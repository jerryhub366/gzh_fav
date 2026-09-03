import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { sql } from '@vercel/postgres';
import { createHash } from 'crypto';
import ensureSeq from '../../../lib/db/ensureSeq';
import ensureArticleWorkflow from '../../../lib/db/ensureArticleWorkflow';
import { sanitizeArticleHtml } from '../../../lib/html';
import { isAdminRequest } from '../../../lib/admin';
import { extractDedaoArticle, isDedaoUrl } from '../../../lib/extractors/dedao';
import { fetchXArticle, isXUrl } from '../../../lib/extractors/x';

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

function normalizeTitle(value: string) {
  return normalizeWhitespace(value.replace(/\\[nrt]/g, ' '));
}

function titleFromContent(value: string, maxLength = 72) {
  const text = normalizeTitle(value);
  if (!text) return '';

  const sentenceEnd = text.search(/[。！？!?]/);
  const candidate = sentenceEnd >= 11 ? text.slice(0, sentenceEnd + 1) : text;
  return candidate.length > maxLength ? `${candidate.slice(0, maxLength).trimEnd()}…` : candidate;
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

function metadataExcerptContent(url: URL, description: string) {
  return `
    <p><strong>Only the page summary was available; the full body was not extracted.</strong></p>
    <p>${escapeHtml(description)}</p>
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

function sourceType(url: URL) {
  if (url.hostname.endsWith('mp.weixin.qq.com')) return 'wechat';
  if (isXUrl(url)) return 'x';
  if (isDedaoUrl(url)) return 'dedao';
  return 'web';
}

// Engagement chrome that X appends to the tweet body (counts + labels). These
// labels don't occur alone in tweet prose, so removing standalone-label leaves
// (and the bare number right before them) is safe.
const X_STAT_LABEL =
  /^(Views?|Reposts?|Retweets?|Likes?|Quotes?|Bookmarks?|Replies|Reply|次查看|查看|转推|转发|喜欢|引用|书签|回复)$/i;
const X_STAT_COMBINED =
  /^[\d.,]+[KMB]?\s*(Views?|Reposts?|Retweets?|Likes?|Quotes?|Bookmarks?|Replies)$/i;

function stripXChrome(html: string) {
  const $ = cheerio.load(html);
  $('*').each((_, element) => {
    const $el = $(element);
    if ($el.children().length) return; // only touch leaf nodes
    const text = normalizeWhitespace($el.text());
    if (!text) return;
    if (X_STAT_COMBINED.test(text) || X_STAT_LABEL.test(text)) {
      const prev = $el.prev();
      if (X_STAT_LABEL.test(text) && prev.length && /^[\d.,]+[KMB]?$/.test(normalizeWhitespace(prev.text()))) {
        prev.remove();
      }
      $el.remove();
    }
  });
  return $.root().html()?.trim() || html;
}

// X/Twitter server HTML only exposes og:title ("Name (@handle) on X") and
// og:description (the tweet body); there is no publish-time meta and the account
// name is buried in og:site_name. Derive a useful author/title/date instead.
function extractXMeta($: cheerio.CheerioAPI, parsedUrl: URL, contentText: string) {
  const ogTitle = firstAttr($, ['meta[property="og:title"]', 'meta[name="twitter:title"]'], 'content');
  const handleFromPath = parsedUrl.pathname.split('/').filter(Boolean)[0] || '';

  let author = '';
  const named = ogTitle.match(/^(.*?)\s*\(@(\w+)\)\s*on\s*X$/i) || ogTitle.match(/^(.*?)\s*\(@(\w+)\)/);
  if (named) {
    author = `${named[1].trim()} (@${named[2]})`;
  } else if (handleFromPath && !['i', 'home', 'status'].includes(handleFromPath.toLowerCase())) {
    author = `@${handleFromPath}`;
  }

  const ogDesc = firstAttr($, ['meta[property="og:description"]', 'meta[name="description"]'], 'content');
  const body = normalizeWhitespace(ogDesc || contentText || '');
  let title = '';
  if (body) {
    const firstChunk = body.split(/[。！？\n]|\.\s/)[0].trim() || body;
    title = firstChunk.length > 46 ? `${firstChunk.slice(0, 46)}…` : firstChunk;
  }

  let publishedAt = '';
  const zh = contentText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const en = contentText.match(/([A-Z][a-z]{2})\s+(\d{1,2}),?\s+(\d{4})/);
  const hm = contentText.match(/(\d{1,2}):(\d{2})/);
  if (zh) {
    const dt = new Date(Date.UTC(Number(zh[1]), Number(zh[2]) - 1, Number(zh[3]), hm ? Number(hm[1]) : 0, hm ? Number(hm[2]) : 0));
    if (!isNaN(dt.getTime())) publishedAt = dt.toISOString();
  } else if (en) {
    const dt = new Date(`${en[1]} ${en[2]}, ${en[3]} UTC`);
    if (!isNaN(dt.getTime())) publishedAt = dt.toISOString();
  }

  return { title, author, publishedAt, body };
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
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

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
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are supported' }, { status: 400 });
    }

    let specializedExtraction = isXUrl(parsedUrl) ? await fetchXArticle(parsedUrl) : null;
    let html = '';
    let effectiveUrl = parsedUrl;

    if (!specializedExtraction) {
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          Referer: parsedUrl.hostname.endsWith('mp.weixin.qq.com') ? 'https://mp.weixin.qq.com/' : parsedUrl.origin,
          'User-Agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
      }
      effectiveUrl = new URL(response.url || parsedUrl.toString());
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

        await Promise.all([ensureSeq(), ensureArticleWorkflow()]);
        const { rows: [saved] } = await sql`
          INSERT INTO articles (
            id, url, title, author, content, published_at, collected_at,
            source_type, extraction_status, extraction_method, extraction_error, extracted_at
          )
          VALUES (
            ${id}, ${article.url}, ${article.title}, ${article.author}, ${article.content},
            ${article.publishedAt}, ${article.collectedAt}, ${sourceType(parsedUrl)},
            'link_only', 'non_html', ${`Unsupported content type: ${contentType}`}, ${article.collectedAt}
          )
          ON CONFLICT (id) DO UPDATE SET
            url = EXCLUDED.url,
            title = EXCLUDED.title,
            author = EXCLUDED.author,
            content = EXCLUDED.content,
            published_at = EXCLUDED.published_at,
            source_type = EXCLUDED.source_type,
            extraction_status = EXCLUDED.extraction_status,
            extraction_method = EXCLUDED.extraction_method,
            extraction_error = EXCLUDED.extraction_error,
            extracted_at = EXCLUDED.extracted_at
          RETURNING collected_at, (xmax::text::bigint <> 0) AS existed
        `;

        return NextResponse.json({
          shortLink: `/${id}`,
          article,
          collectedAt: saved?.collected_at ? new Date(saved.collected_at).toISOString() : article.collectedAt,
          existed: Boolean(saved?.existed),
          extractionStatus: 'link_only',
        });
      }

      html = await response.text();
      if (isDedaoUrl(parsedUrl) || isDedaoUrl(effectiveUrl)) {
        specializedExtraction = extractDedaoArticle(html);
      }
    }

    // Parse HTML
    const $ = cheerio.load(html);

    const metadataTitle = firstAttr(
      $,
      ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[name="title"]'],
      'content',
    );
    const metadataDescription = firstAttr(
      $,
      ['meta[property="og:description"]', 'meta[name="twitter:description"]', 'meta[name="description"]'],
      'content',
    );
    const isWeChat = parsedUrl.hostname.endsWith('mp.weixin.qq.com');
    const headingTitle = firstText($, isWeChat ? ['#activity-name', 'h1'] : ['h1']);
    let title =
      specializedExtraction?.title ||
      (isWeChat ? headingTitle || metadataTitle : metadataTitle || headingTitle) ||
      $('title').text().trim() ||
      fallbackTitle(parsedUrl);
    let author =
      specializedExtraction?.author ||
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
    let publishedAt =
      specializedExtraction?.publishedAt ||
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
    const extractedContentHtml = specializedExtraction ? '' : getContentHtml($);
    const validExtractedContent =
      extractedContentHtml && !isBlockedOrScriptLike(getReadableText(extractedContentHtml));
    const weChatTextHtml = specializedExtraction || validExtractedContent ? '' : getWeChatTextPageHtml(html);
    let contentHtml = specializedExtraction?.contentHtml || (validExtractedContent ? extractedContentHtml : weChatTextHtml || '');
    let extractionMethod =
      specializedExtraction?.extractionMethod ||
      (validExtractedContent ? 'dom' : weChatTextHtml ? 'wechat_text' : 'none');

    if (isXUrl(parsedUrl) && !specializedExtraction) {
      const xMeta = extractXMeta($, parsedUrl, getReadableText(contentHtml));
      if (xMeta.author) author = xMeta.author;
      if (xMeta.title) title = xMeta.title;
      if (xMeta.publishedAt) publishedAt = xMeta.publishedAt;
      contentHtml = stripXChrome(contentHtml);
      if (getReadableText(contentHtml).length < 80 && xMeta.body) {
        contentHtml = textToHtml(xMeta.body);
        extractionMethod = 'x_metadata';
      }
    }

    const contentText = getReadableText(contentHtml);
    const normalizedTitle = normalizeTitle(title);
    const normalizedMetadataTitle = normalizeTitle(metadataTitle);
    const titleLooksLikeBody =
      normalizedTitle.length > 120 ||
      (normalizedTitle.length >= 80 && contentText.startsWith(normalizedTitle.slice(0, 60)));

    if (titleLooksLikeBody) {
      title =
        (normalizedMetadataTitle && normalizedMetadataTitle.length <= 120
          ? normalizedMetadataTitle
          : titleFromContent(contentText || normalizedTitle)) || fallbackTitle(parsedUrl);
    } else {
      title = normalizedTitle || fallbackTitle(parsedUrl);
    }

    // Clean content
    const usableMetadataDescription =
      normalizeWhitespace(metadataDescription).length >= 80 &&
      !isBlockedOrScriptLike(metadataDescription);
    const extractionStatus =
      specializedExtraction?.extractionStatus ||
      (contentText.length >= 80 ? 'full' : usableMetadataDescription ? 'partial' : 'link_only');
    if (contentText.length < 80 && usableMetadataDescription) extractionMethod = 'page_metadata';
    const extractionError =
      specializedExtraction?.extractionError !== undefined
        ? specializedExtraction.extractionError
        : extractionStatus === 'full'
        ? null
        : extractionStatus === 'partial'
          ? 'Full body unavailable; saved page metadata summary.'
          : 'Readable content could not be extracted automatically.';
    const content =
      extractionStatus === 'full'
        ? cleanContent(contentHtml, effectiveUrl)
        : extractionStatus === 'partial'
          ? specializedExtraction
            ? cleanContent(contentHtml, effectiveUrl)
            : metadataExcerptContent(parsedUrl, normalizeWhitespace(metadataDescription))
          : fallbackContent(parsedUrl, extractionError);

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
    await Promise.all([ensureSeq(), ensureArticleWorkflow()]);

    const { rows: [saved] } = await sql`
      INSERT INTO articles (
        id, url, title, author, content, published_at, collected_at,
        source_type, extraction_status, extraction_method, extraction_error, extracted_at
      )
      VALUES (
        ${id}, ${article.url}, ${title}, ${author}, ${content}, ${publishedAt},
        ${article.collectedAt}, ${sourceType(parsedUrl)}, ${extractionStatus},
        ${extractionMethod}, ${extractionError}, ${article.collectedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        url = EXCLUDED.url,
        title = EXCLUDED.title,
        author = EXCLUDED.author,
        content = EXCLUDED.content,
        published_at = EXCLUDED.published_at,
        source_type = EXCLUDED.source_type,
        extraction_status = EXCLUDED.extraction_status,
        extraction_method = EXCLUDED.extraction_method,
        extraction_error = EXCLUDED.extraction_error,
        extracted_at = EXCLUDED.extracted_at
      RETURNING collected_at, (xmax::text::bigint <> 0) AS existed
    `;

    return NextResponse.json({
      shortLink: `/${id}`,
      article,
      collectedAt: saved?.collected_at ? new Date(saved.collected_at).toISOString() : article.collectedAt,
      existed: Boolean(saved?.existed),
      extractionStatus,
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
  }
}
