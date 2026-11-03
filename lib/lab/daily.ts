// 今日一问：没有现成观点的日子，按日期轮换一道题，直接从陪练的问题开始。
export const DAILY_QUESTIONS: { company: string; text: string; ref: string }[] = [
  { company: '泡泡玛特', text: '泡泡玛特的稀缺属于哪一种？如果稀缺消失了，它还剩什么？', ref: 'P14' },
  { company: '英伟达', text: '如果英伟达五年不推出新一代产品，会发生什么？', ref: 'P8' },
  { company: '爱马仕', text: '如果爱马仕明天开始打折，它会失去什么？', ref: 'P14' },
  { company: '拼多多', text: '拼多多的便宜，是“低价”还是“低价能力”？别人能学走吗？', ref: 'P15' },
  { company: '腾讯', text: '换一个普通管理层来管微信，它会变差吗？会怎么变差？', ref: 'P7' },
  { company: '宁德时代', text: '车企会用什么办法压宁德时代的价？它挡得住吗？', ref: 'P16' },
  { company: '可口可乐', text: '可口可乐推错口味能撤回。什么样的失误是它撤不回的？', ref: 'P9' },
  { company: '苹果', text: '苹果要继续这样赚钱，需要押对几个外部变量？分别是什么？', ref: 'P11' },
  { company: '诺和诺德', text: '诺和诺德的核心专利到期后，它还剩什么护城河？', ref: 'P13' },
  { company: 'Meta', text: '广告主业很简单，那是什么让 Meta 整体变得不简单？', ref: 'P17' },
  { company: '美团', text: '美团外卖涨价，用户和商家谁会先跑？它的定价权来自哪里？', ref: 'P5' },
  { company: '贵州茅台', text: '茅台的利润能不能都变成现金？有什么东西可能吃掉它？', ref: 'P6' },
  { company: '阿里巴巴', text: '用一句话说清阿里巴巴怎么赚钱。说得清吗？卡在哪？', ref: 'P3' },
  { company: '快手', text: '快手和抖音的竞争，是慢变量还是快变量？为什么？', ref: 'P10' },
];

export function dailyQuestion(date = new Date()) {
  const day = Math.floor((date.getTime() + 8 * 3600000) / 86400000);
  const index = day % DAILY_QUESTIONS.length;
  return { index, ...DAILY_QUESTIONS[index] };
}
