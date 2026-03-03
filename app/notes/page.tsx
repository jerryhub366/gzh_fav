'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const PAGE_SIZE = 20;

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = notes.length < total;

  const fetchNotes = useCallback(async (offset: number) => {
    const isFirstPage = offset === 0;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetch(`/api/notes?limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      if (res.ok) {
        if (isFirstPage) setNotes(data.notes);
        else setNotes((prev) => [...prev, ...data.notes]);
        setTotal(data.total);
      }
    } finally {
      if (isFirstPage) setLoading(false);
      else setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes(0);
  }, [fetchNotes]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchNotes(notes.length);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, notes.length, fetchNotes]);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold">Notes</h1>
        <div className="flex gap-3">
          <a
            href="/articles"
            className="px-5 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Articles
          </a>
          <a
            href="/note/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            + Add Note
          </a>
        </div>
      </div>

      <div className="space-y-4">
        {loading && <p className="text-center text-gray-500 py-8">Loading...</p>}
        {!loading && notes.length === 0 && (
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
            className="block border border-gray-400 rounded-lg p-4 hover:border-gray-500 dark:border-gray-500 dark:hover:border-gray-400 transition-colors"
          >
            <p className="text-gray-900 dark:text-white mb-2 whitespace-pre-line">
              {note.content.length > 150 ? note.content.slice(0, 150) + '…' : note.content}
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
        <div ref={sentinelRef} />
        {loadingMore && <p className="text-center text-gray-500 py-4">Loading...</p>}
      </div>
    </main>
  );
}
