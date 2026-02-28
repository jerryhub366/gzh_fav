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

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

type Tab = 'articles' | 'notes';

export default function Home() {
  const [tab, setTab] = useState<Tab>('articles');

  // Articles state
  const [url, setUrl] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesTotal, setArticlesTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState('');

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesTotal, setNotesTotal] = useState(0);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingMoreNotes, setLoadingMoreNotes] = useState(false);

  const articleSentinelRef = useRef<HTMLDivElement>(null);
  const noteSentinelRef = useRef<HTMLDivElement>(null);
  const notesFetched = useRef(false);

  const hasMoreArticles = articles.length < articlesTotal;
  const hasMoreNotes = notes.length < notesTotal;

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
        setArticlesTotal(data.total);
      }
    } finally {
      if (isFirstPage) setLoading(false);
      else setLoadingMore(false);
    }
  }, []);

  const fetchNotes = useCallback(async (offset: number) => {
    const isFirstPage = offset === 0;
    if (isFirstPage) setLoadingNotes(true);
    else setLoadingMoreNotes(true);

    try {
      const res = await fetch(`/api/notes?limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      if (res.ok) {
        if (isFirstPage) setNotes(data.notes);
        else setNotes((prev) => [...prev, ...data.notes]);
        setNotesTotal(data.total);
      }
    } finally {
      if (isFirstPage) setLoadingNotes(false);
      else setLoadingMoreNotes(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles(0);
  }, [fetchArticles]);

  // Lazy-load notes on first tab switch
  useEffect(() => {
    if (tab === 'notes' && !notesFetched.current) {
      notesFetched.current = true;
      fetchNotes(0);
    }
  }, [tab, fetchNotes]);

  // Infinite scroll for articles
  useEffect(() => {
    const sentinel = articleSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreArticles && !loadingMore) {
          fetchArticles(articles.length);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreArticles, loadingMore, articles.length, fetchArticles]);

  // Infinite scroll for notes
  useEffect(() => {
    const sentinel = noteSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreNotes && !loadingMoreNotes) {
          fetchNotes(notes.length);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreNotes, loadingMoreNotes, notes.length, fetchNotes]);

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
        setMessage(`Article collected! Short link: ${data.shortLink}`);
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
      <h1 className="text-4xl font-bold mb-8">GZH Fav</h1>

      {/* Tab switcher */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setTab('articles')}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              tab === 'articles'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Articles
          </button>
          <button
            onClick={() => setTab('notes')}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              tab === 'notes'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Notes
          </button>
        </div>

        <a
          href="/note/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          + Add Note
        </a>
      </div>

      {/* Articles tab */}
      {tab === 'articles' && (
        <>
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="flex gap-4">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste WeChat article URL here"
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
            <div ref={articleSentinelRef} />
            {loadingMore && <p className="text-center text-gray-500 py-4">Loading...</p>}
          </div>
        </>
      )}

      {/* Notes tab */}
      {tab === 'notes' && (
        <div className="space-y-4">
          {loadingNotes && <p className="text-center text-gray-500 py-8">Loading...</p>}
          {!loadingNotes && notes.length === 0 && (
            <p className="text-center text-gray-500 py-12">
              No notes yet.{' '}
              <a href="/note/new" className="text-blue-600 hover:underline">
                Add your first note
              </a>
              .
            </p>
          )}
          {notes.map((note) => (
            <a
              key={note.id}
              href={`/note/${note.id}`}
              className="block border border-gray-200 rounded-lg p-4 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600 transition-colors"
            >
              <p className="text-gray-900 dark:text-white mb-2 line-clamp-3 whitespace-pre-line">
                {note.content}
              </p>
              <p className="text-gray-500 text-sm">
                {new Date(note.createdAt).toLocaleString(undefined, {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </a>
          ))}
          <div ref={noteSentinelRef} />
          {loadingMoreNotes && <p className="text-center text-gray-500 py-4">Loading...</p>}
        </div>
      )}
    </main>
  );
}
