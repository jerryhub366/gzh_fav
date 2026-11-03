import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Invest Lab · 观点练习场',
  description: '先自己答，再被挑战，写下证伪条件，到期复盘。',
};

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="zh-CN" className="min-h-screen">
      <header className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between text-sm">
        <a href="/lab" className="font-semibold text-gray-900 dark:text-white">Invest Lab</a>
        <nav className="flex gap-4 text-gray-500">
          <a href="/lab" className="hover:text-gray-800 dark:hover:text-gray-200">观点卡</a>
          <a href="/lab/principles" className="hover:text-gray-800 dark:hover:text-gray-200">原则</a>
        </nav>
      </header>
      {children}
      <footer className="max-w-3xl mx-auto px-4 sm:px-6 py-10 text-xs text-gray-400 leading-relaxed">
        本工具用于思维训练和观点记录，不构成投资建议；任何结论都需以公司财报、公告等一级来源为准，价格判断需另行研究。
      </footer>
    </div>
  );
}
