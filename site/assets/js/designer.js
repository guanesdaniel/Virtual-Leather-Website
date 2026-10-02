/* Virtual Leather — apron designer.
 * Renders a live SVG preview and adds the configured apron to the Ecwid cart
 * using the store's real product option names (see tools/ecwid-products.json).
 */
(function () {
  'use strict';
  var form = document.getElementById('designer-form');
  var stage = document.getElementById('apron-preview');
  if (!form || !stage) return;

  var C = window.VL_CONFIG || {};
  var VL = window.VL = window.VL || {};
  var NS = 'http://www.w3.org/2000/svg';
  var PRICE = 185, EXTRA_PRICE = 18;

  var STYLES = {
    bbq:    { id: 619498562, name: 'BBQ apron with beer holder', positions: 6, secondary: 'Secondary Color (Attachment/Pockets)' },
    barber: { id: 619492033, name: 'Barber apron', positions: 6, secondary: 'Secondary Color (Attachment/Pockets)' },
    simple: { id: 619505538, name: 'Simple apron', positions: 6, secondary: 'Secondary Color (Attachments/Pockets)' },
    split:  { id: 619501025, name: 'Split-leg forging & tattoo apron', positions: 4, secondary: 'Secondary Color (Attachment/Pockets)' },
    wood:   { id: 619498560, name: 'Woodworking apron', positions: 4, secondary: 'Secondary Color (Attachment/Pockets)' }
  };
  // Leather palette taken from the reference illustration.
  //   hex = base, edge = outline/shadow, hi = highlight, strap = harness colour, engrave = lettering,
  //   mottle* = colour of the cloudy patches (0-1 RGB).
  var COLORS = {
    tan:   { label: 'Tan (light brown)', ecwid: 'Tanned (Light Brown)', addon: 'Tanned or Light Brown', hex: '#b5592f', edge: '#5e2a14', hi: '#c97a50', strap: '#8a4422', engrave: '#3b170a', mottleR: .55, mottleG: .22, mottleB: .1, mottleK: '1.6 0 0 0 -0.55' },
    brown: { label: 'Dark brown', ecwid: 'Dark Brown', addon: 'Dark Brown', hex: '#5b3c35', edge: '#2e1c18', hi: '#7a5650', strap: '#4a2f29', engrave: '#1c100c', mottleR: .27, mottleG: .16, mottleB: .13, mottleK: '1.1 0 0 0 -0.42' },
    black: { label: 'Black', ecwid: 'Black', addon: 'Black', hex: '#262322', edge: '#0e0d0c', hi: '#45403d', strap: '#1b1918', engrave: '#8a837d', mottleR: .16, mottleG: .15, mottleB: .145, mottleK: '0.9 0 0 0 -0.38' }
  };
  var FONTS = {
    serif:  { label: 'Classic serif', family: 'Fraunces, Georgia, serif', weight: 700 },
    sans:   { label: 'Modern bold', family: 'Inter, Arial, sans-serif', weight: 800 },
    script: { label: 'Script', family: '"Great Vibes", "Brush Script MT", cursive', weight: 400 }
  };
  // Engraving positions 1-6 from the Virtual Leather "Apron Sketch" (1200 x 1800 drawing units).
  var POS = {
    1: { x: 600, y: 465, w: 330, h: 90, label: 'Chest, top' },
    2: { x: 600, y: 580, w: 330, h: 70, label: 'Chest, below 1' },
    3: { x: 285, y: 880, w: 210, h: 70, label: 'Middle left' },
    4: { x: 730, y: 930, w: 280, h: 56, label: 'Middle right' },
    5: { x: 235, y: 1640, w: 260, h: 120, label: 'Bottom left' },
    6: { x: 965, y: 1640, w: 260, h: 120, label: 'Bottom right' }
  };
  VL.designerPositions = POS;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function val(name) {
    var f = form.elements[name];
    if (!f) return '';
    if (f.length && !f.tagName) { for (var i = 0; i < f.length; i++) if (f[i].checked) return f[i].value; return ''; }
    if (f.type === 'checkbox') return f.checked;
    return f.value.trim();
  }

  /* ---------- SVG preview (styled after the Virtual Leather reference illustration) ---------- */
  var W = 1200, H = 1800;
  var BIB = 'M350,236 Q350,220 366,220 Q600,242 834,220 Q850,220 850,236 L850,560 C860,760 1000,900 1160,950 ' +
    'L1160,1742 Q1160,1760 1142,1760 L58,1760 Q40,1760 40,1742 L40,950 C200,900 340,760 350,560 Z';
  var STRAP_L = 'M390,300 V215 C390,165 440,125 545,98';
  var STRAP_R = 'M810,300 V215 C810,165 760,125 655,98';
  var OUTER_L = 'M545,45 C340,20 205,45 175,170 C150,280 145,430 140,560 L135,650 C130,770 45,775 45,690 L45,620';
  var OUTER_R = 'M655,45 C860,20 995,45 1025,170 C1050,280 1055,430 1060,560 L1065,650 C1070,770 1155,775 1155,690 L1155,620';

  function rivet(g, x, y, r) {
    el('circle', { cx: x, cy: y, r: r || 9, fill: 'url(#metal)', stroke: 'rgba(0,0,0,.35)', 'stroke-width': 1.5 }, g);
  }
  function plate(g, x, y, w, h, acc, rx) {
    return el('rect', { x: x, y: y, width: w, height: h, rx: rx == null ? 8 : rx, fill: 'url(#accGrad)', stroke: acc.edge, 'stroke-width': 3, filter: 'url(#drop)' }, g);
  }
  function stitch(g, x, y, w, h) {
    el('rect', { x: x, y: y, width: w, height: h, rx: 4, fill: 'none', stroke: 'rgba(255,240,225,.55)', 'stroke-width': 2.5, 'stroke-dasharray': '10 8' }, g);
  }
  // Tool-loop strip: base strap with raised leather loops between rivet pairs.
  function loops(g, x, y, w, h, n, acc) {
    plate(g, x, y, w, h, acc, 6);
    var lw = (w - 40) / n;
    for (var i = 0; i < n; i++) {
      var lx = x + 20 + i * lw + 8;
      el('rect', { x: lx, y: y - 8, width: lw - 16, height: h + 16, rx: 12, fill: 'url(#loopGrad)', stroke: acc.edge, 'stroke-width': 3 }, g);
    }
    for (var j = 0; j <= n; j++) {
      var rx = x + 20 + j * lw;
      rivet(g, rx, y + h * 0.3, 6); rivet(g, rx, y + h * 0.7, 6);
    }
  }
  function strap(g, x, y, w, h, acc) {
    plate(g, x, y, w, h, acc, 6);
    rivet(g, x + w / 2, y + 22, 7);
    el('path', { d: 'M' + (x + w / 2 - 6) + ',' + (y + h * 0.55) + ' h12 M' + (x + w / 2 - 6) + ',' + (y + h * 0.78) + ' h12', stroke: 'rgba(0,0,0,.6)', 'stroke-width': 3 }, g);
  }
  function hstrap(g, x, y, w, h, acc) {
    plate(g, x, y, w, h, acc, 6);
    el('path', { d: 'M' + (x + 35) + ',' + (y + h / 2) + ' h22 M' + (x + 70) + ',' + (y + h / 2) + ' h22', stroke: 'rgba(0,0,0,.6)', 'stroke-width': 3 }, g);
    rivet(g, x + w - 24, y + h / 2, 7);
  }
  function pocket(g, x, y, w, h, acc) {
    plate(g, x, y, w, h, acc, 8);
    stitch(g, x + 12, y + 12, w - 24, h - 24);
    rivet(g, x + 14, y + 14, 8); rivet(g, x + w - 14, y + 14, 8); rivet(g, x + 14, y + h - 14, 8); rivet(g, x + w - 14, y + h - 14, 8);
  }
  function dring(g, x, y, acc) {
    plate(g, x - 27, y - 45, 54, 34, acc, 6);
    rivet(g, x - 10, y - 28, 6); rivet(g, x + 10, y - 28, 6);
    el('path', { d: 'M' + (x - 26) + ',' + (y - 10) + ' h52 a26,26 0 0 1 -52,0 Z', fill: 'none', stroke: 'url(#metal)', 'stroke-width': 7 }, g);
  }

  function draw(st) {
    var style = STYLES[st.style], main = COLORS[st.main], acc = COLORS[st.acc];
    stage.textContent = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-labelledby': 'apron-title apron-desc' }, stage);
    el('title', { id: 'apron-title' }, svg).textContent = 'Preview of your ' + style.name;
    el('desc', { id: 'apron-desc' }, svg).textContent = main.label + ' leather with ' + acc.label.toLowerCase() + ' accessories' +
      (st.text ? ', engraved "' + st.text.replace(/\n/g, ' ') + '" at position ' + st.pos + ' (' + POS[st.pos].label.toLowerCase() + ')' : ', no engraving') + '.';

    var defs = el('defs', {}, svg);
    // Cloudy, mottled leather: large soft blotches plus a fine grain.
    var mott = el('filter', { id: 'mottle', x: 0, y: 0, width: '100%', height: '100%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '.0035 .005', numOctaves: 4, seed: 11, result: 'n' }, mott);
    el('feColorMatrix', { type: 'matrix', values: '0 0 0 0 ' + main.mottleR + '  0 0 0 0 ' + main.mottleG + '  0 0 0 0 ' + main.mottleB + '  ' + main.mottleK, in: 'n' }, mott);
    var grain = el('filter', { id: 'grain', x: 0, y: 0, width: '100%', height: '100%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '.9', numOctaves: 2, seed: 3 }, grain);
    el('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .35 0' }, grain);
    var drop = el('filter', { id: 'drop', x: '-10%', y: '-10%', width: '120%', height: '130%' }, defs);
    el('feDropShadow', { dx: 0, dy: 3, stdDeviation: 3, 'flood-color': '#000', 'flood-opacity': '.35' }, drop);
    var acG = el('linearGradient', { id: 'accGrad', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': acc.hi }, acG); el('stop', { offset: '1', 'stop-color': acc.hex }, acG);
    var loopG = el('linearGradient', { id: 'loopGrad', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: '0', 'stop-color': acc.hex }, loopG); el('stop', { offset: '.45', 'stop-color': acc.hi }, loopG); el('stop', { offset: '1', 'stop-color': acc.edge }, loopG);
    var metal = el('linearGradient', { id: 'metal', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': '#ffffff' }, metal); el('stop', { offset: '.5', 'stop-color': '#c9c9c9' }, metal); el('stop', { offset: '1', 'stop-color': '#7d7d7d' }, metal);
    var clip = el('clipPath', { id: 'bibclip' }, defs);
    el('path', { d: BIB }, clip);

    // Harness straps (accessory colour), drawn with a light outline like the reference.
    var sc = acc.strap;
    var harness = el('g', { fill: 'none', 'stroke-linecap': 'butt', 'stroke-linejoin': 'round' }, svg);
    [OUTER_L, OUTER_R, STRAP_L, STRAP_R].forEach(function (d) {
      el('path', { d: d, stroke: '#8f8a84', 'stroke-width': 38 }, harness);
      el('path', { d: d, stroke: sc, 'stroke-width': 32 }, harness);
      el('path', { d: d, stroke: 'rgba(255,255,255,.12)', 'stroke-width': 3, transform: 'translate(-6 -2)' }, harness);
    });
    // Strap sliders
    [[143, 460], [1057, 460]].forEach(function (p) {
      el('rect', { x: p[0] - 13, y: p[1] - 26, width: 26, height: 52, rx: 13, fill: 'none', stroke: 'url(#metal)', 'stroke-width': 6 }, svg);
    });
    // Hexagonal back connector
    el('path', { d: 'M500,78 L535,15 H665 L700,78 L665,142 H535 Z', fill: 'url(#accGrad)', stroke: acc.edge, 'stroke-width': 3, filter: 'url(#drop)' }, svg);

    // Apron body
    el('path', { d: BIB, fill: main.hex }, svg);
    var tex = el('g', { 'clip-path': 'url(#bibclip)' }, svg);
    el('rect', { x: 0, y: 0, width: W, height: H, filter: 'url(#mottle)' }, tex);
    el('rect', { x: 0, y: 0, width: W, height: H, filter: 'url(#grain)', opacity: '.5' }, tex);
    el('path', { d: BIB, fill: 'none', stroke: main.edge, 'stroke-width': 4 }, svg);
    if (st.style === 'split') {
      el('path', { d: 'M588,1762 L600,1360 L612,1762 Z', fill: '#f3ece2', stroke: main.edge, 'stroke-width': 3 }, svg);
    }
    // Strap rivets on the bib
    [[388, 258], [388, 296], [812, 258], [812, 296]].forEach(function (p) { rivet(svg, p[0], p[1], 9); });

    // Waist tabs with D-rings
    var acs = el('g', {}, svg);
    [[25, 948], [1100, 948]].forEach(function (p, i) {
      el('path', { d: i ? 'M1175,958 a20,22 0 0 1 0,40' : 'M25,958 a20,22 0 0 0 0,40', fill: 'none', stroke: 'url(#metal)', 'stroke-width': 7 }, acs);
      plate(acs, p[0], p[1], 75, 58, acc, 5);
      rivet(acs, p[0] + 22, p[1] + 17, 6); rivet(acs, p[0] + 53, p[1] + 17, 6);
      rivet(acs, p[0] + 22, p[1] + 41, 6); rivet(acs, p[0] + 53, p[1] + 41, 6);
    });

    // Style-specific attachments (accessory colour)
    if (st.style === 'bbq') {
      loops(acs, 368, 688, 210, 50, 3, acc);
      loops(acs, 578, 804, 305, 54, 3, acc);
      hstrap(acs, 82, 1055, 153, 48, acc); hstrap(acs, 507, 1055, 140, 48, acc);
      el('path', { d: 'M278,1055 H472 V1082 H440 V1212 Q440,1230 422,1230 H398 L380,1200 L362,1230 H334 Q316,1230 316,1212 V1082 H278 Z',
        fill: 'url(#accGrad)', stroke: acc.edge, 'stroke-width': 3, filter: 'url(#drop)' }, acs);
      el('ellipse', { cx: 378, cy: 1145, rx: 17, ry: 36, fill: main.edge }, acs);
      strap(acs, 298, 1280, 48, 155, acc); strap(acs, 388, 1280, 45, 155, acc);
      dring(acs, 598, 1215, acc);
      pocket(acs, 730, 1065, 260, 298, acc);
    } else if (st.style === 'barber') {
      loops(acs, 578, 804, 305, 54, 3, acc);
      pocket(acs, 92, 1060, 120, 250, acc); pocket(acs, 230, 1060, 120, 250, acc);
      hstrap(acs, 400, 1060, 150, 48, acc);
      dring(acs, 598, 1215, acc);
      pocket(acs, 730, 1065, 260, 298, acc);
    } else if (st.style === 'simple') {
      pocket(acs, 460, 1080, 280, 260, acc);
    } else if (st.style === 'split') {
      loops(acs, 368, 688, 210, 50, 3, acc);
      loops(acs, 578, 804, 305, 54, 3, acc);
      dring(acs, 598, 1130, acc);
      pocket(acs, 730, 1065, 260, 260, acc);
      strap(acs, 230, 1480, 48, 170, acc); strap(acs, 922, 1480, 48, 170, acc);
    } else if (st.style === 'wood') {
      loops(acs, 578, 804, 305, 54, 3, acc);
      hstrap(acs, 120, 1040, 180, 50, acc);
      pocket(acs, 100, 1150, 440, 420, acc); pocket(acs, 660, 1150, 440, 420, acc);
    }

    // Position guides
    var guides = el('g', { 'aria-hidden': 'true' }, svg);
    for (var p = 1; p <= style.positions; p++) {
      var q = POS[p];
      var on = String(p) === String(st.pos);
      if (on && st.text) continue;
      el('rect', { x: q.x - q.w / 2, y: q.y - q.h / 2, width: q.w, height: q.h, rx: 8, fill: 'none',
        stroke: on ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.4)', 'stroke-dasharray': '14 10', 'stroke-width': on ? 4 : 3 }, guides);
      var t = el('text', { x: q.x, y: q.y + 14, 'text-anchor': 'middle', fill: on ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.6)', 'font-size': 40, 'font-weight': 700, 'font-family': 'Inter, sans-serif' }, guides);
      t.textContent = p;
    }

    // Engraving: dark burned-in lettering with a faint highlight, like the reference.
    if (st.text) {
      var font = FONTS[st.font], box = POS[st.pos];
      var lines = st.text.split('\n').slice(0, 3);
      var g = el('g', { 'aria-hidden': 'true' }, svg);
      var size = Math.min(110, (box.h * 1.3) / lines.length);
      var hl = [], texts = [];
      lines.forEach(function (line) {
        var h1 = el('text', { x: box.x + 2, 'text-anchor': 'middle', fill: 'rgba(255,225,200,.22)', 'font-family': font.family, 'font-weight': font.weight }, g);
        var t = el('text', { x: box.x, 'text-anchor': 'middle', fill: main.engrave, 'font-family': font.family, 'font-weight': font.weight }, g);
        h1.textContent = line; t.textContent = line;
        hl.push(h1); texts.push(t);
      });
      // Shrink to fit the engraving area width.
      for (var guard = 0; guard < 40; guard++) {
        texts.concat(hl).forEach(function (t) { t.setAttribute('font-size', size.toFixed(1)); });
        var widest = Math.max.apply(null, texts.map(function (t) { try { return t.getComputedTextLength(); } catch (e) { return 0; } }));
        if (widest <= box.w + 60 || size <= 20) break;
        size *= 0.93;
      }
      var lh = size * 1.08, top = box.y - ((lines.length - 1) * lh) / 2 + size * 0.34;
      texts.forEach(function (t, i) { t.setAttribute('y', (top + i * lh).toFixed(1)); });
      hl.forEach(function (t, i) { t.setAttribute('y', (top + i * lh + 2).toFixed(1)); });
    }
  }

  /* ---------- State, summary, validation ---------- */
  function read() {
    return {
      style: val('style') || 'bbq', main: val('main') || 'tan', acc: val('acc') || 'brown',
      text: (form.elements.engraving.value || '').replace(/\r/g, '').replace(/\n{2,}/g, '\n').trim(),
      font: val('font') || 'serif', pos: val('position') || '1', logo: val('logo'), notes: val('notes'),
      height: val('height'), weight: val('weight'), email: val('email'), phone: val('phone'),
      wings: val('wings'), opener: val('opener')
    };
  }

  function describe(st) {
    var parts = [];
    if (st.text) {
      parts.push('Engraving text: "' + st.text.replace(/\n/g, ' / ') + '"');
      parts.push('Font style: ' + FONTS[st.font].label);
      parts.push('Position: ' + st.pos + ' (' + POS[st.pos].label + ')');
    } else {
      parts.push('Engraving text: none');
    }
    if (st.logo) parts.push('Logo: customer will send the logo file by WhatsApp or email');
    if (st.notes) parts.push('Notes: ' + st.notes);
    parts.push('Designed on virtualleather.net');
    return parts.join(' | ');
  }

  var summaryEls = {
    style: document.getElementById('sum-style'), colors: document.getElementById('sum-colors'),
    engraving: document.getElementById('sum-engraving'), extras: document.getElementById('sum-extras'),
    total: document.getElementById('sum-total'), tag: document.getElementById('preview-tag')
  };
  var counter = document.getElementById('engraving-count');
  var waLink = document.getElementById('design-whatsapp');

  function total(st) { return PRICE + (st.wings ? EXTRA_PRICE : 0) + (st.opener ? EXTRA_PRICE : 0); }

  function waMessage(st) {
    return 'Hi Virtual Leather! I designed an apron on your website:\n' +
      '- Style: ' + STYLES[st.style].name + '\n' +
      '- Main leather: ' + COLORS[st.main].label + '\n' +
      '- Accessories: ' + COLORS[st.acc].label + '\n' +
      '- ' + describe(st).split(' | ').slice(0, -1).join('\n- ') + '\n' +
      (st.wings ? '- Extra: leather wings\n' : '') + (st.opener ? '- Extra: bottle opener\n' : '') +
      'Can you help me finish my order?';
  }

  function syncPositions(st) {
    var max = STYLES[st.style].positions;
    var radios = form.querySelectorAll('input[name="position"]');
    Array.prototype.forEach.call(radios, function (r) {
      var hide = Number(r.value) > max;
      r.disabled = hide;
      r.closest('.opt').hidden = hide;
      if (hide && r.checked) form.querySelector('input[name="position"][value="1"]').checked = true;
    });
  }

  function update() {
    var st = read();
    syncPositions(st);
    st = read();
    draw(st);
    summaryEls.style.textContent = STYLES[st.style].name;
    summaryEls.colors.textContent = COLORS[st.main].label + ' / ' + COLORS[st.acc].label;
    summaryEls.engraving.textContent = st.text ? '"' + st.text.replace(/\n/g, ' ') + '" · position ' + st.pos : (st.logo ? 'Logo (sent after order)' : 'None');
    var ex = [];
    if (st.wings) ex.push('Wings'); if (st.opener) ex.push('Bottle opener');
    summaryEls.extras.textContent = ex.length ? ex.join(', ') : 'None';
    summaryEls.total.textContent = '$' + total(st);
    summaryEls.tag.textContent = STYLES[st.style].name;
    counter.textContent = form.elements.engraving.value.length + ' / 40 characters';
    if (waLink) waLink.href = 'https://wa.me/' + C.whatsappNumber + '?text=' + encodeURIComponent(waMessage(st));
  }

  var customised = false;
  form.addEventListener('input', function (e) {
    if (e.target.name === 'engraving') {
      var lines = e.target.value.split('\n');
      if (lines.length > 3) e.target.value = lines.slice(0, 3).join('\n');
    }
    if (e.target.getAttribute('aria-invalid') === 'true') validateField(e.target);
    update();
    if (!customised) {
      customised = true;
      var st = read();
      VL.track && VL.track('customize_product', { currency: C.currency, value: PRICE,
        items: [{ item_id: String(STYLES[st.style].id), item_name: STYLES[st.style].name, price: PRICE }] });
    }
  });
  form.addEventListener('change', update);

  var MESSAGES = {
    height: 'Please enter the wearer\'s height, for example 180 cm or 5 ft 11 in.',
    weight: 'Please enter the wearer\'s weight, for example 85 kg or 187 lb.',
    email: 'Please enter a valid email address, for example name@example.com.',
    phone: 'Please enter a phone number including the country code, for example +1 555 123 4567.'
  };
  function validateField(f) {
    var err = document.getElementById(f.id + '-error');
    var ok = f.checkValidity();
    f.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (err) err.textContent = ok ? '' : (MESSAGES[f.name] || f.validationMessage);
    return ok;
  }
  ['height', 'weight', 'email', 'phone'].forEach(function (n) {
    form.elements[n].addEventListener('blur', function () { if (this.value) validateField(this); });
  });

  var status = document.getElementById('designer-status');
  var submit = document.getElementById('designer-submit');
  var added = document.getElementById('designer-added');

  function setStatus(msg, kind) { status.textContent = msg; status.setAttribute('data-kind', kind || ''); }

  function addProduct(E, id, options) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var t = setTimeout(function () { if (!done) reject(new Error('timeout')); }, 12000);
      E.Cart.addProduct({ id: id, quantity: 1, options: options, callback: function (success) {
        done = true; clearTimeout(t);
        success === false ? reject(new Error('rejected')) : resolve();
      } });
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = ['height', 'weight', 'email', 'phone'].map(function (n) { return form.elements[n]; })
      .filter(function (f) { return !validateField(f); });
    if (bad.length) {
      setStatus('Please check the highlighted fields.', 'error');
      bad[0].focus();
      return;
    }
    var st = read();
    var style = STYLES[st.style];
    var options = {
      'Main Color': COLORS[st.main].ecwid,
      'Customer Height': st.height,
      'Customer Weight': st.weight,
      'Description For Personalization': describe(st),
      'Email for design confirmation': st.email,
      'Phone Number for shipping confirmation': st.phone
    };
    options[style.secondary] = COLORS[st.acc].ecwid;

    submit.disabled = true;
    setStatus('Adding to your cart…');
    VL.loadEcwid().then(function (E) {
      return addProduct(E, style.id, options)
        .then(function () { return st.wings ? addProduct(E, 688211109, { Color: COLORS[st.acc].addon }) : null; })
        .then(function () { return st.opener ? addProduct(E, 619483308, { Color: COLORS[st.acc].addon }) : null; });
    }).then(function () {
      setStatus('');
      form.hidden = true;
      added.hidden = false;
      added.querySelector('h3').focus();
      added.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function () {
      setStatus('Sorry, we couldn\'t reach the cart (an ad blocker can cause this). Please send us your design on WhatsApp instead. It\'s already written for you.', 'error');
      if (waLink) waLink.focus();
    }).then(function () { submit.disabled = false; });
  });

  document.getElementById('designer-again').addEventListener('click', function () {
    added.hidden = true; form.hidden = false;
    form.elements.engraving.focus();
  });

  VL.designer = {
    setStyle: function (s) {
      var r = form.querySelector('input[name="style"][value="' + s + '"]');
      if (r) { r.checked = true; update(); }
    }
  };
  // Deep link: /#design?style=barber is not valid hash syntax, so use data-style buttons or ?style=
  var qs = /[?&]style=(\w+)/.exec(location.search);
  if (qs) VL.designer.setStyle(qs[1]);

  update();
})();
