import { NextRequest, NextResponse } from 'next/server';
import { isValidOwner, resolveOwner, setOwnerCookie, withOwner } from '../../../../lib/lab/owner';

// GET：确保当前浏览器有身份，并返回它（用于生成同步链接）。
export async function GET(request: NextRequest) {
  const ident = resolveOwner(request);
  return withOwner(NextResponse.json({ owner: ident.owner }, { headers: { 'Cache-Control': 'no-store' } }), ident);
}

// POST：在新设备上切换到同步链接里的身份。
export async function POST(request: NextRequest) {
  const { owner } = await request.json().catch(() => ({}));
  if (!isValidOwner(owner)) {
    return NextResponse.json({ error: '同步码无效' }, { status: 400 });
  }
  return setOwnerCookie(NextResponse.json({ owner }), owner);
}
