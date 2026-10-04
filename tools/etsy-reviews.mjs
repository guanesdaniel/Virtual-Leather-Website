// Fetches the shop's reviews through Etsy's official Open API (v3) and writes src/data/reviews.json,
// so customers can read them on virtualleather.net without being sent to Etsy.
//   ETSY_API_KEY="keystring:shared_secret" node tools/etsy-reviews.mjs   (npm run reviews)
//   or ETSY_API_KEY="keystring" ETSY_SHARED_SECRET="shared_secret" (two separate secrets).
// The key lives only in GitHub secrets (ETSY_API_KEY, and ETSY_SHARED_SECRET if kept apart); the deploy
// workflow runs this before each build (and every 6 hours). Without a key, or if Etsy can't be reached,
// the existing file is kept.
//
// We show the most recent written reviews whatever their rating (not a hand-picked selection), with
// the shop's real average and count, and Etsy's required API notice next to them.
import { writeFile } from 'node:fs/promises';

// Common paste slips are tidied: spaces and line breaks anywhere (Etsy's codes have none), invisible
// characters that copying from a web page or phone can add, and quote marks around the code. Etsy wants
// "keystring:shared_secret"; the shared secret can also come from its own secret, ETSY_SHARED_SECRET.
const INVISIBLE = /[\s\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]+/g;
const tidy = (v) => String(v || '').replace(INVISIBLE, '').replace(/^['"]+|['"]+$/g, '');
const SECRET = tidy(process.env.ETSY_SHARED_SECRET);
let KEY = tidy(process.env.ETSY_API_KEY);
if (KEY && SECRET && !KEY.includes(':')) KEY += ':' + SECRET;
// The key's shape, never its content (build logs are public): how many parts, how long each is, and how
// many characters in each are not letters or digits (Etsy's codes are letters and digits only).
function keyShape() {
  const parts = KEY.split(':');
  const odd = parts.map((x) => (x.match(/[^a-z0-9]/gi) || []).length);
  return `${parts.length} part${parts.length === 1 ? '' : 's'} separated by ":" (lengths ${parts.map((x) => x.length).join(' + ')})` +
    (odd.some(Boolean) ? `, with ${odd.join(' + ')} character(s) that are not letters or digits` : '');
}
const SHOP = process.env.ETSY_SHOP_NAME || 'virtualleathershop';
const BASE = process.env.ETSY_API_BASE || 'https://openapi.etsy.com/v3/application';
const SHOW = 12;

if (!KEY) {
  console.log('ETSY_API_KEY is not set: keeping src/data/reviews.json as it is.');
  process.exit(0);
}

async function api(path) {
  const res = await fetch(BASE + path, { headers: { 'x-api-key': KEY, accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path.split('?')[0]} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function plain(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+/g, ' ')
    .trim();
}
// Etsy titles are long keyword lists; keep the first phrase.
function shortTitle(t) {
  const first = plain(t).split(/\s[|,–-]\s|\s\|\s|,/)[0].trim();
  return first.length > 60 ? first.slice(0, 57).trimEnd() + '…' : first;
}
function monthYear(ts) {
  return new Date(ts * 1000).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

try {
  const found = await api('/shops?shop_name=' + encodeURIComponent(SHOP));
  const shop = (found.results || []).find((s) => String(s.shop_name).toLowerCase() === SHOP.toLowerCase()) || (found.results || [])[0];
  if (!shop) throw new Error(`no Etsy shop called ${SHOP}`);

  const all = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const page = await api(`/shops/${shop.shop_id}/reviews?limit=100&offset=${offset}`);
    all.push(...(page.results || []));
    if (!page.results || page.results.length < 100) break;
  }
  const time = (r) => r.created_timestamp || r.create_timestamp || 0;
  const written = all.filter((r) => plain(r.review)).sort((a, b) => time(b) - time(a)).slice(0, SHOW);

  // Product names for the reviews shown (optional: reviews still show if this fails).
  const titles = {};
  const ids = [...new Set(written.map((r) => r.listing_id).filter(Boolean))];
  if (ids.length) {
    try {
      const listings = await api('/listings/batch?listing_ids=' + ids.join(','));
      for (const l of listings.results || []) titles[l.listing_id] = shortTitle(l.title);
    } catch (e) {
      console.warn('Could not fetch product names: ' + e.message);
    }
  }

  const average = Number(shop.review_average);
  const out = {
    _comment: 'Written by tools/etsy-reviews.mjs from the Etsy API. Do not edit by hand: it is replaced on each deploy.',
    source: 'etsy-api',
    fetched: new Date().toISOString(),
    etsyRating: average ? average.toFixed(1) : '',
    etsyReviewCount: String(shop.review_count || all.length || ''),
    reviews: written.map((r) => ({
      rating: Math.max(1, Math.min(5, Number(r.rating) || 0)),
      text: plain(r.review),
      date: monthYear(time(r)),
      item: titles[r.listing_id] || ''
    }))
  };
  await writeFile('src/data/reviews.json', JSON.stringify(out, null, 2) + '\n');
  console.log(`Saved ${out.reviews.length} Etsy reviews (shop average ${out.etsyRating || 'n/a'} from ${out.etsyReviewCount} reviews).`);
} catch (e) {
  console.warn('Could not fetch Etsy reviews (' + e.message.trim() + '). Keeping src/data/reviews.json as it is.');
  if (/ 40[13]:/.test(e.message)) {
    console.warn('The Etsy key used has ' + keyShape() + '. Etsy expects 2 parts, "keystring:sharedsecret", copied from ' +
      'the Etsy developer dashboard (Personal Apps: the Keystring column, and the Shared Secret shown with the eye icon). ' +
      'ETSY_API_KEY should hold exactly the Keystring (24 letters and digits) and ETSY_SHARED_SECRET the Shared Secret; ' +
      'or put both in ETSY_API_KEY with a colon between them.');
  }
}
