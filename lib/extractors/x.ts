import type { SpecializedArticleExtraction } from './types';

interface FxTwitterResponse {
  code?: number;
  tweet?: {
    id?: string;
    text?: string;
    created_at?: string;
    created_timestamp?: number;
    author?: {
      name?: string;
      screen_name?: string;
    };
    quote?: {
      text?: string;
      author?: {
        name?: string;
        screen_name?: string;
      };
    };
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function titleFromTweet(text: string) {
  const compact = text.replace(/\s+/g, ' ').trim();
  const sentenceEnd = compact.search(/[。！？!?]/);
  const candidate = sentenceEnd >= 11 ? compact.slice(0, sentenceEnd + 1) : compact;
  return candidate.length > 72 ? `${candidate.slice(0, 72).trimEnd()}…` : candidate;
}

export function isXUrl(url: URL) {
  return /(^|\.)(x\.com|twitter\.com)$/i.test(url.hostname);
}

export async function fetchXArticle(url: URL): Promise<SpecializedArticleExtraction | null> {
  const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/i);
  if (!match) return null;

  const [, handle, tweetId] = match;
  try {
    // X's public page is frequently blocked or empty for server-side fetches.
    // FxTwitter provides a small read-only JSON representation of public posts.
    const apiBaseUrl = process.env.X_EXTRACTOR_BASE_URL || 'https://api.fxtwitter.com';
    const endpoint = new URL(`/${encodeURIComponent(handle)}/status/${tweetId}`, apiBaseUrl);
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gzh-fav/1.0',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as FxTwitterResponse;
    const tweet = data.tweet;
    const text = tweet?.text?.trim() || '';
    if (!tweet || !text || (tweet.id && tweet.id !== tweetId)) return null;

    const screenName = tweet.author?.screen_name || handle;
    const authorName = tweet.author?.name?.trim() || `@${screenName}`;
    const author = authorName.includes(`@${screenName}`)
      ? authorName
      : `${authorName} (@${screenName})`;
    const createdAt = tweet.created_timestamp
      ? new Date(tweet.created_timestamp * 1000)
      : new Date(tweet.created_at || '');

    let contentHtml = textToParagraphs(text);
    if (tweet.quote?.text) {
      const quoteAuthor =
        tweet.quote.author?.name ||
        (tweet.quote.author?.screen_name ? `@${tweet.quote.author.screen_name}` : 'Quoted post');
      contentHtml += `\n<blockquote><p><strong>${escapeHtml(quoteAuthor)}</strong></p>${textToParagraphs(tweet.quote.text)}</blockquote>`;
    }
    contentHtml += `\n<p><a href="${escapeHtml(url.toString())}">View original post on X</a></p>`;

    return {
      title: titleFromTweet(text) || `Post by @${screenName}`,
      author,
      contentHtml,
      publishedAt: Number.isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString(),
      extractionStatus: 'full',
      extractionMethod: 'x_fxtwitter',
    };
  } catch {
    return null;
  }
}
