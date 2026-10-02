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
//   {{reviews}}            Etsy review cards from src/data/reviews.json
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFile(path.join(root, p), 'utf8');
const json = async (p) => JSON.parse(await read(p));

const site = await json('src/config.json');
const images = await json('tools/images.json');
const products = await json('src/data/products.json');
const reviewData = await json('src/data/reviews.json');

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

function productCards(group) {
  return products.filter((p) => p.group === group).map((p) => {
    const href = `/shop/#!/p/${p.id}`;
    const design = p.designer
      ? `<a class="btn btn-sm btn-ghost" href="/#design" data-style="${p.designer}" data-track="select_style">Design it</a>`
      : '';
    return `<article class="card product">
  <a class="product-media" href="${href}" data-track="select_item" data-id="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}" tabindex="-1" aria-hidden="true">${img(p.image || `p-${p.id}`, '', '(min-width: 1000px) 300px, (min-width: 640px) 45vw, 90vw')}</a>
  <div class="product-body">
    <h3><a href="${href}" data-track="select_item" data-id="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}">${esc(p.name)}</a></h3>
    <p>${esc(p.summary)}</p>
    <div class="product-foot"><span class="price">${money(p.price)}</span>${design}</div>
  </div>
</article>`;
  }).join('\n');
}

function reviews() {
  const list = reviewData.reviews || [];
  if (!list.length) return '';
  return `<ul class="reviews" role="list">${list.map((r) => `
  <li class="card review">
    <p class="stars" aria-label="${esc(r.rating)} out of 5 stars">${'★'.repeat(Number(r.rating) || 0)}</p>
    <blockquote><p>${esc(r.text)}</p></blockquote>
    <p class="review-meta">${esc(r.name)}${r.date ? ` · ${esc(r.date)}` : ''}${r.item ? ` · ${esc(r.item)}` : ''} · <span>Etsy review</span></p>
  </li>`).join('')}
</ul>`;
}

async function render(tpl, page, depth = 0) {
  if (depth > 5) throw new Error('Partial nesting too deep');
  let out = tpl;
  const partials = [...out.matchAll(/\{\{>\s*([\w-]+)\s*\}\}/g)];
  for (const [tag, name] of partials) {
    out = out.replace(tag, await render(await read(`src/partials/${name}.html`), page, depth + 1));
  }
  return out
    .replace(/\{\{img ([^}]+)\}\}/g, (_, a) => img(...a.split('|').map((s) => s.trim())))
    .replace(/\{\{products (\w+)\}\}/g, (_, g) => productCards(g))
    .replace(/\{\{reviews\}\}/g, () => reviews())
    .replace(/\{\{reviewsSummary\}\}/g, () => {
      const r = reviewData;
      return r.etsyRating && r.etsyReviewCount
        ? `Rated <strong>${esc(r.etsyRating)} out of 5</strong> from ${esc(r.etsyReviewCount)} reviews on Etsy.`
        : 'Read what our customers say on Etsy.';
    })
    .replace(/\{\{site\.(\w+)\}\}/g, (_, k) => esc(site[k]))
    .replace(/\{\{page\.(\w+)\}\}/g, (_, k) => esc(page[k]))
    .replace(/\{\{raw page\.(\w+)\}\}/g, (_, k) => page[k] ?? '');
}

const outDir = path.join(root, 'site');
const pageFiles = (await fs.readdir(path.join(root, 'src/pages'))).filter((f) => f.endsWith('.html'));
const sitemap = [];

for (const file of pageFiles) {
  const src = await read(`src/pages/${file}`);
  const m = src.match(/^<!--(\{[\s\S]*?\})-->\n?/);
  if (!m) throw new Error(`${file}: missing JSON header`);
  const page = JSON.parse(m[1]);
  const slug = file.replace(/\.html$/, '');
  page.path = slug === 'index' ? '/' : slug === '404' ? '/404.html' : `/${slug}/`;
  page.canonical = site.siteUrl + (page.path === '/404.html' ? '/' : page.path);
  page.robots = page.noindex ? 'noindex, follow' : 'index, follow';
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

// Runtime config for the browser (only public, non-secret values).
const pub = {
  siteUrl: site.siteUrl, whatsappNumber: site.whatsappNumber, email: site.email,
  ecwidStoreId: site.ecwidStoreId, currency: site.currency,
  ga4MeasurementId: site.ga4MeasurementId, metaPixelId: site.metaPixelId,
  products: Object.fromEntries(products.map((p) => [p.id, { name: p.name, price: p.price, group: p.group }])),
};
await fs.writeFile(path.join(outDir, 'assets/js/config.js'),
  `// Generated by tools/build.mjs from src/config.json. Do not edit by hand.\nwindow.VL_CONFIG = ${JSON.stringify(pub, null, 2)};\n`);

// GitHub Pages: custom domain + serve files as-is (no Jekyll processing).
await fs.writeFile(path.join(outDir, 'CNAME'), new URL(site.siteUrl).hostname + '\n');
await fs.writeFile(path.join(outDir, '.nojekyll'), '');

const today = new Date().toISOString().slice(0, 10);
await fs.writeFile(path.join(outDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
    .map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
await fs.writeFile(path.join(outDir, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${site.siteUrl}/sitemap.xml\n`);
console.log('done');
