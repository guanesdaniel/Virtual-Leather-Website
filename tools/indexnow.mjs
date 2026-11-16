// Tells IndexNow search engines (Bing, which also feeds ChatGPT search and Copilot, plus Yandex, Seznam,
// Naver and others) about the site's pages right after a deploy, so new and changed pages are picked up in
// hours instead of weeks. Run by deploy.yml after publishing (npm run indexnow); uses the public key in
// src/config.json (indexNowKey), whose key file the build publishes at /<key>.txt.
// Google doesn't use IndexNow: it reads sitemap.xml (submitted in Search Console).
import fs from 'node:fs/promises';

const site = JSON.parse(await fs.readFile('src/config.json', 'utf8'));
const key = String(site.indexNowKey || '').trim();
if (!key) { console.log('No indexNowKey in src/config.json: skipping IndexNow.'); process.exit(0); }
const host = new URL(site.siteUrl).hostname;
const sitemap = await fs.readFile('site/sitemap.xml', 'utf8').catch(() => '');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) { console.log('No URLs in site/sitemap.xml: skipping IndexNow.'); process.exit(0); }
try {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation: `${site.siteUrl}/${key}.txt`, urlList })
  });
  // 200 and 202 mean accepted; anything else is only logged, so a deploy never fails because of it.
  console.log(`IndexNow: sent ${urlList.length} URLs, answer ${res.status} ${res.statusText}.`);
} catch (e) {
  console.log('IndexNow could not be reached (' + e.message + '); the pages will still be found through the sitemap.');
}
