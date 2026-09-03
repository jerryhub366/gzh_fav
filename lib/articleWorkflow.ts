export const ARTICLE_STATUSES = ['inbox', 'kept', 'research', 'done', 'skipped'] as const;

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  inbox: '待处理',
  kept: '保留',
  research: '研究',
  done: '完成',
  skipped: '略过',
};

export const EXTRACTION_STATUSES = ['full', 'partial', 'link_only', 'failed'] as const;

export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export function isArticleStatus(value: unknown): value is ArticleStatus {
  return typeof value === 'string' && ARTICLE_STATUSES.includes(value as ArticleStatus);
}

export function displayArticleTitle(value: string, maxLength = 110) {
  const normalized = String(value || '').replace(/\\[nrt]/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;

  const sentenceEnd = normalized.search(/[。！？!?]/);
  const candidate = sentenceEnd >= 11 && sentenceEnd < maxLength ? normalized.slice(0, sentenceEnd + 1) : normalized;
  return `${candidate.slice(0, maxLength).trimEnd()}…`;
}
