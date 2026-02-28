import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { createHash } from 'crypto';
import ensureNotes from '../../../lib/db/ensureNotes';

export async function GET(request: NextRequest) {
  try {
    await ensureNotes();

    const { searchParams } = request.nextUrl;
    const limit = Math.max(1, Number(searchParams.get('limit')) || 20);
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0);

    const [{ rows }, { rows: countRows }] = await Promise.all([
      sql`SELECT id, content, created_at FROM notes ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      sql`SELECT COUNT(*) AS total FROM notes`,
    ]);

    const total = Number(countRows[0].total);
    const mapped = rows.map((r: any) => ({
      id: r.id,
      content: r.content,
      createdAt: new Date(r.created_at).toISOString(),
    }));

    return NextResponse.json({ notes: mapped, total });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureNotes();

    const { content } = await request.json();
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const id = createHash('md5')
      .update(content + Date.now().toString())
      .digest('hex')
      .substring(0, 6);

    const createdAt = new Date().toISOString();
    await sql`INSERT INTO notes (id, content, created_at) VALUES (${id}, ${content.trim()}, ${createdAt})`;

    return NextResponse.json({ id, shortLink: `/note/${id}` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
