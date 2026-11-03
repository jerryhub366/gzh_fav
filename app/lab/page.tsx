'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Card } from '../../lib/lab/cards';
import { CARD_KINDS } from '../../lib/lab/principles';
import { dailyQuestion } from '../../lib/lab/daily';
import { OUTCOME_LABEL, today } from '../../lib/lab/labels';

const EXAMPLES = ['快手跌到什么程度可以买？', '最近福耀玻璃感觉很不错', '英伟达是不是太贵了，该抛了？'];

// 打样：一次完整陪练长什么样。示例里的数字是假设，仅演示流程。
const DEMO: { role: 'me' | 'coach'; who?: string; text: string }[] = [
  { role: 'me', text: '快手是不是再降点就可以考虑了，股息率涨上来就可以入' },
  { role: 'coach', who: '陪练 · P18 价格要写出锚', text: '你说的“股息率涨上来”，具体到多少算够？这个数是和什么比出来的？' },
  { role: 'me', text: '大概 5% 吧，和港股其他高息股比' },
  { role: 'coach', who: '竞争对手 · P10 快变量', text: '如果抖音明年在下沉市场再砸一轮补贴，快手的利润还撑得住 5% 的分红吗？' },
  { role: 'me', text: '说不清，电商可能会被打，但广告应该还稳' },
  { role: 'coach', who: '陪练 · P12 看最差的一项', text: '那出现什么看得见的信号，你会承认“分红撑不住”？' },
  { role: 'me', text: '连续两个季度广告收入同比下滑，或者分红回购总额变少' },
];

function localDay(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function last30Days() {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) days.push(localDay(new Date(Date.now() - i * 86400000).toISOString()));
  return days;
}

// 校准：把 <50% 的判断翻成“反面 ≥50%”，再按区间看命中率；Brier 越低越好。
function calibration(cards: Card[]) {
  const scored = cards.filter(
    (c) => c.status === 'resolved' && (c.data.outcome === 'right' || c.data.outcome === 'wrong') &&
      (c.data.finalProbability ?? c.data.initialProbability) != null,
  );
  const buckets = [50, 60, 70, 80, 90].map((lo) => ({ lo, hi: lo === 90 ? 100 : lo + 9, n: 0, hits: 0 }));
  let brier = 0;
  for (const c of scored) {
    let p = (c.data.finalProbability ?? c.data.initialProbability) / 100;
    let hit = c.data.outcome === 'right';
    brier += (p - (hit ? 1 : 0)) ** 2;
    if (p < 0.5) {
      p = 1 - p;
      hit = !hit;
    }
    const b = buckets.find((x) => p * 100 >= x.lo && p * 100 <= x.hi + 0.99) || buckets[4];
    b.n += 1;
    if (hit) b.hits += 1;
  }
  return { n: scored.length, brier: scored.length ? brier / scored.length : null, buckets };
}

function CardRow({ card, highlight }: { card: Card; highlight?: boolean }) {
  const p = card.data.finalProbability ?? card.data.initialProbability;
  const action =
    card.status === 'draft' ? '继续聊 →' : card.status === 'challenged' ? '差一步收卡 →' : highlight ? '去复盘 →' : '';
  return (
    <a
      href={`/lab/${card.id}`}
      className={`block border rounded-xl px-4 py-3 transition-colors ${
        highlight
          ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:border-amber-500'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="font-medium text-gray-700 dark:text-gray-300">{card.company}</span>
        <span>· {CARD_KINDS.find((k) => k.key === card.kind)?.label}</span>
        {p != null && card.status !== 'draft' && <span>· 把握 {p}%</span>}
        {card.status === 'resolved' && card.data.outcome && <span>· {OUTCOME_LABEL[card.data.outcome]}</span>}
        {card.data.friends.length > 0 && <span>· {card.data.friends.length} 人押注</span>}
        <span className="ml-auto text-blue-600">{action}</span>
      </div>
      <p className="text-gray-900 dark:text-white mt-0.5">{card.claim}</p>
    </a>
  );
}

export default function LabHome() {
  const router = useRouter();
  const [owner, setOwner] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [syncCopied, setSyncCopied] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const daily = dailyQuestion();

  // 先确定身份：同步链接 #/sync/<身份> 优先，否则用（或新发）本浏览器的身份。
  useEffect(() => {
    async function boot() {
      const match = window.location.hash.match(/^#\/sync\/([A-Za-z0-9_-]+)$/);
      if (match) {
        window.history.replaceState(null, '', window.location.pathname);
        await fetch('/api/lab/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner: match[1] }),
        });
      }
      const res = await fetch('/api/lab/me', { cache: 'no-store' });
      const d = await res.json();
      setOwner(d.owner || '');
    }
    boot().catch(() => setOwner(''));
    // 从研究工具「写观点卡」跳过来：/lab?q=快手：
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) {
      setText(q.slice(0, 200));
      window.history.replaceState(null, '', window.location.pathname);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    // 页面已开着时粘贴同步链接只会改 hash，不会重新挂载，这里补一次。
    const onHash = () => {
      if (/^#\/sync\//.test(window.location.hash)) boot().then(() => window.location.reload());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/lab/cards', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setCards(data.cards);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (owner) load();
  }, [owner, load]);

  async function start(body: Record<string, unknown>, key: string) {
    setError('');
    setBusy(key);
    try {
      const res = await fetch('/api/lab/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '开局失败');
      router.push(`/lab/${data.card.id}`);
    } catch (err: any) {
      setError(err.message);
      setBusy('');
    }
  }

  function copySync() {
    navigator.clipboard.writeText(`${window.location.origin}/lab#/sync/${owner}`).then(() => {
      setSyncCopied(true);
      setTimeout(() => setSyncCopied(false), 1500);
    });
  }

  const t = today();
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? cards.filter((c) => `${c.company} ${c.claim}`.toLowerCase().includes(q)) : cards;
  }, [cards, filter]);
  const due = cards.filter((c) => c.status === 'open' && c.reviewDate && c.reviewDate <= t);
  const working = cards.filter((c) => c.status === 'draft' || c.status === 'challenged');
  const archive = visible.filter((c) => !due.includes(c) && !working.includes(c));

  const days = last30Days();
  const perDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cards) m[localDay(c.createdAt)] = (m[localDay(c.createdAt)] || 0) + 1;
    return m;
  }, [cards]);
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (perDay[days[i]]) streak++;
    else if (i === days.length - 1) continue; // 今天还没交不算断
    else break;
  }
  const cal = calibration(cards);
  const doneToday = Boolean(perDay[localDay(new Date().toISOString())]);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-3xl font-bold">说一句你最近的投资观点</h1>
      <p className="text-sm text-gray-500 mt-1 mb-4">陪练追问你 3 次，把你自己的话整理成一张卡，到期回头看你对了没有。约 3 分钟。</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) start({ text: text.trim() }, 'text');
        }}
      >
        <textarea
          ref={inputRef}
          rows={3}
          className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
          placeholder="随口说，像在群里聊天那样。比如：快手再跌一点、股息率上来就可以买了"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) start({ text: text.trim() }, 'text');
          }}
        />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button disabled={!text.trim() || !!busy} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40">
            {busy === 'text' ? '陪练在读…' : '开始陪练'}
          </button>
          <span className="text-xs text-gray-400 mr-1">试试：</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setText(ex);
                inputRef.current?.focus();
              }}
              className="px-2.5 py-1 text-xs rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {ex}
            </button>
          ))}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      <section className="mt-6 rounded-2xl bg-gray-100 dark:bg-gray-800 p-4">
        <p className="text-xs text-gray-500 mb-1">没想法的日子 · 今日一问 · {daily.company}</p>
        <p className="text-gray-900 dark:text-white">{daily.text}</p>
        <button
          onClick={() => start({ daily: true, index: daily.index }, 'daily')}
          disabled={!!busy}
          className="mt-3 px-4 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-40"
        >
          {busy === 'daily' ? '准备中…' : '回答这一问'}
        </button>
      </section>

      {(due.length > 0 || working.length > 0) && (
        <section className="mt-8 space-y-2">
          <h2 className="text-sm font-semibold text-gray-500">接着做</h2>
          {due.map((c) => <CardRow key={c.id} card={c} highlight />)}
          {working.map((c) => <CardRow key={c.id} card={c} />)}
        </section>
      )}

      <details className="mt-8 group" open={loaded && cards.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-gray-500 select-none">看看一次陪练长什么样（30 秒）</summary>
        <div className="mt-3 space-y-2.5 text-sm">
          {DEMO.map((m, i) =>
            m.role === 'me' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 text-white px-3.5 py-2">{m.text}</p>
              </div>
            ) : (
              <div key={i} className="max-w-[90%] rounded-2xl rounded-bl-sm bg-gray-100 dark:bg-gray-800 px-3.5 py-2">
                <p className="text-[11px] text-gray-500">{m.who}</p>
                <p className="text-gray-900 dark:text-white">{m.text}</p>
              </div>
            ),
          )}
          <div className="border-2 border-blue-200 dark:border-blue-900 rounded-2xl p-3.5 space-y-1">
            <p className="text-xs text-gray-500">→ 自动整理成卡，你只需点一个把握程度</p>
            <p className="font-semibold">快手股息率到 5% 左右可以开始买</p>
            <p><span className="text-gray-500">最依赖的假设：</span>广告收入稳得住，撑得起分红</p>
            <p><span className="text-gray-500">什么会让我认错：</span>连续两季广告同比下滑，或分红回购变少</p>
            <p><span className="text-gray-500">下一步去查：</span>近 8 个季度广告收入同比；分红 + 回购总额</p>
            <p><span className="text-gray-500">把握：</span>50% · 下次财报后回看</p>
          </div>
          <p className="text-xs text-gray-400">示例数字为假设，仅演示流程，不构成投资建议。</p>
        </div>
      </details>

      <section className="mt-8 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-2xl font-semibold">{streak}</p>
          <p className="text-xs text-gray-500">{doneToday ? '连续天数 · 今天已交' : '连续天数'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-2xl font-semibold">{cards.filter((c) => c.status === 'open' || c.status === 'resolved').length}</p>
          <p className="text-xs text-gray-500">收进卡片册</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-2xl font-semibold">{cal.n ? cal.brier.toFixed(2) : '—'}</p>
          <p className="text-xs text-gray-500">{cal.n ? `校准分（${cal.n} 张，越低越准）` : '校准分（复盘后才有）'}</p>
        </div>
      </section>
      <div className="flex gap-[3px] mt-3" title="近 30 天每天的观点卡">
        {days.map((d) => (
          <span
            key={d}
            title={`${d}：${perDay[d] || 0} 张`}
            className={`h-2.5 flex-1 rounded-sm ${perDay[d] >= 2 ? 'bg-green-600' : perDay[d] ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`}
          />
        ))}
      </div>
      {cal.n > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          {cal.buckets.filter((b) => b.n).map((b) => `说 ${b.lo}–${b.hi}% 时对了 ${Math.round((b.hits / b.n) * 100)}%（${b.n} 次）`).join(' · ')}
        </p>
      )}

      {archive.length > 0 && (
        <section className="mt-8 space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-500">卡片册</h2>
            {cards.length > 6 && (
              <input
                className="ml-auto px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent"
                placeholder="按公司找"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            )}
          </div>
          {archive.map((c) => <CardRow key={c.id} card={c} />)}
        </section>
      )}

      <p className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-4 text-xs text-gray-500 leading-relaxed">
        不用登录，卡片跟着这个浏览器走。换手机/电脑：
        <button onClick={copySync} className="mx-1 text-blue-600 hover:underline">{syncCopied ? '已复制' : '复制同步链接'}</button>
        在另一台设备打开。这个链接等于钥匙，别发给别人；想让朋友参与，用卡片里的「发给朋友押注」。
      </p>
    </main>
  );
}
