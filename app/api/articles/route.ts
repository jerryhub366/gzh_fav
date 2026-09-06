import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import ensureSeq from '../../../lib/db/ensureSeq';
import ensureArticleWorkflow from '../../../lib/db/ensureArticleWorkflow';
import { isAdminRequest } from '../../../lib/admin';
import { isArticleStatus } from '../../../lib/articleWorkflow';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://agent.ladebuid.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    await Promise.all([ensureSeq(), ensureArticleWorkflow()]);

    const { searchParams } = request.nextUrl;
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0);
    const admin = isAdminRequest(request);
    const requestedStatus = searchParams.get('status');
    const status = admin && isArticleStatus(requestedStatus) ? requestedStatus : null;
    const query = admin ? searchParams.get('q')?.trim().slice(0, 200) || '' : '';
    const queryPattern = `%${query}%`;

    const [{ rows }, { rows: countRows }, { rows: statusRows }] = await Promise.all([
      sql`
        SELECT
          id, url, title, author, published_at, collected_at, seq,
          CASE WHEN ${admin} THEN status ELSE NULL END AS status,
          CASE WHEN ${admin} THEN personal_note ELSE NULL END AS personal_note,
          CASE WHEN ${admin} THEN research_question ELSE NULL END AS research_question,
          CASE WHEN ${admin} THEN tags ELSE NULL END AS tags,
          CASE WHEN ${admin} THEN source_type ELSE NULL END AS source_type,
          CASE WHEN ${admin} THEN extraction_status ELSE NULL END AS extraction_status
        FROM articles
        WHERE (${status}::TEXT IS NULL OR status = ${status})
          AND (${query} = '' OR title ILIKE ${queryPattern} OR author ILIKE ${queryPattern} OR url ILIKE ${queryPattern})
        ORDER BY seq DESC NULLS LAST, collected_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) AS total
        FROM articles
        WHERE (${status}::TEXT IS NULL OR status = ${status})
          AND (${query} = '' OR title ILIKE ${queryPattern} OR author ILIKE ${queryPattern} OR url ILIKE ${queryPattern})
      `,
      admin
        ? sql`SELECT status, COUNT(*)::INT AS count FROM articles GROUP BY status`
        : Promise.resolve({ rows: [] }),
    ]);

    const total = Number(countRows[0].total);
    const mapped = rows.map((r: any, i: number) => ({
      id: r.id,
      url: r.url,
      title: r.title,
      author: r.author,
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
      collectedAt: r.collected_at ? new Date(r.collected_at).toISOString() : null,
      index: r.seq != null ? Number(r.seq) : offset + i + 1,
      ...(admin
        ? {
            status: r.status,
            personalNote: r.personal_note || '',
            researchQuestion: r.research_question || '',
            tags: r.tags || [],
            sourceType: r.source_type,
            extractionStatus: r.extraction_status,
          }
        : {}),
    }));

    const statusCounts = admin
      ? Object.fromEntries(statusRows.map((row: any) => [row.status, Number(row.count)]))
      : undefined;

    return NextResponse.json({ articles: mapped, total, statusCounts }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load articles' }, { status: 500, headers: corsHeaders });
  }
}
