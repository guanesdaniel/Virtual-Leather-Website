// Reads the current prices from the Ecwid store and writes src/data/prices.json, so every price on
// virtualleather.net (pages, designers, Google product data) matches what checkout charges.
//   node tools/ecwid-prices.mjs   (npm run prices)
// Uses the store's *public* token (read-only, it can only see what the shop already shows), from the
// ECWID_TOKEN environment variable or "ecwidPublicToken" in src/config.json. The deploy workflow runs
// this before each build and every 6 hours. Without a token, or if Ecwid can't be reached or answers
// with something odd, the existing file is kept, so the site never loses its prices.
//
// prices.json: { products: { "<id>": { name, price, choices: { "<option choice>": price } } } }
// choices holds each option choice's full price (base price plus its price modifier, or the price of a
// variation made from just that choice), e.g. the knife roll's "Large: 76cm x 52 cm".
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const file = path.join(root, 'src/data/prices.json');
const json = async (p) => JSON.parse(await fs.readFile(path.join(root, p), 'utf8'));
const site = await json('src/config.json');
const products = await json('src/data/products.json');

const INVISIBLE = /[\s­᠎​-‏‪-‮⁠-⁤﻿]+/g;
const TOKEN = String(process.env.ECWID_TOKEN || site.ecwidPublicToken || '').replace(INVISIBLE, '').replace(/^['"]+|['"]+$/g, '');
const STORE = site.ecwidStoreId;
if (!TOKEN) { console.log('No Ecwid token (ECWID_TOKEN or ecwidPublicToken): keeping src/data/prices.json as it is.'); process.exit(0); }
if (TOKEN.startsWith('secret_')) { console.log('That is the Ecwid *secret* token: use the public one (public_…). Keeping prices.json.'); process.exit(0); }

const ids = [...new Set([...products.map((p) => p.id), site.extraEngravingProductId].filter(Boolean).map(String))];
const old = JSON.parse(await fs.readFile(file, 'utf8').catch(() => '{"products":{}}'));
const money = (n) => Math.round(Number(n) * 100) / 100;
const ok = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 100000;
const clean = (s) => String(s || '').replace(INVISIBLE, ' ').trim();

async function get(id) {
  const res = await fetch(`https://app.ecwid.com/api/v3/${STORE}/products/${id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`product ${id}: HTTP ${res.status}`);
  return res.json();
}

const out = { _comment: 'Written by tools/ecwid-prices.mjs from the Ecwid store. Edit prices in Ecwid, not here.', fetched: new Date().toISOString(), products: {} };
let failed = 0;
for (const id of ids) {
  let item;
  try { item = await get(id); } catch (e) { console.log(`Ecwid: ${e.message}`); failed++; continue; }
  if (!ok(item.price)) { console.log(`Ecwid: product ${id} has no usable price, keeping the old one.`); failed++; continue; }
  const choices = {};
  for (const opt of item.options || []) {
    for (const ch of opt.choices || []) {
      const m = Number(ch.priceModifier) || 0;
      const p = ch.priceModifierType === 'PERCENT' ? item.price * (1 + m / 100) : item.price + m;
      if (ok(p)) choices[clean(ch.text)] = money(p);
    }
  }
  for (const c of item.combinations || []) {
    if ((c.options || []).length === 1 && ok(c.price)) choices[clean(c.options[0].value)] = money(c.price);
  }
  out.products[id] = { name: item.name, price: money(item.price), ...(Object.keys(choices).length ? { choices } : {}) };
}
// Any product Ecwid didn't answer for keeps its last known price.
for (const id of ids) if (!out.products[id] && old.products && old.products[id]) out.products[id] = old.products[id];
if (failed === ids.length) { console.log('Ecwid could not be read at all: keeping src/data/prices.json as it is.'); process.exit(0); }

for (const id of ids) {
  const a = old.products?.[id]?.price, b = out.products[id]?.price;
  if (a !== b) console.log(`Price change: ${out.products[id]?.name || id}: ${a ?? '—'} → ${b}`);
}
await fs.writeFile(file, JSON.stringify(out, null, 2) + '\n');
console.log(`Prices read from Ecwid for ${ids.length - failed} of ${ids.length} products.`);
