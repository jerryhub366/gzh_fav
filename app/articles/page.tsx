'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ARTICLE_STATUSES,
  ARTICLE_STATUS_LABELS,
  displayArticleTitle,
  type ArticleStatus,
} from '../../lib/articleWorkflow';
import { adminHeaders, getAdminSession } from '../../lib/adminClient';

const PAGE_SIZE = 20;

interface Article {
  id: string;
  url: string;
  title: string;
  author: string;
  publishedAt: string;
  collectedAt: string;
  index?: number;
  status?: ArticleStatus;
  personalNote?: string;
  researchQuestion?: string;
  tags?: string[];
  sourceType?: string;
  extractionStatus?: string;
}

type StatusFilter = ArticleStatus | 'all';

const STATUS_STYLES: Record<ArticleStatus, string> = {
  inbox: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
  kept: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200',
  research: 'border-purple-300 bg-purple-50 text-purple-800 dark:border-purple-700 dark:bg-purple-950/40 dark:text-purple-200',
  done: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
  skipped: 'border-gray-300 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300',
};

const EXTRACTION_LABELS: Record<string, string> = {
  full: '正文完整',
  partial: '仅摘要',
  link_only: '仅链接',
  failed: '抓取失败',
};

function ArticleCard({
  article,
  canManage,
  onUpdated,
}: {
  article: Article;
  canManage: boolean;
  onUpdated: () => void;
}) {
  const articleTags = (article.tags || []).join(', ');
  const [expanded, setExpanded] = useState(false);
  const [personalNote, setPersonalNote] = useState(article.personalNote || '');
  const [researchQuestion, setResearchQuestion] = useState(article.researchQuestion || '');
  const [tags, setTags] = useState(articleTags);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPersonalNote(article.personalNote || '');
    setResearchQuestion(article.researchQuestion || '');
    setTags(articleTags);
  }, [article.id, article.personalNote, article.researchQuestion, articleTags]);

  const saveWorkflow = async (status: ArticleStatus = article.status || 'inbox') => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/articles/${article.id}/workflow`, {
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
      if (status === 'research') setExpanded(true);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            {article.status ? (
              <span className={`rounded-full border px-2 py-0.5 ${STATUS_STYLES[article.status]}`}>
                {ARTICLE_STATUS_LABELS[article.status]}
              </span>
            ) : null}
            {article.extractionStatus ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {EXTRACTION_LABELS[article.extractionStatus] || article.extractionStatus}
              </span>
            ) : null}
            {article.sourceType ? <span className="text-gray-400">{article.sourceType}</span> : null}
          </div>
          <h2 className="text-lg font-semibold leading-snug sm:text-xl">
            <a href={`/${article.id}`} className="text-blue-700 hover:underline dark:text-blue-400">
              {article.index ? `${article.index}. ` : ''}
              {displayArticleTitle(article.title)}
            </a>
          </h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{article.author}</span>
            <span>
              收藏于{' '}
              {new Date(article.collectedAt).toLocaleString(undefined, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
              原文 ↗
            </a>
          </div>
          {article.personalNote ? (
            <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {article.personalNote}
            </p>
          ) : null}
        </div>

        {canManage ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-expanded={expanded}
          >
            {expanded ? '收起' : '备注'}
          </button>
        ) : null}
      </div>

      {canManage ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
          {ARTICLE_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              disabled={saving}
              onClick={() => saveWorkflow(status)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-opacity disabled:opacity-50 ${
                article.status === status
                  ? STATUS_STYLES[status]
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {ARTICLE_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      ) : null}

      {canManage && expanded ? (
        <div className="mt-4 space-y-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/70">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            我的备注
            <textarea
              value={personalNote}
              onChange={(event) => setPersonalNote(event.target.value)}
              placeholder="为什么收藏？我的判断是什么？"
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-normal text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            下一步研究问题
            <textarea
              value={researchQuestion}
              onChange={(event) => setResearchQuestion(event.target.value)}
              placeholder="希望 Agent 帮我核实或深入研究什么？"
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-normal text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            标签
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="AI, 投资, 待核实"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-normal text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            {error ? <p className="text-sm text-red-600">{error}</p> : <span />}
            <button
              type="button"
              disabled={saving}
              onClick={() => saveWorkflow()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存备注'}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function ArticlesPage() {
  const [url, setUrl] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('inbox');
  const [searchDraft, setSearchDraft] = useState('');
  const [query, setQuery] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [authEnabled, setAuthEnabled] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState('');

  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = articles.length < total;

  useEffect(() => {
    let active = true;
    getAdminSession().then((session) => {
      if (!active) return;
      setAuthorized(session.admin);
      setAuthEnabled(session.authEnabled);
      setAdminToken(session.token);
      if (!session.admin) setStatusFilter('all');
    });
    return () => {
      active = false;
    };
  }, []);

  const fetchArticles = useCallback(
    async (offset: number) => {
      if (authorized === null) return;
      const isFirstPage = offset === 0;
      if (isFirstPage) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
        if (authorized && statusFilter !== 'all') params.set('status', statusFilter);
        if (authorized && query) params.set('q', query);
        const response = await fetch(`/api/articles?${params}`, {
          headers: adminHeaders(adminToken),
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '加载失败');
        if (isFirstPage) setArticles(data.articles);
        else setArticles((previous) => [...previous, ...data.articles]);
        setTotal(data.total);
        setStatusCounts(data.statusCounts || {});
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '加载失败');
      } finally {
        if (isFirstPage) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [adminToken, authorized, query, statusFilter],
  );

  useEffect(() => {
    setArticles([]);
    fetchArticles(0);
  }, [fetchArticles]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchArticles(articles.length);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [articles.length, fetchArticles, hasMore, loading, loadingMore]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!authorized) return;
    setCollecting(true);
    setMessage('');

    try {
      const response = await fetch('/api/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders(adminToken) },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '收藏失败');

      const firstSaved = data.collectedAt
        ? new Date(data.collectedAt).toLocaleString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      setMessage(`${data.existed ? '已收藏过' : '收藏成功'}！最早入库时间：${firstSaved}（${data.shortLink}）`);
      setUrl('');
      setStatusFilter('inbox');
      setQuery('');
      setSearchDraft('');
      await fetchArticles(0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '收藏失败');
    } finally {
      setCollecting(false);
    }
  };

  const allCount = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">GZH Fav</h1>
          <p className="mt-1 text-sm text-gray-500">先收藏，稍后判断；真正值得的再深入研究。</p>
        </div>
        {authorized ? (
          <a href="/notes" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
            Quick Notes
          </a>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
        <label htmlFor="collect-url" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
          快速收藏
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="collect-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="粘贴公众号、X 或其他网页链接"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white p-3 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            disabled={!authorized || collecting}
            required
          />
          <button type="submit" disabled={!authorized || collecting || !url} className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {collecting ? '收藏中…' : '收藏'}
          </button>
        </div>
        {authorized === false ? (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            {authEnabled ? '请先使用管理员链接登录，公开访客只能阅读。' : '尚未配置 ADMIN_TOKEN，收藏与私人备注已停用。'}
          </p>
        ) : null}
        {message ? <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{message}</p> : null}
      </form>

      {authorized ? (
        <section className="mb-5 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`shrink-0 rounded-full px-4 py-2 text-sm ${statusFilter === 'all' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
            >
              全部 {allCount}
            </button>
            {ARTICLE_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm ${statusFilter === status ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
              >
                {ARTICLE_STATUS_LABELS[status]} {statusCounts[status] || 0}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <form
              className="flex min-w-0 flex-1 gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setQuery(searchDraft.trim());
              }}
            >
              <input
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="搜索标题、作者或 URL"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
              />
              <button type="submit" className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600">
                搜索
              </button>
            </form>
            {(statusCounts.research || 0) > 0 ? (
              <a href="/api/research/export" className="rounded-lg bg-purple-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-purple-700">
                导出研究包（{statusCounts.research}）
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-4" aria-busy={loading}>
        {loading && articles.length === 0 ? <p className="py-10 text-center text-gray-500">加载中…</p> : null}
        {!loading && articles.length === 0 ? <p className="py-10 text-center text-gray-500">这里还没有内容。</p> : null}
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} canManage={authorized === true} onUpdated={() => fetchArticles(0)} />
        ))}
        <div ref={sentinelRef} />
        {loadingMore ? <p className="py-4 text-center text-gray-500">继续加载…</p> : null}
      </section>
    </main>
  );
}
