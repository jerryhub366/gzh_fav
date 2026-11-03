import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '../../../../../../lib/admin';
import { getCard, saveCard } from '../../../../../../lib/lab/cards';
import { generateChallenges } from '../../../../../../lib/lab/challenger';
import { DRAFT_QUESTIONS } from '../../../../../../lib/lab/principles';

export const maxDuration = 120;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  try {
    const { id } = await params;
    const card = await getCard(id);
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

    // Blank-first：自己没答完，不给挑战。
    const missing = DRAFT_QUESTIONS[card.kind].filter((q) => !card.data.draftAnswers[q.key]?.trim());
    if (missing.length || card.data.initialProbability == null) {
      return NextResponse.json({ error: '先把三道题和概率自己答完，再召唤挑战者' }, { status: 400 });
    }

    const { challenges, meta } = await generateChallenges(card);
    const saved = await saveCard(id, {
      status: card.status === 'draft' ? 'challenged' : card.status,
      data: { challenges, challengeMeta: meta },
    });
    return NextResponse.json({ card: saved });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to generate challenges' }, { status: 500 });
  }
}
