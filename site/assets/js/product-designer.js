/* Virtual Leather — designer for products with their own page (the duffle bag, the knife roll): leather tones, text and
   logo engravings the customer drags into place, a live preview, and the Ecwid cart. Each product's
   drawing and engraving places come from window.VL_PRODUCT_DESIGN (site/assets/js/designs/*.js).
   Also runs the photo gallery at the top of those pages. */
(function () {
  'use strict';
  var C = window.VL_CONFIG || {};
  var VL = window.VL = window.VL || {};
  var P = window.VL_PRODUCT_DESIGN;
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- Photo gallery: thumbnails swap the big photo ---------- */
  var gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    var mainImg = gallery.querySelector('[data-gallery-main]');
    gallery.addEventListener('click', function (e) {
      var b = e.target.closest('.pdp-thumb');
      if (!b) return;
      mainImg.src = b.getAttribute('data-src');
      mainImg.alt = b.getAttribute('data-alt');
      Array.prototype.forEach.call(gallery.querySelectorAll('.pdp-thumb'), function (t) { t.setAttribute('aria-pressed', String(t === b)); });
    });
  }

  var form = document.getElementById('pd-form');
  var box = document.getElementById('pd-preview');
  if (!form || !box) return;
  if (!P) { document.getElementById('pd-failed').hidden = false; document.getElementById('pd-designer').hidden = true; return; }

  // Extra engravings add the Ecwid "Extra engraving" product, unless the product includes them all.
  var ENGRAVING_PRICE = 5, ENGRAVING_ID = P.extraEngravings === false ? 0 : Number(C.extraEngravingId) || 0;
  // Leather tones, as on the apron designer (ecwid = the "Main Color" value in the store).
  var COLORS = {
    tan:   { label: 'Tan', ecwid: 'Tanned (Light Brown)', hex: '#b5592f', hi: '#c97a50', edge: '#5e2a14', engrave: '#3b170a' },
    brown: { label: 'Dark brown', ecwid: 'Dark Brown', hex: '#5b3c35', hi: '#7a5650', edge: '#2e1c18', engrave: '#1c100c' },
    black: { label: 'Black', ecwid: 'Black', hex: '#262322', hi: '#45403d', edge: '#0e0d0c', engrave: '#8a837d' }
  };
  // Engraving fonts (the apron designer's). scale evens out how big each one looks at the same size.
  var FONTS = {
    montserrat: { label: 'Montserrat', family: 'Montserrat, Arial, sans-serif', weight: 700, scale: 1 },
    anton:      { label: 'Anton', family: 'Anton, Impact, sans-serif', weight: 400, scale: .81 },
    opensans:   { label: 'Open Sans', family: '"Open Sans", Arial, sans-serif', weight: 600, scale: 1.02 },
    classic:    { label: 'Classic', real: 'Playfair Display', family: '"Playfair Display", Georgia, serif', weight: 700, scale: 1.05 },
    alexbrush:  { label: 'Alex Brush', family: '"Alex Brush", cursive', weight: 400, scale: 1.52 },
    comforter:  { label: 'Comforter', family: 'Comforter, cursive', weight: 400, scale: 1.71 },
    signature:  { label: 'Signature', real: 'Great Vibes', family: '"Great Vibes", cursive', weight: 400, scale: 1.46 },
    brush:      { label: 'Brush', real: 'Kaushan Script', family: '"Kaushan Script", cursive', weight: 400, scale: 1.16 },
    bangers:    { label: 'Bangers', family: 'Bangers, Impact, sans-serif', weight: 400, scale: 1.22 },
    graffiti:   { label: 'Graffiti', real: 'Permanent Marker', family: '"Permanent Marker", cursive', weight: 400, scale: 1.1 }
  };
  function fontName(k) { var f = FONTS[k] || FONTS.montserrat; return f.label + (f.real ? ' (' + f.real + ')' : ''); }
  var PLACES = Object.keys(P.places);
  // Sizes (optional, P.sizes): a "size" radio group in the form picks one; each has its price, the
  // store's spelling of the choice, and a scale for the drawing.
  var SIZES = P.sizes || null;
  function curSize() {
    if (!SIZES) return null;
    var k = val('size');
    return SIZES.filter(function (z) { return z.key === k; })[0] || SIZES[0];
  }
  function perMm(place) { var z = curSize(); return P.places[place].perMm * (z && z.scale || 1); }
  function basePrice() { var z = curSize(); return z ? z.price : P.price; }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function val(name) { var f = form.querySelector('input[name="' + name + '"]:checked'); return f ? f.value : ''; }

  /* ---------- State ---------- */
  // Each engraving: kind 'text' or 'logo', place (a key of P.places), its size (mm tall), and its centre
  // (x, y) in drawing units. Logo pictures stay on the customer's device (they send the file after).
  var items = [], selected = 0, nextKey = 1;
  function zoneCentre(place) { var z = P.places[place].zone; return z.r ? { x: z.cx, y: z.cy } : { x: z.x + z.w / 2, y: z.y + z.h / 2 }; }
  function newItem(kind, place) {
    var c = zoneCentre(place);
    return { key: nextKey++, kind: kind, place: place, text: '', font: 'montserrat', size: P.places[place][kind][2], x: c.x, y: c.y, note: '', img: null };
  }
  function hasContent(it) { return it.kind === 'logo' || !!it.text.trim(); }
  function isPlain() { return document.getElementById('pd-plain').checked; }
  function engraved() { return isPlain() ? [] : items.filter(hasContent); }
  function extras() { return Math.max(0, engraved().length - 1); }
  function total() { return basePrice() + (ENGRAVING_ID ? extras() * ENGRAVING_PRICE : 0); }

  /* ---------- Preview ---------- */
  var svg = el('svg', { viewBox: P.viewBox, role: 'img', 'aria-labelledby': 'pd-svg-desc', id: 'pd-svg' }, box);
  el('desc', { id: 'pd-svg-desc' }, svg);
  var base = el('g', {}, svg), defs = el('defs', {}, svg), layer = el('g', {}, svg), drawn = '';
  // Clip each place, so engravings never spill over the edge.
  PLACES.forEach(function (k) {
    var z = P.places[k].zone, cp = el('clipPath', { id: 'pd-clip-' + k }, defs);
    if (z.r) el('circle', { cx: z.cx, cy: z.cy, r: z.r }, cp); else el('rect', { x: z.x, y: z.y, width: z.w, height: z.h }, cp);
  });
  // Logos are shown the way the laser engraves them: dark parts in the engraving colour, light parts clear.
  var logoFilter = el('filter', { id: 'pd-logo', 'color-interpolation-filters': 'sRGB' }, defs);
  var logoMatrix = el('feColorMatrix', { type: 'matrix', result: 'm' }, logoFilter);
  el('feComposite', { in: 'm', in2: 'SourceAlpha', operator: 'in' }, logoFilter);

  function hexRgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; }); }
  function drawBase(main, straps) {
    var size = curSize() ? curSize().key : '';
    if (drawn === main + straps + size) return;
    drawn = main + straps + size;
    while (base.firstChild) base.removeChild(base.firstChild);
    P.draw(base, COLORS[main], COLORS[straps], { el: el, size: size });
    var c = hexRgb(COLORS[main].engrave).map(function (v) { return v.toFixed(3); });
    logoMatrix.setAttribute('values', '0 0 0 0 ' + c[0] + '  0 0 0 0 ' + c[1] + '  0 0 0 0 ' + c[2] + '  -0.2126 -0.7152 -0.0722 0 1');
  }

  // How big an engraving is in drawing units, before fitting: [width, height].
  function boxOf(it, node) {
    var h = it.size * perMm(it.place);
    if (it.kind === 'logo') return [h * (it.img ? it.img.ratio : 1.4), h];
    var b = node.getBBox();
    return [b.width, h];
  }
  // Most an engraving can take at its height in a place: [width, height].
  function room(it, y) {
    var z = P.places[it.place].zone;
    if (!z.r) return [z.w, z.h];
    return [2 * Math.sqrt(Math.max(0, z.r * z.r - Math.pow(Math.abs(y - z.cy), 2))), 2 * z.r];
  }
  // Keep an engraving's centre where the whole engraving stays inside its place.
  function clamp(it, w, h) {
    var z = P.places[it.place].zone;
    if (!z.r) {
      it.x = w >= z.w ? z.x + z.w / 2 : Math.min(z.x + z.w - w / 2, Math.max(z.x + w / 2, it.x));
      it.y = h >= z.h ? z.y + z.h / 2 : Math.min(z.y + z.h - h / 2, Math.max(z.y + h / 2, it.y));
      return;
    }
    var max = Math.max(0, z.r - Math.sqrt(w * w + h * h) / 2), dx = it.x - z.cx, dy = it.y - z.cy, d = Math.sqrt(dx * dx + dy * dy);
    if (d > max) { it.x = z.cx + (d ? dx / d * max : 0); it.y = z.cy + (d ? dy / d * max : 0); }
  }

  function drawItems(main) {
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    if (isPlain()) return;
    var ink = COLORS[main].engrave;
    items.forEach(function (it, i) {
      var g = el('g', { 'clip-path': 'url(#pd-clip-' + it.place + ')' }, layer);
      var hit = el('g', { class: 'pd-item', 'data-i': i, tabindex: 0, role: 'button',
        'aria-label': 'Engraving ' + (i + 1) + ' on ' + P.places[it.place].long + '. Drag, or use the arrow keys, to move it.' }, g);
      var w, h, node, fit = 1;
      if (it.kind === 'text') {
        var f = FONTS[it.font] || FONTS.montserrat, empty = !it.text.trim();
        node = el('text', { x: it.x, y: it.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: ink,
          'font-family': f.family, 'font-weight': f.weight, 'font-size': (it.size * perMm(it.place) / .7 * f.scale).toFixed(1),
          opacity: empty ? .35 : .92 }, hit);
        node.textContent = empty ? 'Your name' : it.text;
        var bw = node.getBBox().width, r = room(it, it.y);
        // Too long for the place at this size: shrink it to fit (we tell the customer in the form).
        if (bw > r[0] * .96) { fit = r[0] * .96 / bw; node.setAttribute('font-size', (node.getAttribute('font-size') * fit).toFixed(1)); }
        w = bw * fit; h = it.size * perMm(it.place) * fit;
      } else {
        var bx = boxOf(it), r2 = room(it, it.y);
        fit = Math.min(1, r2[0] * .96 / bx[0], r2[1] * .96 / bx[1]);
        w = bx[0] * fit; h = bx[1] * fit;
      }
      it.fit = fit;
      clamp(it, w, h);
      if (it.kind === 'text') { node.setAttribute('x', it.x); node.setAttribute('y', it.y); }
      else if (it.img) {
        el('image', { href: it.img.url, x: it.x - w / 2, y: it.y - h / 2, width: w, height: h, filter: 'url(#pd-logo)', preserveAspectRatio: 'xMidYMid meet' }, hit);
      } else {
        el('rect', { x: it.x - w / 2, y: it.y - h / 2, width: w, height: h, rx: 8, fill: 'none', stroke: ink, 'stroke-width': 3, 'stroke-dasharray': '8 6' }, hit);
        el('text', { x: it.x, y: it.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: ink, 'font-family': 'Inter, sans-serif', 'font-weight': 700, 'font-size': Math.min(h * .3, w * .22).toFixed(1) }, hit).textContent = 'LOGO';
      }
      // Invisible hit area (so a thin script is easy to grab), and the selection outline.
      el('rect', { x: it.x - w / 2 - 8, y: it.y - h / 2 - 8, width: w + 16, height: h + 16, fill: 'transparent' }, hit);
      if (i === selected) el('rect', { class: 'pd-sel', x: it.x - w / 2 - 8, y: it.y - h / 2 - 8, width: w + 16, height: h + 16, rx: 6, fill: 'none', 'pointer-events': 'none' }, layer);
    });
  }

  /* ---------- Form: one card per engraving ---------- */
  var list = document.getElementById('pd-engravings');
  function range(it) { return P.places[it.place][it.kind]; }
  function priceTag(it) {
    if (!ENGRAVING_ID || !hasContent(it)) return '';
    return engraved().indexOf(it) > 0 ? '+$' + ENGRAVING_PRICE : 'Included';
  }
  function card(it, i) {
    var id = 'pd-e' + it.key, r = range(it);
    var places = PLACES.map(function (k) {
      return '<label class="opt"><input type="radio" name="' + id + '-place" value="' + k + '" data-k="place"' + (k === it.place ? ' checked' : '') + '><span>' + esc(P.places[k].label) + '</span></label>';
    }).join('');
    var body = it.kind === 'text'
      ? '<div class="field"><label for="' + id + '-text">Text</label>' +
          '<input id="' + id + '-text" type="text" maxlength="40" autocomplete="off" data-k="text" value="' + esc(it.text) + '" placeholder="e.g. a name, initials or a short phrase"></div>' +
        '<fieldset class="option-group"><legend>Font</legend><div class="options font-opts">' + Object.keys(FONTS).map(function (k) {
          var f = FONTS[k];
          return '<label class="opt"><input type="radio" name="' + id + '-font" value="' + k + '" data-k="font"' + (k === it.font ? ' checked' : '') + '>' +
            '<span style="font-family:' + esc(f.family) + ';font-weight:' + f.weight + '">' + esc(f.label) + '</span></label>';
        }).join('') + '</div></fieldset>'
      : '<div class="field logo-file"><label for="' + id + '-file">Your image or logo <span class="muted">(to see it here; you send us the file after)</span></label>' +
          '<input id="' + id + '-file" type="file" accept="image/*" data-k="file"></div>' +
        '<div class="field"><label for="' + id + '-note">Or tell us what you\'d like <span class="muted">(optional)</span></label>' +
          '<input id="' + id + '-note" type="text" maxlength="120" autocomplete="off" data-k="note" value="' + esc(it.note) + '" placeholder="e.g. our team crest, or a drawing you\'d like us to make"></div>';
    return '<fieldset class="slot' + (i === selected ? ' is-active' : '') + '" data-i="' + i + '">' +
      '<legend><span class="slot-num" aria-hidden="true">' + (i + 1) + '</span> <span class="slot-title">' + (it.kind === 'text' ? 'Text' : 'Image or logo') + '</span>' +
        '<span class="slot-price' + (priceTag(it).charAt(0) === '+' ? ' is-extra' : '') + '">' + priceTag(it) + '</span></legend>' +
      '<fieldset class="option-group"><legend>Where</legend><div class="options">' + places + '</div></fieldset>' + body +
      '<div class="size-field"><div class="size-head"><label for="' + id + '-size">Size</label><output id="' + id + '-size-out" for="' + id + '-size">' + it.size + ' mm tall</output></div>' +
        '<div class="size-row"><button type="button" class="size-btn" data-step="-1" aria-label="Smaller">−</button>' +
        '<input id="' + id + '-size" type="range" min="' + r[0] + '" max="' + r[1] + '" step="1" value="' + it.size + '" data-k="size">' +
        '<button type="button" class="size-btn" data-step="1" aria-label="Bigger">+</button></div>' +
        '<p class="fit-note" id="' + id + '-fit" aria-live="polite"></p></div>' +
      '<div class="btn-row pd-item-actions"><button type="button" class="link-button" data-centre>Centre it</button>' +
        '<button type="button" class="link-button" data-remove>Remove</button></div>' +
      '</fieldset>';
  }
  function renderList() {
    list.innerHTML = items.map(card).join('') || '<p class="hint">No engraving yet: add a text or a logo below.</p>';
  }
  function cardOf(i) { return list.querySelector('.slot[data-i="' + i + '"]'); }
  // Small updates that don't rebuild the cards (so typing keeps its place).
  function refreshCards() {
    items.forEach(function (it, i) {
      var c = cardOf(i);
      if (!c) return;
      c.classList.toggle('is-active', i === selected);
      var tag = c.querySelector('.slot-price'), t = priceTag(it);
      tag.textContent = t; tag.classList.toggle('is-extra', t.charAt(0) === '+');
      var note = c.querySelector('.fit-note');
      note.textContent = it.fit < .995 && hasContent(it)
        ? 'At this size it doesn\'t fit ' + P.places[it.place].long + ', so we\'ve made it smaller: about ' + Math.round(it.size * it.fit) + ' mm tall.' : '';
    });
  }

  /* ---------- Summary, description and WhatsApp ---------- */
  function shortTone(k) { return COLORS[k].label.toLowerCase(); }
  function where(it) {
    var z = P.places[it.place].zone, fx, fy;
    if (z.r) { fx = (it.x - z.cx) / (2 * z.r) + .5; fy = (it.y - z.cy) / (2 * z.r) + .5; }
    else { fx = (it.x - z.x) / z.w; fy = (it.y - z.y) / z.h; }
    if (Math.abs(fx - .5) < .04 && Math.abs(fy - .5) < .04) return 'centred';
    return Math.round(fx * 100) + '% from the left, ' + Math.round(fy * 100) + '% from the top';
  }
  function line(it, n) {
    var size = 'about ' + Math.round(it.size * (it.fit || 1)) + ' mm tall';
    if (it.kind === 'text') return n + ') Text "' + it.text.trim() + '" on ' + P.places[it.place].long + ', font ' + fontName(it.font) + ', ' + size + ', ' + where(it);
    return n + ') Image or logo on ' + P.places[it.place].long + ' (' + (it.note ? it.note + '; ' : '') + 'customer sends the file), ' + size + ', ' + where(it);
  }
  // The engravings on one place, for a store option of their own ('' if none).
  function linesOn(place) {
    return engraved().map(function (it, i) { return it.place === place ? line(it, i + 1) : ''; }).filter(Boolean).join(' | ');
  }
  function describe(ref) {
    var parts = [(curSize() ? 'Size: ' + curSize().label + ' | ' : '') + (P.strapsLabel || 'Straps and handles') + ': ' + COLORS[val('straps')].label];
    var list = engraved();
    if (!list.length) parts.push('Engraving: none (plain)');
    list.forEach(function (it, i) { parts.push(line(it, i + 1)); });
    if (list.length > 1) parts.push('Engravings: ' + list.length + (ENGRAVING_ID ? ' (1 included + ' + (list.length - 1) + ' extra)' : ' (all included)'));
    var who = document.getElementById('pd-for').value.trim(), notes = document.getElementById('pd-notes').value.trim();
    if (who) parts.push('For: ' + who);
    if (notes) parts.push('Notes: ' + notes);
    parts.push('Designed on virtualleather.net' + (ref ? ' (ref ' + ref + ')' : ''));
    return parts.join(' | ');
  }
  var sum = {
    size: document.getElementById('pd-sum-size'), colors: document.getElementById('pd-sum-colors'), engraving: document.getElementById('pd-sum-engraving'),
    extra: document.getElementById('pd-sum-extra'), extraDt: document.getElementById('pd-sum-extra-dt'), total: document.getElementById('pd-sum-total')
  };
  var waLink = document.getElementById('pd-whatsapp');
  function updateSummary() {
    if (sum.size && curSize()) sum.size.textContent = curSize().summary || curSize().label;
    sum.colors.textContent = COLORS[val('main')].label + ', ' + shortTone(val('straps')) + ' straps';
    var list = engraved();
    sum.engraving.textContent = list.length ? list.map(function (it) {
      return (it.kind === 'text' ? '"' + it.text.trim() + '"' : 'Logo') + ' (' + P.places[it.place].label.toLowerCase() + ')';
    }).join(', ') : 'None';
    var n = ENGRAVING_ID ? extras() : 0;
    sum.extra.hidden = sum.extraDt.hidden = !n;
    sum.extra.textContent = n + ' × $' + ENGRAVING_PRICE;
    sum.total.textContent = '$' + total();
    if (waLink) waLink.href = 'https://wa.me/' + C.whatsappNumber + '?text=' + encodeURIComponent(
      'Hi Virtual Leather! I\'d like to order a ' + (curSize() ? curSize().label.toLowerCase() + ' ' : '') + P.name + ': ' + COLORS[val('main')].label + ' leather. ' + describe('').replace(/ \| Designed on virtualleather\.net$/, '') + '.');
    document.getElementById('pd-svg-desc').textContent = P.desc + ' in ' + shortTone(val('main')) + ' leather with ' + shortTone(val('straps')) + ' straps' +
      (list.length ? ', engraved: ' + list.map(function (it) { return (it.kind === 'text' ? it.text.trim() : 'a logo') + ' on ' + P.places[it.place].long; }).join('; ') : ', without engraving') + '.';
  }

  /* ---------- Draft (kept on this device, without logo pictures) ---------- */
  var DRAFT = 'vl-design-' + P.id, draftTimer;
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      try {
        localStorage.setItem(DRAFT, JSON.stringify({ main: val('main'), straps: val('straps'), size: val('size'), plain: isPlain(),
          for: document.getElementById('pd-for').value, notes: document.getElementById('pd-notes').value,
          email: form.elements.email.value, phone: form.elements.phone.value,
          items: items.map(function (it) { return { kind: it.kind, place: it.place, text: it.text, font: it.font, size: it.size, x: it.x, y: it.y, note: it.note }; }) }));
      } catch (e) {}
    }, 400);
  }
  function loadDraft() {
    var d;
    try { d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) {}
    if (!d || !Array.isArray(d.items)) return false;
    ['main', 'straps', 'size'].forEach(function (n) { var r = form.querySelector('input[name="' + n + '"][value="' + d[n] + '"]'); if (r) r.checked = true; });
    document.getElementById('pd-plain').checked = !!d.plain;
    document.getElementById('pd-for').value = d.for || '';
    document.getElementById('pd-notes').value = d.notes || '';
    form.elements.email.value = d.email || '';
    form.elements.phone.value = d.phone || '';
    items = d.items.filter(function (it) { return P.places[it.place] && (it.kind === 'text' || it.kind === 'logo'); }).map(function (it) {
      var n = newItem(it.kind, it.place), r = P.places[it.place][it.kind];
      n.text = String(it.text || ''); n.font = FONTS[it.font] ? it.font : 'montserrat'; n.note = String(it.note || '');
      n.size = Math.min(r[1], Math.max(r[0], Number(it.size) || r[2])); n.x = Number(it.x) || n.x; n.y = Number(it.y) || n.y;
      return n;
    });
    return true;
  }

  /* ---------- Updates ---------- */
  var tracked = false;
  function update(rebuild) {
    var plain = isPlain();
    if (selected >= items.length) selected = items.length - 1;
    drawBase(val('main'), val('straps'));
    if (rebuild) renderList();
    list.hidden = plain;
    document.getElementById('pd-add').hidden = plain;
    drawItems(val('main'));
    refreshCards();
    updateSummary();
    saveDraft();
  }
  function changed() {
    if (tracked || !VL.track) return;
    tracked = true;
    VL.track('customize_product', { currency: C.currency, value: basePrice(), items: [{ item_id: String(P.id), item_name: P.label, price: basePrice() }] });
  }
  function select(i, focusCard) {
    if (i === selected && !focusCard) return;
    selected = i;
    drawItems(val('main'));
    refreshCards();
    if (focusCard && cardOf(i)) cardOf(i).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  form.addEventListener('change', function (e) {
    var t = e.target, c = t.closest('.slot');
    if (!c) { changed(); return update(false); }
    var it = items[+c.getAttribute('data-i')], k = t.getAttribute('data-k');
    selected = +c.getAttribute('data-i');
    if (k === 'place') {
      it.place = t.value;
      var r = range(it), ctr = zoneCentre(it.place);
      it.size = r[2]; it.x = ctr.x; it.y = ctr.y;
      changed();
      return update(true);
    }
    if (k === 'font') it.font = t.value;
    if (k === 'file' && t.files && t.files[0]) {
      var url = URL.createObjectURL(t.files[0]), probe = new Image();
      probe.onload = function () {
        if (it.img) URL.revokeObjectURL(it.img.url);
        it.img = { url: url, ratio: probe.naturalWidth / probe.naturalHeight || 1 };
        update(false);
      };
      probe.onerror = function () { URL.revokeObjectURL(url); };
      probe.src = url;
    }
    changed();
    update(false);
  });
  form.addEventListener('input', function (e) {
    var t = e.target, c = t.closest('.slot');
    if (!c) return update(false);
    var it = items[+c.getAttribute('data-i')], k = t.getAttribute('data-k');
    selected = +c.getAttribute('data-i');
    if (k === 'text') it.text = t.value;
    if (k === 'note') it.note = t.value;
    if (k === 'size') { it.size = +t.value; c.querySelector('output').textContent = it.size + ' mm tall'; }
    update(false);
  });
  form.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]');
    if (add) {
      var kind = add.getAttribute('data-add');
      // A second engraving starts on the place with the fewest engravings.
      var place = PLACES.slice().sort(function (a, b) {
        return items.filter(function (it) { return it.place === a; }).length - items.filter(function (it) { return it.place === b; }).length;
      })[0];
      items.push(newItem(kind, place));
      selected = items.length - 1;
      changed();
      update(true);
      var c = cardOf(selected);
      if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); (c.querySelector('[data-k="text"]') || c.querySelector('input')).focus({ preventScroll: true }); }
      return;
    }
    var c2 = e.target.closest('.slot');
    if (!c2) return;
    var i = +c2.getAttribute('data-i'), it = items[i];
    if (e.target.closest('[data-remove]')) {
      if (it.img) URL.revokeObjectURL(it.img.url);
      items.splice(i, 1);
      selected = Math.max(0, Math.min(selected, items.length - 1));
      update(true);
      var next = cardOf(selected);
      (next ? next.querySelector('input') : document.getElementById('pd-add').querySelector('button')).focus();
      return;
    }
    if (e.target.closest('[data-centre]')) { var ctr = zoneCentre(it.place); it.x = ctr.x; it.y = ctr.y; selected = i; return update(false); }
    var step = e.target.closest('[data-step]');
    if (step) {
      var input = c2.querySelector('[data-k="size"]');
      input.value = Math.min(+input.max, Math.max(+input.min, +input.value + 5 * Number(step.getAttribute('data-step'))));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  list.addEventListener('focusin', function (e) {
    var c = e.target.closest('.slot');
    if (c && +c.getAttribute('data-i') !== selected) select(+c.getAttribute('data-i'));
  });

  /* ---------- Drag (mouse, touch, pen) and arrow keys on the preview ---------- */
  var drag = null;
  function toSvg(e) {
    var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  svg.addEventListener('pointerdown', function (e) {
    var g = e.target.closest('.pd-item');
    if (!g) return;
    e.preventDefault();
    var i = +g.getAttribute('data-i'), p = toSvg(e);
    select(i, true);
    drag = { id: e.pointerId, dx: items[i].x - p.x, dy: items[i].y - p.y };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var p = toSvg(e), it = items[selected];
    it.x = p.x + drag.dx; it.y = p.y + drag.dy;
    drawItems(val('main'));
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    changed();
    refreshCards(); updateSummary(); saveDraft();
    var g = layer.querySelector('.pd-item[data-i="' + selected + '"]');
    if (g) g.focus({ preventScroll: true });
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('keydown', function (e) {
    var g = e.target.closest('.pd-item'), d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!g || !d) return;
    e.preventDefault();
    var i = +g.getAttribute('data-i'), it = items[i], s = e.shiftKey ? 20 : 5;
    selected = i; it.x += d[0] * s; it.y += d[1] * s;
    update(false);
    var again = layer.querySelector('.pd-item[data-i="' + i + '"]');
    if (again) again.focus({ preventScroll: true });
  });
  svg.addEventListener('focusin', function (e) {
    var g = e.target.closest('.pd-item');
    if (g && +g.getAttribute('data-i') !== selected) { select(+g.getAttribute('data-i')); var a = layer.querySelector('.pd-item[data-i="' + selected + '"]'); if (a) a.focus({ preventScroll: true }); }
  });

  /* ---------- Add to cart ---------- */
  var status = document.getElementById('pd-status'), submit = document.getElementById('pd-submit'), added = document.getElementById('pd-added');
  function setStatus(msg, kind) { status.textContent = msg; status.setAttribute('data-kind', kind || ''); }
  function validate(f) {
    var v = f.value.trim(), err = document.getElementById(f.id + '-error'), msg = '';
    if (f.name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = 'Please enter your email, for example name@example.com.';
    if (f.name === 'phone' && !/^\+?[0-9 ()\-]{6,24}$/.test(v)) msg = 'Please enter your phone number, with the country code if you can.';
    f.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg;
    return !msg;
  }
  form.elements.email.addEventListener('blur', function () { if (this.value) validate(this); });
  form.elements.phone.addEventListener('blur', function () { if (this.value) validate(this); });
  function newRef() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint8Array(4), out = 'VL-';
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < 4; i++) a[i] = Math.floor(Math.random() * 256);
    for (var j = 0; j < 4; j++) out += chars[a[j] % chars.length];
    return out;
  }
  function addProduct(E, id, options, quantity) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('timeout')); }, 12000);
      E.Cart.addProduct({ id: id, quantity: quantity || 1, options: options, callback: function (success) {
        clearTimeout(t);
        success === false ? reject(new Error('rejected')) : resolve();
      } });
    });
  }

  // Add the product. With sizes, the cart is checked for the size: if the store didn't take the choice as
  // spelled (so the price would be wrong), that line comes out and the next spelling is tried.
  function addMain(E, options, ref) {
    var z = curSize(), names = z ? [].concat(z.ecwid) : [null];
    function check(name) {
      return new Promise(function (resolve) {
        E.Cart.get(function (cart) {
          var items = cart && cart.items || [], at = -1;
          items.forEach(function (it, i) {
            var o = it.options || {};
            if (it.product && Number(it.product.id) === P.id && Object.keys(o).some(function (k) { return String(o[k]).indexOf(ref) !== -1; })) at = i;
          });
          if (at !== -1 && items[at].options.Size === name) return resolve(true);
          if (at === -1) return resolve(false);
          E.Cart.removeProduct(at, function () { resolve(false); });
        });
      });
    }
    function attempt(i) {
      if (z) options.Size = names[i];
      var last = i === names.length - 1;
      return addProduct(E, P.id, options, 1).then(function () {
        if (last) return;
        return check(names[i]).then(function (ok) { if (!ok) return attempt(i + 1); });
      }, function (err) { if (last) throw err; return attempt(i + 1); });
    }
    return attempt(0);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!isPlain() && !engraved().length) {
      setStatus('Please write your text or add a logo, or tick "I\'d like it plain".', 'error');
      var first = list.querySelector('[data-k="text"]');
      (first || document.getElementById('pd-add').querySelector('button')).focus();
      return;
    }
    var bad = [form.elements.email, form.elements.phone].filter(function (f) { return !validate(f); });
    if (bad.length) { setStatus('Please check the highlighted fields.', 'error'); bad[0].focus(); return; }
    var ref = newRef(), n = ENGRAVING_ID ? extras() : 0, logos = engraved().filter(function (it) { return it.kind === 'logo'; }).length;
    var options = {
      'Main Color': COLORS[val('main')].ecwid,
      'Description For Personalization': describe(ref),
      'Email for design confirmation': form.elements.email.value.trim(),
      'Phone Number for shipping confirmation': form.elements.phone.value.trim()
    };
    if (curSize()) options.Size = [].concat(curSize().ecwid)[0];
    // A product whose store options differ maps them itself (P.cartOptions).
    if (P.cartOptions) options = P.cartOptions(options, { straps: COLORS[val('straps')], description: options['Description For Personalization'], lines: linesOn });
    submit.disabled = true;
    setStatus('Adding to your cart…');
    VL.loadEcwid().then(function (E) {
      return addMain(E, options, ref).then(function () { if (n) return addProduct(E, ENGRAVING_ID, {}, n); });
    }).then(function () {
      setStatus('');
      try { localStorage.removeItem(DRAFT); } catch (err) {}
      var logo = document.getElementById('pd-logo-next');
      logo.hidden = !logos;
      if (logos) {
        var text = 'Hi Virtual Leather! I\'ve just added a ' + P.name + ' to my cart on your website (design ref ' + ref + '). Here is my image or logo:';
        document.getElementById('pd-logo-wa').href = 'https://wa.me/' + C.whatsappNumber + '?text=' + encodeURIComponent(text);
        document.getElementById('pd-logo-mail').href = 'mailto:' + C.email + '?subject=' + encodeURIComponent('My logo for my ' + P.label.toLowerCase() + ' order') +
          '&body=' + encodeURIComponent(text + '\n\n(File attached.)\n\nName on the order: ');
      }
      form.hidden = true;
      added.hidden = false;
      added.querySelector('h3').focus();
      added.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function () {
      setStatus('Sorry, we couldn\'t reach the cart (an ad blocker can cause this). Please send us your design on WhatsApp instead. It\'s already written for you.', 'error');
      if (waLink) waLink.focus();
    }).then(function () { submit.disabled = false; });
  });
  document.getElementById('pd-again').addEventListener('click', function () {
    items.forEach(function (it) { if (it.img) URL.revokeObjectURL(it.img.url); });
    items = [newItem('text', PLACES[0])]; selected = 0;
    document.getElementById('pd-plain').checked = false;
    document.getElementById('pd-for').value = '';
    document.getElementById('pd-notes').value = '';
    added.hidden = true; form.hidden = false;
    update(true);
    form.querySelector('input[name="main"]:checked').focus();
  });

  if (!loadDraft()) items = [newItem('text', PLACES[0])];
  update(true);
  // Fonts load on demand: redraw once they arrive, so sizes and fitting use the real letters.
  if (document.fonts && document.fonts.ready) {
    Object.keys(FONTS).forEach(function (k) { try { document.fonts.load(FONTS[k].weight + ' 20px ' + FONTS[k].family); } catch (e) {} });
    document.fonts.ready.then(function () { drawItems(val('main')); refreshCards(); });
    document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', function () { if (!drag) { drawItems(val('main')); refreshCards(); } });
  }
  if (VL.track) VL.track('view_item', { currency: C.currency, value: basePrice(), items: [{ item_id: String(P.id), item_name: P.label, price: basePrice() }] });
})();
