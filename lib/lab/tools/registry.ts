// 网页版 skill 工具：每个工具 = 一份 skill 原文 + 网页版约束 + 输入框。
// 加工具：在 scripts/sync-skills.mjs 的 SKILLS 里加名字、跑 npm run sync-skills，再在这里加一条。

export interface ToolDef {
  slug: string;
  skill: string;
  name: string;
  // 卡片上的一行，什么时候用
  short: string;
  when: string;
  // 网页版的篇幅约束，压过 skill 原文里的长度要求
  length: string;
  maxOutputTokens: number;
  // 预计耗时（秒），只用来给进度条
  eta: number;
  extra?: { label: string; placeholder: string };
  examples: string[];
}

export const TOOLS: ToolDef[] = [
  {
    slug: 'cash-story',
    skill: 'cash-story',
    name: '现金故事',
    short: '钱从哪来、到哪去',
    when: '翻到一家陌生公司，先用现金视角过一遍：在积累现金还是在烧钱，值不值得细看。',
    length: '600–900 字',
    maxOutputTokens: 5000,
    eta: 70,
    examples: ['快手', '福耀玻璃', 'Cloudflare'],
  },
  {
    slug: 'risk',
    skill: 'risk',
    name: '致命风险',
    short: '看多者忽略的 3 条风险',
    when: '已经有点想买了，花一分钟看看三条多数看多者没注意到的风险，每条都要有硬数据。',
    length: '每条不超过 200 字，全文不超过 900 字',
    maxOutputTokens: 5000,
    eta: 70,
    extra: { label: '你的看多理由（可选）', placeholder: '写了的话会逐条拆你的理由，比如：股息率 5%、电商还在增长' },
    examples: ['英伟达', '泡泡玛特', '拼多多'],
  },
  {
    slug: 'bear-case',
    skill: 'bear-case-research',
    name: '反方备忘录',
    short: '最强的反对意见',
    when: '偏向看多、准备下手前，让一个挑剔的反方研究员写完整备忘录：市场在担心什么、估值会怎么杀、什么证据能证明反方错了。',
    length: '全文不超过 2500 字',
    maxOutputTokens: 9000,
    eta: 150,
    extra: { label: '你的看多理由（可选）', placeholder: '写了的话会针对你的理由反驳' },
    examples: ['腾讯控股', '美团', 'Costco'],
  },
  {
    slug: 'company-story',
    skill: 'company-story',
    name: '公司故事',
    short: '创始人和关键抉择',
    when: '想知道这是一家什么样的公司：创始人是谁、哪几个决定把它塑造成今天的样子、用户真实感受如何。',
    length: '全文不超过 3000 字',
    maxOutputTokens: 10000,
    eta: 170,
    examples: ['拼多多', '海天味业', 'Nvidia'],
  },
  {
    slug: 'buyside',
    skill: 'buyside-research',
    name: '买方报告',
    short: '生意本质、护城河、估值',
    when: '决定深挖一家公司时：生意本质、商业模式和护城河、估值推演，给出明确判断。',
    length: '全文不超过 3000 字',
    maxOutputTokens: 10000,
    eta: 170,
    examples: ['新奥能源', 'Broadcom', '贵州茅台'],
  },
];

export function toolBySlug(slug: string) {
  return TOOLS.find((t) => t.slug === slug) || null;
}
