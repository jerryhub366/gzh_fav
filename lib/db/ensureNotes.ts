import { sql } from '@vercel/postgres';

let done = false;

export async function ensureNotes() {
  if (done) return;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    done = true;
  } catch (err) {
    console.error('ensureNotes error:', err);
  }
}

export default ensureNotes;
