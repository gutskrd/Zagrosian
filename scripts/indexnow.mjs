/**
 * Tells search engines that support IndexNow (Bing, and through it ChatGPT
 * search, Copilot and DuckDuckGo; also Yandex, Seznam and Naver) about every
 * page in the live sitemap, so they crawl them soon. Run it after a deploy:
 *
 *   npm run indexnow
 *
 * The key is in src/site.ts and public/<key>.txt, which proves the site is
 * ours. Google does not use IndexNow: submit the sitemap in Google Search
 * Console instead.
 */
import { readFileSync } from 'node:fs';

const site = readFileSync(new URL('../src/site.ts', import.meta.url), 'utf8');
const host = 'zagrosian.com';
const key = site.match(/indexNowKey: '([0-9a-f]+)'/)?.[1];
if (!key) throw new Error('No IndexNow key in src/site.ts');

const sitemap = await (await fetch(`https://${host}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (urlList.length === 0) throw new Error('The live sitemap lists no pages.');

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList }),
});
console.log(`IndexNow: ${response.status} ${response.statusText} for ${urlList.length} pages.`);
if (!response.ok) process.exitCode = 1;
