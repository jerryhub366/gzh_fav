// 原则库：Playground 的追问和挑战都要引用这里的编号。
// 修订时新增一个版本并改 CURRENT_PRINCIPLE_VERSION，旧卡片仍指向它当时的版本。

export interface Principle {
  id: string;
  layer: string;
  title: string;
  detail: string;
}

export const CURRENT_PRINCIPLE_VERSION = 'v1.0';

export const PRINCIPLE_LAYERS = [
  { key: 'understand', label: '第一层：好懂吗？' },
  { key: 'simple', label: '第二层：经济学简单吗？' },
  { key: 'predict', label: '第三层：可预测吗？（最硬的一层）' },
  { key: 'extra', label: '补充原则' },
  { key: 'price', label: '价格与持有（练习用，不是估值模型）' },
];

const V1_0: Principle[] = [
  { id: 'P1', layer: 'understand', title: '一句话讲清怎么赚钱', detail: '谁付钱、为什么付钱、钱付给谁？讲不清就还没懂。' },
  { id: 'P2', layer: 'understand', title: '不需要先讲技术路线', detail: '要先讲一堆专业术语才能说明白的生意，好懂度打折。' },
  { id: 'P3', layer: 'understand', title: '一个主业还是业务拼盘', detail: '要拆五六个业务才能讲明白，说明它不简单。' },
  { id: 'P4', layer: 'simple', title: '需求性质', detail: '必需、高频、小额，还是可选、低频、大额？需求真实性梯度：医疗刚需 > 日常必需 > 富人身份 > 可选潮流 > 周期性资本品。' },
  { id: 'P5', layer: 'simple', title: '定价权来源', detail: '来自品牌、习惯、网络、规模，还是来自不断降价、补贴、讲新故事？涨价客户会跑吗？' },
  { id: 'P6', layer: 'simple', title: '利润能变成现金', detail: '利润会不会被库存、设备、应收、大额资本开支吃掉？' },
  { id: 'P7', layer: 'simple', title: '傻瓜测试', detail: '换个普通管理层会不会垮？是否高度依赖某个天才或创始人的品味？' },
  { id: 'P8', layer: 'predict', title: '创新是点缀还是生死', detail: '核心产品十年后变不变？五年不创新会死吗？' },
  { id: 'P9', layer: 'predict', title: '失败能不能撤回', detail: '可口可乐推错口味可以撤；一代产品失误、一个 IP 过气，修复就贵得多。' },
  { id: 'P10', layer: 'predict', title: '竞争是慢变量还是快变量', detail: '对手基本固定、打法几十年不变，还是要同时打技术、地缘、法规、潮流好几场仗？' },
  { id: 'P11', layer: 'predict', title: '要押对几个外部变量', detail: '政策、技术路线、单一 IP、单一大客户、单一产品，依赖项越多，栏杆越高。' },
  { id: 'P12', layer: 'predict', title: '看最差的那一项', detail: '不要打平均分。可预测这一层是红灯，前面再好懂、现在再赚钱，也不算芒格式的简单。' },
  { id: 'P13', layer: 'extra', title: '护城河衰减四分法', detail: '品牌/习惯衰减慢、无到期日；平台网络需要持续效率和补贴；专利有倒计时，要靠新产品续命；制造规模会被技术路线、产能过剩和客户分流侵蚀。' },
  { id: 'P14', layer: 'extra', title: '稀缺三分法', detail: '可控稀缺、专利/产能稀缺、炒作稀缺。稀缺是谁控制的？能维持多久？稀缺消失后还剩什么？' },
  { id: 'P15', layer: 'extra', title: '低价能力才是护城河', detail: '低价本身不是护城河，低价能力才是，而且低价能力会被模仿。' },
  { id: 'P16', layer: 'extra', title: 'B2C 与 B2B 定价权不同', detail: 'B2C 靠习惯、身份和转换成本；B2B 客户集中且专业，会主动培养第二供应商压价，“行业第一”不等于“有定价权”。' },
  { id: 'P17', layer: 'extra', title: '增长会破坏简单', detail: '拒绝增长有时就是护城河；集团多业务也会把主业的简单变复杂。' },
  { id: 'P18', layer: 'price', title: '价格判断要写出锚', detail: '“跌到多少能买”必须写出你心里的价格或估值锚，以及这个锚来自哪里（历史区间、现金流倍数、对标公司）。' },
  { id: 'P19', layer: 'price', title: '涨跌 50% 测试', detail: '涨或跌 50% 后，你的逻辑还成立吗？逻辑没变而只想追涨杀跌，说明在交易情绪。' },
  { id: 'P20', layer: 'price', title: '卖出要先写卖出理由', detail: '“太贵该抛”要区分：是生意变差了、估值透支了，还是只是涨多了不舒服？' },
];

const VERSIONS: Record<string, Principle[]> = { 'v1.0': V1_0 };

export function getPrinciples(version = CURRENT_PRINCIPLE_VERSION): Principle[] {
  return VERSIONS[version] || V1_0;
}

export function principleById(id: string, version = CURRENT_PRINCIPLE_VERSION) {
  return getPrinciples(version).find((p) => p.id === id);
}

export function principlesAsPrompt(version = CURRENT_PRINCIPLE_VERSION) {
  return getPrinciples(version)
    .map((p) => `${p.id} ${p.title}：${p.detail}`)
    .join('\n');
}

// 卡片类型决定先自己答的题目，以及模型不可用时的规则挑战。
export const CARD_KINDS = [
  { key: 'quality', label: '生意好不好', example: '最近福耀玻璃感觉很不错' },
  { key: 'buy', label: '什么价能买', example: '快手跌到什么程度可以买' },
  { key: 'sell', label: '该不该卖', example: '英伟达是不是太贵了该抛了' },
] as const;

export type CardKind = (typeof CARD_KINDS)[number]['key'];

export const IMPULSE_SOURCES = ['看到新闻', '价格大涨/大跌', '朋友/群里在聊', '自己研究后', '财报/公告', '说不清'];

export const DRAFT_QUESTIONS: Record<CardKind, { key: string; text: string; ref: string }[]> = {
  quality: [
    { key: 'model', text: '一句话：谁付钱、为什么付、付给谁？', ref: 'P1' },
    { key: 'moat', text: '它的护城河是哪一种？会怎么衰减？', ref: 'P13' },
    { key: 'weakest', text: '按“看最差的那一项”，它最弱的是哪一点？', ref: 'P12' },
  ],
  buy: [
    { key: 'anchor', text: '你心里的买入价/估值锚是多少？锚从哪来？', ref: 'P18' },
    { key: 'model', text: '跌下来之后，它赚钱的方式变了吗？', ref: 'P1' },
    { key: 'test50', text: '如果买完再跌 50%，你的逻辑还成立吗？', ref: 'P19' },
  ],
  sell: [
    { key: 'reason', text: '想卖是因为生意变差、估值透支，还是只是涨多了不舒服？', ref: 'P20' },
    { key: 'anchor', text: '“太贵”的锚是什么？和什么比？', ref: 'P18' },
    { key: 'regret', text: '卖完再涨 50%，你会怎么想？逻辑还成立吗？', ref: 'P19' },
  ],
};

export const RULE_CHALLENGES: Record<CardKind, { persona: string; text: string; ref: string }[]> = {
  quality: [
    { persona: '竞争对手', text: '如果我是它的竞争对手，手里有足够的钱，我会从哪里打它？它挡得住吗？', ref: 'P10' },
    { persona: '十年后的你', text: '十年后它的核心产品还长这样吗？五年不创新会怎样？', ref: 'P8' },
    { persona: '空头', text: '它最大的单一依赖是什么？这个依赖消失后还剩什么？', ref: 'P11' },
  ],
  buy: [
    { persona: '空头', text: '价格跌了，是市场错了，还是市场看到了你没看到的东西？列出至少一条市场可能对的理由。', ref: 'P19' },
    { persona: '十年后的你', text: '如果五年后回看，什么情况会让这次买入成为错误？', ref: 'P8' },
    { persona: '芒格', text: '去掉价格因素，你愿意按现在的理解持有它十年吗？为什么？', ref: 'P12' },
  ],
  sell: [
    { persona: '多头', text: '如果生意本身没变差，卖出是不是在用短期估值惩罚长期复利？', ref: 'P20' },
    { persona: '竞争对手', text: '真正会让它变差的竞争或技术变量是什么？现在出现了吗？', ref: 'P10' },
    { persona: '芒格', text: '卖出后的钱要放到哪里？那个替代选项比它更简单、更可预测吗？', ref: 'P12' },
  ],
};

export const DEFAULT_REVIEW_DAYS: Record<CardKind, number> = { quality: 180, buy: 90, sell: 90 };
