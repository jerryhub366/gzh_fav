import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { proxyArticleImages, sanitizeArticleHtml } from '../../../../lib/html';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rows } = await sql`
      SELECT id, url, title, author, content, published_at, collected_at
      FROM articles
      WHERE id = ${id}
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const article = rows[0] as any;
    return NextResponse.json({
      article: {
        id: article.id,
        url: article.url,
        title: article.title,
        author: article.author,
        content: proxyArticleImages(article.content),
        publishedAt: article.published_at ? new Date(article.published_at).toISOString() : null,
        collectedAt: article.collected_at ? new Date(article.collected_at).toISOString() : null,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load article' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { title, author, content } = await request.json();

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const { rows } = await sql`SELECT url FROM articles WHERE id = ${id}`;
    if (!rows[0]) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const baseUrl = rows[0].url ? new URL(rows[0].url) : undefined;
    const cleanContent = sanitizeArticleHtml(content, baseUrl);

    await sql`
      UPDATE articles
      SET title = ${title.trim()}, author = ${author?.trim() || ''}, content = ${cleanContent}
      WHERE id = ${id}
    `;

    return NextResponse.json({ id, shortLink: `/${id}` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save article' }, { status: 500 });
  }
}
