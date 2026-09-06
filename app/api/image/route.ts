import { NextRequest, NextResponse } from 'next/server';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export const preferredRegion = ['sin1'];

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const isQpicHost = url.hostname === 'qpic.cn' || url.hostname.endsWith('.qpic.cn');
  if (!['http:', 'https:'].includes(url.protocol) || !isQpicHost) {
    return NextResponse.json({ error: 'Unsupported image host' }, { status: 400 });
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Referer: 'https://mp.weixin.qq.com/',
        'User-Agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
    }

    return new NextResponse(response.body, {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable, s-maxage=86400, stale-while-revalidate=604800',
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json({ error: 'Image proxy upstream timeout or failure' }, { status: 504 });
  }
}
