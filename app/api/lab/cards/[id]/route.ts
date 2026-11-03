import { NextRequest, NextResponse } from 'next/server';
import { CardStatus, deleteCard, getCard, saveCard } from '../../../../../lib/lab/cards';
import { resolveOwner } from '../../../../../lib/lab/owner';

type Params = { params: Promise<{ id: string }> };

const STATUSES: CardStatus[] = ['draft', 'challenged', 'open', 'resolved'];
const DATA_KEYS = [
  'impulseSource', 'impulseNote', 'draftAnswers', 'initialProbability', 'challenges',
  'finalProbability', 'keyAssumption', 'falsifiers', 'nextChecks', 'outcome', 'lesson',
];

function notFound() {
  return NextResponse.json({ error: 'Card not found' }, { status: 404 });
}

// 只认卡片主人；别人的卡一律当作不存在。
async function ownCard(request: NextRequest, params: Params['params']) {
  const { id } = await params;
  const card = await getCard(id);
  return card && card.ownerId === resolveOwner(request).owner ? card : null;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const card = await ownCard(request, params);
    if (!card) return notFound();
    return NextResponse.json({ card }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load card' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const own = await ownCard(request, params);
    if (!own) return notFound();
    const id = own.id;
    const body = await request.json();
    const data = Object.fromEntries(
      Object.entries(body.data || {}).filter(([key]) => DATA_KEYS.includes(key)),
    );
    const card = await saveCard(id, {
      company: typeof body.company === 'string' ? body.company.trim().slice(0, 80) : undefined,
      claim: typeof body.claim === 'string' ? body.claim.trim().slice(0, 300) : undefined,
      status: STATUSES.includes(body.status) ? body.status : undefined,
      reviewDate: body.reviewDate === undefined ? undefined : body.reviewDate || null,
      data,
    });
    if (!card) return notFound();
    return NextResponse.json({ card });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save card' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const card = await ownCard(request, params);
    if (!card) return notFound();
    await deleteCard(card.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 });
  }
}
