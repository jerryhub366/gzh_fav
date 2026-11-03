import { randomBytes } from 'crypto';
import { sql } from '@vercel/postgres';
import { ensureLab } from '../cards';
import { researchMarkdown } from '../llm';
import { ToolDef } from './registry';
import { skillHash, toolInput, toolInstructions } from './prompt';

// 一次工具运行 = 一行 lab_runs。POST 建行后在 after() 里跑模型，页面轮询这一行。
// 手机锁屏、切走都不影响，回来还在；运行超过 STALE_MS 还没结束就当失败（函数被杀了）。

export type RunStatus = 'running' | 'done' | 'error';

export interface Run {
  id: string;
  ownerId: string;
  tool: string;
  company: string;
  extra: string;
  status: RunStatus;
  output: string;
  sources: { title: string; url: string }[];
  error: string;
  modelId: string;
  skillHash: string;
  searches: number;
  createdAt: string;
  finishedAt: string | null;
}

// 时间列用 TIMESTAMPTZ：不带时区的 TIMESTAMP 在本机（东八区）会被当成本地时间，差 8 小时。
const STALE_MS = 330 * 1000;
const MAX_PER_OWNER = Number(process.env.LAB_DAILY_TOOL_RUNS_PER_OWNER || 15);
const MAX_TOTAL = Number(process.env.LAB_DAILY_TOOL_RUNS_TOTAL || 80);

let pending: Promise<void> | null = null;

async function migrate() {
  await ensureLab();
  await sql`
    CREATE TABLE IF NOT EXISTS lab_runs (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      company TEXT NOT NULL,
      extra TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'running',
      output TEXT NOT NULL DEFAULT '',
      sources JSONB NOT NULL DEFAULT '[]'::jsonb,
      error TEXT NOT NULL DEFAULT '',
      model_id TEXT NOT NULL DEFAULT '',
      skill_hash TEXT NOT NULL DEFAULT '',
      searches INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_lab_runs_owner ON lab_runs (owner_id, created_at DESC)`;
  await sql`ALTER TABLE lab_usage ADD COLUMN IF NOT EXISTS tool_runs INT NOT NULL DEFAULT 0`;
}

function ensureRuns() {
  if (!pending) {
    pending = migrate().catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}

function toDate(value: any) {
  return value ? new Date(value).toISOString() : null;
}

function mapRow(r: any): Run {
  const run: Run = {
    id: r.id,
    ownerId: r.owner_id,
    tool: r.tool,
    company: r.company,
    extra: r.extra,
    status: r.status,
    output: r.output,
    sources: r.sources || [],
    error: r.error,
    modelId: r.model_id,
    skillHash: r.skill_hash,
    searches: r.searches,
    createdAt: toDate(r.created_at),
    finishedAt: toDate(r.finished_at),
  };
  if (run.status === 'running' && Date.now() - new Date(run.createdAt).getTime() > STALE_MS) {
    return { ...run, status: 'error', error: '超时了，再跑一次试试' };
  }
  return run;
}

export async function consumeToolQuota(ownerId: string): Promise<string | null> {
  await ensureRuns();
  const day = new Date().toISOString().slice(0, 10);
  const { rows: totalRows } = await sql`SELECT COALESCE(SUM(tool_runs), 0) AS total FROM lab_usage WHERE day = ${day}`;
  if (Number(totalRows[0].total) >= MAX_TOTAL) return '今天全站的研究额度用完了，明天再来';
  const { rows } = await sql`
    INSERT INTO lab_usage (owner_id, day, tool_runs) VALUES (${ownerId}, ${day}, 1)
    ON CONFLICT (owner_id, day) DO UPDATE SET tool_runs = lab_usage.tool_runs + 1
    RETURNING tool_runs
  `;
  if (rows[0].tool_runs > MAX_PER_OWNER) return `今天的研究额度（${MAX_PER_OWNER} 次）用完了，明天再来`;
  return null;
}

export async function createRun(ownerId: string, tool: ToolDef, company: string, extra: string): Promise<Run> {
  await ensureRuns();
  const id = randomBytes(6).toString('base64url');
  const { rows } = await sql`
    INSERT INTO lab_runs (id, owner_id, tool, company, extra, skill_hash)
    VALUES (${id}, ${ownerId}, ${tool.slug}, ${company}, ${extra}, ${skillHash(tool)})
    RETURNING *
  `;
  return mapRow(rows[0]);
}

export async function executeRun(run: Run, tool: ToolDef) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  try {
    const result = await researchMarkdown(
      toolInstructions(tool, today),
      toolInput(tool, run.company, run.extra),
      tool.maxOutputTokens,
      (STALE_MS - 40 * 1000) / 2,
    );
    await sql`
      UPDATE lab_runs SET status = 'done', output = ${result.text}, sources = ${JSON.stringify(result.sources)}::jsonb,
        model_id = ${result.modelId}, searches = ${result.searches}, finished_at = NOW()
      WHERE id = ${run.id}
    `;
  } catch (err: any) {
    await sql`UPDATE lab_runs SET status = 'error', error = ${err?.message || '生成失败'}, finished_at = NOW() WHERE id = ${run.id}`;
  }
}

export async function getRun(id: string): Promise<Run | null> {
  await ensureRuns();
  const { rows } = await sql`SELECT * FROM lab_runs WHERE id = ${id}`;
  return rows[0] ? mapRow(rows[0]) : null;
}

// 列表不带正文
export async function listRuns(ownerId: string, tool?: string) {
  await ensureRuns();
  const { rows } = tool
    ? await sql`SELECT id, owner_id, tool, company, extra, status, '' AS output, '[]'::jsonb AS sources, error, model_id, skill_hash, searches, created_at, finished_at
        FROM lab_runs WHERE owner_id = ${ownerId} AND tool = ${tool} ORDER BY created_at DESC LIMIT 50`
    : await sql`SELECT id, owner_id, tool, company, extra, status, '' AS output, '[]'::jsonb AS sources, error, model_id, skill_hash, searches, created_at, finished_at
        FROM lab_runs WHERE owner_id = ${ownerId} ORDER BY created_at DESC LIMIT 50`;
  return rows.map(mapRow);
}

export async function deleteRun(id: string) {
  await ensureRuns();
  await sql`DELETE FROM lab_runs WHERE id = ${id}`;
}
