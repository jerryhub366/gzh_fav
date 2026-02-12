import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import ensureSeq from '../../../lib/db/ensureSeq';

export async function GET(request: NextRequest) {
  try {
    // Ensure seq column and sequence exist before querying
    await ensureSeq();

    const { searchParams } = request.nextUrl;
    const limit = Math.max(1, Number(searchParams.get('limit')) || 20);
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0);

    const [{ rows }, { rows: countRows }] = await Promise.all([
      sql`SELECT * FROM articles ORDER BY seq DESC NULLS LAST, collected_at DESC LIMIT ${limit} OFFSET ${offset}`,
      sql`SELECT COUNT(*) AS total FROM articles`,
    ]);

    const total = Number(countRows[0].total);
    const mapped = rows.map((r: any, i: number) => ({
      id: r.id,
      url: r.url,
      title: r.title,
      author: r.author,
      content: r.content,
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
      collectedAt: r.collected_at ? new Date(r.collected_at).toISOString() : null,
      index: r.seq != null ? Number(r.seq) : offset + i + 1,
    }));

    return NextResponse.json({ articles: mapped, total });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load articles' }, { status: 500 });
  }
}