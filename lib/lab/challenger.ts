import { Card, Challenge } from './cards';
import { CARD_KINDS, DRAFT_QUESTIONS, RULE_CHALLENGES, principlesAsPrompt } from './principles';

// 挑战者：一次模型调用，三个角色各提一个挑战。模型挂了就退回规则题库，流程不中断。
// 密钥只从服务端环境变量读；返回给前端的错误不带上游细节。

const BASE_URL = process.env.LAB_LLM_BASE_URL || 'https://api.cloudalpha.top/v1';
// 别配 gpt-5.4：cloudalpha 中转会收下请求但静默换成别的模型。
const MODELS = [process.env.LAB_LLM_MODEL || 'gpt-5.5', process.env.LAB_LLM_FALLBACK_MODEL || 'gpt-5.4-mini'];
const TIMEOUT_MS = 60000;

function apiKey() {
  return process.env.CLOUDALPHA_API_KEY || process.env.OPENAI_API_KEY || '';
}

const SYSTEM_PROMPT = `你是一名价值投资思维训练的“挑战者”，不是荐股者。
规则：
1. 只能基于用户写下的原话提挑战，找漏洞、矛盾、没考虑的变量；不得替用户下买入/卖出结论，不得给目标价。
2. 你提到的任何公司事实、数字都要在句末标注“（待核实）”，提醒用户以财报、公告为准。
3. 每个挑战必须引用一条原则编号（如 P11）。
4. 挑战要具体、尖锐、可回答，一个挑战只问一件事，中文，不超过 80 字。
5. 只输出 JSON，不要任何解释。`;

function buildUserPrompt(card: Card) {
  const kind = CARD_KINDS.find((k) => k.key === card.kind);
  const answers = DRAFT_QUESTIONS[card.kind]
    .map((q) => `- ${q.text}\n  用户答：${card.data.draftAnswers[q.key]?.trim() || '（未答）'}`)
    .join('\n');
  return `原则库（${card.principleVersion}）：
${principlesAsPrompt(card.principleVersion)}

用户的观点卡：
- 公司：${card.company}
- 观点：${card.claim}
- 类型：${kind?.label}
- 冲动来源：${card.data.impulseSource.join('、') || '未填'}；${card.data.impulseNote || ''}
- 用户自评“这个判断是对的”概率：${card.data.initialProbability ?? '未填'}%
用户先自己写下的答案：
${answers}

请以三个角色各提一个挑战：
1. "空头"：最想证明用户错的卖方/空头分析师
2. "竞争对手"：这家公司最难缠的竞争对手 CEO
3. "芒格"：只关心简单、可预测、看最差那一项

另外指出用户答案里最薄弱的 2–3 个环节（每条不超过 30 字）。

输出格式：
{"challenges":[{"persona":"空头","text":"...","ref":"P11"},{"persona":"竞争对手","text":"...","ref":"P10"},{"persona":"芒格","text":"...","ref":"P12"}],"weakest":["...","..."]}`;
}

function parseJson(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no json');
  return JSON.parse(text.slice(start, end + 1));
}

async function callModel(model: string, card: Card) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey()}` },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(card) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const parsed = parseJson(json.choices?.[0]?.message?.content || '');
    const challenges: Challenge[] = (parsed.challenges || [])
      .filter((c: any) => c && typeof c.text === 'string' && c.text.trim())
      .slice(0, 5)
      .map((c: any) => ({
        persona: String(c.persona || '挑战者'),
        text: c.text.trim(),
        ref: String(c.ref || ''),
        source: 'model' as const,
      }));
    if (challenges.length === 0) throw new Error('empty challenges');
    const weakest = Array.isArray(parsed.weakest) ? parsed.weakest.map(String).slice(0, 3) : [];
    return { challenges, weakest, modelId: (json.model as string) || model };
  } finally {
    clearTimeout(timer);
  }
}

export async function generateChallenges(card: Card) {
  const ruleChallenges: Challenge[] = RULE_CHALLENGES[card.kind].map((c) => ({ ...c, source: 'rule' }));

  if (!apiKey()) {
    return { challenges: ruleChallenges, meta: { modelId: null, fallback: true, error: '未配置模型密钥' } };
  }

  let lastError = '';
  for (const model of MODELS) {
    try {
      const result = await callModel(model, card);
      return {
        challenges: result.challenges,
        meta: { modelId: result.modelId, fallback: false, weakest: result.weakest },
      };
    } catch (err: any) {
      lastError = err?.name === 'AbortError' ? '超时' : err?.message || 'unknown';
      console.error(`lab challenger ${model} failed:`, lastError);
    }
  }
  return { challenges: ruleChallenges, meta: { modelId: null, fallback: true, error: '模型暂不可用' } };
}
