import * as cheerio from 'cheerio';

function proxiedImageSrc(src: string) {
  try {
    const url = new URL(src, 'http://localhost');
    if (url.pathname === '/api/image') return `${url.pathname}${url.search}`;
    if (url.hostname.endsWith('qpic.cn')) {
      return `/api/image?url=${encodeURIComponent(url.toString())}`;
    }
  } catch {
    return src;
  }

  return src;
}

// WeChat bakes explicit dark text colors (e.g. color: rgba(0,0,0,.9)) and white
// backgrounds into inline styles. Left in place, that text turns invisible in the
// app's dark mode (black-on-black), which reads as missing characters. Strip color
// declarations so text inherits the page's theme foreground instead.
const THEME_UNSAFE_PROPS = new Set(['color', 'background-color', 'background']);

function stripThemeColors($: cheerio.CheerioAPI) {
  $('[style]').each((_, element) => {
    const style = $(element).attr('style') || '';
    const kept = style
      .split(';')
      .map((decl) => decl.trim())
      .filter(Boolean)
      .filter((decl) => !THEME_UNSAFE_PROPS.has(decl.split(':')[0]?.trim().toLowerCase()));
    if (kept.length) $(element).attr('style', kept.join('; '));
    else $(element).removeAttr('style');
  });
  $('[color]').each((_, element) => $(element).removeAttr('color'));
  $('[bgcolor]').each((_, element) => $(element).removeAttr('bgcolor'));
}

export function proxyArticleImages(html: string) {
  const $ = cheerio.load(html || '');
  $('img[src]').each((_, element) => {
    const src = $(element).attr('src');
    if (src) $(element).attr('src', proxiedImageSrc(src));
  });
  stripThemeColors($);

  return $.root().html()?.trim() || '';
}

export function sanitizeArticleHtml(html: string, baseUrl?: URL) {
  const $ = cheerio.load(html || '');
  $('script, iframe, object, embed, form, input, textarea, select, button, noscript').remove();

  $('*').each((_, element) => {
    const attribs = $(element).attr() || {};
    for (const attr of Object.keys(attribs)) {
      const lower = attr.toLowerCase();
      const value = attribs[attr]?.trim().toLowerCase();
      if (lower.startsWith('on') || value?.startsWith('javascript:')) {
        $(element).removeAttr(attr);
      }
    }
  });

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    try {
      $(element).attr('href', baseUrl ? new URL(href, baseUrl).toString() : href);
      $(element).attr('target', '_blank');
      $(element).attr('rel', 'noopener noreferrer');
    } catch {
      $(element).removeAttr('href');
    }
  });

  $('img').each((_, element) => {
    const src = $(element).attr('src') || $(element).attr('data-src');
    if (!src) return;
    try {
      const absolute = src.startsWith('/api/image') ? src : baseUrl ? new URL(src, baseUrl).toString() : src;
      $(element).attr('src', proxiedImageSrc(absolute));
    } catch {
      $(element).removeAttr('src');
    }
  });

  $('video[src], audio[src], source[src]').each((_, element) => {
    const src = $(element).attr('src');
    if (!src) return;
    try {
      $(element).attr('src', baseUrl ? new URL(src, baseUrl).toString() : src);
    } catch {
      $(element).removeAttr('src');
    }
  });

  stripThemeColors($);

  return $.root().html()?.trim() || '';
}
