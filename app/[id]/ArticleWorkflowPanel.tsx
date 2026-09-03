'use client';

import { useEffect, useState } from 'react';
import {
  ARTICLE_STATUSES,
  ARTICLE_STATUS_LABELS,
  type ArticleStatus,
} from '../../lib/articleWorkflow';
import { getAdminSession } from '../../lib/adminClient';

interface Workflow {
  status: ArticleStatus;
  personalNote: string;
  researchQuestion: string;
  tags: string[];
  extractionStatus: string;
  extractionMethod: string;
  extractionError?: string;
}

export default function ArticleWorkflowPanel({ id }: { id: string }) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [personalNote, setPersonalNote] = useState('');
  const [researchQuestion, setResearchQuestion] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const session = await getAdminSession();
      if (!session.admin || !active) return;

      const response = await fetch(`/api/articles/${id}/workflow`, { cache: 'no-store' });
      const data = await response.json();
      if (!active || !response.ok) return;

      const nextWorkflow = data.workflow as Workflow;
      setWorkflow(nextWorkflow);
      setPersonalNote(nextWorkflow.personalNote);
      setResearchQuestion(nextWorkflow.researchQuestion);
      setTags(nextWorkflow.tags.join(', '));
    }

    load();
    return () => {
      active = false;
    };
  }, [id]);

  const save = async (status: ArticleStatus = workflow?.status || 'inbox') => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/articles/${id}/workflow`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          personalNote,
          researchQuestion,
          tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存失败');
      setWorkflow(data.workflow);
      setMessage('已保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!workflow) return null;

  return (
    <aside className="mb-8 rounded-xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900 dark:bg-purple-950/20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">我的处理</h2>
        <span className="text-xs text-gray-500">
          抓取：{workflow.extractionStatus} · {workflow.extractionMethod}
        </span>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {ARTICLE_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            disabled={saving}
            onClick={() => save(status)}
            className={`rounded-full border px-3 py-1.5 text-sm disabled:opacity-50 ${
              workflow.status === status
                ? 'border-purple-600 bg-purple-600 text-white'
                : 'border-gray-300 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300'
            }`}
          >
            {ARTICLE_STATUS_LABELS[status]}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          我的备注
          <textarea
            value={personalNote}
            onChange={(event) => setPersonalNote(event.target.value)}
            placeholder="为什么收藏？我的判断是什么？"
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-normal dark:border-gray-600 dark:bg-gray-900"
          />
        </label>
        <label className="block text-sm font-medium">
          下一步研究问题
          <textarea
            value={researchQuestion}
            onChange={(event) => setResearchQuestion(event.target.value)}
            placeholder="希望 Agent 帮我核实或深入研究什么？"
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-normal dark:border-gray-600 dark:bg-gray-900"
          />
        </label>
        <label className="block text-sm font-medium">
          标签
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="AI, 投资, 待核实"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-normal dark:border-gray-600 dark:bg-gray-900"
          />
        </label>
      </div>
      {workflow.extractionError ? <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">{workflow.extractionError}</p> : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm text-gray-500">{message}</span>
        <button type="button" disabled={saving} onClick={() => save()} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </aside>
  );
}

