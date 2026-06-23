'use client';

import { useEffect, useRef, useState } from 'react';

interface Article {
  id: string;
  url: string;
  title: string;
  author: string;
  content: string;
}

export default function EditArticlePage() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setId(window.location.pathname.split('/')[1] || '');
  }, []);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/articles/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.article) throw new Error(data.error || 'Failed to load article');
        const article = data.article as Article;
        setTitle(article.title);
        setAuthor(article.author);
        setUrl(article.url);
        setContent(article.content || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id || !title.trim() || !editorRef.current?.innerHTML.trim()) return;
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          author,
          content: editorRef.current.innerHTML,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      window.location.href = data.shortLink;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="max-w-4xl mx-auto p-6 text-gray-500">Loading...</main>;
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <a href={`/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          Back
        </a>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full mb-3 text-3xl font-bold bg-transparent border-b border-gray-200 pb-2 focus:outline-none focus:border-blue-500"
      />
      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Author"
        className="w-full mb-2 text-gray-600 bg-transparent border-b border-gray-200 pb-2 focus:outline-none focus:border-blue-500"
      />
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block mb-6 text-sm text-blue-600 hover:underline">
        Original Link
      </a>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: content }}
        className="min-h-[60vh] rounded-lg border border-gray-200 bg-white p-5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </main>
  );
}
