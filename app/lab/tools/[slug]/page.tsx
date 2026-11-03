'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import type { Run } from '../../../../lib/lab/tools/runs';
import { TOOLS, toolBySlug } from '../../../../lib/lab/tools/registry';
import Markdown from '../Markdown';
import { RunRow } from '../RunRow';

function stage(elapsed: number, eta: number) {
  if (elapsed < 12) return '在搜资料…';
  if (elapsed < eta * 0.6) return '在读财报和新闻…';
  if (elapsed < eta * 1.3) return '在写报告…';
  return '比平时慢，再等等…';
}

function Progress({ run, eta }: { run: Run; eta: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.max(0, Math.round((now - new Date(run.createdAt).getTime()) / 1000));
  const pct = Math.min(95, (elapsed / eta) * 90);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-center text-sm">
        <span className="text-gray-800 dark:text-gray-200">{stage(elapsed, eta)}</span>
        <span className="ml-auto text-gray-400 tabular-nums">{elapsed}s / 约 {eta}s</span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mt-2 overflow-hidden">
        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-2">可以锁屏或切走，结果会留在下面的记录里。</p>
    </div>
  );
}

export default function ToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const tool = toolBySlug(slug);
  const router = useRouter();
  const search = useSearchParams();
  const runId = search.get('run');

  const [company, setCompany] = useState('');
  const [extra, setExtra] = useState('');
  const [run, setRun] = useState<Run | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const loadRuns = useCallback(() => {
    fetch(`/api/lab/runs?tool=${slug}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setRuns(d.runs || []))
      .catch(() => {});
  }, [slug]);

  useEffect(loadRuns, [loadRuns]);

  // 从别的工具「接着看」跳过来：?company=快手，只预填不自动跑
  useEffect(() => {
    const preset = search.get('company');
    if (preset) setCompany(preset.slice(0, 60));
  }, [search]);

  // 打开 ?run= 的那条；还在生成就每 3 秒问一次
  useEffect(() => {
    if (!runId) {
      setRun(null);
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const res = await fetch(`/api/lab/runs/${runId}`, { cache: 'no-store' }).catch(() => null);
      if (stopped) return;
      if (!res || !res.ok) {
        if (res?.status === 404) setError('找不到这条记录（可能是在别的浏览器里跑的）');
        else timer = setTimeout(poll, 5000);
        return;
      }
      const data = await res.json();
      setRun(data.run);
      if (data.run.status === 'running') timer = setTimeout(poll, 3000);
      else loadRuns();
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [runId, loadRuns]);

  if (!tool) {
    return <main className="max-w-3xl mx-auto px-4 pt-8 text-gray-500">没有这个工具。<a className="text-blue-600" href="/lab/tools">看看全部工具</a></main>;
  }

  async function start(name?: string) {
    const target = (name ?? company).trim();
    if (target.length < 2) {
      setError('写一个公司名或股票代码');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/lab/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: tool!.slug, company: target, extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '启动失败');
      setRun(data.run);
      router.replace(`/lab/tools/${tool!.slug}?run=${data.run.id}`, { scroll: false });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!run) return;
    await navigator.clipboard.writeText(run.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    if (!run) return;
    const blob = new Blob([run.output], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${run.company}-${tool!.name}-${run.createdAt.slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function remove() {
    if (!run || !confirm('删掉这条记录？')) return;
    await fetch(`/api/lab/runs/${run.id}`, { method: 'DELETE' });
    router.replace(`/lab/tools/${tool!.slug}`, { scroll: false });
    loadRuns();
  }

  const seconds = run?.finishedAt ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.createdAt).getTime()) / 1000) : null;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-8">
      <a href="/lab/tools" className="text-xs text-gray-400">← 研究工具</a>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{tool.name}</h1>
      <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{tool.when}</p>

      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
      >
        <div className="flex gap-2">
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="公司名或代码，如 快手 / 1024.HK"
            enterKeyHint="go"
            className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl px-4 text-[15px] font-medium disabled:opacity-50"
          >
            {busy ? '启动…' : '开始'}
          </button>
        </div>
        {tool.extra && (
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            rows={2}
            placeholder={`${tool.extra.label}：${tool.extra.placeholder}`}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-[15px] bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        )}
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="text-gray-400 py-1">试试</span>
          {tool.examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setCompany(ex)}
              className="border border-gray-200 dark:border-gray-700 rounded-full px-2.5 py-1 text-gray-600 dark:text-gray-300"
            >
              {ex}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>

      <div ref={resultRef} className="mt-5 scroll-mt-4">
        {run && run.status === 'running' && <Progress run={run} eta={tool.eta} />}
        {run && run.status === 'error' && (
          <div className="border border-red-200 dark:border-red-900 rounded-xl p-4 text-sm">
            <p className="text-red-600">{run.company}：{run.error || '生成失败'}</p>
            <button onClick={() => start(run.company)} className="mt-2 text-blue-600">再跑一次</button>
          </div>
        )}
        {run && run.status === 'done' && (
          <article>
            <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-white/90 dark:bg-gray-950/90 backdrop-blur flex gap-2 text-sm border-b border-gray-100 dark:border-gray-800">
              <button onClick={copy} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1">{copied ? '已复制' : '复制'}</button>
              <button onClick={download} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1">下载 .md</button>
              <a
                href={`/lab?q=${encodeURIComponent(`${run.company}：`)}`}
                className="border border-blue-300 text-blue-700 dark:text-blue-300 rounded-lg px-3 py-1"
              >
                写观点卡
              </a>
              <button onClick={remove} className="ml-auto text-gray-400 px-1">删除</button>
            </div>
            <div className="pt-3">
              <Markdown text={run.output} />
            </div>
            {run.sources.length > 0 && (
              <div className="mt-4 text-sm">
                <button onClick={() => setShowSources(!showSources)} className="text-gray-500">
                  {showSources ? '收起' : '展开'}来源（{run.sources.length}）
                </button>
                {showSources && (
                  <ol className="mt-2 space-y-1 list-decimal pl-5 text-xs text-gray-500">
                    {run.sources.map((s) => (
                      <li key={s.url} className="break-all">
                        <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-600">{s.title}</a>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-1.5 text-sm">
              <span className="text-gray-500 text-xs">接着看 {run.company}：</span>
              {TOOLS.filter((t) => t.slug !== tool.slug).map((t) => (
                <a
                  key={t.slug}
                  href={`/lab/tools/${t.slug}?company=${encodeURIComponent(run.company)}`}
                  className="border border-gray-300 dark:border-gray-600 rounded-full px-2.5 py-0.5 text-gray-700 dark:text-gray-200"
                >
                  {t.name}
                </a>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-4">
              {run.modelId} · 搜索 {run.searches} 次{seconds != null ? ` · ${seconds} 秒` : ''} · skill {tool.skill}@{run.skillHash}
            </p>
          </article>
        )}
      </div>

      {runs.length > 0 && (
        <section className="mt-7">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">之前跑过的</h2>
          <div className="space-y-1.5">
            {runs.map((r) => <RunRow key={r.id} run={r} active={r.id === runId} />)}
          </div>
        </section>
      )}
    </main>
  );
}
