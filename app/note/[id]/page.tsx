import { notFound } from 'next/navigation';
import { sql } from '@vercel/postgres';
import ensureNotes from '../../../lib/db/ensureNotes';

interface Note {
  id: string;
  content: string;
  created_at: string;
}

async function getNote(id: string): Promise<Note | null> {
  try {
    await ensureNotes();
    const { rows } = await sql`SELECT * FROM notes WHERE id = ${id}`;
    return (rows[0] as Note) || null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await getNote(id);

  if (!note) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <a href="/?tab=notes" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm">
          ← Back
        </a>
      </div>
      <p className="text-gray-500 text-sm mb-6">
        {new Date(note.created_at).toLocaleString(undefined, {
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
    </div>
  );
}
