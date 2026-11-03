import { sql } from '@vercel/postgres';
import { createHash, randomBytes } from 'crypto';
import { CURRENT_PRINCIPLE_VERSION, CardKind, DEFAULT_REVIEW_DAYS } from './principles';

// 一张卡 = 一个观点的完整生命周期：draft → challenged → open（等复盘）→ resolved。
// 迭代期字段变化快，除了要筛选/排序的列，其余都放 data jsonb，避免反复迁移。

export type CardStatus = 'draft' | 'challenged' | 'open' | 'resolved';

export interface Challenge {
  persona: string;
  text: string;
  ref: string;
  source: 'model' | 'rule';
  reply?: string;
  rejected?: boolean;
}

export interface FriendTake {
  name: string;
  stance: 'agree' | 'disagree' | 'unsure';
  probability: number | null;
  reason: string;
  createdAt: string;
}

export interface CardData {
  impulseSource: string[];
  impulseNote: string;
  draftAnswers: Record<string, string>;
  initialProbability: number | null;
  challenges: Challenge[];
  challengeMeta?: { modelId: string | null; fallback: boolean; error?: string; weakest?: string[] };
  finalProbability: number | null;
  keyAssumption: string;
  falsifiers: string;
  nextChecks: string;
  outcome?: 'right' | 'wrong' | 'partial' | 'unclear';
  lesson?: string;
  friends: FriendTake[];
}

export interface Card {
  id: string;
  ownerId: string | null;
  company: string;
  claim: string;
  kind: CardKind;
  status: CardStatus;
  principleVersion: string;
  reviewDate: string | null;
  shareKey: string;
  data: CardData;
  createdAt: string;
  updatedAt: string;
  committedAt: string | null;
  resolvedAt: string | null;
}

const EMPTY_DATA: CardData = {
  impulseSource: [],
  impulseNote: '',
  draftAnswers: {},
  initialProbability: null,
  challenges: [],
  finalProbability: null,
  keyAssumption: '',
  falsifiers: '',
  nextChecks: '',
  friends: [],
};

let pending: Promise<void> | null = null;

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS lab_cards (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      claim TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      principle_version TEXT NOT NULL,
      review_date DATE,
      share_key TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      committed_at TIMESTAMP,
      resolved_at TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_lab_cards_created ON lab_cards (created_at DESC)`;
  // 2026-11-03：去掉 admin 限制，改为每个浏览器一个匿名身份，各看各的卡。
  await sql`ALTER TABLE lab_cards ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_lab_cards_owner ON lab_cards (owner_id, created_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS lab_usage (
      owner_id TEXT NOT NULL,
      day DATE NOT NULL,
      challenges INT NOT NULL DEFAULT 0,
      PRIMARY KEY (owner_id, day)
    )
  `;
}

export function ensureLab() {
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

function mapRow(r: any): Card {
  return {
    id: r.id,
    ownerId: r.owner_id || null,
    company: r.company,
    claim: r.claim,
    kind: r.kind,
    status: r.status,
    principleVersion: r.principle_version,
    // review_date 以文本取出：pg 把 DATE 解析成本地零点，转 ISO 会在东八区倒退一天。
    reviewDate: r.review_date_text || null,
    shareKey: r.share_key,
    data: { ...EMPTY_DATA, ...(r.data || {}) },
    createdAt: toDate(r.created_at),
    updatedAt: toDate(r.updated_at),
    committedAt: toDate(r.committed_at),
    resolvedAt: toDate(r.resolved_at),
  };
}

export async function listCards(ownerId: string): Promise<Card[]> {
  await ensureLab();
  const { rows } = await sql`
    SELECT *, review_date::text AS review_date_text FROM lab_cards
    WHERE owner_id = ${ownerId} ORDER BY created_at DESC LIMIT 500
  `;
  return rows.map(mapRow);
}

export async function getCard(id: string): Promise<Card | null> {
  await ensureLab();
  const { rows } = await sql`SELECT *, review_date::text AS review_date_text FROM lab_cards WHERE id = ${id}`;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function createCard(ownerId: string, input: {
  company: string;
  claim: string;
  kind: CardKind;
  impulseSource?: string[];
  impulseNote?: string;
}): Promise<Card> {
  await ensureLab();
  const id = createHash('md5')
    .update(input.claim + Date.now().toString() + Math.random())
    .digest('hex')
    .substring(0, 8);
  const shareKey = randomBytes(9).toString('base64url');
  const data: CardData = {
    ...EMPTY_DATA,
    impulseSource: input.impulseSource || [],
    impulseNote: input.impulseNote || '',
  };
  const review = new Date(Date.now() + DEFAULT_REVIEW_DAYS[input.kind] * 86400000).toISOString().slice(0, 10);
  await sql`
    INSERT INTO lab_cards (id, owner_id, company, claim, kind, principle_version, review_date, share_key, data)
    VALUES (${id}, ${ownerId}, ${input.company}, ${input.claim}, ${input.kind}, ${CURRENT_PRINCIPLE_VERSION},
            ${review}, ${shareKey}, ${JSON.stringify(data)}::jsonb)
  `;
  return getCard(id);
}

export async function saveCard(
  id: string,
  patch: { company?: string; claim?: string; status?: CardStatus; reviewDate?: string | null; data?: Partial<CardData> },
): Promise<Card | null> {
  const card = await getCard(id);
  if (!card) return null;

  const data = { ...card.data, ...(patch.data || {}) };
  const status = patch.status || card.status;
  const committedAt = status === 'open' && !card.committedAt ? new Date().toISOString() : card.committedAt;
  const resolvedAt = status === 'resolved' && !card.resolvedAt ? new Date().toISOString() : card.resolvedAt;
  const reviewDate = patch.reviewDate === undefined ? card.reviewDate : patch.reviewDate;

  await sql`
    UPDATE lab_cards SET
      company = ${patch.company ?? card.company},
      claim = ${patch.claim ?? card.claim},
      status = ${status},
      review_date = ${reviewDate},
      data = ${JSON.stringify(data)}::jsonb,
      updated_at = NOW(),
      committed_at = ${committedAt},
      resolved_at = ${resolvedAt}
    WHERE id = ${id}
  `;
  return getCard(id);
}

export async function deleteCard(id: string) {
  await ensureLab();
  await sql`DELETE FROM lab_cards WHERE id = ${id}`;
}

// 分享页只露出观点本身和朋友的押注，不露出冲动自查和自答草稿。
// 朋友也要先押注再看答案：revealed 之前不给出主人的概率、假设和其他人的押注。
export function publicView(card: Card, revealed: boolean) {
  const base = {
    id: card.id,
    company: card.company,
    claim: card.claim,
    kind: card.kind,
    status: card.status,
    createdAt: card.createdAt,
    friendCount: card.data.friends.length,
  };
  if (!revealed) return base;
  return {
    ...base,
    reviewDate: card.reviewDate,
    finalProbability: card.status === 'draft' ? null : card.data.finalProbability ?? card.data.initialProbability,
    keyAssumption: card.data.keyAssumption,
    falsifiers: card.data.falsifiers,
    outcome: card.data.outcome,
    friends: card.data.friends,
  };
}

// 模型调用额度：每个身份每天 MAX_PER_OWNER 次，全站每天 MAX_TOTAL 次，超了退回规则题库。
const MAX_PER_OWNER = Number(process.env.LAB_DAILY_CHALLENGES_PER_OWNER) || 30;
const MAX_TOTAL = Number(process.env.LAB_DAILY_CHALLENGES_TOTAL) || 300;

export async function consumeChallengeQuota(ownerId: string): Promise<string | null> {
  await ensureLab();
  const day = new Date().toISOString().slice(0, 10);
  const { rows: totalRows } = await sql`SELECT COALESCE(SUM(challenges), 0) AS total FROM lab_usage WHERE day = ${day}`;
  if (Number(totalRows[0].total) >= MAX_TOTAL) return '今日全站模型额度已用完';
  const { rows } = await sql`
    INSERT INTO lab_usage (owner_id, day, challenges) VALUES (${ownerId}, ${day}, 1)
    ON CONFLICT (owner_id, day) DO UPDATE SET challenges = lab_usage.challenges + 1
    RETURNING challenges
  `;
  if (rows[0].challenges > MAX_PER_OWNER) return `今日模型额度（${MAX_PER_OWNER} 次）已用完`;
  return null;
}
