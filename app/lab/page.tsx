'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Card } from '../../lib/lab/cards';
import { CARD_KINDS, IMPULSE_SOURCES } from '../../lib/lab/principles';
import { OUTCOME_LABEL, STATUS_LABEL, today } from '../../lib/lab/labels';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

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
  return (
    <a
      href={`/lab/${card.id}`}
      className={`block border rounded-lg p-4 transition-colors ${
        highlight
          ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:border-amber-500'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-400'
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        <span className="font-medium text-gray-700 dark:text-gray-300">{card.company}</span>
        <span>·</span>
        <span>{CARD_KINDS.find((k) => k.key === card.kind)?.label}</span>
        <span>·</span>
        <span>{STATUS_LABEL[card.status]}</span>
        {card.data.friends.length > 0 && <span>· {card.data.friends.length} 位朋友押注</span>}
      </div>
      <p className="text-gray-900 dark:text-white">{card.claim}</p>
      <div className="flex gap-3 text-xs text-gray-500 mt-2">
        {p != null && <span>概率 {p}%</span>}
        {card.status === 'open' && card.reviewDate && <span>复盘日 {card.reviewDate}</span>}
        {card.status === 'resolved' && card.data.outcome && <span>{OUTCOME_LABEL[card.data.outcome]}</span>}
        <span className="ml-auto">{localDay(card.createdAt)}</span>
      </div>
    </a>
  );
}

export default function LabHome() {
  const router = useRouter();
  const [owner, setOwner] = useState<string | null>(null);
  const [syncCopied, setSyncCopied] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState('');
  const [claim, setClaim] = useState('');
  const [kind, setKind] = useState<string>('quality');
  const [impulse, setImpulse] = useState<string[]>([]);
  const [impulseNote, setImpulseNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

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
  }, []);

  function copySync() {
    navigator.clipboard.writeText(`${window.location.origin}/lab#/sync/${owner}`).then(() => {
      setSyncCopied(true);
      setTimeout(() => setSyncCopied(false), 1500);
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lab/cards', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setCards(data.cards);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (owner) load();
  }, [owner, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!impulse.length && !impulseNote.trim()) {
      setError('先做冲动自查：你为什么现在对它有感觉？');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/lab/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, claim, kind, impulseSource: impulse, impulseNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建失败');
      router.push(`/lab/${data.card.id}`);
    } catch (err: any) {
      setError(err.message);
      setCreating(false);
    }
  }

  const t = today();
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => `${c.company} ${c.claim}`.toLowerCase().includes(q));
  }, [cards, filter]);
  const due = visible.filter((c) => c.status === 'open' && c.reviewDate && c.reviewDate <= t);
  const working = visible.filter((c) => c.status === 'draft' || c.status === 'challenged');
  const waiting = visible.filter((c) => c.status === 'open' && !(c.reviewDate && c.reviewDate <= t));
  const resolved = visible.filter((c) => c.status === 'resolved');

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

  if (owner === null) return <main className="max-w-3xl mx-auto p-6 text-gray-500">Loading...</main>;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-3xl font-bold mb-1">今天有什么观点？</h1>
      <p className="text-sm text-gray-500 mb-6">先自己答 → 被三个角色挑战 → 写下证伪条件 → 到期复盘。</p>

      <form onSubmit={create} className="border border-gray-300 dark:border-gray-600 rounded-xl p-4 space-y-3 mb-8">
        <div className="flex flex-wrap gap-2">
          {CARD_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              className={`px-3 py-1.5 text-sm rounded-full border ${
                kind === k.key
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
          <input className={inputClass} placeholder="公司，如 快手" value={company} onChange={(e) => setCompany(e.target.value)} required />
          <input
            className={inputClass}
            placeholder={`一句话观点，如「${CARD_KINDS.find((k) => k.key === kind)?.example}」`}
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            required
          />
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">冲动自查：为什么是现在？</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {IMPULSE_SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setImpulse((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))}
                className={`px-2.5 py-1 text-xs rounded-full border ${
                  impulse.includes(s)
                    ? 'bg-gray-800 border-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <input className={inputClass} placeholder="补一句（可选）：看到了什么、谁说的、跌了多少" value={impulseNote} onChange={(e) => setImpulseNote(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={creating} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {creating ? '创建中…' : '开一张观点卡'}
        </button>
      </form>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
          <p className="text-xs text-gray-500">连续交作品</p>
          <p className="text-2xl font-semibold">{streak} 天</p>
          <div className="flex gap-[3px] mt-3" title="近 30 天每天的观点卡">
            {days.map((d) => (
              <span
                key={d}
                title={`${d}：${perDay[d] || 0} 张`}
                className={`h-3 flex-1 rounded-sm ${
                  perDay[d] >= 2 ? 'bg-green-600' : perDay[d] ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
          <p className="text-xs text-gray-500">观点卡</p>
          <p className="text-2xl font-semibold">{cards.length}</p>
          <p className="text-xs text-gray-500 mt-2">
            等复盘 {cards.filter((c) => c.status === 'open').length} · 已复盘 {cards.filter((c) => c.status === 'resolved').length}
          </p>
        </div>
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
          <p className="text-xs text-gray-500">校准（已复盘且有对错）</p>
          {cal.n === 0 ? (
            <p className="text-sm text-gray-500 mt-2">还没有复盘结果。到期复盘后，这里会告诉你“说 80% 的时候，实际对了几成”。</p>
          ) : (
            <>
              <p className="text-2xl font-semibold">Brier {cal.brier.toFixed(2)}</p>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                {cal.buckets.filter((b) => b.n).map((b) => (
                  <p key={b.lo}>
                    说 {b.lo}–{b.hi}%：{b.n} 次，对了 {Math.round((b.hits / b.n) * 100)}%
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <input className={`${inputClass} mb-6`} placeholder="按公司或关键词找卡" value={filter} onChange={(e) => setFilter(e.target.value)} />

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && cards.length === 0 && (
        <p className="text-gray-500 text-center py-8">还没有观点卡。上面写下今天的第一个观点。</p>
      )}

      {[
        { title: '到期待复盘', list: due, highlight: true },
        { title: '进行中', list: working },
        { title: '等复盘', list: waiting },
        { title: '已复盘', list: resolved },
      ]
        .filter((s) => s.list.length)
        .map((s) => (
          <section key={s.title} className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 mb-3">
              {s.title}（{s.list.length}）
            </h2>
            <div className="space-y-3">
              {s.list.map((c) => (
                <CardRow key={c.id} card={c} highlight={s.highlight} />
              ))}
            </div>
          </section>
        ))}

      <section className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-4 text-xs text-gray-500 leading-relaxed">
        <p>
          观点卡跟着这个浏览器走，不需要登录。换手机/电脑继续用：
          <button onClick={copySync} className="mx-1 text-blue-600 hover:underline">
            {syncCopied ? '已复制' : '复制同步链接'}
          </button>
          在另一台设备打开即可。这个链接等于你的钥匙，别发给别人；想让朋友参与，用单张卡里的「朋友押注链接」。
        </p>
      </section>
    </main>
  );
}
