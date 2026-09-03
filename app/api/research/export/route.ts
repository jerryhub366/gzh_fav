import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import * as cheerio from 'cheerio';
import { isAdminRequest } from '../../../../lib/admin';
import ensureArticleWorkflow from '../../../../lib/db/ensureArticleWorkflow';

function htmlToText(html: string) {
  const $ = cheerio.load(html || '');
  $('script, style, noscript').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    await ensureArticleWorkflow();
    const { rows } = await sql`
      SELECT id, url, title, author, content, personal_note, research_question, tags
      FROM articles
      WHERE status = 'research'
      ORDER BY seq DESC NULLS LAST, collected_at DESC
    `;

    const sections = rows.map((row: any, index: number) => {
      const sourceText = htmlToText(row.content).slice(0, 40_000);
      return [
        `## ${index + 1}. ${row.title}`,
        '',
        `- Fav ID: ${row.id}`,
        `- 来源: ${row.url}`,
        `- 作者: ${row.author || '未知'}`,
        `- 标签: ${(row.tags || []).join(', ') || '无'}`,
        '',
        '### 我的备注',
        row.personal_note || '（未填写）',
        '',
        '### 研究问题',
        row.research_question || '（请先帮助判断这条内容是否值得深入研究）',
        '',
        '### 已抓取正文',
        sourceText || '（没有抓取到正文，请访问原始链接）',
      ].join('\n');
    });

    const markdown = [
      '# Fav 研究队列',
      '',
      `导出时间：${new Date().toISOString()}`,
      `条目数：${rows.length}`,
      '',
      '请先逐条判断信息质量、列出需要核实的关键主张，再围绕“研究问题”开展工作。不要把原文观点直接当成事实。',
      '',
      ...sections,
    ].join('\n\n');

    return new NextResponse(markdown, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': 'attachment; filename="fav-research-queue.md"',
        'Content-Type': 'text/markdown; charset=utf-8',
        'X-Fav-Article-Count': String(rows.length),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to export research queue' }, { status: 500 });
  }
}
