import { Card, Turn } from './cards';
import { CARD_KINDS, CardKind, DRAFT_QUESTIONS, RULE_CHALLENGES, principlesAsPrompt } from './principles';
import { chatJSON } from './llm';

// 对话式陪练：用户先说一句（或一段）自己的观点，陪练一次只问一个问题，问满三个后把用户原话整理成卡。
// 原则：陪练只提问、只整理，不给结论；整理只能用用户说过的话。每一步一次模型调用，挂了退回规则题。

export const COACH_QUESTIONS = 3;

const NOW = () => new Date().toISOString();

const SYSTEM_PROMPT = `你是价值投资思维训练的“陪练”，像一个犀利但友善的老朋友，不是荐股者。
铁律：
1. 一次只问一个问题，不超过 60 字，口语化，用户一句话就能答。
2. 问题必须建立在用户刚说的原话上，指向用户没想清楚、自相矛盾或回避的地方；不要泛泛而谈，不要复述用户的话。
3. 绝不替用户下结论，不评价对错，不给买卖建议或目标价。
4. 你提到的任何公司事实、数字，句末加“（待核实）”。
5. 每个问题引用一条最相关的原则编号。
6. 分清谁说了什么：陪练自己提过的观点不能说成“你说”。引用用户时只引用标着“用户”的话。
7. 只输出 JSON。`;

const STAGES = [
  '第 1 问【澄清核心】：逼用户把观点里最模糊的那个关键词说具体。买入观点优先问“价格/估值锚是多少、从哪来”；卖出观点问“是生意变差、估值透支，还是涨多了不舒服”；生意判断问“谁付钱、为什么付”。',
  '第 2 问【换视角攻击】：从竞争对手、十年后、单一依赖、涨跌 50% 中挑一个用户最没想过的角度。',
  '第 3 问【逼出证伪条件】：问“出现什么具体信号，你会承认自己错了/改主意？”要结合用户前面的回答，让他说出可观察的信号。',
];

function transcript(turns: Turn[]) {
  return turns.map((t) => `${t.role === 'me' ? '用户' : `陪练（${t.persona || ''}）`}：${t.text}`).join('\n');
}

function guessKind(text: string): CardKind {
  if (/抛|卖|减仓|太贵|止盈|清仓|高估/.test(text)) return 'sell';
  if (/买|入|建仓|加仓|跌到|便宜|低估|股息率|抄底|多少能/.test(text)) return 'buy';
  return 'quality';
}

function guessCompany(text: string) {
  const cleaned = text.replace(/^(最近|我觉得|感觉|听说|朋友说|群里说|今天)+/, '').trim();
  const latin = cleaned.match(/^[A-Za-z][A-Za-z0-9.&\- ]{0,20}/);
  if (latin) return latin[0].trim();
  const han = cleaned.match(/^[一-龥]{2,6}?(?=是|跌|涨|最近|感觉|太|该|能|可以|还|的|这|现在|，|,|\s)/);
  return han ? han[0] : cleaned.slice(0, 4) || '未命名';
}

function ruleQuestion(kind: CardKind, index: number): Omit<Turn, 'at'> {
  if (index === 0) {
    const q = DRAFT_QUESTIONS[kind][0];
    return { role: 'coach', text: q.text, ref: q.ref, persona: '陪练', source: 'rule' };
  }
  if (index === 1) {
    const c = RULE_CHALLENGES[kind][0];
    return { role: 'coach', text: c.text, ref: c.ref, persona: c.persona, source: 'rule' };
  }
  return { role: 'coach', text: '出现什么具体的、看得见的信号，你会承认自己错了？', ref: 'P12', persona: '陪练', source: 'rule' };
}

function validQuestion(q: any) {
  if (!q || typeof q.text !== 'string' || !q.text.trim()) throw new Error('bad question');
  return { persona: String(q.persona || '陪练').slice(0, 10), text: q.text.trim().slice(0, 200), ref: String(q.ref || '').slice(0, 6) };
}

// 开局：从用户的一句话里抽出公司、类型、一句话观点，并问第一个问题。
export async function openChat(text: string) {
  const user = `原则库：
${principlesAsPrompt()}

用户刚说：「${text}」

任务：
1. 识别公司名（用最常用的中文简称，美股可用英文）。
2. 判断类型：quality=判断生意好不好；buy=什么价能买/要不要买；sell=该不该卖/是不是太贵。
3. 把用户的观点压成一句不超过 30 字的话，尽量保留用户原词，不要加入用户没说的判断。
4. ${STAGES[0]}

输出：{"company":"快手","kind":"buy","claim":"...","question":{"persona":"陪练","text":"...","ref":"P18"}}`;
  try {
    const { data, modelId } = await chatJSON(SYSTEM_PROMPT, user, (d) => ({
      company: String(d.company || '').trim().slice(0, 40) || guessCompany(text),
      kind: (CARD_KINDS.some((k) => k.key === d.kind) ? d.kind : guessKind(text)) as CardKind,
      claim: String(d.claim || '').trim().slice(0, 120) || text.slice(0, 120),
      question: validQuestion(d.question),
    }));
    return { ...data, question: { role: 'coach' as const, ...data.question, source: 'model' as const, at: NOW() }, modelId };
  } catch (err: any) {
    const kind = guessKind(text);
    return {
      company: guessCompany(text),
      kind,
      claim: text.slice(0, 120),
      question: { ...ruleQuestion(kind, 0), at: NOW() },
      modelId: null,
      error: err.message as string,
    };
  }
}

export function coachQuestionCount(card: Card) {
  return (card.data.turns || []).filter((t) => t.role === 'coach').length;
}

// 下一步：问满三个问题（或用户喊停）就整理，否则问下一个。
export async function nextStep(card: Card, opts: { finish: boolean; quotaError: string | null }) {
  const turns = card.data.turns || [];
  const asked = coachQuestionCount(card);
  if (opts.finish || asked >= COACH_QUESTIONS) return { kind: 'summary' as const, ...(await summarize(card, opts.quotaError)) };

  if (opts.quotaError) return { kind: 'question' as const, turn: { ...ruleQuestion(card.kind, asked), at: NOW() } };
  const user = `原则库：
${principlesAsPrompt(card.principleVersion)}

公司：${card.company}；观点：${card.claim}
目前的对话：
${transcript(turns)}

${STAGES[Math.min(asked, STAGES.length - 1)]}
不要重复已经问过的问题。如果用户上一句是“没想过/说不清/不知道”，这是一个值得记下的盲区：不要追着同一点逼问，用一个更具体、更容易回答的问法推进到本阶段的问题。用户说“换个问法”，就针对上一个问题换一个角度重新问。

输出：{"question":{"persona":"空头|竞争对手|十年后的你|芒格|陪练","text":"...","ref":"P10"}}`;
  try {
    const { data } = await chatJSON(SYSTEM_PROMPT, user, (d) => validQuestion(d.question));
    return { kind: 'question' as const, turn: { role: 'coach' as const, ...data, source: 'model' as const, at: NOW() } };
  } catch {
    return { kind: 'question' as const, turn: { ...ruleQuestion(card.kind, asked), at: NOW() } };
  }
}

async function summarize(card: Card, quotaError: string | null) {
  const empty = { keyAssumption: '', falsifiers: '', nextChecks: '', claim: card.claim, weakest: [] as string[] };
  if (quotaError) return { ...empty, modelId: null, fallback: true };
  const user = `公司：${card.company}；观点：${card.claim}
对话：
${transcript(card.data.turns || [])}

把用户自己的想法整理成一张观点卡。只能用用户说过的内容，可以压缩改写，但不能加入用户没表达的判断；用户没说到的项写空字符串。
- claim：用户最终的观点 + 他给出的最主要理由，一句话，≤40 字（例如“福耀是好生意：安全件换供应商成本高”），不要照抄开头那句口语
- keyAssumption：这个观点成立最依赖的那个假设，写成一个将来能验证真假的判断句，≤40 字
- falsifiers：用户说过的、会让他改主意的信号，≤60 字
- nextChecks：根据对话里用户不确定的地方，列 1–3 件具体可查的事（财报哪部分、什么数据），用“；”分隔
- weakest：必须给 1–2 条。用户思考里最薄弱的地方，每条 ≤25 字：用户答“没想过/说不清”的点、只有感觉没有依据的点、前后矛盾的点（这是给用户的反馈，可以是你的观察）

输出：{"claim":"...","keyAssumption":"...","falsifiers":"...","nextChecks":"...","weakest":["..."]}`;
  try {
    const { data, modelId } = await chatJSON(
      '你是价值投资思维训练的整理员。只整理用户的原话，不下结论、不给买卖建议。只输出 JSON。',
      user,
      (d) => ({
        claim: String(d.claim || card.claim).slice(0, 120),
        keyAssumption: String(d.keyAssumption || '').slice(0, 200),
        falsifiers: String(d.falsifiers || '').slice(0, 300),
        nextChecks: String(d.nextChecks || '').slice(0, 300),
        weakest: Array.isArray(d.weakest) ? d.weakest.map(String).slice(0, 2) : [],
      }),
    );
    return { ...data, modelId, fallback: false };
  } catch {
    return { ...empty, modelId: null, fallback: true };
  }
}
