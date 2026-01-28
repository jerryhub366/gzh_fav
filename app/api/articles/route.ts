import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    const { rows } = await sql`SELECT * FROM articles ORDER BY collected_at DESC`;
    const mapped = rows.map((r: any) => ({
      id: r.id,
      url: r.url,
      title: r.title,
      author: r.author,
      content: r.content,
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
      collectedAt: r.collected_at ? new Date(r.collected_at).toISOString() : null,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load articles' }, { status: 500 });
  }
}