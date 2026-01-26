import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { sql } from '@vercel/postgres';
import { createHash } from 'crypto';

interface Article {
  id: string;
  url: string;
  title: string;
  author: string;
  content: string;
  publishedAt: string;
  collectedAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Fetch the article
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
    }
    const html = await response.text();

    // Parse HTML
    const $ = cheerio.load(html);

    const title = $('#activity-name').text().trim() || $('title').text().trim() || 'Unknown Title';
    const author = $('#js_name').text().trim() || $('#profileBt a').text().trim() || 'Unknown Author';
    const publishedAt = $('meta[property="article:published_time"]').attr('content') || $('#publish_time').text().trim() || new Date().toISOString();
    const contentHtml = $('#js_content').html() || '';

    // Clean content
    const content = contentHtml.replace(/<script[\s\S]*?<\/script>/gi, '').trim();

    // Generate short ID
    const id = createHash('md5').update(url).digest('hex').substring(0, 6);

    const article: Article = {
      id,
      url,
      title,
      author,
      content,
      publishedAt,
      collectedAt: new Date().toISOString(),
    };

    // Save to database
    await sql`
      INSERT INTO articles (id, url, title, author, content, published_at, collected_at)
      VALUES (${id}, ${url}, ${title}, ${author}, ${content}, ${publishedAt}, ${article.collectedAt})
    `;

    return NextResponse.json({ shortLink: `/${id}`, article });
  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
  }
}