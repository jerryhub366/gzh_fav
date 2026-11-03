import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '../../../../lib/admin';
import { createCard, listCards } from '../../../../lib/lab/cards';
import { CARD_KINDS } from '../../../../lib/lab/principles';

function forbidden() {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return forbidden();
  try {
    const cards = await listCards();
    return NextResponse.json({ cards }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load cards' }, { status: 500 });
  }
}

// 也给 agent 用：带 x-admin-token 头即可从 skill 里直接建卡。
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return forbidden();
  try {
    const body = await request.json();
    const company = String(body.company || '').trim();
    const claim = String(body.claim || '').trim();
    const kind = CARD_KINDS.some((k) => k.key === body.kind) ? body.kind : 'quality';
    if (!company || !claim) {
      return NextResponse.json({ error: '公司和观点都要填' }, { status: 400 });
    }
    const card = await createCard({
      company: company.slice(0, 80),
      claim: claim.slice(0, 300),
      kind,
      impulseSource: Array.isArray(body.impulseSource) ? body.impulseSource.map(String).slice(0, 6) : [],
      impulseNote: String(body.impulseNote || '').slice(0, 500),
    });
    return NextResponse.json({ card, url: `/lab/${card.id}` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create card' }, { status: 500 });
  }
}
