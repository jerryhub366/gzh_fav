'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 模型输出只当 Markdown 渲染，不放行原始 HTML（react-markdown 默认就不解析 HTML）。
export default function Markdown({ text }: { text: string }) {
  return (
    <div className="lab-md text-gray-800 dark:text-gray-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>
          ),
          table: ({ children }) => (
            <div className="lab-md-table"><table>{children}</table></div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
