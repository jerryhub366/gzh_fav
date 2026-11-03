import { after, NextRequest, NextResponse } from 'next/server';
import { resolveOwner, withOwner } from '../../../../lib/lab/owner';
import { toolBySlug } from '../../../../lib/lab/tools/registry';
import { consumeToolQuota, createRun, executeRun, listRuns } from '../../../../lib/lab/tools/runs';

// 模型在 after() 里跑，函数要活到它跑完。
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const ident = resolveOwner(request);
  try {
    const tool = request.nextUrl.searchParams.get('tool') || undefined;
    const runs = await listRuns(ident.owner, tool);
    return withOwner(NextResponse.json({ runs }, { headers: { 'Cache-Control': 'no-store' } }), ident);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '加载失败' }, { status: 500 });
  }
}

// { tool, company, extra? }：立刻返回 run，页面轮询 /api/lab/runs/[id]。
export async function POST(request: NextRequest) {
  const ident = resolveOwner(request);
  try {
    const body = await request.json().catch(() => ({}));
    const tool = toolBySlug(String(body.tool || ''));
    if (!tool) return NextResponse.json({ error: '没有这个工具' }, { status: 404 });
    const company = String(body.company || '').trim().slice(0, 60);
    if (company.length < 2) return NextResponse.json({ error: '写一个公司名或股票代码' }, { status: 400 });
    const extra = tool.extra ? String(body.extra || '').trim().slice(0, 800) : '';

    const quotaError = await consumeToolQuota(ident.owner);
    if (quotaError) return NextResponse.json({ error: quotaError }, { status: 429 });
    const run = await createRun(ident.owner, tool, company, extra);
    after(() => executeRun(run, tool));
    return withOwner(NextResponse.json({ run }), ident);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '启动失败，再试一次' }, { status: 500 });
  }
}
