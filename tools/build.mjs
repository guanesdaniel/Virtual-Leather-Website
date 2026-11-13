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
//                          ({{products group not <id>}} leaves that product out)
//   {{gallery}}            real photos per apron style for the designer (src/data/gallery.json)
//   {{reviews}}            Etsy review cards from src/data/reviews.json (see tools/etsy-reviews.mjs)
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
const reviewData = await json('src/data/reviews.json');
const galleryData = await json('src/data/gallery.json');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;

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
const imgUrl = (name, largest = true) => {
  const ws = images[name].widths;
  return `${site.siteUrl}/assets/img/${name}-${largest ? ws[ws.length - 1] : ws[0]}.webp`;
};

function productCards(group, not) {
  return products.filter((p) => p.group === group && p.id !== not).map((p) => {
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
function reviewCard(r) {
  const n = Math.max(0, Math.min(5, Number(r.rating) || 0));
  return `
  <li class="card review">
    <p class="stars" role="img" aria-label="${n} out of 5 stars">${'★'.repeat(n)}<span aria-hidden="true" class="stars-off">${'★'.repeat(5 - n)}</span></p>
    <blockquote><p>${esc(r.text).replace(/\n+/g, '<br>')}</p></blockquote>
    <p class="review-meta">${esc(r.name || 'Etsy buyer')}${r.date ? ` · ${esc(r.date)}` : ''}${r.item ? ` · ${esc(r.item)}` : ''}</p>
  </li>`;
}
function reviews() {
  const list = reviewData.reviews || [];
  if (!list.length) return '';
  const first = list.slice(0, 6), more = list.slice(6);
  return `<ul class="reviews" role="list">${first.map(reviewCard).join('')}
</ul>` + (more.length ? `
<details class="more-reviews"><summary>Show more reviews</summary>
<ul class="reviews" role="list">${more.map(reviewCard).join('')}
</ul></details>` : '');
}
const hasReviews = (reviewData.reviews || []).length > 0;
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
  return ifFlags(out)
    .replace(/\{\{img ([^}]+)\}\}/g, (_, a) => img(...a.split('|').map((s) => s.trim())))
    .replace(/\{\{products (\w+)(?: not (\d+))?\}\}/g, (_, g, not) => productCards(g, not))
    .replace(/\{\{productLinks\}\}/g, () => productLinks())
    .replace(/\{\{reviews\}\}/g, () => reviews())
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
  const src = ifFlags(await read(`src/pages/${file}`));
  const m = src.match(/^<!--(\{[\s\S]*?\})-->\n?/);
  if (!m) throw new Error(`${file}: missing JSON header`);
  const page = JSON.parse(m[1]);
  const slug = file.replace(/\.html$/, '');
  page.path = slug === 'index' ? '/' : slug === '404' ? '/404.html' : `/${slug}/`;
  page.canonical = site.siteUrl + (page.path === '/404.html' ? '/' : page.path);
  page.robots = page.noindex ? 'noindex, follow' : 'index, follow';
  page.ogType ||= 'website';
  page.ogImage ||= imgUrl('hero-bbq');
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
    'Design proof to approve before we start', 'Made in about 3 days after you approve, then tracked shipping', 'Shipping included, worldwide'];
  if (p.group === 'more') return ['Real leather, handmade in Colombia', 'Personalised with your name, phrase or logo',
    'Design proof to approve before we start', 'Made in about 3 days after you approve, then tracked shipping', 'Shipping included, worldwide'];
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
${related.length ? `  <section class="product-related" aria-labelledby="related-title">
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
  const page = { title: `${p.title || p.name} | ${site.siteName}`, description: p.description || p.summary, bodyClass: 'product-page-body',
    path: productUrl(p), robots: 'index, follow', ogType: 'product' };
  page.canonical = site.siteUrl + page.path;
  page.ogImage = imgUrl(productPhotos(p)[0][0]);
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
  products: Object.fromEntries(products.map((p) => [p.id, Object.assign({ name: p.name, price: p.price, group: p.group }, p.designer ? { designer: p.designer } : {}, p.page ? { page: p.page } : {})])),
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
  const description = `${about} Personalised: engraved with your name, phrase or logo. Handmade to order in Colombia; you approve a design proof before we make it.`;
  const tags = [
    ['g:id', p.id],
    ['g:title', us(p.title || p.name)],
    ['g:description', us(description)],
    ['g:link', site.siteUrl + productUrl(p)],
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
await fs.writeFile(path.join(outDir, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${site.siteUrl}/sitemap.xml\n`);
console.log('done');
