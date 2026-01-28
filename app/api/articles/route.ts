import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import ensureSeq from '../../../lib/db/ensureSeq';

export async function GET() {
  try {
    // Ensure seq column and sequence exist before querying
    await ensureSeq();
    // Prefer persistent seq when available; fall back to row order index
    const { rows } = await sql`SELECT * FROM articles ORDER BY seq DESC NULLS LAST, collected_at DESC`;
    const mapped = rows.map((r: any, i: number) => ({
      id: r.id,
      url: r.url,
      title: r.title,
      author: r.author,
      content: r.content,
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
      collectedAt: r.collected_at ? new Date(r.collected_at).toISOString() : null,
      index: r.seq != null ? Number(r.seq) : i + 1,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load articles' }, { status: 500 });
  }
}