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
  var COLORS = {
    tan:   { label: 'Tan (light brown)', ecwid: 'Tanned (Light Brown)', addon: 'Tanned or Light Brown', hex: '#a95f2b', dark: '#7d4219', engrave: '#4a220a' },
    brown: { label: 'Dark brown', ecwid: 'Dark Brown', addon: 'Dark Brown', hex: '#4f3328', dark: '#3a241b', engrave: '#1f120c' },
    black: { label: 'Black', ecwid: 'Black', addon: 'Black', hex: '#262322', dark: '#141212', engrave: '#77706a' }
  };
  var FONTS = {
    serif:  { label: 'Classic serif', family: 'Fraunces, Georgia, serif', weight: 700 },
    sans:   { label: 'Modern bold', family: 'Inter, Arial, sans-serif', weight: 800 },
    script: { label: 'Script', family: '"Great Vibes", "Brush Script MT", cursive', weight: 400 }
  };
  var POS = {
    1: { x: 200, y: 128, w: 100, h: 30, label: 'Chest, top' },
    2: { x: 200, y: 163, w: 100, h: 24, label: 'Chest, below 1' },
    3: { x: 140, y: 236, w: 62, h: 26, label: 'Middle left' },
    4: { x: 256, y: 252, w: 80, h: 20, label: 'Middle right' },
    5: { x: 122, y: 470, w: 64, h: 34, label: 'Bottom left' },
    6: { x: 278, y: 470, w: 64, h: 34, label: 'Bottom right' }
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

  /* ---------- SVG preview ---------- */
  var BIB = 'M140,90 H260 L262,108 C266,170 290,214 322,232 L322,486 Q322,504 304,504 H96 Q78,504 78,486 L78,232 C110,214 134,170 138,108 Z';
  function rivets(g, xs, y) { xs.forEach(function (x) { el('circle', { cx: x, cy: y, r: 2.2, fill: '#d9c7a6' }, g); }); }
  function strip(g, x, y, w, h, fill) {
    el('rect', { x: x, y: y, width: w, height: h, rx: 2, fill: fill, stroke: 'rgba(0,0,0,.35)', 'stroke-width': 1 }, g);
    var xs = []; for (var i = x + 7; i < x + w - 3; i += 12) xs.push(i);
    rivets(g, xs, y + h / 2);
  }
  function pocket(g, x, y, w, h, fill) {
    el('rect', { x: x, y: y, width: w, height: h, rx: 3, fill: fill, stroke: 'rgba(0,0,0,.35)', 'stroke-width': 1 }, g);
    el('rect', { x: x + 4, y: y + 4, width: w - 8, height: h - 8, rx: 2, fill: 'none', stroke: 'rgba(255,240,220,.35)', 'stroke-dasharray': '3 3' }, g);
    rivets(g, [x + 5, x + w - 5], y + 5);
  }

  function draw(st) {
    var style = STYLES[st.style], main = COLORS[st.main], acc = COLORS[st.acc];
    stage.textContent = '';
    var svg = el('svg', { viewBox: '0 0 400 520', role: 'img', 'aria-labelledby': 'apron-title apron-desc' }, stage);
    el('title', { id: 'apron-title' }, svg).textContent = 'Preview of your ' + style.name;
    el('desc', { id: 'apron-desc' }, svg).textContent = main.label + ' leather with ' + acc.label.toLowerCase() + ' accessories' +
      (st.text ? ', engraved "' + st.text.replace(/\n/g, ' ') + '" at position ' + st.pos + ' (' + POS[st.pos].label.toLowerCase() + ')' : ', no engraving') + '.';

    var defs = el('defs', {}, svg);
    var grain = el('filter', { id: 'grain', x: 0, y: 0, width: '100%', height: '100%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '.85', numOctaves: 2, seed: 7, result: 'n' }, grain);
    el('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0' }, grain);
    var shade = el('radialGradient', { id: 'shade', cx: '45%', cy: '35%', r: '75%' }, defs);
    el('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '.16' }, shade);
    el('stop', { offset: '1', 'stop-color': '#000', 'stop-opacity': '.28' }, shade);
    var clip = el('clipPath', { id: 'bibclip' }, defs);
    el('path', { d: BIB }, clip);

    // Neck straps
    var straps = el('g', { fill: 'none', stroke: acc.hex, 'stroke-width': 9, 'stroke-linecap': 'round' }, svg);
    el('path', { d: 'M150,94 C152,60 176,36 196,26' }, straps);
    el('path', { d: 'M250,94 C248,60 224,36 204,26' }, straps);
    el('path', { d: 'M196,26 C150,8 70,40 62,120 C57,170 66,205 74,232' }, straps);
    el('path', { d: 'M204,26 C250,8 330,40 338,120 C343,170 334,205 326,232' }, straps);
    el('rect', { x: 186, y: 14, width: 28, height: 24, rx: 7, fill: acc.dark }, svg);
    rivets(svg, [146, 254], 98);

    // Body
    el('path', { d: BIB, fill: main.hex, stroke: main.dark, 'stroke-width': 2 }, svg);
    var tex = el('g', { 'clip-path': 'url(#bibclip)' }, svg);
    el('rect', { x: 0, y: 0, width: 400, height: 520, filter: 'url(#grain)', opacity: '.35' }, tex);
    el('rect', { x: 0, y: 0, width: 400, height: 520, fill: 'url(#shade)' }, tex);
    el('path', { d: BIB, fill: 'none', stroke: 'rgba(255,240,220,.28)', 'stroke-width': 1, 'stroke-dasharray': '4 4', transform: 'translate(200 297) scale(.965) translate(-200 -297)' }, svg);

    if (st.style === 'split') {
      el('path', { d: 'M193,505 L200,392 L207,505 Z', fill: '#f1e8dc' }, svg);
    }

    // Waist tabs + rings
    var acs = el('g', {}, svg);
    [[66, 237], [334, 237]].forEach(function (p) { el('circle', { cx: p[0], cy: p[1], r: 9, fill: 'none', stroke: '#b9b2a6', 'stroke-width': 3 }, acs); });
    strip(acs, 74, 228, 20, 18, acc.hex); strip(acs, 306, 228, 20, 18, acc.hex);

    // Style-specific attachments (secondary colour)
    if (st.style === 'bbq') {
      strip(acs, 166, 196, 62, 14, acc.hex); strip(acs, 214, 218, 72, 14, acc.hex);
      el('rect', { x: 126, y: 284, width: 72, height: 16, rx: 2, fill: acc.hex }, acs);
      el('rect', { x: 150, y: 284, width: 24, height: 44, rx: 2, fill: acc.hex }, acs);
      el('ellipse', { cx: 162, cy: 306, rx: 6, ry: 9, fill: main.dark }, acs);
      strip(acs, 148, 336, 10, 40, acc.hex); strip(acs, 166, 336, 10, 40, acc.hex);
      el('circle', { cx: 216, cy: 312, r: 6, fill: 'none', stroke: '#b9b2a6', 'stroke-width': 2.5 }, acs);
      pocket(acs, 240, 286, 66, 72, acc.hex);
    } else if (st.style === 'barber') {
      strip(acs, 214, 218, 72, 14, acc.hex);
      pocket(acs, 104, 286, 28, 66, acc.hex); pocket(acs, 136, 286, 28, 66, acc.hex);
      el('circle', { cx: 216, cy: 312, r: 6, fill: 'none', stroke: '#b9b2a6', 'stroke-width': 2.5 }, acs);
      pocket(acs, 240, 286, 66, 72, acc.hex);
    } else if (st.style === 'simple') {
      pocket(acs, 160, 300, 80, 66, acc.hex);
    } else if (st.style === 'split') {
      strip(acs, 166, 196, 62, 14, acc.hex); strip(acs, 214, 218, 72, 14, acc.hex);
      pocket(acs, 236, 290, 70, 70, acc.hex);
      strip(acs, 112, 420, 12, 46, acc.hex); strip(acs, 276, 420, 12, 46, acc.hex);
    } else if (st.style === 'wood') {
      strip(acs, 214, 218, 72, 14, acc.hex);
      strip(acs, 116, 288, 40, 14, acc.hex);
      pocket(acs, 94, 330, 100, 100, acc.hex); pocket(acs, 206, 330, 100, 100, acc.hex);
    }

    // Position guides
    var guides = el('g', { 'aria-hidden': 'true' }, svg);
    for (var p = 1; p <= style.positions; p++) {
      var q = POS[p];
      var on = String(p) === String(st.pos);
      if (on && st.text) continue;
      el('rect', { x: q.x - q.w / 2, y: q.y - q.h / 2, width: q.w, height: q.h, rx: 3, fill: 'none',
        stroke: on ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.35)', 'stroke-dasharray': '4 3', 'stroke-width': on ? 1.5 : 1 }, guides);
      if (!(on && st.text)) {
        var t = el('text', { x: q.x, y: q.y + 4, 'text-anchor': 'middle', fill: on ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.55)', 'font-size': 12, 'font-weight': 700, 'font-family': 'Inter, sans-serif' }, guides);
        t.textContent = p;
      }
    }

    // Engraving
    if (st.text) {
      var font = FONTS[st.font], box = POS[st.pos];
      var lines = st.text.split('\n').slice(0, 3);
      var g = el('g', { 'aria-hidden': 'true' }, svg);
      var size = Math.min(34, (box.h * 1.15) / lines.length + (box.h > 28 ? 6 : 3));
      var texts = lines.map(function (line, i) {
        var t = el('text', { x: box.x, 'text-anchor': 'middle', fill: main.engrave, 'font-family': font.family, 'font-weight': font.weight }, g);
        t.textContent = line;
        return t;
      });
      // Shrink to fit the engraving area width.
      for (var guard = 0; guard < 30; guard++) {
        texts.forEach(function (t) { t.setAttribute('font-size', size.toFixed(1)); });
        var widest = Math.max.apply(null, texts.map(function (t) { try { return t.getComputedTextLength(); } catch (e) { return 0; } }));
        if (widest <= box.w + 26 || size <= 7) break;
        size *= 0.92;
      }
      var lh = size * 1.08, top = box.y - ((lines.length - 1) * lh) / 2 + size * 0.34;
      texts.forEach(function (t, i) { t.setAttribute('y', (top + i * lh).toFixed(1)); });
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
