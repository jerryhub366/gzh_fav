import * as cheerio from 'cheerio';
import type { SpecializedArticleExtraction } from './types';

interface DedaoTextPart {
  type?: string;
  text?: {
    content?: string;
    bold?: boolean;
    italic?: boolean;
  };
}

interface DedaoContentNode {
  type?: string;
  text?: string;
  level?: number;
  title?: string;
  desc?: string;
  contents?: DedaoTextPart[];
}

interface DedaoInitialState {
  articleInfo?: {
    article?: {
      PublishTime?: number;
    };
    content?: string;
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

function renderInline(parts: DedaoTextPart[] | undefined, fallback: string) {
  if (!parts?.length) return escapeHtml(fallback);

  return parts
    .map((part) => {
      const text = escapeHtml(part.text?.content || '');
      if (!text) return '';
      const italic = part.text?.italic ? `<em>${text}</em>` : text;
      return part.text?.bold ? `<strong>${italic}</strong>` : italic;
    })
    .join('');
}

function renderNode(node: DedaoContentNode) {
  const text = (node.text || '').trim();
  if (node.type === 'audio') {
    const title = node.title?.replace(/\.(mp3|m4a|aac)$/i, '').trim() || '';
    const desc = node.desc?.trim() || '';
    if (!title && !desc) return '';
    return `<p><strong>${escapeHtml(title)}</strong>${desc ? ` · ${escapeHtml(desc)}` : ''}</p>`;
  }
  if (!text && !node.contents?.length) return '';

  const inline = renderInline(node.contents, text);
  if (node.type === 'header') {
    const level = node.level === 2 ? 3 : 2;
    return `<h${level}>${inline}</h${level}>`;
  }
  return `<p>${inline}</p>`;
}

export function isDedaoUrl(url: URL) {
  return url.hostname === 'dedao.cn' || url.hostname.endsWith('.dedao.cn');
}

export function extractDedaoArticle(html: string): SpecializedArticleExtraction | null {
  const $ = cheerio.load(html);
  let state: DedaoInitialState | null = null;

  $('script').each((_, element) => {
    if (state) return;
    const script = $(element).html() || '';
    const marker = 'window.__INITIAL_STATE__=';
    const markerIndex = script.indexOf(marker);
    if (markerIndex < 0) return;

    const raw = script.slice(markerIndex + marker.length).trim().replace(/;\s*$/, '');
    try {
      state = JSON.parse(raw) as DedaoInitialState;
    } catch {
      state = null;
    }
  });

  if (!state?.articleInfo?.content) return null;

  let nodes: DedaoContentNode[];
  try {
    nodes = JSON.parse(state.articleInfo.content) as DedaoContentNode[];
  } catch {
    return null;
  }
  if (!Array.isArray(nodes)) return null;

  const audio = nodes.find((node) => node.type === 'audio');
  const title =
    audio?.title?.replace(/\.(mp3|m4a|aac)$/i, '').trim() ||
    nodes.find((node) => node.type === 'header')?.text?.trim() ||
    '得到试读';
  const author = audio?.desc?.replace(/\s*亲述\s*$/, '').trim() || '得到';
  const contentHtml = nodes.map(renderNode).filter(Boolean).join('\n');
  const readableText = cheerio.load(contentHtml).text().replace(/\s+/g, ' ').trim();
  if (readableText.length < 80) return null;

  const publishTime = state.articleInfo.article?.PublishTime;
  const publishedAt = publishTime ? new Date(publishTime * 1000) : new Date();

  return {
    title,
    author,
    contentHtml,
    publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date().toISOString() : publishedAt.toISOString(),
    extractionStatus: 'partial',
    extractionMethod: 'dedao_initial_state',
    extractionError: 'Saved the text available in the public Dedao trial-reading page.',
  };
}
