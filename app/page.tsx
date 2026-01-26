'use client';

import { useState, useEffect } from 'react';

interface Article {
  id: string;
  url: string;
  title: string;
  author: string;
  content: string;
  publishedAt: string;
  collectedAt: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    const res = await fetch('/api/articles');
    const data = await res.json();
    setArticles(data);
  };

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
        fetchArticles();
      } else {
        setMessage(data.error || 'Failed to collect article');
      }
    } catch (error) {
      setMessage('Error collecting article');
    }

    setLoading(false);
  };

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8">GZH Fav</h1>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste WeChat article URL here"
            className="flex-1 p-3 border border-gray-300 rounded-lg"
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

      <h2 className="text-2xl font-bold mb-4">Collected Articles</h2>
      <div className="space-y-4">
        {articles.map((article) => (
          <div key={article.id} className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-xl font-semibold mb-2">
              <a href={`/${article.id}`} className="text-blue-600 hover:underline">
                {article.title}
              </a>
            </h3>
            <p className="text-gray-600 mb-1">Author: {article.author}</p>
            <p className="text-gray-600 mb-2">Collected: {new Date(article.collectedAt).toLocaleDateString()}</p>
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              Original Link
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}