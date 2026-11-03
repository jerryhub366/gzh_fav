import { CURRENT_PRINCIPLE_VERSION, PRINCIPLE_LAYERS, getPrinciples } from '../../../lib/lab/principles';

export const metadata = { title: '原则 · Invest Lab' };

const EXAMPLES = [
  ['可口可乐', '好懂、简单、可预测，基本全绿；参照物。'],
  ['苹果', '好懂、经济学相对简单，可预测偏黄（创新周期、监管）。'],
  ['爱马仕', '手工瓶颈 + 主动限产 + 不打折，可预测最高一档。'],
  ['Meta', '广告主业很简单，但被大赌注（Reality Labs、AI 资本开支）拖成黄灯。'],
  ['腾讯', '核心社交很强，但多业务加政策，整体偏黄。'],
  ['阿里巴巴', '核心电商好懂，但集团拼盘 + 云的 AI 资本开支，整体偏黄。'],
  ['拼多多', '平台模式好懂，但价格战 + Temu 跨境变量多，可预测性低。'],
  ['诺和诺德', '疾病需求真实，但专利有倒计时，属于“管线赌注”，偏黄到红之间。'],
  ['泡泡玛特', '好懂，但可预测是红灯，IP 潮流周期太难押。'],
  ['英伟达', '现在赚钱很简单，但可预测也是红灯，技术周期和大客户自研都是快变量。'],
  ['宁德时代', '产品好懂，但 B2B 议价、产能过剩、技术路线、地缘变量多，可预测偏低。'],
];

export default function PrinciplesPage() {
  const principles = getPrinciples();
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-3xl font-bold mb-2">原则 {CURRENT_PRINCIPLE_VERSION}</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-2">
        <b>“好懂、简单、可预测”是三件事，不能互相代替。</b>好懂：现在能讲清它怎么赚钱；简单：赚钱环节少、变量少；可预测：十年后大概率还是这么赚钱。
      </p>
      <p className="text-sm text-gray-500 mb-6">源自 2026-11-03 读《芒格之道》的讨论。观点卡里的追问和挑战都引用这里的编号。</p>

      <nav className="flex flex-wrap gap-2 mb-8 text-sm">
        {PRINCIPLE_LAYERS.map((l) => (
          <a key={l.key} href={`#${l.key}`} className="px-2.5 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
            {l.label.split('：')[0].replace('（练习用，不是估值模型）', '')}
          </a>
        ))}
        <a href="#examples" className="px-2.5 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">对照表</a>
      </nav>

      {PRINCIPLE_LAYERS.map((layer) => (
        <section key={layer.key} id={layer.key} className="mb-8 scroll-mt-6">
          <h2 className="text-lg font-semibold mb-3">{layer.label}</h2>
          <div className="space-y-3">
            {principles.filter((p) => p.layer === layer.key).map((p) => (
              <div key={p.id} id={p.id} className="flex gap-3 scroll-mt-6">
                <span className="shrink-0 w-10 text-sm font-mono text-gray-400 pt-0.5">{p.id}</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{p.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{p.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section id="examples" className="mb-8 scroll-mt-6">
        <h2 className="text-lg font-semibold mb-1">对照表示例</h2>
        <p className="text-xs text-gray-500 mb-3">仅为讨论示例：按“简单标准”的相对判断，不是质量排名，更不是买卖建议。</p>
        <div className="divide-y divide-gray-200 dark:divide-gray-700 border-y border-gray-200 dark:border-gray-700">
          {EXAMPLES.map(([name, text]) => (
            <div key={name} className="flex gap-3 py-2 text-sm">
              <span className="shrink-0 w-20 font-medium">{name}</span>
              <span className="text-gray-600 dark:text-gray-300">{text}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
