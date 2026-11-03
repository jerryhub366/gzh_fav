'use client';

import { useEffect, useState } from 'react';
import type { Run } from '../../../lib/lab/tools/runs';
import { TOOLS } from '../../../lib/lab/tools/registry';
import { RunRow } from './RunRow';

export default function ToolsIndex() {
  const [runs, setRuns] = useState<Run[] | null>(null);

  useEffect(() => {
    fetch('/api/lab/runs', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setRuns(d.runs || []))
      .catch(() => setRuns([]));
  }, []);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">研究工具</h1>
      <p className="text-sm text-gray-500 mt-1">输入一个公司名，联网查资料后按固定方法写一份短报告。方法来自我平时用的 skill，两边同源。</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
        {TOOLS.map((t) => (
          <a
            key={t.slug}
            href={`/lab/tools/${t.slug}`}
            className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 hover:border-gray-400 active:bg-gray-50 dark:active:bg-gray-900"
          >
            <div className="font-medium text-gray-900 dark:text-white text-[15px]">{t.name}</div>
            <div className="text-xs text-gray-500 mt-0.5 leading-snug">{t.short}</div>
            <div className="text-[11px] text-gray-400 mt-1">约 {Math.round(t.eta / 60) || 1} 分钟</div>
          </a>
        ))}
        <a
          href="/lab"
          className="border border-dashed border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 hover:border-gray-400"
        >
          <div className="font-medium text-gray-900 dark:text-white text-[15px]">观点卡</div>
          <div className="text-xs text-gray-500 mt-0.5 leading-snug">读完报告，写下自己的判断</div>
          <div className="text-[11px] text-gray-400 mt-1">陪练追问 3 次</div>
        </a>
      </div>

      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-7 mb-2">我的研究记录</h2>
      {runs === null ? (
        <p className="text-sm text-gray-400">加载中…</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-gray-400">还没有。挑一个工具，输入公司名试试。</p>
      ) : (
        <div className="space-y-1.5">
          {runs.map((r) => <RunRow key={r.id} run={r} showTool />)}
        </div>
      )}
    </main>
  );
}
