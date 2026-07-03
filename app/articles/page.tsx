'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const PAGE_SIZE = 20;

interface Article {
  id: string;
  url: string;
  title: string;
  author: string;
  publishedAt: string;
  collectedAt: string;
  index?: number;
}

export default function ArticlesPage() {
  const [url, setUrl] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState('');

  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = articles.length < total;

  const fetchArticles = useCallback(async (offset: number) => {
    const isFirstPage = offset === 0;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetch(`/api/articles?limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      if (res.ok) {
        if (isFirstPage) setArticles(data.articles);
        else setArticles((prev) => [...prev, ...data.articles]);
        setTotal(data.total);
      }
    } finally {
      if (isFirstPage) setLoading(false);
      else setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles(0);
  }, [fetchArticles]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchArticles(articles.length);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, articles.length, fetchArticles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (res.ok) {
        const firstSaved = data.collectedAt
          ? new Date(data.collectedAt).toLocaleString(undefined, {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';
        const prefix = data.existed ? '已收藏过' : '收藏成功';
        setMessage(
          `${prefix}！最早入库时间：${firstSaved}（${data.shortLink}）`,
        );
        setUrl('');
        setArticles([]);
        fetchArticles(0);
      } else {
        setMessage(data.error || 'Failed to collect article');
      }
    } catch {
      setMessage('Error collecting article');
    }

    setLoading(false);
  };

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold">GZH Fav</h1>
        <a
          href="/notes"
          className="px-5 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Notes
        </a>
      </div>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste any article or webpage URL here"
            className="flex-1 p-3 border border-gray-300 rounded-lg bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:placeholder-gray-400"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Collecting...' : 'Collect'}
          </button>
        </div>
        {message && <p className="mt-2 text-green-600">{message}</p>}
      </form>

      <div className="space-y-4">
        {loading && <p className="text-center text-gray-500 py-8">Loading...</p>}
        {articles.map((article) => (
          <div key={article.id} className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-xl font-semibold mb-2">
              <a href={`/${article.id}`} className="text-blue-600 hover:underline">
                {article.index ? `${article.index}. ` : ''}{article.title}
              </a>
            </h3>
            <p className="text-gray-600 mb-1">Author: {article.author}</p>
            <p className="text-gray-600 mb-2">
              Collected:{' '}
              {new Date(article.collectedAt).toLocaleString(undefined, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              Original Link
            </a>
          </div>
        ))}
        <div ref={sentinelRef} />
        {loadingMore && <p className="text-center text-gray-500 py-4">Loading...</p>}
      </div>
    </main>
  );
}
