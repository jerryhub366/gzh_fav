import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'articles.json');
    if (!fs.existsSync(filePath)) {
      return NextResponse.json([]);
    }
    const data = fs.readFileSync(filePath, 'utf8');
    const articles = JSON.parse(data);
    return NextResponse.json(articles);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load articles' }, { status: 500 });
  }
}