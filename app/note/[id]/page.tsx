'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getAdminSession } from '../../../lib/adminClient';

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;

    async function load() {
      const session = await getAdminSession();
      if (!session.admin) {
        if (active) {
          setError('Admin access required.');
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`/api/notes/${id}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load note');
        if (active) setNote(data.note);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Failed to load note');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <main className="max-w-4xl mx-auto p-6 text-gray-500">Loading...</main>;

  if (!note) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <a href="/notes" className="text-sm text-gray-500 hover:text-gray-700">← Notes</a>
        <p className="mt-6 text-red-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <a href="/notes" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm">
          ← Notes
        </a>
      </div>
      <p className="text-gray-500 text-sm mb-6">
        {new Date(note.createdAt).toLocaleString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      <pre className="whitespace-pre-wrap font-sans text-base text-gray-900 dark:text-white leading-relaxed">
        {note.content}
      </pre>
    </main>
  );
}
