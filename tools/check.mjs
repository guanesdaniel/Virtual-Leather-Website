// Pre-launch checks: run `npm run build && npm run check`.
// Reports TODO markers, missing tracking IDs, images without alt, and broken internal links.
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const siteDir = path.join(root, 'site');
const cfg = JSON.parse(await fs.readFile(path.join(root, 'src/config.json'), 'utf8'));
const reviews = JSON.parse(await fs.readFile(path.join(root, 'src/data/reviews.json'), 'utf8'));

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}

const warnings = [], errors = [];
for (const k of ['ga4MeasurementId', 'metaPixelId', 'businessAddress']) if (!cfg[k]) warnings.push(`src/config.json: "${k}" is empty`);
if (!reviews.reviews.length) warnings.push('src/data/reviews.json: no Etsy reviews added yet');

const files = (await walk(siteDir)).filter((f) => f.endsWith('.html'));
for (const f of files) {
  const rel = path.relative(siteDir, f);
  const html = await fs.readFile(f, 'utf8');
  for (const m of html.matchAll(/<span class="todo">([\s\S]*?)<\/span>/g)) warnings.push(`${rel}: ${m[1].replace(/\s+/g, ' ').slice(0, 110)}`);
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt="/.test(m[0])) errors.push(`${rel}: <img> without alt: ${m[0].slice(0, 80)}`);
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    let p = m[1];
    if (p.endsWith('/')) p += 'index.html';
    try { await fs.access(path.join(siteDir, p)); } catch { errors.push(`${rel}: broken link ${m[1]}`); }
  }
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const p = part.trim().split(' ')[0];
      try { await fs.access(path.join(siteDir, p)); } catch { errors.push(`${rel}: missing image ${p}`); }
    }
  }
}
console.log(`Checked ${files.length} pages.`);
if (warnings.length) console.log(`\nTo do before launch (${warnings.length}):\n- ` + warnings.join('\n- '));
if (errors.length) { console.log(`\nErrors (${errors.length}):\n- ` + errors.join('\n- ')); process.exit(1); }
console.log('\nNo broken links or missing alt text.');
