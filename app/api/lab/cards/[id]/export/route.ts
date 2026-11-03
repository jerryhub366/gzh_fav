import { NextRequest, NextResponse } from 'next/server';
import { getCard } from '../../../../../../lib/lab/cards';
import { resolveOwner } from '../../../../../../lib/lab/owner';
import { cardToMarkdown } from '../../../../../../lib/lab/markdown';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await getCard(id);
  if (!card || card.ownerId !== resolveOwner(request).owner) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  if (request.nextUrl.searchParams.get('format') === 'json') {
    return NextResponse.json({ card });
  }
  return new NextResponse(cardToMarkdown(card), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
