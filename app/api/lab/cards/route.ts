import { NextRequest, NextResponse } from 'next/server';
import { createCard, listCards } from '../../../../lib/lab/cards';
import { resolveOwner, withOwner } from '../../../../lib/lab/owner';
import { CARD_KINDS } from '../../../../lib/lab/principles';

export async function GET(request: NextRequest) {
  const ident = resolveOwner(request);
  try {
    const cards = ident.isNew ? [] : await listCards(ident.owner);
    return withOwner(NextResponse.json({ cards }, { headers: { 'Cache-Control': 'no-store' } }), ident);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load cards' }, { status: 500 });
  }
}

// 也给 agent 用：带 x-lab-owner 头即可从 skill 里直接建卡。
export async function POST(request: NextRequest) {
  const ident = resolveOwner(request);
  try {
    const body = await request.json();
    const company = String(body.company || '').trim();
    const claim = String(body.claim || '').trim();
    const kind = CARD_KINDS.some((k) => k.key === body.kind) ? body.kind : 'quality';
    if (!company || !claim) {
      return NextResponse.json({ error: '公司和观点都要填' }, { status: 400 });
    }
    const card = await createCard(ident.owner, {
      company: company.slice(0, 80),
      claim: claim.slice(0, 300),
      kind,
      impulseSource: Array.isArray(body.impulseSource) ? body.impulseSource.map(String).slice(0, 6) : [],
      impulseNote: String(body.impulseNote || '').slice(0, 500),
    });
    return withOwner(NextResponse.json({ card, url: `/lab/${card.id}` }), ident);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create card' }, { status: 500 });
  }
}
