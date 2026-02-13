import { sql } from '@vercel/postgres';

let done = false;

export async function ensureSeq() {
  if (done) return;

  try {
    // Create sequence if missing
    await sql`CREATE SEQUENCE IF NOT EXISTS articles_seq`;

    // Add seq column if missing
    await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS seq bigint`;

    // Ensure default uses the sequence
    await sql`ALTER TABLE articles ALTER COLUMN seq SET DEFAULT nextval('articles_seq')`;

    // Backfill existing rows that have null seq by grabbing nextval per row
    await sql`UPDATE articles SET seq = nextval('articles_seq') WHERE seq IS NULL`;

    // Advance the sequence to the current max(seq)
    await sql`SELECT setval('articles_seq', (SELECT COALESCE(MAX(seq), 0) FROM articles))`;

    // Create index for the ORDER BY used in listing queries
    await sql`CREATE INDEX IF NOT EXISTS idx_articles_seq_collected ON articles (seq DESC NULLS LAST, collected_at DESC)`;

    done = true;
  } catch (err) {
    // Don't throw - callers should handle failures gracefully
    console.error('ensureSeq error:', err);
  }
}

export default ensureSeq;
