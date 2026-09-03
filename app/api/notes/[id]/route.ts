import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { isAdminRequest } from '../../../../lib/admin';
import ensureNotes from '../../../../lib/db/ensureNotes';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    await ensureNotes();
    const { id } = await params;
    const { rows } = await sql`SELECT id, content, created_at FROM notes WHERE id = ${id}`;
    if (!rows[0]) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({
      note: {
        id: rows[0].id,
        content: rows[0].content,
        createdAt: new Date(rows[0].created_at).toISOString(),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load note' }, { status: 500 });
  }
}
