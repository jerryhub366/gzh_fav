export type SpecializedExtractionStatus = 'full' | 'partial';

export interface SpecializedArticleExtraction {
  title: string;
  author: string;
  contentHtml: string;
  publishedAt: string;
  extractionStatus: SpecializedExtractionStatus;
  extractionMethod: string;
  extractionError?: string | null;
}
