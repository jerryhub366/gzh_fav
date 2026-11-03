import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '../../../../../../lib/admin';
import { getCard } from '../../../../../../lib/lab/cards';
import { cardToMarkdown } from '../../../../../../lib/lab/markdown';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const { id } = await params;
  const card = await getCard(id);
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  if (request.nextUrl.searchParams.get('format') === 'json') {
    return NextResponse.json({ card });
  }
  return new NextResponse(cardToMarkdown(card), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
