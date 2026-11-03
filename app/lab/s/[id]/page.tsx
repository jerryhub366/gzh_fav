'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CARD_KINDS } from '../../../../lib/lab/principles';
import { STANCE_LABEL } from '../../../../lib/lab/labels';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const NAME_KEY = 'invest_lab_friend_name';

export default function SharePage() {
  const { id } = useParams<{ id: string }>();
  const k = useSearchParams().get('k') || '';
  const [card, setCard] = useState<any>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [stance, setStance] = useState('');
  const [probability, setProbability] = useState(50);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let me = '';
    try {
      me = window.localStorage.getItem(NAME_KEY) || '';
    } catch {}
    setName(me);
    fetch(`/api/lab/share/${id}?k=${encodeURIComponent(k)}&me=${encodeURIComponent(me)}`, { cache: 'no-store' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) return setError('链接无效或已失效');
        setCard(d.card);
        setRevealed(d.revealed);
      });
  }, [id, k]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/lab/share/${id}?k=${encodeURIComponent(k)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, stance, probability, reason }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '提交失败');
      try {
        window.localStorage.setItem(NAME_KEY, name.trim());
      } catch {}
      setCard(d.card);
      setRevealed(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (error && !card) return <main className="max-w-xl mx-auto p-6 text-red-600">{error}</main>;
  if (!card) return <main className="max-w-xl mx-auto p-6 text-gray-500">Loading...</main>;

  return (
    <main className="max-w-xl mx-auto px-4 sm:px-6 py-6">
      <p className="text-xs text-gray-500 mb-1">
        {card.company} · {CARD_KINDS.find((x) => x.key === card.kind)?.label} · 已有 {card.friendCount} 人押注
      </p>
      <h1 className="text-2xl font-bold mb-6">{card.claim}</h1>

      {!revealed ? (
        <form onSubmit={submit} className="space-y-4 border border-gray-300 dark:border-gray-600 rounded-xl p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">先押注，再看别人怎么想。押完才会显示主人的判断。</p>
          <input className={inputClass} placeholder="你的名字/昵称" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="flex gap-2">
            {(['agree', 'disagree', 'unsure'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStance(s)}
                className={`px-3 py-1.5 text-sm rounded-full border ${
                  stance === s ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {STANCE_LABEL[s]}
              </button>
            ))}
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>你觉得这个观点是对的概率</span>
              <b>{probability}%</b>
            </div>
            <input type="range" min={0} max={100} step={5} value={probability} onChange={(e) => setProbability(Number(e.target.value))} className="w-full accent-blue-600" />
          </div>
          <textarea rows={3} className={inputClass} placeholder="一句理由：你最看重 / 最担心的是什么？" value={reason} onChange={(e) => setReason(e.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={sending || !stance} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {sending ? '提交中…' : '押注并查看'}
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="border border-gray-300 dark:border-gray-600 rounded-xl p-4 text-sm space-y-1">
            <p className="font-semibold mb-1">主人的判断</p>
            {card.status === 'draft' || card.status === 'challenged' ? (
              <p className="text-gray-500">主人还在思考中，封存后这里会显示概率和证伪条件。</p>
            ) : (
              <>
                <p>概率：{card.finalProbability ?? '—'}%</p>
                <p>关键假设：{card.keyAssumption || '—'}</p>
                <p>证伪条件：{card.falsifiers || '—'}</p>
                <p>复盘日期：{card.reviewDate || '—'}</p>
              </>
            )}
          </div>
          <div>
            <p className="font-semibold text-sm mb-2">所有押注（{card.friends.length}）</p>
            <ul className="space-y-2 text-sm">
              {card.friends.map((f: any) => (
                <li key={f.name} className="border-l-4 border-gray-300 dark:border-gray-600 pl-3">
                  <b>{f.name}</b>：{STANCE_LABEL[f.stance]}
                  {f.probability != null && ` ${f.probability}%`}
                  <br />
                  <span className="text-gray-600 dark:text-gray-300">{f.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
