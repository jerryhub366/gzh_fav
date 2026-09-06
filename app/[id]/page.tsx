import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import { sql } from '@vercel/postgres';
import { proxyArticleImages } from '../../lib/html';
import AdminEditLink from './AdminEditLink';
import ArticleWorkflowPanel from './ArticleWorkflowPanel';
import { displayArticleTitle } from '../../lib/articleWorkflow';

export const preferredRegion = ['sin1'];

interface Article {
  id: string;
  url: string;
  title: string;
  author: string;
  content: string;
  published_at: string;
  collected_at: string;
}

// Load article and precompute the render-ready HTML (image proxying + theme color
// stripping) in one cached unit, so repeat views skip both the DB round trip and
// the per-request Cheerio pass. The cache is invalidated via the
// 'article-detail' tag whenever content is created or edited.
async function loadArticle(id: string) {
  const { rows } = await sql`SELECT * FROM articles WHERE id = ${id}`;
  const article = rows[0] as Article | undefined;
  if (!article) return null;
  return {
    id: article.id,
    url: article.url,
    title: article.title,
    author: article.author,
    published_at: article.published_at,
    collected_at: article.collected_at,
    contentHtml: proxyArticleImages(article.content),
  };
}

const getArticleCached = unstable_cache(loadArticle, undefined, {
  revalidate: 600,
  tags: ['article-detail'],
});

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticleCached(id);

  if (!article) {
    notFound();
  }

  const hasContent = article.contentHtml?.trim();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <AdminEditLink id={article.id} />
      <h1 className="text-3xl font-bold mb-4">{displayArticleTitle(article.title)}</h1>
      <p className="text-gray-600 mb-2">Author: {article.author}</p>
      <div className="mb-6 flex flex-wrap gap-x-4 gap-y-2 text-gray-600">
        <span>Published: {new Date(article.published_at).toLocaleDateString()}</span>
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          Original source ↗
        </a>
      </div>
      <ArticleWorkflowPanel id={article.id} />
      {hasContent ? (
        <div className="article-content" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
      ) : (
        <div className="rounded-lg border border-gray-200 p-4 text-gray-700">
          <p className="mb-3">Readable content was not extracted for this URL.</p>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Open original link
          </a>
        </div>
      )}
    </div>
  );
}
