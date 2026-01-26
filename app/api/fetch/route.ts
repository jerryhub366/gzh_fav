import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
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
    const response = await fetch(url);
    const html = await response.text();

    // Parse HTML
    const $ = cheerio.load(html);

    const title = $('title').text() || $('#activity-name').text() || 'Unknown Title';
    const author = $('#js_name').text() || $('#profileBt a').text() || 'Unknown Author';
    const publishedAt = $('#publish_time').text() || new Date().toISOString();
    const content = $('#js_content').html() || '';

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

    // Save to JSON file
    const filePath = path.join(process.cwd(), 'data', 'articles.json');
    let articles: Article[] = [];
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      articles = JSON.parse(data);
    }
    articles.push(article);
    fs.writeFileSync(filePath, JSON.stringify(articles, null, 2));

    return NextResponse.json({ shortLink: `/${id}`, article });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
  }
}