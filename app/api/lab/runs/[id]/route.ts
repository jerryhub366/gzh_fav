import { NextRequest, NextResponse } from 'next/server';
import { resolveOwner } from '../../../../../lib/lab/owner';
import { deleteRun, getRun } from '../../../../../lib/lab/tools/runs';

type Params = { params: Promise<{ id: string }> };

// 只认主人；别人的记录一律当作不存在。
async function ownRun(request: NextRequest, params: Params['params']) {
  const { id } = await params;
  const run = await getRun(id);
  return run && run.ownerId === resolveOwner(request).owner ? run : null;
}

function notFound() {
  return NextResponse.json({ error: '找不到这条记录' }, { status: 404 });
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const run = await ownRun(request, params);
    if (!run) return notFound();
    return NextResponse.json({ run }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '加载失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const run = await ownRun(request, params);
    if (!run) return notFound();
    await deleteRun(run.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
