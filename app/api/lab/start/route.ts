import { NextRequest, NextResponse } from 'next/server';
import { consumeChallengeQuota, createChatCard } from '../../../../lib/lab/cards';
import { openChat } from '../../../../lib/lab/coach';
import { DAILY_QUESTIONS, dailyQuestion } from '../../../../lib/lab/daily';
import { resolveOwner, withOwner } from '../../../../lib/lab/owner';
import { RULE_CHALLENGES } from '../../../../lib/lab/principles';

export const maxDuration = 120;

// 开局：{ text } 用一句话观点开始；{ daily: true } 回答今日一问。
export async function POST(request: NextRequest) {
  const ident = resolveOwner(request);
  try {
    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();

    if (body.daily) {
      const q = Number.isInteger(body.index) && DAILY_QUESTIONS[body.index] ? { index: body.index, ...DAILY_QUESTIONS[body.index] } : dailyQuestion();
      const card = await createChatCard(ident.owner, {
        company: q.company,
        claim: q.text,
        kind: 'quality',
        turns: [{ role: 'coach', persona: '今日一问', text: q.text, ref: q.ref, source: 'daily', at: now }],
      });
      return withOwner(NextResponse.json({ card }), ident);
    }

    const text = String(body.text || '').trim().slice(0, 1000);
    if (text.length < 4) {
      return NextResponse.json({ error: '多说几个字：哪家公司、你怎么看' }, { status: 400 });
    }
    const quotaError = await consumeChallengeQuota(ident.owner);
    const opened = quotaError ? null : await openChat(text);
    const fallback = opened || {
      company: text.slice(0, 4),
      kind: 'quality' as const,
      claim: text.slice(0, 120),
      question: { role: 'coach' as const, ...RULE_CHALLENGES.quality[0], source: 'rule' as const, at: now },
      modelId: null,
    };
    const card = await createChatCard(ident.owner, {
      company: fallback.company,
      claim: fallback.claim,
      kind: fallback.kind,
      turns: [{ role: 'me', text, at: now }, fallback.question],
      coachNote: quotaError || ('error' in fallback ? String((fallback as any).error || '') : ''),
    });
    return withOwner(NextResponse.json({ card }), ident);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '开局失败，再试一次' }, { status: 500 });
  }
}
