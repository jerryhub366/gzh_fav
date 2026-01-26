import { notFound } from 'next/navigation';
import * as fs from 'fs';
import * as path from 'path';

interface Article {
  id: string;
  url: string;
  title: string;
  author: string;
  content: string;
  publishedAt: string;
  collectedAt: string;
}

async function getArticle(id: string): Promise<Article | null> {
  const filePath = path.join(process.cwd(), 'data', 'articles.json');
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const data = fs.readFileSync(filePath, 'utf8');
  const articles: Article[] = JSON.parse(data);
  return articles.find(article => article.id === id) || null;
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
      <p className="text-gray-600 mb-4">Published: {new Date(article.publishedAt).toLocaleDateString()}</p>
      <div dangerouslySetInnerHTML={{ __html: article.content }} />
    </div>
  );
}