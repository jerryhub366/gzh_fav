import { NextRequest, NextResponse } from 'next/server';
import { Turn, consumeChallengeQuota, getCard, saveCard } from '../../../../../../lib/lab/cards';
import { nextStep } from '../../../../../../lib/lab/coach';
import { resolveOwner } from '../../../../../../lib/lab/owner';

export const maxDuration = 120;

// 回答陪练的问题：{ reply } 追加一句，然后陪练问下一个；{ finish: true } 直接整理成卡。
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { owner } = resolveOwner(request);
    const card = await getCard(id);
    if (!card || card.ownerId !== owner || card.data.mode !== 'chat') {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }
    if (card.status !== 'draft') {
      return NextResponse.json({ error: '这张卡已经整理过了' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reply = String(body.reply || '').trim().slice(0, 1000);
    const turns: Turn[] = [...(card.data.turns || [])];
    if (reply) turns.push({ role: 'me', text: reply, at: new Date().toISOString() });
    if (!reply && !body.finish) {
      return NextResponse.json({ error: '说一句再发' }, { status: 400 });
    }
    if (body.finish && !turns.some((t) => t.role === 'me')) {
      return NextResponse.json({ error: '至少先回答一个问题' }, { status: 400 });
    }

    const quotaError = await consumeChallengeQuota(owner);
    const working = { ...card, data: { ...card.data, turns } };
    const step = await nextStep(working, { finish: Boolean(body.finish), quotaError });

    if (step.kind === 'question') {
      const saved = await saveCard(id, { data: { turns: [...turns, step.turn] } });
      return NextResponse.json({ card: saved });
    }
    const saved = await saveCard(id, {
      status: 'challenged',
      claim: step.claim || card.claim,
      data: {
        turns,
        keyAssumption: step.keyAssumption,
        falsifiers: step.falsifiers,
        nextChecks: step.nextChecks,
        summary: { weakest: step.weakest, modelId: step.modelId, fallback: step.fallback },
        coachNote: quotaError || card.data.coachNote || '',
      },
    });
    return NextResponse.json({ card: saved });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '陪练卡住了，再发一次' }, { status: 500 });
  }
}
