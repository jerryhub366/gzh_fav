'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Card, Turn } from '../../../lib/lab/cards';
import { CARD_KINDS, IMPULSE_SOURCES, principleById } from '../../../lib/lab/principles';
import { OUTCOME_LABEL, STANCE_LABEL, STATUS_LABEL } from '../../../lib/lab/labels';
import LegacyCard from './LegacyCard';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:text-gray-800 dark:disabled:text-gray-200';
const primaryBtn = 'px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40';
const chip =
  'px-3 py-1.5 text-sm rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800';
const chipOn = 'px-3 py-1.5 text-sm rounded-full border bg-blue-600 border-blue-600 text-white';
const QUICK_REPLIES = ['没想过', '说不清', '换个问法'];
const REVIEW_PRESETS = [
  { label: '1 个月', days: 30 },
  { label: '下次财报后', days: 90 },
  { label: '半年', days: 180 },
  { label: '一年', days: 365 },
];

function addDays(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function RefTag({ id, version }: { id?: string; version: string }) {
  const [open, setOpen] = useState(false);
  const p = id ? principleById(id, version) : null;
  if (!p) return null;
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="ml-1 px-1.5 py-0.5 text-[11px] rounded bg-white/70 dark:bg-gray-700 text-gray-500">
        {p.id} {p.title}
      </button>
      {open && (
        <span className="absolute z-10 left-0 top-6 w-72 p-3 text-xs leading-relaxed rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-lg text-gray-700 dark:text-gray-200">
          {p.detail}
          <a href={`/lab/principles#${p.id}`} className="block mt-1 text-blue-600">看全部原则 →</a>
        </span>
      )}
    </span>
  );
}

function Bubble({ turn, version }: { turn: Turn; version: string }) {
  if (turn.role === 'me') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-blue-600 text-white px-4 py-2.5">{turn.text}</p>
      </div>
    );
  }
  return (
    <div className="flex">
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-gray-100 dark:bg-gray-800 px-4 py-2.5">
        <p className="text-xs text-gray-500 mb-1">
          {turn.persona || '陪练'}
          <RefTag id={turn.ref} version={version} />
        </p>
        <p className="text-gray-900 dark:text-white">{turn.text}</p>
      </div>
    </div>
  );
}

function ChatCard({ initial }: { initial: Card }) {
  const router = useRouter();
  const [card, setCard] = useState(initial);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    claim: initial.claim,
    keyAssumption: initial.data.keyAssumption,
    falsifiers: initial.data.falsifiers,
    nextChecks: initial.data.nextChecks,
    probability: initial.data.finalProbability as number | null,
    reviewDate: initial.reviewDate,
    impulse: initial.data.impulseSource,
    outcome: initial.data.outcome,
    lesson: initial.data.lesson || '',
  });
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const turns = card.data.turns || [];
  const isDraft = card.status === 'draft';
  const isSummarized = card.status === 'challenged';
  const locked = card.status === 'open' || card.status === 'resolved';
  const answered = turns.filter((t) => t.role === 'me').length;
  const asked = turns.filter((t) => t.role === 'coach').length;
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, busy, card.status]);

  async function send(text: string, finish = false) {
    setError('');
    setBusy(finish ? 'finish' : 'reply');
    if (text) {
      setCard((c) => ({ ...c, data: { ...c.data, turns: [...(c.data.turns || []), { role: 'me', text, at: new Date().toISOString() }] } }));
      setReply('');
    }
    try {
      const res = await fetch(`/api/lab/cards/${card.id}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finish ? { reply: text, finish: true } : { reply: text }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '发送失败');
      setCard(d.card);
      setForm((f) => ({
        ...f,
        claim: d.card.claim,
        keyAssumption: d.card.data.keyAssumption,
        falsifiers: d.card.data.falsifiers,
        nextChecks: d.card.data.nextChecks,
      }));
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err: any) {
      setError(err.message);
      if (text) setReply(text);
      setCard((c) => (text ? { ...c, data: { ...c.data, turns: (c.data.turns || []).slice(0, -1) } } : c));
    } finally {
      setBusy('');
    }
  }

  async function save(body: Record<string, unknown>, key: string) {
    setError('');
    setBusy(key);
    try {
      const res = await fetch(`/api/lab/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '保存失败');
      setCard(d.card);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  function commit() {
    save(
      {
        status: 'open',
        claim: form.claim,
        reviewDate: form.reviewDate,
        data: {
          keyAssumption: form.keyAssumption,
          falsifiers: form.falsifiers,
          nextChecks: form.nextChecks,
          finalProbability: form.probability,
          impulseSource: form.impulse,
        },
      },
      'commit',
    );
  }

  async function remove() {
    if (!confirm('删除这张观点卡？不可恢复。')) return;
    await fetch(`/api/lab/cards/${card.id}`, { method: 'DELETE' });
    router.push('/lab');
  }

  function copyShare() {
    navigator.clipboard.writeText(`${window.location.origin}/lab/s/${card.id}?k=${card.shareKey}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const kindLabel = CARD_KINDS.find((k) => k.key === card.kind)?.label;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <a href="/lab" className="text-sm text-gray-500 hover:text-gray-700">← 全部观点卡</a>
      <div className="mt-3 mb-5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{card.company}</span>
        <span>· {kindLabel}</span>
        <span>· {STATUS_LABEL[card.status]}</span>
        {isDraft && <span className="ml-auto">第 {Math.min(asked, 3)} / 3 问</span>}
      </div>

      <div className="space-y-3">
        {turns.map((t, i) => (
          <Bubble key={i} turn={t} version={card.principleVersion} />
        ))}
        {busy === 'reply' && <p className="text-sm text-gray-400 pl-2">陪练在想下一个问题…</p>}
        {busy === 'finish' && <p className="text-sm text-gray-400 pl-2">正在把你说的话整理成卡…</p>}
      </div>

      {card.data.coachNote && (
        <p className="mt-3 text-xs text-amber-700">本轮没用上模型（{card.data.coachNote}），问题来自规则题库。</p>
      )}

      {isDraft && (
        <div className="mt-5 sticky bottom-0 bg-[rgb(var(--background-end-rgb))] pt-2 pb-4">
          <div className="flex gap-2 mb-2 flex-wrap">
            {QUICK_REPLIES.map((q) => (
              <button key={q} className={chip} disabled={!!busy} onClick={() => send(q)}>
                {q}
              </button>
            ))}
            {answered >= 2 && (
              <button className={`${chip} ml-auto`} disabled={!!busy} onClick={() => send(reply.trim(), true)}>
                够了，帮我整理 →
              </button>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (reply.trim()) send(reply.trim());
            }}
            className="flex gap-2 items-end"
          >
            <textarea
              ref={inputRef}
              rows={2}
              className={inputClass}
              placeholder="一两句话回答就行，想到什么说什么"
              value={reply}
              disabled={!!busy}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && reply.trim()) send(reply.trim());
              }}
            />
            <button className={`${primaryBtn} shrink-0 whitespace-nowrap`} disabled={!reply.trim() || !!busy}>发送</button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {(isSummarized || locked) && (
        <section className="mt-6 border-2 border-blue-200 dark:border-blue-900 rounded-2xl p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">{isSummarized ? '这是用你的原话整理的观点卡，改哪句直接改' : '观点卡'}</p>
            <textarea rows={2} className={`${inputClass} text-lg font-semibold`} disabled={locked} value={form.claim} onChange={(e) => set({ claim: e.target.value })} />
          </div>
          {[
            { key: 'keyAssumption', label: '最依赖的假设', hint: '这个观点成立，最需要什么是真的？' },
            { key: 'falsifiers', label: '什么会让我认错', hint: '没说清的话，补一句看得见的信号' },
            { key: 'nextChecks', label: '下一步去查', hint: '财报哪部分、什么数据' },
          ].map((f) => (
            <div key={f.key}>
              <p className="text-xs text-gray-500 mb-1">{f.label}</p>
              <textarea
                rows={2}
                className={inputClass}
                disabled={locked}
                placeholder={locked ? "—" : f.hint}
                value={(form as any)[f.key]}
                onChange={(e) => set({ [f.key]: e.target.value } as any)}
              />
            </div>
          ))}
          {card.data.summary?.weakest?.length > 0 && (
            <div className="text-sm bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700 mb-1">陪练的观察：这次想得最薄的地方</p>
              <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                {card.data.summary.weakest.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-gray-700 dark:text-gray-300">你觉得这个观点对的把握有几成？</p>
              <span className="text-2xl font-semibold tabular-nums">{form.probability == null ? '?' : `${form.probability}%`}</span>
            </div>
            <div className="flex gap-1.5 mt-2">
              {[10, 30, 50, 70, 90].map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={locked}
                  onClick={() => set({ probability: p })}
                  className={`flex-1 py-2 text-sm rounded-lg border ${
                    form.probability === p ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-gray-400 mt-1">
              <span>多半错</span>
              <span>五五开</span>
              <span>很有把握</span>
            </div>
          </div>

          {isSummarized && (
            <>
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">什么时候回头看？</p>
                <div className="flex flex-wrap gap-2">
                  {REVIEW_PRESETS.map((r) => (
                    <button key={r.days} type="button" className={form.reviewDate === addDays(r.days) ? chipOn : chip} onClick={() => set({ reviewDate: addDays(r.days) })}>
                      {r.label}
                    </button>
                  ))}
                  <input type="date" className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent" value={form.reviewDate || ''} onChange={(e) => set({ reviewDate: e.target.value })} />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">这个想法从哪来的？<span className="text-xs text-gray-400">（可选，回看时很有用）</span></p>
                <div className="flex flex-wrap gap-2">
                  {IMPULSE_SOURCES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={form.impulse.includes(s) ? chipOn : chip}
                      onClick={() => set({ impulse: form.impulse.includes(s) ? form.impulse.filter((x) => x !== s) : [...form.impulse, s] })}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <button className={primaryBtn} disabled={form.probability == null || !form.reviewDate || busy === 'commit'} onClick={commit}>
                收进卡片册
              </button>
              {form.probability == null && <span className="ml-3 text-xs text-gray-500">点一个把握程度就能收</span>}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}

          {locked && <p className="text-sm text-gray-500">复盘日：{card.reviewDate || '—'}{card.data.impulseSource.length > 0 && ` · 来源：${card.data.impulseSource.join('、')}`}</p>}
        </section>
      )}

      {locked && (
        <section className="mt-5 border border-gray-300 dark:border-gray-600 rounded-2xl p-4 sm:p-5 space-y-3">
          <p className="font-semibold">复盘{card.status === 'open' && card.reviewDate ? `（${card.reviewDate} 到期，可提前）` : ''}</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(OUTCOME_LABEL) as (keyof typeof OUTCOME_LABEL)[]).map((o) => (
              <button key={o} type="button" disabled={card.status === 'resolved'} className={form.outcome === o ? chipOn : chip} onClick={() => set({ outcome: o })}>
                {OUTCOME_LABEL[o]}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            className={inputClass}
            disabled={card.status === 'resolved'}
            placeholder="一句话：学到什么？当时的来源靠谱吗？"
            value={form.lesson}
            onChange={(e) => set({ lesson: e.target.value })}
          />
          {card.status === 'open' && (
            <button className={primaryBtn} disabled={!form.outcome || busy === 'resolve'} onClick={() => save({ status: 'resolved', data: { outcome: form.outcome, lesson: form.lesson } }, 'resolve')}>
              完成复盘
            </button>
          )}
        </section>
      )}

      {card.data.friends.length > 0 && (
        <section className="mt-5 border border-gray-300 dark:border-gray-600 rounded-2xl p-4">
          <p className="font-semibold mb-2">朋友的押注（{card.data.friends.length}）</p>
          <ul className="space-y-1.5 text-sm">
            {card.data.friends.map((f) => (
              <li key={f.name}>
                <b>{f.name}</b>：{STANCE_LABEL[f.stance]}
                {f.probability != null && ` ${f.probability}%`} — {f.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div ref={endRef} className="flex flex-wrap gap-3 mt-6 text-sm text-gray-500">
        <button className="hover:text-gray-800" onClick={copyShare}>{copied ? '已复制' : '发给朋友押注'}</button>
        <a className="hover:text-gray-800" href={`/api/lab/cards/${card.id}/export`} target="_blank">导出 Markdown</a>
        <button className="ml-auto text-red-500 hover:text-red-700" onClick={remove}>删除</button>
      </div>
    </main>
  );
}

export default function CardPage() {
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/lab/cards/${id}`, { cache: 'no-store' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) =>
        ok ? setCard(d.card) : setError('找不到这张卡：它可能属于另一个浏览器，用首页底部的同步链接把身份带过来。'),
      );
  }, [id]);

  if (error) return <main className="max-w-2xl mx-auto p-6 text-red-600">{error}</main>;
  if (!card) return <main className="max-w-2xl mx-auto p-6 text-gray-500">Loading...</main>;
  if (card.data.mode !== 'chat') return <LegacyCard />;
  return <ChatCard initial={card} />;
}
