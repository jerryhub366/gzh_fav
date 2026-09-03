import { notFound } from 'next/navigation';
import { sql } from '@vercel/postgres';
import { proxyArticleImages } from '../../lib/html';
import AdminEditLink from './AdminEditLink';
import ArticleWorkflowPanel from './ArticleWorkflowPanel';
import { displayArticleTitle } from '../../lib/articleWorkflow';

interface Article {
  id: string;
  url: string;
  title: string;
  author: string;
  content: string;
  published_at: string;
  collected_at: string;
}

async function getArticle(id: string): Promise<Article | null> {
  try {
    const { rows } = await sql`SELECT * FROM articles WHERE id = ${id}`;
    return (rows[0] as Article) || null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id);

  if (!article) {
    notFound();
  }

  const hasContent = article.content?.trim();

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
        <div className="article-content" dangerouslySetInnerHTML={{ __html: proxyArticleImages(article.content) }} />
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
