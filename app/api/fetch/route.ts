import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { sql } from '@vercel/postgres';
import { createHash } from 'crypto';
import ensureSeq from '../../../lib/db/ensureSeq';
import { sanitizeArticleHtml } from '../../../lib/html';

interface Article {
  id: string;
  url: string;
  title: string;
  author: string;
  content: string;
  publishedAt: string;
  collectedAt: string;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function firstText($: cheerio.CheerioAPI, selectors: string[]) {
  for (const selector of selectors) {
    const value = $(selector).first().text().trim();
    if (value) return value;
  }
  return '';
}

function firstAttr($: cheerio.CheerioAPI, selectors: string[], attr: string) {
  for (const selector of selectors) {
    const value = $(selector).first().attr(attr)?.trim();
    if (value) return value;
  }
  return '';
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function fallbackTitle(url: URL) {
  const lastSegment = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
  return lastSegment || url.hostname;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fallbackContent(url: URL, reason: string) {
  return `
    <p>${escapeHtml(reason)}</p>
    <p><a href="${escapeHtml(url.toString())}" target="_blank" rel="noopener noreferrer">Open original link</a></p>
  `.trim();
}

function decodeJsString(value: string) {
  return value
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function textToHtml(value: string) {
  const $ = cheerio.load('<div></div>');
  const container = $('div');
  container.text(value);

  container.html(
    (container.html() || '')
      .replace(/&lt;(\/?a\b.*?)&gt;/g, '<$1>')
      .replace(/(<a\b[^>]*>)(.*?)(?=<br>|$)/g, '$1$2</a>'),
  );
  container
    .find('a[href]')
    .each((_, element) => {
      const href = $(element).attr('href');
      if (href) $(element).attr('href', href.replace(/&amp;/g, '&'));
    });

  return container
    .html()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim().replace(/\n/g, '<br>'))
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join('\n');
}

function getWeChatTextPageHtml(rawHtml: string) {
  const match =
    rawHtml.match(/content_noencode\s*:\s*'((?:\\.|[^'\\])*)'/) ||
    rawHtml.match(/text_page_info\s*:\s*\{[\s\S]*?content\s*:\s*'((?:\\.|[^'\\])*)'/);
  if (!match) return '';

  const decoded = cheerio.load('<div></div>').root().text(decodeJsString(match[1])).text();
  return getReadableText(decoded).length >= 80 ? textToHtml(decoded) : '';
}

function cleanContent(html: string, baseUrl: URL) {
  return sanitizeArticleHtml(html, baseUrl);
}

function getReadableText(html: string) {
  return cheerio
    .load(html)
    .text()
    .replace(/\s+/g, ' ')
    .trim();
}

function isBlockedOrScriptLike(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return true;

  const blockedPhrases = [
    '当前环境异常',
    '完成验证后即可继续访问',
    'enable javascript',
    'please enable cookies',
    'access denied',
  ];
  if (blockedPhrases.some((phrase) => normalized.toLowerCase().includes(phrase.toLowerCase()))) {
    return true;
  }

  const scriptMarkers = ['function ', 'var ', 'const ', 'let ', 'window.', 'document.', '__INLINE_SCRIPT__'];
  const markerCount = scriptMarkers.filter((marker) => normalized.includes(marker)).length;
  if (
    normalized.includes('window.cgiDataNew') ||
    normalized.includes('window.__ajaxTransferConfig') ||
    normalized.includes('text_page_info') ||
    normalized.includes('content_noencode')
  ) {
    return true;
  }

  return markerCount >= 3 && normalized.length > 1000;
}

function getContentHtml($: cheerio.CheerioAPI) {
  const preferred = [
    '#js_content',
    'article',
    'main',
    '[role="main"]',
    '.article',
    '.post',
    '.content',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.markdown-body',
  ];

  for (const selector of preferred) {
    const html = $(selector).first().html();
    const text = html ? getReadableText(html) : '';
    if (html && text.length >= 120 && !isBlockedOrScriptLike(text)) return html;
  }

  let bestHtml = '';
  let bestScore = 0;
  $('body *').each((_, element) => {
    if (element.tagName === 'script' || element.tagName === 'style') return;
    const $element = $(element);
    if ($element.parents('script, style').length) return;
    if ($element.find('article, main, section, div, p').length > 200) return;

    const text = normalizeWhitespace($element.text());
    if (text.length < 120) return;
    if (isBlockedOrScriptLike(text)) return;

    const linkText = normalizeWhitespace($element.find('a').text()).length;
    const paragraphCount = $element.find('p').length;
    const headingCount = $element.find('h1, h2, h3').length;
    const score = text.length + paragraphCount * 80 + headingCount * 40 - linkText * 0.6;

    if (score > bestScore) {
      bestScore = score;
      bestHtml = $element.html() || '';
    }
  });

  return bestHtml;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Fetch the article
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        Referer: parsedUrl.hostname.endsWith('mp.weixin.qq.com') ? 'https://mp.weixin.qq.com/' : parsedUrl.origin,
        'User-Agent': USER_AGENT,
      },
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      const id = createHash('md5').update(parsedUrl.toString()).digest('hex').substring(0, 6);
      const collectedAt = new Date().toISOString();
      const article: Article = {
        id,
        url: parsedUrl.toString(),
        title: fallbackTitle(parsedUrl),
        author: parsedUrl.hostname.replace(/^www\./, ''),
        content: fallbackContent(parsedUrl, `This URL points to ${contentType}, so no web page body was extracted.`),
        publishedAt: collectedAt,
        collectedAt,
      };

      await ensureSeq();
      await sql`
        INSERT INTO articles (id, url, title, author, content, published_at, collected_at)
        VALUES (${id}, ${article.url}, ${article.title}, ${article.author}, ${article.content}, ${article.publishedAt}, ${article.collectedAt})
        ON CONFLICT (id) DO UPDATE SET
          url = EXCLUDED.url,
          title = EXCLUDED.title,
          author = EXCLUDED.author,
          content = EXCLUDED.content,
          published_at = EXCLUDED.published_at
      `;

      return NextResponse.json({ shortLink: `/${id}`, article });
    }
    const html = await response.text();

    // Parse HTML
    const $ = cheerio.load(html);

    const title =
      firstText($, ['#activity-name', 'h1']) ||
      firstAttr(
        $,
        ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[name="title"]'],
        'content',
      ) ||
      $('title').text().trim() ||
      fallbackTitle(parsedUrl);
    const author =
      firstText($, ['#js_name', '#profileBt a', '.author', '.byline', '[rel="author"]']) ||
      firstAttr(
        $,
        [
          'meta[name="author"]',
          'meta[property="article:author"]',
          'meta[name="twitter:creator"]',
          'meta[property="og:site_name"]',
          'meta[name="application-name"]',
        ],
        'content',
      ) ||
      parsedUrl.hostname.replace(/^www\./, '');
    const publishedAt =
      firstAttr(
        $,
        [
          'meta[property="article:published_time"]',
          'meta[property="article:modified_time"]',
          'meta[name="publishdate"]',
          'meta[name="pubdate"]',
          'meta[itemprop="datePublished"]',
          'meta[name="date"]',
          'time[datetime]',
        ],
        'content',
      ) ||
      firstAttr($, ['time[datetime]'], 'datetime') ||
      firstText($, ['#publish_time', 'time']) ||
      new Date().toISOString();
    const extractedContentHtml = getContentHtml($);
    const contentHtml =
      extractedContentHtml && !isBlockedOrScriptLike(getReadableText(extractedContentHtml))
        ? extractedContentHtml
        : getWeChatTextPageHtml(html) || '';

    // Clean content
    const content =
      getReadableText(contentHtml).length >= 80
        ? cleanContent(contentHtml, parsedUrl)
        : fallbackContent(parsedUrl, 'Readable content could not be extracted automatically.');

    // Generate short ID
    const id = createHash('md5').update(parsedUrl.toString()).digest('hex').substring(0, 6);

    const article: Article = {
      id,
      url: parsedUrl.toString(),
      title,
      author,
      content,
      publishedAt,
      collectedAt: new Date().toISOString(),
    };

    // Save to database
    // Ensure seq exists and is ready
    await ensureSeq();

    await sql`
      INSERT INTO articles (id, url, title, author, content, published_at, collected_at)
      VALUES (${id}, ${article.url}, ${title}, ${author}, ${content}, ${publishedAt}, ${article.collectedAt})
      ON CONFLICT (id) DO UPDATE SET
        url = EXCLUDED.url,
        title = EXCLUDED.title,
        author = EXCLUDED.author,
        content = EXCLUDED.content,
        published_at = EXCLUDED.published_at
    `;

    return NextResponse.json({ shortLink: `/${id}`, article });
  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
  }
}
