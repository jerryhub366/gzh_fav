import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '../../../../../lib/admin';
import { CardStatus, deleteCard, getCard, saveCard } from '../../../../../lib/lab/cards';

type Params = { params: Promise<{ id: string }> };

const STATUSES: CardStatus[] = ['draft', 'challenged', 'open', 'resolved'];
const DATA_KEYS = [
  'impulseSource', 'impulseNote', 'draftAnswers', 'initialProbability', 'challenges',
  'finalProbability', 'keyAssumption', 'falsifiers', 'nextChecks', 'outcome', 'lesson',
];

function forbidden() {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
}

export async function GET(request: NextRequest, { params }: Params) {
  if (!isAdminRequest(request)) return forbidden();
  try {
    const { id } = await params;
    const card = await getCard(id);
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    return NextResponse.json({ card }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load card' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!isAdminRequest(request)) return forbidden();
  try {
    const { id } = await params;
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
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    return NextResponse.json({ card });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save card' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  if (!isAdminRequest(request)) return forbidden();
  try {
    const { id } = await params;
    await deleteCard(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 });
  }
}
