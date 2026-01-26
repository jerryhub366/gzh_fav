const cheerio = require('cheerio');
const { createHash } = require('crypto');

async function testFetch(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (!response.ok) {
      console.error('Failed to fetch:', response.status);
      return;
    }
    const html = await response.text();
    console.log('HTML length:', html.length);

    const $ = cheerio.load(html);

    const title = $('#activity-name').text().trim() || $('title').text().trim() || 'Unknown Title';
    const author = $('#js_name').text().trim() || $('#profileBt a').text().trim() || 'Unknown Author';
    const publishTimeText = $('#publish_time').text().trim();
    const metaPublished = $('meta[property="article:published_time"]').attr('content');
    const publishedAt = metaPublished || publishTimeText || new Date().toISOString();

    console.log('Title element:', $('#activity-name').text().trim());
    console.log('Title tag:', $('title').text().trim());
    console.log('Author js_name:', $('#js_name').text().trim());
    console.log('Author profileBt:', $('#profileBt a').text().trim());
    console.log('Publish time text:', publishTimeText);
    console.log('Meta published:', metaPublished);
    const contentHtml = $('#js_content').html() || '';

    const content = contentHtml.replace(/<script[\s\S]*?<\/script>/gi, '').trim();

    console.log('Title:', title);
    console.log('Author:', author);
    console.log('Published At:', publishedAt);
    console.log('Content length:', content.length);
    console.log('Content preview:', content.substring(0, 200) + '...');

  } catch (error) {
    console.error('Error:', error);
  }
}

testFetch('https://mp.weixin.qq.com/s/qalljmCFzF6QZJiG2zEZNg');