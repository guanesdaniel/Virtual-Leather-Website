// Virtual Leather order Worker (Cloudflare Workers, free plan). See worker/README.md.
//
// 1. POST /design   The apron designer on virtualleather.net files each design here when it goes in the cart: the
//                   apron as MarketCenter's "pedido-web" wants it (every engraving in mm), under its ref (VL-XXXX),
//                   for 30 days. Only the device that first saved a ref (its random key) can change it.
// 2. POST /order    The shop page sends the order when Ecwid says it was placed (works on the Starter plan; no Ecwid
//                   API needed): order number, payment status, shipping address, and per designed apron its ref, the
//                   device's key for it, quantity, height and weight. A PAID order goes to MarketCenter with the saved
//                   designs; any other is kept and logged ("held") for the owner to send from /admin.
// 3. Every 15 min   Orders MarketCenter couldn't take yet (busy, rate limit) are sent again.
// 4. GET /admin     For the shop owner (?key=ADMIN_KEY): the latest events, and ?send=<order id> to send (or with
//                   DRY_RUN on, test) one order now and see MarketCenter's reply.
//
// Secrets (set in Cloudflare, never in this file): MC_STORE_KEY, ADMIN_KEY.
// Settings (wrangler.toml [vars]): MC_URL, ALLOWED_ORIGINS, CLOUDINARY_PREFIX, DRY_RUN.
// Storage: the DESIGNS KV namespace.

const DAY = 86400;
const REF = /\bVL-[A-Z0-9]{4,8}\b/;
const STYLES = ['bbq', 'bbqpattern', 'barber', 'simple', 'split', 'wood'];
const SPOTS = ['1', '2', '3', '4', '5', '6', 'pocket', 'pocket2'];
const MODES = ['text', 'logo', 'design'];
const COLORS = ['tan', 'brown', 'black'];
const PER_CALL = 4;          // MarketCenter takes up to 4 aprons per call
const MAX_TRIES = 20;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    try {
      if (url.pathname === '/design') return await saveDesign(req, env);
      if (url.pathname === '/order') return await placedOrder(req, env, ctx);
      if (url.pathname === '/admin') return await admin(req, env, url);
      return new Response('Virtual Leather orders', { status: 200 });
    } catch (e) {
      await log(env, 'error', { path: url.pathname, error: String(e && e.message || e) });
      return json({ error: 'server' }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(retryPending(env));
  }
};

/* ---------- 1. Designs from the website ---------- */

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : null;
}

async function saveDesign(req, env) {
  const h = cors(req, env);
  if (!h) return json({ error: 'origin' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: Object.assign({ 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }, h) });
  if (req.method !== 'POST') return json({ error: 'method' }, 405, h);
  const text = await req.text();
  if (text.length > 32768) return json({ error: 'size' }, 413, h);
  let body;
  try { body = JSON.parse(text); } catch (e) { return json({ error: 'json' }, 400, h); }
  const ref = String(body.ref || '');
  if (!/^VL-[A-Z0-9]{4,8}$/.test(ref) || !/^[0-9a-f]{32}$/.test(String(body.key || ''))) return json({ error: 'ref' }, 400, h);
  const apron = cleanApron(body.apron, env);
  if (!apron) return json({ error: 'apron' }, 400, h);
  const keyHash = await sha256(body.key);
  const old = await env.DESIGNS.get('design:' + ref, 'json');
  if (old && old.keyHash !== keyHash) return json({ error: 'taken' }, 409, h);
  await env.DESIGNS.put('design:' + ref, JSON.stringify({ keyHash, savedAt: new Date().toISOString(), apron }), { expirationTtl: 30 * DAY });
  return json({ ok: true }, 200, h);
}

// Only the fields MarketCenter takes, of the expected kinds and lengths (the page is public, so anything could arrive).
function cleanApron(a, env) {
  if (!a || typeof a !== 'object' || !STYLES.includes(a.style)) return null;
  const s = (v, n) => (v == null || v === '' ? null : String(v).slice(0, n));
  const num = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 10) / 10 : null);
  const color = (v) => (COLORS.includes(v) ? v : null);
  const cloud = (v) => (typeof v === 'string' && v.startsWith(env.CLOUDINARY_PREFIX || 'https://res.cloudinary.com/') && v.length < 400 ? v : null);
  const spots = (Array.isArray(a.spots) ? a.spots : []).slice(0, 7).map((p) => {
    if (!p || !SPOTS.includes(p.spot) || !MODES.includes(p.mode) || !p.mm) return null;
    const o = { spot: p.spot, mode: p.mode, size: num(p.size),
      mm: { h: num(p.mm.h), w: num(p.mm.w), x: num(p.mm.x), down: num(p.mm.down) } };
    if (p.mode === 'text') { o.text = s(p.text, 200) || ''; o.font = s(p.font, 30); o.mm.font = num(p.mm.font); }
    if (p.mode === 'design') {
      o.design = s(p.design, 40); o.fields = {};
      Object.keys(p.fields || {}).slice(0, 6).forEach((k) => { o.fields[String(k).slice(0, 20)] = s(p.fields[k], 80); });
      if (p.dfont) o.dfont = s(p.dfont, 30);
    }
    if (p.mode === 'logo') { o.logoUrl = cloud(p.logoUrl); o.inkCropped = !!(o.logoUrl && p.inkCropped); }
    return o;
  }).filter(Boolean);
  const x = a.extras || {};
  return { style: a.style, main: color(a.main), acc: color(a.acc),
    extras: { wings: color(x.wings), opener: color(x.opener), grease: !!x.grease },
    height: s(a.height, 40), weight: s(a.weight, 40), spots,
    description: s(a.description, 4000) || '', designPicture: cloud(a.designPicture) };
}

/* ---------- 2. Orders placed on the website ---------- */

// The shop page sends the order when Ecwid says it was placed (Ecwid.OnOrderPlaced, which works on every Ecwid plan):
// its number, payment status, shipping address and, per designed apron, the ref, the device's key for that ref,
// the quantity, the wearer's height and weight and the order description. Only aprons whose design was saved here
// by the same device (its key) are kept, so nobody can make up an order for someone else's design.
async function placedOrder(req, env, ctx) {
  const h = cors(req, env);
  if (!h) return json({ error: 'origin' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: Object.assign({ 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }, h) });
  if (req.method !== 'POST') return json({ error: 'method' }, 405, h);
  const text = await req.text();
  if (text.length > 32768) return json({ error: 'size' }, 413, h);
  let b;
  try { b = JSON.parse(text); } catch (e) { return json({ error: 'json' }, 400, h); }
  const orderId = String(b.orderId || '').slice(0, 40);
  if (!/^[A-Za-z0-9-]{1,40}$/.test(orderId)) return json({ error: 'orderId' }, 400, h);
  if (await env.DESIGNS.get('order:' + orderId)) return json({ ok: true, duplicate: true }, 200, h);
  const s = (v, n) => String(v == null ? '' : v).slice(0, n);
  const items = [];
  for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, 20)) {
    const ref = s(it && it.ref, 12);
    if (!/^VL-[A-Z0-9]{4,8}$/.test(ref)) continue;
    const saved = await env.DESIGNS.get('design:' + ref, 'json');
    if (!saved || saved.keyHash !== await sha256(it.key)) continue;
    items.push({ ref, qty: Math.max(1, Math.min(12, Number(it.qty) || 1)), height: s(it.height, 40), weight: s(it.weight, 40), description: s(it.description, 4000) });
  }
  if (!items.length) return json({ ok: true, aprons: 0 }, 200, h);
  const t = b.shipTo || {};
  const order = { orderId, paymentStatus: s(b.paymentStatus, 30).toUpperCase(), receivedAt: new Date().toISOString(),
    shipTo: { name: s(t.name, 120), street: s(t.street, 240), city: s(t.city, 120), state: s(t.state, 80), postal: s(t.postal, 30),
      country: s(t.country, 4), phone: s(t.phone, 40), email: s(b.email, 160) },
    notes: s(b.notes, 2000), items };
  await env.DESIGNS.put('order:' + orderId, JSON.stringify(order), { expirationTtl: 60 * DAY });
  // Ecwid's storefront says ACCEPTED for a paid order (PAID in its newer API); QUEUED is "awaiting payment".
  if (order.paymentStatus === 'PAID' || order.paymentStatus === 'ACCEPTED') ctx.waitUntil(sendOrder(env, orderId, {}));
  else await log(env, 'held', { orderId, paymentStatus: order.paymentStatus || '(none)', aprons: items.map((i) => i.ref) });
  return json({ ok: true, aprons: items.length }, 200, h);
}

// MarketCenter's calls for one order: { calls: [{ orderId, body }], aprons, missing: [refs whose design expired] }.
async function buildCalls(env, order, opts) {
  const aprons = [], missing = [];
  for (const item of order.items) {
    const saved = await env.DESIGNS.get('design:' + item.ref, 'json');
    if (!saved) { missing.push(item.ref); continue; }
    const a = Object.assign({ ref: item.ref }, saved.apron);
    a.qty = item.qty;
    a.height = item.height || a.height;
    a.weight = item.weight || a.weight;
    Object.assign(a, wearer(a.height, a.weight));
    a.description = item.description || a.description;
    if (!a.designPicture) delete a.designPicture;
    aprons.push(a);
  }
  // clientApproved: false: the order goes in, but waits for the owner to tick the client's "yes" in the portal once
  // the customer has approved the design proof the website promises them.
  const base = { v: 1, shop: 'ecwid', paidAt: order.receivedAt, clientApproved: false, shipTo: order.shipTo, notes: order.notes };
  if (opts.dryRun) base.dryRun = true;
  const calls = [];
  for (let i = 0; i < aprons.length; i += PER_CALL) {
    // More than 4 aprons: the next ones go as "<order>-2", "<order>-3"… (each call is its own order there).
    const id = order.orderId + (i ? '-' + (i / PER_CALL + 1) : '');
    calls.push({ orderId: id, body: Object.assign({}, base, { orderId: id, aprons: aprons.slice(i, i + PER_CALL) }) });
  }
  return { calls, aprons: aprons.length, missing };
}

async function postMC(env, body) {
  const r = await fetch(env.MC_URL, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-mc-dist-web': env.MC_STORE_KEY || '' }, body: JSON.stringify(body) });
  let reply = null;
  try { reply = await r.json(); } catch (e) { reply = null; }
  return { status: r.status, reply };
}

// Sends one order. live = a real send (DRY_RUN off, or from /admin with live=1); otherwise MarketCenter only checks it.
async function sendOrder(env, orderId, opts) {
  const dryRun = opts.live ? false : opts.dryRun != null ? opts.dryRun : env.DRY_RUN === '1';
  if (!dryRun && !opts.again && await env.DESIGNS.get('sent:' + orderId)) return { orderId, already: true };
  const order = await env.DESIGNS.get('order:' + orderId, 'json');
  if (!order) return { orderId, error: 'no such order here' };
  const plan = await buildCalls(env, order, { dryRun });
  const out = { orderId, dryRun, aprons: plan.aprons, missing: plan.missing, results: [] };
  if (!plan.calls.length) { await log(env, 'no-aprons', out); return out; }
  let retry = false;
  for (const c of plan.calls) {
    let res;
    try { res = await postMC(env, c.body); } catch (e) { res = { status: 0, reply: String(e.message || e) }; }
    out.results.push({ orderId: c.orderId, status: res.status, reply: res.reply });
    if ([0, 413, 415, 429, 500, 502, 503, 504].includes(res.status)) retry = true;
  }
  const ok = out.results.every((r) => r.status === 200);
  if (!dryRun) {
    if (ok) {
      await env.DESIGNS.put('sent:' + orderId, JSON.stringify({ at: new Date().toISOString(), results: out.results }), { expirationTtl: 400 * DAY });
      await env.DESIGNS.delete('pending:' + orderId);
    } else if (retry) {
      const p = (await env.DESIGNS.get('pending:' + orderId, 'json')) || { tries: 0 };
      p.tries += 1;
      if (p.tries < MAX_TRIES) await env.DESIGNS.put('pending:' + orderId, JSON.stringify(p), { expirationTtl: 7 * DAY });
      else await env.DESIGNS.delete('pending:' + orderId);
      out.willRetry = p.tries < MAX_TRIES;
    }
  }
  await log(env, dryRun ? 'dry-run' : ok ? 'sent' : 'not-sent', out);
  return out;
}

/* ---------- 3. Retries ---------- */

async function retryPending(env) {
  const list = await env.DESIGNS.list({ prefix: 'pending:' });
  for (const k of list.keys.slice(0, 10)) {
    const id = k.name.slice('pending:'.length);
    try { await sendOrder(env, id, { live: true }); } catch (e) { await log(env, 'error', { orderId: id, error: String(e.message || e) }); }
  }
}

/* ---------- 4. The owner's page ---------- */

async function admin(req, env, url) {
  const key = url.searchParams.get('key') || (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.ADMIN_KEY || !safeEqual(key, env.ADMIN_KEY)) return json({ error: 'key' }, 401);
  const send = url.searchParams.get('send');
  if (send) {
    const live = url.searchParams.get('live') === '1';
    return json(await sendOrder(env, send, { live, dryRun: !live, again: true }));
  }
  const ref = url.searchParams.get('ref');
  if (ref) return json(await env.DESIGNS.get('design:' + ref, 'json') || { error: 'no design saved for ' + ref });
  const logs = await env.DESIGNS.list({ prefix: 'log:', limit: 1000 });
  const latest = logs.keys.map((k) => k.name).sort().reverse().slice(0, 20);
  const events = await Promise.all(latest.map((k) => env.DESIGNS.get(k, 'json')));
  const pending = (await env.DESIGNS.list({ prefix: 'pending:' })).keys.map((k) => k.name.slice(8));
  return json({ dryRun: env.DRY_RUN === '1', pending, events });
}

/* ---------- Helpers ---------- */

function json(o, status, headers) {
  return new Response(JSON.stringify(o, null, 1), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers || {}) });
}
// The owner's log, without addresses, emails or phone numbers (only order ids, refs and MarketCenter's replies).
async function log(env, kind, data) {
  const at = new Date().toISOString();
  await env.DESIGNS.put('log:' + at + ':' + Math.random().toString(36).slice(2, 6), JSON.stringify({ at, kind, data }), { expirationTtl: 60 * DAY });
}
async function sha256(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
// Compares in constant time (no early exit), so a wrong key can't be guessed letter by letter.
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0 && a.length > 0;
}

// The wearer's height and weight in cm and kg, read the way the designer reads them (designer.js parseHeight,
// parseWeight), so MarketCenter cuts the size the customer saw. A weight with no unit is pounds when the height
// was in feet and inches: a US customer's "5'6", 170" is 77 kg, not 170. Text that can't be read goes as typed.
function wearer(height, weight) {
  const h = parseHeight(height), kg = parseWeight(weight, h ? h.imperial : false);
  return { height: h ? Math.round(h.cm) + ' cm' : height, weight: kg != null ? Math.round(kg) + ' kg' : weight };
}
const num = (x) => parseFloat(String(x).replace(',', '.'));
function parseHeight(text) {
  const t = String(text || '').toLowerCase().replace(/[’′]/g, "'").replace(/[”″]/g, '"').trim();
  let m;
  if (!t) return null;
  if ((m = /^(\d)\s*(?:'|ft|feet|foot)\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:"|''|in|inch|inches)?)?$/.exec(t))) {
    return { cm: (Number(m[1]) * 12 + (m[2] ? num(m[2]) : 0)) * 2.54, imperial: true };
  }
  if ((m = /^(\d{2,3}(?:[.,]\d+)?)\s*(?:"|''|in|inch|inches)$/.exec(t))) return { cm: num(m[1]) * 2.54, imperial: true };
  if ((m = /^(\d(?:[.,]\d{1,2})?)\s*(?:m|mt|mts|meters?|metres?)?$/.exec(t))) {
    const v = num(m[1]);
    if (v >= 1.2 && v <= 2.5) return { cm: v * 100, imperial: false };
    if (!/m/.test(t) && v >= 4 && v < 8) {
      const parts = m[1].split(/[.,]/), inch = parts[1] ? Number(parts[1]) : 0;
      if (inch < 12) return { cm: (Number(parts[0]) * 12 + inch) * 2.54, imperial: true };
    }
    return null;
  }
  if ((m = /^(\d{3}(?:[.,]\d+)?)\s*(?:cm|cms|centimet(?:er|re)s?)?$/.exec(t))) { const c = num(m[1]); return c >= 120 && c <= 250 ? { cm: c, imperial: false } : null; }
  return null;
}
function parseWeight(text, imperial) {
  const t = String(text || '').toLowerCase().trim();
  let m;
  if (!t) return null;
  if ((m = /^(\d{1,2})\s*(?:st|stone)s?\s*(?:(\d{1,2})\s*(?:lb|lbs|pounds?)?)?$/.exec(t))) return (Number(m[1]) * 14 + (m[2] ? Number(m[2]) : 0)) * 0.45359237;
  if ((m = /^(\d{2,3}(?:[.,]\d+)?)\s*(kg|kgs|kilos?|kilograms?|lb|lbs|pounds?)?$/.exec(t))) {
    const v = num(m[1]), lb = m[2] ? /^(lb|pound)/.test(m[2]) : imperial;
    const kg = lb ? v * 0.45359237 : v;
    return kg >= 30 && kg <= 300 ? kg : null;
  }
  return null;
}

export { cleanApron, buildCalls, wearer };
