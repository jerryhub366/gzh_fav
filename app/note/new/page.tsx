'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewNote() {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(data.shortLink);
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch {
      setError('Error saving note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <a href="/" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm">
          ← Back
        </a>
        <h1 className="text-2xl font-bold">New Note</h1>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your idea or note..."
        className="w-full h-64 p-4 border border-gray-300 rounded-lg bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoFocus
      />

      {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}

      <div className="mt-4 flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <a
          href="/"
          className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          Cancel
        </a>
      </div>
    </main>
  );
}
