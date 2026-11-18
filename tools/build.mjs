// Tiny static-site builder: no framework, no runtime dependencies.
//   src/pages/foo.html  ->  site/foo/index.html   (clean URL /foo/)
//   src/pages/index.html -> site/index.html,  src/pages/404.html -> site/404.html
// Each page starts with a JSON comment: <!--{"title": "...", "description": "..."}-->
// Template syntax:
//   {{> name}}             include src/partials/name.html
//   {{site.key}}           value from src/config.json (HTML-escaped)
//   {{page.key}}           value from the page's JSON header
//   {{img name|alt|sizes|eager}}   responsive <img> for an image from tools/images.json
//   {{products group}}     product cards for a group in src/data/products.json
//                          ({{products group not <id>}} leaves that product out;
//                          {{products ids <id>,<id>}} shows just those products)
//   {{gallery}}            real photos per apron style for the designer (src/data/gallery.json)
//   {{reviews}}            Etsy review cards from src/data/reviews.json (see tools/etsy-reviews.mjs)
//   {{reviews <id>}}       reviews of one product (+ recent others if it has few); {{reviewsSummary <id>}} its intro
//   {{reviewPhotos}}       row of small photos customers added to their reviews ({{reviewPhotos <id>}}: one product's)
//   {{#if reviews}}…{{/if reviews}}  kept only when there are reviews
//   {{#if extraEngraving}}…{{else}}…{{/if extraEngraving}}  first part once the Ecwid "Extra engraving"
//                          product is set (extraEngravingProductId in src/config.json), else the second.
//                          These also work inside a page's JSON header.
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFile(path.join(root, p), 'utf8');
const json = async (p) => JSON.parse(await read(p));

const site = await json('src/config.json');
const images = await json('tools/images.json');
const products = await json('src/data/products.json');
// Live prices from the Ecwid store (tools/ecwid-prices.mjs); products.json's prices are the fall-back.
const priceData = await json('src/data/prices.json').catch(() => ({ products: {} }));
for (const p of products) {
  const live = priceData.products?.[p.id]?.price;
  if (live > 0) p.price = live;
}
const reviewData = await json('src/data/reviews.json');
const galleryData = await json('src/data/gallery.json');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;

// Prices in page text, so a price changed in Ecwid changes everywhere on the next build:
//   {{price <id>}}  "$185"     {{price <id> Large}}  the price of the option choice starting "Large"
//   {{priceNum <id>}}  "185.00" (for structured data)   {{price engraving}}  one extra engraving
//   {{fromPrice <group>}}  the lowest price in a products.json group   {{priceRange <group>}}  "$185" or "$185 to $195"
const ENGRAVING_FALLBACK = 5;
const squash = (s) => String(s).replace(/[\s​-‏﻿]+/g, ' ').trim().toLowerCase();
function priceOf(id, choice) {
  if (id === 'engraving') id = String(site.extraEngravingProductId || '');
  const live = priceData.products?.[id];
  const base = live?.price ?? products.find((p) => p.id === id)?.price ?? (id === String(site.extraEngravingProductId) ? ENGRAVING_FALLBACK : null);
  if (base == null) throw new Error(`No price for product ${id}`);
  if (!choice) return base;
  const key = Object.keys(live?.choices || {}).find((k) => squash(k).startsWith(squash(choice)));
  if (!key) throw new Error(`No price for "${choice}" on product ${id} (src/data/prices.json choices)`);
  return live.choices[key];
}
function groupPrices(g) {
  const ps = products.filter((p) => p.group === g).map((p) => p.price);
  if (!ps.length) throw new Error(`No products in group ${g}`);
  return ps;
}
function prices(s) {
  return String(s)
    .replace(/\{\{price (\w+)(?: ([^}]+))?\}\}/g, (_, id, c) => money(priceOf(id, c && c.trim())))
    .replace(/\{\{priceNum (\w+)(?: ([^}]+))?\}\}/g, (_, id, c) => Number(priceOf(id, c && c.trim())).toFixed(2))
    .replace(/\{\{fromPrice (\w+)\}\}/g, (_, g) => money(Math.min(...groupPrices(g))))
    .replace(/\{\{priceRange (\w+)\}\}/g, (_, g) => {
      const ps = groupPrices(g), lo = Math.min(...ps), hi = Math.max(...ps);
      return lo === hi ? money(lo) : `${money(lo)} to ${money(hi)}`;
    });
}

site.whatsappUrl = `https://wa.me/${site.whatsappNumber}`;
site.year = String(new Date().getFullYear());
site.addressLine = site.businessAddress ? `Business address: ${site.businessAddress}.` : '';
site.companyLine = site.companyNumber ? `Company number ${site.companyNumber}.` : '';

function img(name, alt = '', sizes = '100vw', eager = '') {
  const m = images[name];
  if (!m) throw new Error(`Unknown image "${name}"`);
  const ws = m.widths;
  const w = ws[ws.length - 1];
  const h = Math.round(w / m.ratio);
  const srcset = ws.map((x) => `/assets/img/${name}-${x}.webp ${x}w`).join(', ');
  const loading = eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  return `<img src="/assets/img/${name}-${ws[0]}.webp" srcset="${srcset}" sizes="${esc(sizes)}" width="${w}" height="${h}" alt="${esc(alt)}" ${loading}>`;
}

// Every product has its own page: the designer pages (/backpack/ etc., "page" in products.json) or
// /products/<slug>/ built below.
const productUrl = (p) => p.page || `/products/${p.slug}/`;

// The picture a page offers when it's shared or shown by search engines and AI assistants (og:image): a JPEG
// copy of that page's own main photo, made at build time. JPEG because not every app reads WebP (link
// previews, some AI answers), and each page names its own photo ("ogImage" in its header, an image name
// from tools/images.json) so a knife roll page never shows up with an apron.
const ogMade = new Map();
async function ogImage(name) {
  if (!images[name]) throw new Error(`ogImage: unknown image "${name}"`);
  if (!ogMade.has(name)) {
    const { default: sharp } = await import('sharp');
    const ws = images[name].widths;
    await fs.mkdir(path.join(outDir, 'assets/img/og'), { recursive: true });
    const info = await sharp(path.join(outDir, `assets/img/${name}-${ws[ws.length - 1]}.webp`))
      .jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(outDir, `assets/img/og/${name}.jpg`));
    ogMade.set(name, { url: `${site.siteUrl}/assets/img/og/${name}.jpg`, width: info.width, height: info.height });
  }
  return ogMade.get(name);
}
async function setOgImage(page, name, alt) {
  const og = await ogImage(name);
  Object.assign(page, { ogImage: og.url, ogImageWidth: og.width, ogImageHeight: og.height, ogImageAlt: alt || page.ogImageAlt || page.title });
}
const imgUrl = (name, largest = true) => {
  const ws = images[name].widths;
  return `${site.siteUrl}/assets/img/${name}-${largest ? ws[ws.length - 1] : ws[0]}.webp`;
};

function productCards(group, not) {
  // group 'ids' takes a comma-separated list of product ids instead ({{products ids 1,2,3}}), in that order.
  const list = group === 'ids' ? not.split(',').map((id) => products.find((p) => p.id === id)) : products.filter((p) => p.group === group && p.id !== not);
  return list.map((p) => {
    // Each card opens the product's own page; aprons and products with a designer page also get a
    // button straight into the designer.
    const href = productUrl(p);
    const link = `href="${href}" data-track="select_item" data-id="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}"`;
    const design = p.designer
      ? `<a class="btn btn-sm btn-ghost" href="/#design" data-style="${p.designer}" data-track="select_style">Design it</a>`
      : p.page ? `<a class="btn btn-sm btn-ghost" href="${p.page}#design" data-track="select_item" data-id="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}">Design it</a>` : '';
    return `<article class="card product">
  <a class="product-media" ${link} tabindex="-1">${img(p.image || `p-${p.id}`, p.name, '(min-width: 1000px) 300px, (min-width: 640px) 45vw, 90vw')}</a>
  <div class="product-body">
    <h3><a ${link}>${esc(p.name)}</a></h3>
    <p>${esc(p.summary)}</p>
    <div class="product-foot"><span class="price">${money(p.price)}</span>${design}</div>
  </div>
</article>`;
  }).join('\n');
}

// Plain links to every product page (the shop page, so Google can find them without the Ecwid widget).
function productLinks() {
  return `<ul class="product-links" role="list">${products.map((p) => `
  <li><a class="chip" href="${productUrl(p)}">${esc(p.name)}</a></li>`).join('')}
</ul>`;
}

// Review cards: the first six, then the rest behind "Show more reviews" (no JavaScript needed).
// A buyer's photo is shown straight from Etsy (lazy-loaded, so it costs nothing until it's scrolled to);
// tapping it opens the full-size photo.
function reviewCard(r, withPhoto = true) {
  const n = Math.max(0, Math.min(5, Number(r.rating) || 0));
  const photo = withPhoto && /^https:\/\/i\.etsystatic\.com\//.test(r.photo || '') ? r.photo : '';
  const thumb = photo && /^https:\/\/i\.etsystatic\.com\//.test(r.thumb || '') ? r.thumb : photo;
  const about = r.item ? `${r.item}` : 'our leather goods';
  return `
  <li class="card review${photo ? ' has-photo' : ''}">
${photo ? `    <a class="review-photo" href="${esc(photo)}" target="_blank" rel="noopener"><img src="${esc(thumb)}" width="96" height="96" alt="Customer's photo of their ${esc(about)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>
` : ''}    <p class="stars" role="img" aria-label="${n} out of 5 stars">${'★'.repeat(n)}<span aria-hidden="true" class="stars-off">${'★'.repeat(5 - n)}</span></p>
${r.text ? `    <blockquote><p>${esc(r.text).replace(/\n+/g, '<br>')}</p></blockquote>
` : ''}    <p class="review-meta">${esc(r.name || 'Etsy buyer')}${r.date ? ` · ${esc(r.date)}` : ''}${r.item ? ` · ${esc(r.item)}` : ''}</p>
  </li>`;
}
function reviewList(list, withPhotos = true) {
  if (!list.length) return '';
  const card = (r) => reviewCard(r, withPhotos);
  const first = list.slice(0, 6), more = list.slice(6);
  return `<ul class="reviews" role="list">${first.map(card).join('')}
</ul>` + (more.length ? `
<details class="more-reviews"><summary>Show more reviews</summary>
<ul class="reviews" role="list">${more.map(card).join('')}
</ul></details>` : '');
}
const allReviews = reviewData.reviews || [];
// Home page: the 12 most recent reviews with words, whatever their rating, each with its photo beside it.
const homeReviews = allReviews.filter((r) => r.text).slice(0, 12);
const reviews = () => reviewList(homeReviews);

// Which product an Etsy product name is for, by each product's "reviewMatch" in src/data/products.json.
// Apron names go to an apron (the BBQ apron last, as the most general), so "BBQ apron with bottle opener" is
// the BBQ apron, not the bottle-opener extra; anything else to the bags, knife roll or extras.
const matchOrder = [...products].filter((p) => p.reviewMatch)
  .sort((a, b) => (a.designer === 'bbq') - (b.designer === 'bbq'));
const unmatched = new Set();
function productFor(name) {
  const isApron = /apron/i.test(name) && !/optional extra|add[- ]on/i.test(name);
  const p = matchOrder.find((x) => (x.group === 'aprons') === isApron && new RegExp(x.reviewMatch, 'i').test(name));
  if (!p) unmatched.add(name);
  return p?.id;
}
const reviewsById = {};
for (const r of allReviews) {
  for (const id of new Set((r.items || (r.item ? r.item.split(' + ') : [])).map(productFor).filter(Boolean))) {
    (reviewsById[id] ||= []).push(r);
  }
}
// A product page: up to 12 reviews of that product, newest first, with photo reviews of it first among the
// first six. If it has fewer than six, recent reviews of other products fill up the list (each card names
// the product it's about).
function productReviews(id) {
  // Reviews with words only: a photo without words goes in the row of photos below ({{reviewPhotos <id>}}).
  const own = (reviewsById[id] || []).filter((r) => r.text).slice(0, 12);
  const top = [...own.slice(0, 6)].sort((a, b) => !!b.photo - !!a.photo);
  const list = [...top, ...own.slice(6)];
  const ids = new Set(list);
  for (const r of homeReviews) if (list.length < 6 && !ids.has(r)) list.push(r);
  return reviewList(list);
}
function productReviewsSummary(id) {
  const n = (reviewsById[id] || []).filter((r) => r.text).length;
  const p = products.find((x) => x.id === id);
  const shop = rating ? `Our Etsy shop is rated <strong>${esc(rating.score)} out of 5</strong> from ${esc(rating.count)} reviews.` : '';
  if (!n) return `${shop} Here are some recent ones, in the customers' own words.`;
  const name = esc(p ? p.name.replace(/\s*\(.*\)$/, '') : 'product');
  return `${shop} Here's what customers said about the ${name}${n < 6 ? ', then recent reviews of our other pieces' : ''}, in their own words.`;
}
// More photos customers added to their reviews (a row of small photos on the home page): up to 8, newest
// first, leaving out the ones already beside a home page review.
// On a product page ({{reviewPhotos <id>}}), that product's photos not already beside one of its reviews.
function reviewPhotos(id) {
  const shown = id ? (reviewsById[id] || []).filter((r) => r.text).slice(0, 12) : homeReviews;
  const pool = id ? reviewsById[id] || [] : allReviews;
  const withPhoto = pool.filter((r) => !shown.includes(r) && /^https:\/\/i\.etsystatic\.com\//.test(r.photo || '')).slice(0, 8);
  if (withPhoto.length < 2) return '';
  return `<p class="small muted review-photos-title">More photos from our customers (tap to enlarge)</p>
<ul class="review-photos" role="list" aria-label="More photos from our customers">${withPhoto.map((r) => `
  <li><a href="${esc(r.photo)}" target="_blank" rel="noopener"><img src="${esc(/^https:\/\/i\.etsystatic\.com\//.test(r.thumb || '') ? r.thumb : r.photo)}" width="84" height="84" alt="Customer's photo of their ${esc(r.item || 'order')}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a></li>`).join('')}
</ul>`;
}
const hasReviews = homeReviews.length > 0;
// The shop's Etsy average and review count, as Etsy reports them.
const rating = reviewData.etsyRating && reviewData.etsyReviewCount ? {
  score: reviewData.etsyRating,
  count: Number(reviewData.etsyReviewCount).toLocaleString('en-GB'),
  stars: Math.max(0, Math.min(5, Math.round(Number(reviewData.etsyRating) || 0)))
} : null;

// {{#if flag}} … {{else}} … {{/if flag}} blocks (the {{else}} part is optional).
const FLAGS = { reviews: hasReviews, extraEngraving: !!String(site.extraEngravingProductId || '').trim() };
function ifFlags(s) {
  return s.replace(/\{\{#if (\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if \1\}\}/g,
    (all, k, yes, no = '') => (k in FLAGS ? (FLAGS[k] ? yes : no) : all));
}

// Real photos and a short description for each apron style, shown under the designer preview
// (the designer shows the block for the chosen style).
function gallery() {
  return Object.entries(galleryData).filter(([k]) => !k.startsWith('_')).map(([style, g]) => `
<div class="style-gallery" data-style="${style}" hidden>
  <p class="style-about">${esc(g.about)}</p>
  <p class="gallery-title">Real photos <span class="muted">(tap to enlarge)</span></p>
  <ul class="gallery-strip" role="list">${g.photos.map(([, alt], i) => `
    <li><button type="button" class="gallery-thumb" data-full="/assets/img/gal-${style}-${i}-1080.webp" data-alt="${esc(alt)}">${img(`gal-${style}-${i}`, alt, '112px')}</button></li>`).join('')}
  </ul>
</div>`).join('');
}

async function render(tpl, page, depth = 0) {
  if (depth > 5) throw new Error('Partial nesting too deep');
  let out = tpl;
  const partials = [...out.matchAll(/\{\{>\s*([\w-]+)\s*\}\}/g)];
  for (const [tag, name] of partials) {
    out = out.replace(tag, await render(await read(`src/partials/${name}.html`), page, depth + 1));
  }
  return prices(ifFlags(out))
    .replace(/\{\{img ([^}]+)\}\}/g, (_, a) => img(...a.split('|').map((s) => s.trim())))
    .replace(/\{\{products ids ([\d,]+)\}\}/g, (_, ids) => productCards('ids', ids))
    .replace(/\{\{products (\w+)(?: not (\d+))?\}\}/g, (_, g, not) => productCards(g, not))
    .replace(/\{\{productLinks\}\}/g, () => productLinks())
    .replace(/\{\{reviews\}\}/g, () => reviews())
    .replace(/\{\{reviews (\d+)\}\}/g, (_, id) => productReviews(id))
    .replace(/\{\{reviewsSummary (\d+)\}\}/g, (_, id) => productReviewsSummary(id))
    .replace(/\{\{reviewPhotos(?: (\d+))?\}\}/g, (_, id) => reviewPhotos(id))
    .replace(/\{\{gallery\}\}/g, () => gallery())
    .replace(/\{\{reviewsSummary\}\}/g, () => (rating
      ? `Rated <strong>${esc(rating.score)} out of 5</strong> from ${esc(rating.count)} reviews on our Etsy shop.`
      : ''))
    // Hero line under "Design your apron", linking to the reviews (only when they're on the page).
    .replace(/\{\{reviewsBadge\}\}/g, () => (rating && hasReviews
      ? `<p class="hero-rating"><a href="#reviews"><span class="hero-stars" aria-hidden="true">${'★'.repeat(rating.stars)}<span class="off">${'★'.repeat(5 - rating.stars)}</span></span><strong>${esc(rating.score)} out of 5</strong> from ${esc(rating.count)} Etsy reviews</a></p>`
      : ''))
    .replace(/\{\{site\.(\w+)\}\}/g, (_, k) => esc(site[k]))
    .replace(/\{\{page\.(\w+)\}\}/g, (_, k) => esc(page[k]))
    .replace(/\{\{raw page\.(\w+)\}\}/g, (_, k) => page[k] ?? '');
}

const outDir = path.join(root, 'site');
const pageFiles = (await fs.readdir(path.join(root, 'src/pages'))).filter((f) => f.endsWith('.html'));
const sitemap = [];

for (const file of pageFiles) {
  const src = prices(ifFlags(await read(`src/pages/${file}`)));
  const m = src.match(/^<!--(\{[\s\S]*?\})-->\n?/);
  if (!m) throw new Error(`${file}: missing JSON header`);
  const page = JSON.parse(m[1]);
  const slug = file.replace(/\.html$/, '');
  page.path = slug === 'index' ? '/' : slug === '404' ? '/404.html' : `/${slug}/`;
  page.canonical = site.siteUrl + (page.path === '/404.html' ? '/' : page.path);
  page.robots = page.noindex ? 'noindex, follow' : 'index, follow';
  page.ogType ||= 'website';
  await setOgImage(page, page.ogImage || 'hero-bbq', page.ogImageAlt || (page.ogImage ? '' : 'A man wearing a tan leather BBQ apron engraved "Paul Smith", with a beer bottle in the drink holder'));
  page.jsonldTag = page.jsonld
    ? `<script type="application/ld+json">${JSON.stringify(page.jsonld).replace(/</g, '\\u003c')}</script>`
    : '';
  page.body = await render(src.slice(m[0].length), page);
  const html = await render(await read('src/partials/layout.html'), page);
  const dest = slug === 'index' ? 'index.html' : slug === '404' ? '404.html' : `${slug}/index.html`;
  await fs.mkdir(path.dirname(path.join(outDir, dest)), { recursive: true });
  await fs.writeFile(path.join(outDir, dest), html);
  if (!page.noindex && slug !== '404') sitemap.push(page.canonical);
  console.log('built', dest);
}

// One page per product: /products/<slug>/ (one stable slug per Ecwid product id; the Google Merchant
// Center feed links to these too). Copy comes from src/data/products.json, photos from gallery.json.
const tick = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20"><path fill="none" stroke="currentColor" stroke-width="2.4" d="m4 10 4 4 8-9"/></svg>';
const GROUP_LABEL = { aprons: 'Leather aprons', more: 'Leather bags & cases', extras: 'Extras & leather care' };
const engravingLine = FLAGS.extraEngraving ? 'Two engravings included (name, phrase or logo), extra spots $5 each' : 'Name, phrase or logo engraving included';

function productFacts(p) {
  if (p.group === 'aprons') return ['Made to measure from the wearer\'s height and build', 'Real leather, handmade in Colombia', engravingLine,
    'Design proof to approve before we start', 'Made in about 3 days after you approve, then tracked shipping', 'Shipping included worldwide, US import duties included'];
  if (p.group === 'more') return ['Real leather, handmade in Colombia', 'Personalised with your name, phrase or logo',
    'Design proof to approve before we start', 'Made in about 3 days after you approve, then tracked shipping', 'Shipping included worldwide, US import duties included'];
  return ['Shipped from Colombia with tracking', 'Shipping cost shown at checkout'];
}

function productCta(p) {
  const shop = `<a class="btn btn-dark" href="/shop/#!/p/${p.id}" data-track="select_item" data-id="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}">Order in our shop</a>`;
  const wa = `<a class="btn btn-ghost" href="${site.whatsappUrl}?text=${encodeURIComponent(`Hi Virtual Leather, I have a question about the ${p.name}.`)}" target="_blank" rel="noopener" data-track="contact" data-channel="whatsapp" data-location="product">Ask us on WhatsApp</a>`;
  if (p.designer) return `<a class="btn btn-dark" href="/?style=${p.designer}#design" data-track="select_style" data-style="${p.designer}">Design yours and see a preview</a>${wa}`;
  // Apron extras can be bought on their own (e.g. a customer who forgot one) or added to a new apron.
  if (p.group === 'extras' && p.id !== '619498559') return `${shop.replace('Order in our shop', 'Buy it on its own')}<a class="btn btn-ghost" href="/#design">Add it to a new apron</a>${wa}`;
  return shop + wa;
}

const productPhotos = (p) => [[p.image || `p-${p.id}`, p.name],
  ...((galleryData[p.gallery] || {}).photos || []).map(([, alt], i) => [`gal-${p.gallery}-${i}`, alt])];

function productBody(p) {
  const photos = productPhotos(p);
  const about = (galleryData[p.gallery] || {}).about || p.summary;
  const related = products.filter((x) => x.group === p.group && x.id !== p.id);
  return `<div class="wrap pp">
  <nav class="breadcrumb small" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">›</span> <a href="/shop/">Shop</a> <span aria-hidden="true">›</span> <span aria-current="page">${esc(p.name)}</span></nav>
  <div class="product-layout">
    <div class="product-photos">
      <div class="product-main">${img(photos[0][0], photos[0][1], '(min-width: 900px) 560px, 100vw', 'eager')}</div>
${photos.length > 1 ? `      <ul class="product-thumbs" role="list">${photos.slice(1).map(([n, alt]) => `
        <li>${img(n, alt, '(min-width: 900px) 180px, 45vw')}</li>`).join('')}
      </ul>` : ''}
    </div>
    <div class="product-info">
      <p class="eyebrow">${esc(GROUP_LABEL[p.group])}</p>
      <h1>${esc(p.name)}</h1>
      <p class="product-price"><strong>${money(p.price)}</strong> <span class="muted">USD${p.group === 'aprons' ? ' · shipping included' : ''}</span></p>
      <p class="product-lead">${esc(about)}</p>
      <ul class="hero-facts product-facts" role="list">${productFacts(p).map((f) => `
        <li>${tick}${esc(f)}</li>`).join('')}
      </ul>
      <div class="btn-row">${productCta(p)}</div>
      <p class="small muted">Questions about sizes, delivery or returns? See our <a href="/#faq">FAQ</a> and <a href="/shipping-returns/">shipping &amp; returns</a>.</p>
    </div>
  </div>
${hasReviews ? `  <section class="product-reviews" id="reviews" aria-labelledby="reviews-title">
    <p class="eyebrow">Reviews</p>
    <h2 id="reviews-title" class="subhead">What our customers say</h2>
    <p>{{reviewsSummary ${p.id}}}</p>
{{reviews ${p.id}}}
{{reviewPhotos ${p.id}}}
    <p class="small muted etsy-notice">Reviews from our Etsy shop, shown with the Etsy API. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.</p>
  </section>
` : ''}${related.length ? `  <section class="product-related" aria-labelledby="related-title">
    <h2 id="related-title" class="subhead">You might also like</h2>
    <div class="grid">
${productCards(p.group, p.id)}
    </div>
  </section>` : ''}
</div>`;
}

function productJsonld(p, url) {
  const offer = { '@type': 'Offer', url, price: Number(p.price).toFixed(2), priceCurrency: site.currency,
    availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition',
    seller: { '@type': 'Organization', name: site.siteName } };
  if (p.group === 'aprons') offer.shippingDetails = { '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: site.currency } };
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Product', '@id': `${url}#product`, name: p.name, description: (galleryData[p.gallery] || {}).about || p.summary,
      image: productPhotos(p).slice(0, 4).map(([n]) => imgUrl(n)), sku: p.id, productID: p.id,
      brand: { '@type': 'Brand', name: site.siteName }, offers: offer },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${site.siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: `${site.siteUrl}/shop/` },
      { '@type': 'ListItem', position: 3, name: p.name, item: url }] }] };
}

await fs.rm(path.join(outDir, 'products'), { recursive: true, force: true });
for (const p of products.filter((x) => !x.page)) {
  if (!p.slug) throw new Error(`products.json: ${p.id} has no slug`);
  const page = { title: `${p.title || p.name} | ${site.siteName}`, description: prices(p.description || p.summary), bodyClass: 'product-page-body',
    path: productUrl(p), robots: 'index, follow', ogType: 'product' };
  page.canonical = site.siteUrl + page.path;
  await setOgImage(page, productPhotos(p)[0][0], productPhotos(p)[0][1]);
  page.jsonldTag = `<script type="application/ld+json">${JSON.stringify(productJsonld(p, page.canonical)).replace(/</g, '\\u003c')}</script>`;
  page.body = await render(productBody(p), page);
  const dest = `products/${p.slug}/index.html`;
  await fs.mkdir(path.dirname(path.join(outDir, dest)), { recursive: true });
  await fs.writeFile(path.join(outDir, dest), await render(await read('src/partials/layout.html'), page));
  sitemap.push(page.canonical);
  console.log('built', dest);
}

// Runtime config for the browser (only public, non-secret values).
const pub = {
  siteUrl: site.siteUrl, whatsappNumber: site.whatsappNumber, email: site.email,
  ecwidStoreId: site.ecwidStoreId, currency: site.currency, extraEngravingId: site.extraEngravingProductId || '',
  ga4MeasurementId: site.ga4MeasurementId, metaPixelId: site.metaPixelId,
  cloudinaryCloud: site.cloudinaryCloud || '', cloudinaryPreset: site.cloudinaryPreset || '',
  orderWorker: site.orderWorker || '',
  extraEngravingPrice: priceOf('engraving'),
  products: Object.fromEntries(products.map((p) => [p.id, Object.assign({ name: p.name, price: p.price, group: p.group }, p.designer ? { designer: p.designer } : {}, p.page ? { page: p.page } : {},
    priceData.products?.[p.id]?.choices ? { choices: priceData.products[p.id].choices } : {})])),
};
await fs.writeFile(path.join(outDir, 'assets/js/config.js'),
  `// Generated by tools/build.mjs from src/config.json. Do not edit by hand.\nwindow.VL_CONFIG = ${JSON.stringify(pub, null, 2)};\n`);

// The reviews shown, published with the site: each deploy starts from this copy, so the reviews stay up
// when Etsy can't be reached (see .github/workflows/deploy.yml).
const reviewsCopy = path.join(outDir, 'assets/data/reviews.json');
if (hasReviews) {
  await fs.mkdir(path.dirname(reviewsCopy), { recursive: true });
  await fs.writeFile(reviewsCopy, JSON.stringify(reviewData, null, 2) + '\n');
} else {
  await fs.rm(reviewsCopy, { force: true });
}

// Etsy product names no product page claims (their reviews still show on the home page): add a word from
// the name to that product's "reviewMatch" in src/data/products.json.
if (unmatched.size) console.warn('Reviews not matched to a product page: ' + [...unmatched].join(' | '));
console.log('Reviews per product page: ' + products.map((p) => `${p.name} ${(reviewsById[p.id] || []).length}`).join(', '));

// Short links (src/config.json "shortLinks"): /bio/, /etsy/ … send the visitor straight on to the home page
// with UTM tags, so Google Analytics knows which link brought them. Tiny pages, kept out of search and the sitemap.
for (const [slug, l] of Object.entries(site.shortLinks || {})) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`shortLinks: bad slug "${slug}"`);
  const q = new URLSearchParams({ utm_source: l.source, utm_medium: l.medium, utm_campaign: l.campaign });
  const to = `/${l.path ? l.path.replace(/^\/+/, '') : ''}?${q}`;
  await fs.mkdir(path.join(outDir, slug), { recursive: true });
  await fs.writeFile(path.join(outDir, slug, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<!-- Short link for: ${esc(l.use || slug)}. Generated by tools/build.mjs from src/config.json (shortLinks). -->
<title>Virtual Leather</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(site.siteUrl)}/">
<meta http-equiv="refresh" content="0; url=${esc(to)}">
<script>location.replace(${JSON.stringify(to)} + location.hash);</script>
</head><body><p><a href="${esc(to)}">Continue to Virtual Leather</a></p></body></html>
`);
  console.log('short link', `/${slug}/`, '->', to);
}

// The prices used, published with the site: each deploy starts from this copy (see deploy.yml), so the
// site keeps the latest Ecwid prices even when Ecwid can't be reached during a build.
await fs.mkdir(path.join(outDir, 'assets/data'), { recursive: true });
await fs.writeFile(path.join(outDir, 'assets/data/prices.json'), JSON.stringify(priceData, null, 2) + '\n');

// GitHub Pages: custom domain + serve files as-is (no Jekyll processing).
await fs.writeFile(path.join(outDir, 'CNAME'), new URL(site.siteUrl).hostname + '\n');
await fs.writeFile(path.join(outDir, '.nojekyll'), '');

// Google Merchant Center product feed (free listings and Shopping ads), US only for now. Merchant Center
// fetches https://virtualleather.net/feed/google.xml daily, so prices on Google always match the site.
// Apron extras and the leather grease are left out: they're add-ons, not products people search for.
// Shipping (free, from Colombia), handling time and returns are also set in Merchant Center itself.
const us = (s) => s.replace(/personalis/g, 'personaliz').replace(/Personalis/g, 'Personaliz'); // US spelling for US shoppers
const FEED_TYPE = { aprons: 'Leather aprons', more: 'Leather bags & cases' };
const feedItems = products.filter((p) => FEED_TYPE[p.group]).map((p) => {
  const photos = productPhotos(p).map(([n]) => imgUrl(n));
  const about = (galleryData[p.gallery] || {}).about || p.description || p.summary;
  const description = `${prices(about)} Personalised: engraved with your name, phrase or logo. Handmade to order in Colombia; you approve a design proof before we make it.`;
  const tags = [
    ['g:id', p.id],
    ['g:title', us(p.title || p.name)],
    ['g:description', us(description)],
    ['g:link', `${site.siteUrl}${productUrl(p)}?utm_source=google&utm_medium=shopping&utm_campaign=free_listings`],
    ['g:image_link', photos[0]],
    ...photos.slice(1, 11).map((u) => ['g:additional_image_link', u]),
    ['g:availability', 'in_stock'],
    ['g:price', `${Number(p.price).toFixed(2)} ${site.currency}`],
    ['g:condition', 'new'],
    ['g:brand', site.siteName],
    ['g:identifier_exists', 'no'],
    ['g:product_type', `${FEED_TYPE[p.group]} > ${p.name}`],
    ['g:material', 'Leather'],
    ['g:color', 'Brown'],
    ['g:age_group', 'adult'],
    ['g:gender', 'unisex'],
    ['g:size', 'One Size'],
    ['g:is_bundle', 'no'],
    ['g:min_handling_time', '3'],
    ['g:max_handling_time', '5'],
    ['g:custom_label_0', p.group],
  ];
  return `    <item>\n${tags.map(([k, v]) => `      <${k}>${esc(v)}</${k}>`).join('\n')}
      <g:shipping><g:country>US</g:country><g:service>Tracked shipping from Colombia</g:service><g:price>0.00 ${site.currency}</g:price></g:shipping>
    </item>`;
});
await fs.mkdir(path.join(outDir, 'feed'), { recursive: true });
await fs.writeFile(path.join(outDir, 'feed/google.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${esc(site.siteName)}</title>
    <link>${site.siteUrl}/</link>
    <description>${esc(site.siteName)} products for Google Merchant Center</description>
${feedItems.join('\n')}
  </channel>
</rss>
`);
console.log(`built feed/google.xml (${feedItems.length} products)`);

const today = new Date().toISOString().slice(0, 10);
await fs.writeFile(path.join(outDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
    .map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
// Every crawler may read the whole site. The AI assistants' crawlers are also named one by one, so it's
// plain to them (and to anyone checking) that they're welcome: being found through ChatGPT, Claude, Gemini,
// Perplexity, Copilot and the like matters as much as Google search.
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot',
  'Perplexity-User', 'Google-Extended', 'GoogleOther', 'Applebot', 'Applebot-Extended', 'bingbot', 'DuckAssistBot', 'Amazonbot',
  'meta-externalagent', 'MistralAI-User', 'CCBot'];
await fs.writeFile(path.join(outDir, 'robots.txt'),
  `User-agent: *\nAllow: /\n\n# AI assistants and AI search\n${AI_BOTS.map((b) => `User-agent: ${b}`).join('\n')}\nAllow: /\n\n` +
  `# A plain-text summary of the shop for AI assistants: ${site.siteUrl}/llms.txt\nSitemap: ${site.siteUrl}/sitemap.xml\n`);

// IndexNow: the key file that proves tools/indexnow.mjs speaks for this site (see deploy.yml).
if (site.indexNowKey) await fs.writeFile(path.join(outDir, `${site.indexNowKey}.txt`), site.indexNowKey + '\n');

// llms.txt (llmstxt.org): the shop in plain words for AI assistants, with its products, prices and links,
// the key facts and the FAQ (taken from the home page's structured data, so it says exactly what the page says).
{
  const home = await fs.readFile(path.join(outDir, 'index.html'), 'utf8');
  const faq = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return {}; } })
    .flatMap((d) => d['@graph'] || [d]).filter((d) => d['@type'] === 'FAQPage')
    .flatMap((d) => d.mainEntity || []).map((q) => [q.name, q.acceptedAnswer?.text]).filter(([q, a]) => q && a);
  const line = (p) => `- [${p.name}](${site.siteUrl}${productUrl(p)}): ${p.summary} ${money(p.price)} USD${p.group === 'extras' ? ', added to an apron order' : ', shipping included'}.`;
  const rating = reviewData.etsyRating && reviewData.etsyReviewCount ? `${reviewData.etsyRating} out of 5 from ${reviewData.etsyReviewCount} reviews on Etsy` : '';
  const md = `# ${site.siteName}

> ${site.siteName} makes personalised leather goods by hand in ${site.madeIn}: made-to-measure leather aprons (BBQ, chef, barber, woodworking, tattoo and forging), knife rolls, backpacks and duffle bags, engraved with the customer's name, phrase or logo. Customers design their piece online at ${site.siteUrl}, approve a design proof before it is made, and it is shipped worldwide with tracking. Prices are in US dollars${products.some((p) => p.group === 'aprons') ? `; aprons start at ${money(Math.min(...products.filter((p) => p.group === 'aprons').map((p) => p.price)))} with engraving and shipping included` : ''}.

Key facts:

- Seller: ${site.legalName} (${site.siteName}), ${site.legalForm}; founder ${site.ownerName}. Products are handmade in ${site.madeIn}.
- Personalisation: names, short phrases, dates, monograms and logos, laser engraved. A free online designer on the website shows a live preview; a design proof is sent by email or WhatsApp before production.
- Fit: aprons are made to measure from the wearer's height and weight.
- Timing: made in about 3 days after the design proof is approved, then shipped from ${site.madeIn} with a tracking number.
- Business and team orders: aprons with a company logo for restaurants, cafés, barbershops, breweries and teams; prices for several aprons are agreed directly (WhatsApp or email).
- Gifts: popular for Father's Day, birthdays, Christmas, BBQ lovers, chefs, barbers, woodworkers and tattoo artists.${rating ? `\n- Reviews: ${rating} (${site.etsyUrl}).` : ''}
- Contact: WhatsApp ${site.whatsappDisplay}, email ${site.email}, Instagram ${site.instagramHandle} (${site.instagramUrl}).
- Order online: ${site.siteUrl}/shop/ (secure checkout) or design an apron at ${site.siteUrl}/#design.

## Aprons

${products.filter((p) => p.group === 'aprons').map(line).join('\n')}

## More leather goods

${products.filter((p) => p.group === 'more').map(line).join('\n')}

## Apron extras

${products.filter((p) => p.group === 'extras').map(line).join('\n')}

## Guides

- [Custom logo aprons for businesses and teams](${site.siteUrl}/custom-logo-aprons/)
- [BBQ apron gifts](${site.siteUrl}/bbq-apron-gifts/)
- [Leather chef aprons](${site.siteUrl}/leather-chef-apron/)
- [Leather gifts for men](${site.siteUrl}/leather-gifts-for-men/)
- [About ${site.siteName}](${site.siteUrl}/about/)
- [Shipping and returns](${site.siteUrl}/shipping-returns/)
${faq.length ? `
## Frequently asked questions

${faq.map(([q, a]) => `### ${q}\n\n${a}`).join('\n\n')}
` : ''}
## Optional

- [Sitemap](${site.siteUrl}/sitemap.xml): every page on the site
- [Etsy shop](${site.etsyUrl}): the same maker's Etsy shop and its reviews
`;
  await fs.writeFile(path.join(outDir, 'llms.txt'), md);
}
// Each page asks for its CSS and JavaScript files with a fingerprint of their content (?v=…), so browsers
// that kept an older copy fetch the new one as soon as it changes.
const { createHash } = await import('node:crypto');
const fingerprints = new Map();
async function fingerprint(file) {
  if (!fingerprints.has(file)) {
    fingerprints.set(file, await fs.readFile(path.join(outDir, file)).then((b) => createHash('sha256').update(b).digest('hex').slice(0, 10), () => null));
  }
  return fingerprints.get(file);
}
async function htmlFiles(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await htmlFiles(f));
    else if (e.name.endsWith('.html')) out.push(f);
  }
  return out;
}
for (const f of await htmlFiles(outDir)) {
  const html = await fs.readFile(f, 'utf8');
  const ASSET = /"\/(assets\/(?:css|js)\/[^"?#]+)\?v=[^"]*"/g;
  for (const [, ref] of html.matchAll(ASSET)) await fingerprint(ref);
  const out = html.replace(ASSET, (m, ref) => (fingerprints.get(ref) ? `"/${ref}?v=${fingerprints.get(ref)}"` : m));
  if (out !== html) await fs.writeFile(f, out);
}
console.log('done');
