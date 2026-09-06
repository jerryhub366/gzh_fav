import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { isAdminRequest } from '../../../../../lib/admin';
import { isArticleStatus } from '../../../../../lib/articleWorkflow';
import ensureArticleWorkflow from '../../../../../lib/db/ensureArticleWorkflow';

function forbidden() {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
}

function mapWorkflow(row: any) {
  return {
    status: row.status,
    personalNote: row.personal_note || '',
    researchQuestion: row.research_question || '',
    tags: row.tags || [],
    sourceType: row.source_type,
    extractionStatus: row.extraction_status,
    extractionMethod: row.extraction_method,
    extractionError: row.extraction_error,
    extractedAt: row.extracted_at ? new Date(row.extracted_at).toISOString() : null,
    workflowUpdatedAt: row.workflow_updated_at
      ? new Date(row.workflow_updated_at).toISOString()
      : null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) return forbidden();

  try {
    await ensureArticleWorkflow();
    const { id } = await params;
    const { rows } = await sql`
      SELECT
        status, personal_note, research_question, tags, source_type,
        extraction_status, extraction_method, extraction_error,
        extracted_at, workflow_updated_at
      FROM articles
      WHERE id = ${id}
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json({ workflow: mapWorkflow(rows[0]) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load workflow' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) return forbidden();

  try {
    await ensureArticleWorkflow();
    const { id } = await params;
    const body = await request.json();
    const { rows } = await sql`
      SELECT status, personal_note, research_question, tags
      FROM articles
      WHERE id = ${id}
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const current = rows[0] as any;
    const status = body.status === undefined ? current.status : body.status;
    if (!isArticleStatus(status)) {
      return NextResponse.json({ error: 'Invalid article status' }, { status: 400 });
    }

    const personalNote = String(body.personalNote ?? current.personal_note ?? '').trim();
    const researchQuestion = String(body.researchQuestion ?? current.research_question ?? '').trim();
    if (personalNote.length > 20_000 || researchQuestion.length > 10_000) {
      return NextResponse.json({ error: 'Note is too long' }, { status: 400 });
    }

    const rawTags = body.tags === undefined ? current.tags || [] : body.tags;
    if (!Array.isArray(rawTags)) {
      return NextResponse.json({ error: 'Tags must be an array' }, { status: 400 });
    }
    const tags = [...new Set(rawTags.map((tag) => String(tag).trim()).filter(Boolean))];
    if (tags.length > 20 || tags.some((tag) => tag.length > 40)) {
      return NextResponse.json({ error: 'Too many tags or tag is too long' }, { status: 400 });
    }
    const tagsJson = JSON.stringify(tags);

    const { rows: updatedRows } = await sql`
      UPDATE articles
      SET
        status = ${status},
        personal_note = ${personalNote},
        research_question = ${researchQuestion},
        tags = ARRAY(SELECT jsonb_array_elements_text(${tagsJson}::JSONB)),
        workflow_updated_at = NOW()
      WHERE id = ${id}
      RETURNING
        status, personal_note, research_question, tags, source_type,
        extraction_status, extraction_method, extraction_error,
        extracted_at, workflow_updated_at
    `;

    return NextResponse.json({ workflow: mapWorkflow(updatedRows[0]) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save workflow' }, { status: 500 });
  }
}
