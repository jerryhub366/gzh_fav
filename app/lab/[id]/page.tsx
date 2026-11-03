'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getAdminSession } from '../../../lib/adminClient';
import type { Card, CardData, Challenge } from '../../../lib/lab/cards';
import { CARD_KINDS, DRAFT_QUESTIONS, principleById } from '../../../lib/lab/principles';
import { OUTCOME_LABEL, STANCE_LABEL, STATUS_LABEL, today } from '../../../lib/lab/labels';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600 dark:disabled:bg-gray-800 dark:disabled:text-gray-300';
const primaryBtn = 'px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50';
const ghostBtn =
  'px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800';

function Ref({ id, version }: { id: string; version: string }) {
  const [open, setOpen] = useState(false);
  const p = principleById(id, version);
  if (!p) return null;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1 px-1.5 py-0.5 text-[11px] rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
      >
        {p.id}
      </button>
      {open && (
        <span className="absolute z-10 left-0 top-6 w-72 p-3 text-xs leading-relaxed rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-lg text-gray-700 dark:text-gray-200">
          <b>{p.id} {p.title}</b>
          <br />
          {p.detail}
        </span>
      )}
    </span>
  );
}

function ProbabilityInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-xl font-semibold tabular-nums">{value == null ? '—' : `${value}%`}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value ?? 50}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-[11px] text-gray-400">
        <span>肯定错</span>
        <span>五五开</span>
        <span>肯定对</span>
      </div>
    </div>
  );
}

function Step({ n, title, active, done, children }: { n: number; title: string; active: boolean; done: boolean; children: React.ReactNode }) {
  return (
    <section
      className={`border rounded-xl p-4 sm:p-5 mb-5 ${
        active ? 'border-blue-400 dark:border-blue-500' : 'border-gray-300 dark:border-gray-600'
      }`}
    >
      <h2 className="flex items-center gap-2 font-semibold mb-4">
        <span
          className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-xs ${
            done ? 'bg-green-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600'
          }`}
        >
          {done ? '✓' : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function CardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);
  const dirty = useRef<Partial<CardData> & { reviewDate?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getAdminSession().then((s) => setAuthorized(s.admin));
  }, []);

  useEffect(() => {
    if (!authorized || !id) return;
    fetch(`/api/lab/cards/${id}`, { cache: 'no-store' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => (ok ? setCard(d.card) : setError(d.error || '加载失败')));
  }, [authorized, id]);

  const flush = useCallback(
    async (extra: Record<string, unknown> = {}) => {
      if (timer.current) clearTimeout(timer.current);
      const { reviewDate, ...data } = dirty.current;
      dirty.current = {};
      const body: Record<string, unknown> = { ...extra };
      if (Object.keys(data).length) body.data = { ...(body.data as object), ...data };
      if (reviewDate !== undefined) body.reviewDate = reviewDate;
      if (!Object.keys(body).length) return card;
      const res = await fetch(`/api/lab/cards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || '保存失败');
        return null;
      }
      setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
      return d.card as Card;
    },
    [id, card],
  );

  function patch(data: Partial<CardData>, reviewDate?: string) {
    setCard((c) => (c ? { ...c, reviewDate: reviewDate ?? c.reviewDate, data: { ...c.data, ...data } } : c));
    dirty.current = { ...dirty.current, ...data, ...(reviewDate !== undefined ? { reviewDate } : {}) };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(), 1000);
  }

  function updateChallenge(i: number, change: Partial<Challenge>) {
    const challenges = card.data.challenges.map((c, idx) => (idx === i ? { ...c, ...change } : c));
    patch({ challenges });
  }

  async function summon() {
    setError('');
    setBusy('challenge');
    try {
      await flush();
      const res = await fetch(`/api/lab/cards/${id}/challenge`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '挑战生成失败');
      setCard(d.card);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function transition(status: string) {
    setError('');
    setBusy(status);
    const saved = await flush({ status });
    if (saved) setCard(saved);
    setBusy('');
  }

  async function remove() {
    if (!confirm('删除这张观点卡？不可恢复。')) return;
    await fetch(`/api/lab/cards/${id}`, { method: 'DELETE' });
    router.push('/lab');
  }

  function copyShare() {
    const url = `${window.location.origin}/lab/s/${card.id}?k=${card.shareKey}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (authorized === null || (authorized && !card && !error)) {
    return <main className="max-w-3xl mx-auto p-6 text-gray-500">Loading...</main>;
  }
  if (!authorized) return <main className="max-w-3xl mx-auto p-6 text-amber-700">需要管理员登录。</main>;
  if (!card) return <main className="max-w-3xl mx-auto p-6 text-red-600">{error}</main>;

  const d = card.data;
  const questions = DRAFT_QUESTIONS[card.kind];
  const draftDone = questions.every((q) => d.draftAnswers[q.key]?.trim()) && d.initialProbability != null;
  const isDraft = card.status === 'draft';
  const isChallenged = card.status === 'challenged';
  const locked = card.status === 'open' || card.status === 'resolved';
  const delta = d.finalProbability != null && d.initialProbability != null ? d.finalProbability - d.initialProbability : null;
  const canCommit = isChallenged && d.finalProbability != null && d.keyAssumption.trim() && d.falsifiers.trim() && card.reviewDate;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <a href="/lab" className="text-sm text-gray-500 hover:text-gray-700">← 全部观点卡</a>
      <div className="mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-1">
          <span className="font-medium text-gray-700 dark:text-gray-300">{card.company}</span>
          <span>· {CARD_KINDS.find((k) => k.key === card.kind)?.label}</span>
          <span>· {STATUS_LABEL[card.status]}</span>
          <span>· 原则 {card.principleVersion}</span>
          {savedAt && <span className="ml-auto text-green-600">已自动保存 {savedAt}</span>}
        </div>
        <h1 className="text-2xl font-bold">{card.claim}</h1>
        <p className="text-sm text-gray-500 mt-2">
          冲动来源：{d.impulseSource.join('、') || '—'}
          {d.impulseNote && `（${d.impulseNote}）`}
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Step n={1} title="先自己答（看不到任何参考答案）" active={isDraft} done={!isDraft}>
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.key}>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                {q.text}
                <Ref id={q.ref} version={card.principleVersion} />
              </label>
              <textarea
                rows={3}
                className={inputClass}
                disabled={!isDraft}
                value={d.draftAnswers[q.key] || ''}
                onChange={(e) => patch({ draftAnswers: { ...d.draftAnswers, [q.key]: e.target.value } })}
              />
            </div>
          ))}
          <ProbabilityInput
            label="现在你觉得这个判断是对的概率"
            value={d.initialProbability}
            disabled={!isDraft}
            onChange={(v) => patch({ initialProbability: v })}
          />
          {isDraft && (
            <div className="flex items-center gap-3">
              <button className={primaryBtn} disabled={!draftDone || busy === 'challenge'} onClick={summon}>
                {busy === 'challenge' ? '挑战者思考中…（最多 1 分钟）' : '召唤挑战者'}
              </button>
              {!draftDone && <span className="text-xs text-gray-500">三道题和概率都写完才能召唤</span>}
            </div>
          )}
          {!isDraft && <p className="text-xs text-gray-400">第一轮答案已封存，作为原始记录保留。</p>}
        </div>
      </Step>

      {!isDraft && (
        <Step n={2} title="被挑战" active={isChallenged} done={locked}>
          {d.challengeMeta?.fallback && (
            <p className="mb-3 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded px-3 py-2">
              本轮无模型挑战（{d.challengeMeta.error}），使用规则题库。
            </p>
          )}
          {d.challengeMeta?.weakest?.length > 0 && (
            <div className="mb-4 text-sm">
              <p className="text-gray-500 mb-1">你答案里最薄弱的地方：</p>
              <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                {d.challengeMeta.weakest.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-4">
            {d.challenges.map((c, i) => (
              <div key={i} className="border-l-4 border-gray-300 dark:border-gray-600 pl-3">
                <p className="text-sm">
                  <b>{c.persona}</b>
                  <Ref id={c.ref} version={card.principleVersion} />
                  {c.source === 'rule' && <span className="ml-1 text-[11px] text-gray-400">规则题库</span>}
                </p>
                <p className="text-gray-900 dark:text-white my-1">{c.text}</p>
                <textarea
                  rows={2}
                  className={inputClass}
                  disabled={locked}
                  placeholder={c.rejected ? '为什么这个挑战不成立？' : '你的回应'}
                  value={c.reply || ''}
                  onChange={(e) => updateChallenge(i, { reply: e.target.value })}
                />
                <label className="inline-flex items-center gap-1 mt-1 text-xs text-gray-500">
                  <input type="checkbox" disabled={locked} checked={!!c.rejected} onChange={(e) => updateChallenge(i, { rejected: e.target.checked })} />
                  这个挑战不成立
                </label>
              </div>
            ))}
          </div>
          {d.challengeMeta?.modelId && <p className="mt-3 text-[11px] text-gray-400">模型：{d.challengeMeta.modelId} · 事实性内容一律待核实</p>}
        </Step>
      )}

      {!isDraft && (
        <Step n={3} title="收敛：写下会让你认错的东西" active={isChallenged} done={locked}>
          <div className="space-y-4">
            <ProbabilityInput
              label="被挑战之后，你现在的概率"
              value={d.finalProbability}
              disabled={locked}
              onChange={(v) => patch({ finalProbability: v })}
            />
            {delta != null && (
              <p className="text-xs text-gray-500">
                {d.initialProbability}% → {d.finalProbability}%（{delta > 0 ? '+' : ''}
                {delta}）{delta === 0 ? '挑战没有改变你的判断，确认是想清楚了而不是没听进去。' : ''}
              </p>
            )}
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">如果只能保留一个关键假设，是哪一个？</label>
              <textarea rows={2} className={inputClass} disabled={locked} value={d.keyAssumption} onChange={(e) => patch({ keyAssumption: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">什么证据出现，你会放弃或反转这个观点？</label>
              <textarea rows={2} className={inputClass} disabled={locked} value={d.falsifiers} onChange={(e) => patch({ falsifiers: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">下一步要查证的事（具体到财报章节、公告、数据口径）</label>
              <textarea rows={3} className={inputClass} disabled={locked} value={d.nextChecks} onChange={(e) => patch({ nextChecks: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700 dark:text-gray-300">复盘日期</label>
              <input type="date" className={`${inputClass} w-auto`} disabled={card.status === 'resolved'} value={card.reviewDate || ''} onChange={(e) => patch({}, e.target.value)} />
            </div>
            {isChallenged && (
              <div className="flex items-center gap-3">
                <button className={primaryBtn} disabled={!canCommit || busy === 'open'} onClick={() => transition('open')}>
                  封存观点，等复盘
                </button>
                {!canCommit && <span className="text-xs text-gray-500">概率、关键假设、证伪条件、复盘日期必填</span>}
              </div>
            )}
          </div>
        </Step>
      )}

      {locked && (
        <Step n={4} title={card.reviewDate && card.reviewDate > today() && card.status === 'open' ? `复盘（${card.reviewDate} 到期，可提前）` : '复盘'} active={card.status === 'open'} done={card.status === 'resolved'}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(OUTCOME_LABEL) as (keyof typeof OUTCOME_LABEL)[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  disabled={card.status === 'resolved'}
                  onClick={() => patch({ outcome: o })}
                  className={`px-3 py-1.5 text-sm rounded-full border ${
                    d.outcome === o ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {OUTCOME_LABEL[o]}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              className={inputClass}
              disabled={card.status === 'resolved'}
              placeholder="学到什么？证伪条件触发了吗？当时的冲动来源靠谱吗？"
              value={d.lesson || ''}
              onChange={(e) => patch({ lesson: e.target.value })}
            />
            {card.status === 'open' && (
              <button className={primaryBtn} disabled={!d.outcome || busy === 'resolved'} onClick={() => transition('resolved')}>
                完成复盘
              </button>
            )}
          </div>
        </Step>
      )}

      {d.friends.length > 0 && (
        <section className="border border-gray-300 dark:border-gray-600 rounded-xl p-4 mb-5">
          <h2 className="font-semibold mb-3">朋友的押注（{d.friends.length}）</h2>
          <ul className="space-y-2 text-sm">
            {d.friends.map((f) => (
              <li key={f.name}>
                <b>{f.name}</b>：{STANCE_LABEL[f.stance]}
                {f.probability != null && ` ${f.probability}%`} — {f.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2 mt-6">
        <button className={ghostBtn} onClick={copyShare}>{copied ? '已复制' : '复制朋友押注链接'}</button>
        <a className={ghostBtn} href={`/api/lab/cards/${card.id}/export`} target="_blank">导出 Markdown</a>
        <button className={`${ghostBtn} ml-auto text-red-600`} onClick={remove}>删除</button>
      </div>
    </main>
  );
}
