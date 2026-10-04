// Downloads product photos from the Ecwid store (your own photos) and writes
// optimised WebP versions into site/assets/img. Re-run after changing IMAGES.
import fs from 'node:fs/promises';
import sharp from 'sharp';

const products = JSON.parse(await fs.readFile(new URL('./ecwid-products.json', import.meta.url)));
const byId = Object.fromEntries(products.map(p => [p.id, p]));

// name: [productId, imageIndex, widths[]]
const IMAGES = {
  'hero-bbq': ['619498562', 0, [640, 1080]],
  'style-bbq': ['619498562', 3, [480]],
  'style-simple': ['619505538', 5, [480]],
  'style-barber': ['619492033', 0, [480]],
  'style-split': ['619501025', 1, [480]],
  'style-wood': ['619498560', 0, [480]],
  'work-lyric-barber': ['619498562', 16, [480, 800]],
  'work-acdc': ['619498562', 18, [480, 800]],
  'work-monogram': ['619498562', 21, [480, 800]],
  'work-barber-name': ['619492033', 7, [480, 800]],
  'work-campari': ['619505538', 6, [480, 800]],
  'work-grill-master': ['738486114', 3, [480, 800]],
  'work-crest': ['619498562', 22, [480, 800]],
  'work-tan-logo': ['619492033', 5, [480, 800]],
  'workshop': ['619501025', 4, [640, 1080]],
  'team-aprons': ['619498562', 20, [640, 1080]],
  'sketch': ['619498562', 2, [640]],
};
// Real photos for the designer, per apron style (src/data/gallery.json).
const gallery = JSON.parse(await fs.readFile(new URL('../src/data/gallery.json', import.meta.url)));
for (const [style, g] of Object.entries(gallery)) {
  if (style.startsWith('_')) continue;
  g.photos.forEach(([idx], i) => { IMAGES[`gal-${style}-${i}`] = [g.id, idx, [320, 1080]]; });
}
// Main image of every product, for product cards.
for (const p of products) IMAGES[`p-${p.id}`] = [p.id, 0, [480, 800]];

const out = new URL('../site/assets/img/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const meta = {};
for (const [name, [id, idx, widths]] of Object.entries(IMAGES)) {
  const src = byId[id]?.images?.[idx]?.u1500;
  if (!src) { console.warn('missing', name); continue; }
  const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
  const img = sharp(buf).rotate();
  const { width, height } = await img.metadata();
  meta[name] = { ratio: +(width / height).toFixed(4), widths };
  for (const w of widths) {
    await img.clone().resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 74 }).toFile(new URL(`${name}-${w}.webp`, out).pathname);
  }
  console.log('ok', name);
}
await fs.writeFile(new URL('./images.json', import.meta.url), JSON.stringify(meta, null, 1));
