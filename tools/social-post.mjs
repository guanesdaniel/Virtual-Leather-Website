// Posts the queued Instagram and Facebook posts and Stories when they're due.
// Run by .github/workflows/social.yml every 30 minutes. See social/README.md for the setup.
//
//   node tools/social-post.mjs           post what's due
//   node tools/social-post.mjs --dry-run show what would be posted, post nothing
//   node tools/social-post.mjs --check   check the Meta connection (Page, Instagram account, permissions)
//
// The queue is social/queue.json. Each item:
//   { "id": "2026-11-23-duffle-story", "when": "2026-11-23T18:00:00Z", "kind": "story" | "post",
//     "image": "social/2026-11-23-duffle-story.png", "caption": "…", "platforms": ["instagram", "facebook"] }
// "image" is a path inside site/, so it is live at https://virtualleather.net/<image> once deployed.
// Stories have no caption (Instagram's API doesn't take one, or link stickers).
// What was posted is recorded in social/posted.json (committed back by the workflow), per platform,
// so nothing is ever posted twice, even when a run is retried.
//
// Secrets: META_ACCESS_TOKEN (a System User token from Meta Business Suite, never expires).
// Optional: META_PAGE_ID when the token can see more than one Facebook Page.
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const queueFile = path.join(root, 'social/queue.json');
const postedFile = path.join(root, 'social/posted.json');
const cfg = JSON.parse(await fs.readFile(path.join(root, 'src/config.json'), 'utf8'));
const siteUrl = (cfg.siteUrl || 'https://virtualleather.net').replace(/\/$/, '');

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v24.0'}`;
const TOKEN = (process.env.META_ACCESS_TOKEN || '').trim();
const DRY = process.argv.includes('--dry-run');
const CHECK = process.argv.includes('--check');
// Don't post anything more than this late (for example if the workflow was switched off for a while):
// an old "this weekend only" post going out days later is worse than not posting it.
const MAX_LATE_HOURS = 12;

async function graph(method, p, params = {}, token) {
  const url = new URL(`${GRAPH}/${p}`);
  const body = new URLSearchParams({ ...params, access_token: token });
  let res;
  if (method === 'GET') { for (const [k, v] of body) url.searchParams.set(k, v); res = await fetch(url); }
  else res = await fetch(url, { method, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    throw new Error(`${method} ${p}: ${e.message || res.status}${e.code ? ` (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ''})` : ''}`);
  }
  return json;
}

async function connect() {
  if (!TOKEN) return null;
  const { data = [] } = await graph('GET', 'me/accounts', { fields: 'id,name,access_token,instagram_business_account{id,username}' }, TOKEN);
  const pages = process.env.META_PAGE_ID ? data.filter((p) => p.id === process.env.META_PAGE_ID.trim()) : data;
  if (pages.length !== 1) {
    throw new Error(pages.length ? `The token can see ${pages.length} Facebook Pages (${pages.map((p) => `${p.name} = ${p.id}`).join(', ')}). Add a META_PAGE_ID secret with the right one.`
      : 'The token can\'t see any Facebook Page. In Meta Business Suite, give the system user the Page (Assign assets) and generate the token again.');
  }
  const page = pages[0];
  return { pageId: page.id, pageName: page.name, pageToken: page.access_token, ig: page.instagram_business_account || null };
}

async function waitForContainer(id, token) {
  for (let i = 0; i < 20; i++) {
    const { status_code: s } = await graph('GET', id, { fields: 'status_code' }, token);
    if (s === 'FINISHED') return;
    if (s === 'ERROR' || s === 'EXPIRED') throw new Error(`Instagram couldn't process the image (status ${s}).`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Instagram took too long to process the image.');
}

async function postInstagram(m, item, imageUrl) {
  if (!m.ig) throw new Error(`The Facebook Page "${m.pageName}" has no Instagram business account linked.`);
  const params = item.kind === 'story' ? { media_type: 'STORIES', image_url: imageUrl } : { image_url: imageUrl, caption: item.caption || '' };
  const { id } = await graph('POST', `${m.ig.id}/media`, params, m.pageToken);
  await waitForContainer(id, m.pageToken);
  const res = await graph('POST', `${m.ig.id}/media_publish`, { creation_id: id }, m.pageToken);
  return res.id;
}

async function postFacebook(m, item, imageUrl) {
  if (item.kind === 'story') {
    const photo = await graph('POST', `${m.pageId}/photos`, { url: imageUrl, published: 'false' }, m.pageToken);
    const res = await graph('POST', `${m.pageId}/photo_stories`, { photo_id: photo.id }, m.pageToken);
    return res.post_id || res.id || photo.id;
  }
  const res = await graph('POST', `${m.pageId}/photos`, { url: imageUrl, message: item.caption || '' }, m.pageToken);
  return res.post_id || res.id;
}

if (CHECK) {
  if (!TOKEN) { console.log('No META_ACCESS_TOKEN secret yet. See social/README.md.'); process.exit(1); }
  const m = await connect();
  console.log(`Facebook Page: ${m.pageName} (${m.pageId})`);
  console.log(m.ig ? `Instagram: @${m.ig.username} (${m.ig.id})` : 'Instagram: NOT linked to this Page. Link it in the Page settings (Linked accounts → Instagram).');
  if (m.ig) {
    const lim = await graph('GET', `${m.ig.id}/content_publishing_limit`, { fields: 'quota_usage,config' }, m.pageToken).catch((e) => ({ error: e.message }));
    console.log(lim.error ? `Instagram publishing: ${lim.error}` : `Instagram publishing works (posts used in the last 24 h: ${lim.data?.[0]?.quota_usage ?? 0}).`);
  }
  process.exit(0);
}

const queue = JSON.parse(await fs.readFile(queueFile, 'utf8'));
const posted = JSON.parse(await fs.readFile(postedFile, 'utf8').catch(() => '{}'));
const now = Date.now();

const ids = new Set();
for (const item of queue) {
  if (!item.id || ids.has(item.id)) throw new Error(`social/queue.json: every item needs its own "id" (${item.id || 'missing'}).`);
  ids.add(item.id);
  if (!['story', 'post'].includes(item.kind)) throw new Error(`${item.id}: "kind" must be "story" or "post".`);
  if (Number.isNaN(Date.parse(item.when))) throw new Error(`${item.id}: "when" must be a date and time like 2026-11-23T18:00:00Z.`);
  try { await fs.access(path.join(root, 'site', item.image)); } catch { throw new Error(`${item.id}: image site/${item.image} not found.`); }
}

const due = queue.filter((item) => {
  const t = Date.parse(item.when);
  const left = (item.platforms || ['instagram', 'facebook']).filter((p) => !posted[item.id]?.[p]);
  return t <= now && now - t <= MAX_LATE_HOURS * 3600e3 && left.length;
});
const missed = queue.filter((item) => now - Date.parse(item.when) > MAX_LATE_HOURS * 3600e3 && !posted[item.id]);
for (const item of missed) console.log(`Skipped ${item.id}: more than ${MAX_LATE_HOURS} hours late.`);

if (!due.length) { console.log('Nothing due.'); process.exit(0); }
if (!TOKEN && !DRY) { console.log(`${due.length} item(s) due, but there's no META_ACCESS_TOKEN secret yet, so nothing was posted. See social/README.md.`); process.exit(0); }

const m = DRY ? null : await connect();
let failed = 0;
for (const item of due) {
  const imageUrl = `${siteUrl}/${item.image.replace(/^\//, '')}`;
  // The image must already be live on the website (deployed) before Instagram can fetch it.
  const head = await fetch(imageUrl, { method: 'HEAD' }).catch(() => null);
  if (!head?.ok) { console.log(`Waiting on ${item.id}: ${imageUrl} isn't live yet (deploy pending).`); continue; }
  for (const platform of item.platforms || ['instagram', 'facebook']) {
    if (posted[item.id]?.[platform]) continue;
    if (DRY) { console.log(`Would post ${item.kind} ${item.id} to ${platform}: ${imageUrl}`); continue; }
    try {
      const id = platform === 'instagram' ? await postInstagram(m, item, imageUrl) : await postFacebook(m, item, imageUrl);
      posted[item.id] = { ...posted[item.id], [platform]: { id, at: new Date().toISOString() } };
      console.log(`Posted ${item.kind} ${item.id} to ${platform} (${id}).`);
      await fs.writeFile(postedFile, JSON.stringify(posted, null, 2) + '\n');
    } catch (e) {
      failed++;
      console.error(`FAILED ${item.kind} ${item.id} on ${platform}: ${e.message}`);
    }
  }
}
if (failed) process.exit(1);
