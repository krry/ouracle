import { FirecrawlApp } from '@mendable/firecrawl-js';

const app = new FirecrawlApp({ 
  apiKey: process.env.FIRECRAWL_API_KEY 
});

async function test() {
  try {
    const result = await app.crawl('https://example.com', {
      formats: ['markdown'],
      maxPages: 1
    });
    console.log('Firecrawl test succeeded');
    console.log('Pages crawled:', result.data.length);
    process.exit(0);
  } catch (err) {
    console.error('Firecrawl test failed:', err.message);
    process.exit(1);
  }
}

test();
