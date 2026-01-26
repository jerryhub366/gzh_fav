import { notFound } from 'next/navigation';
import { sql } from '@vercel/postgres';

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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
      <p className="text-gray-600 mb-2">Author: {article.author}</p>
      <p className="text-gray-600 mb-4">Published: {new Date(article.published_at).toLocaleDateString()}</p>
      <div dangerouslySetInnerHTML={{ __html: article.content }} />
    </div>
  );
}