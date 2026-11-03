import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { FriendTake, getCard, publicView, saveCard } from '../../../../../lib/lab/cards';

type Params = { params: Promise<{ id: string }> };

function keyMatches(expected: string, actual: string | null) {
  if (!actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function loadShared(request: NextRequest, params: Params['params']) {
  const { id } = await params;
  const card = await getCard(id);
  if (!card || !keyMatches(card.shareKey, request.nextUrl.searchParams.get('k'))) return null;
  return card;
}

// 朋友打开分享链接：先只看到观点；自己押注后才看到主人和其他人的判断。
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const card = await loadShared(request, params);
    if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const me = request.nextUrl.searchParams.get('me');
    const revealed = Boolean(me && card.data.friends.some((f) => f.name === me));
    return NextResponse.json({ card: publicView(card, revealed), revealed });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const card = await loadShared(request, params);
    if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (card.data.friends.length >= 50) {
      return NextResponse.json({ error: '这张卡的押注已满' }, { status: 400 });
    }
    const body = await request.json();
    const name = String(body.name || '').trim().slice(0, 30);
    const reason = String(body.reason || '').trim().slice(0, 500);
    const stance = ['agree', 'disagree', 'unsure'].includes(body.stance) ? body.stance : null;
    const p = Number(body.probability);
    if (!name || !reason || !stance) {
      return NextResponse.json({ error: '名字、立场、理由都要填' }, { status: 400 });
    }
    const take: FriendTake = {
      name,
      stance,
      probability: Number.isFinite(p) && body.probability !== '' && body.probability != null ? Math.max(0, Math.min(100, Math.round(p))) : null,
      reason,
      createdAt: new Date().toISOString(),
    };
    const friends = [...card.data.friends.filter((f) => f.name !== name), take];
    const saved = await saveCard(card.id, { data: { friends } });
    return NextResponse.json({ card: publicView(saved, true), revealed: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
