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
  var PRICE = 185, EXTRA_PRICE = 15;
  // Engraving: the first FREE_ENGRAVINGS spots are included and the chest (spots 1 and 2) counts as one.
  // Each spot after that adds one "Extra engraving" product to the cart. This is off until that Ecwid
  // product's ID is set (extraEngravingProductId in src/config.json).
  var FREE_ENGRAVINGS = 2, ENGRAVING_PRICE = 5, ENGRAVING_ID = Number(C.extraEngravingId) || 0;

  var STYLES = {
    bbq:    { id: 619498562, name: 'BBQ apron with beer holder', positions: 6, pocket: true, secondary: 'Secondary Color (Attachment/Pockets)' },
    // The patterned BBQ apron (a patchwork of leather panels) is its own Ecwid product and its own style:
    // drawn and laid out as the BBQ apron (look), engraved on the chest (spots 1 and 2) and the pocket only.
    bbqpattern: { id: 738486114, name: 'Patterned BBQ apron with beer holder', look: 'bbq', patterned: true, gallery: 'bbq-patterned',
              positions: 2, pocket: true, secondary: 'Secondary Color (Attachment/Pockets)' },
    barber: { id: 619492033, name: 'Barber apron', positions: 6, pocket: true, secondary: 'Secondary Color (Attachment/Pockets)', extras: ['wings', 'grease'] },
    simple: { id: 619505538, name: 'Simple apron', positions: 6, pocket: true, secondary: 'Secondary Color (Attachments/Pockets)' },
    split:  { id: 619501025, name: 'Split-leg forging & tattoo apron', positions: 4, pocket: true, secondary: 'Secondary Color (Attachment/Pockets)' },
    wood:   { id: 619498560, name: 'Woodworking apron', positions: 2, pocket: true, secondary: 'Secondary Color (Attachment/Pockets)' }
  };
  // Leather palette taken from the reference illustration.
  //   hex = base, edge = outline/shadow, hi = highlight, strap = harness colour, engrave = lettering,
  //   mottle* = colour of the cloudy patches (0-1 RGB).
  var COLORS = {
    tan:   { label: 'Tan (light brown)', ecwid: 'Tanned (Light Brown)', addon: 'Tanned or Light Brown', hex: '#b5592f', edge: '#5e2a14', hi: '#c97a50', strap: '#8a4422', engrave: '#3b170a', mottleR: .55, mottleG: .22, mottleB: .1, mottleK: '1.6 0 0 0 -0.55' },
    brown: { label: 'Dark brown', ecwid: 'Dark Brown', addon: 'Dark Brown', hex: '#5b3c35', edge: '#2e1c18', hi: '#7a5650', strap: '#4a2f29', engrave: '#1c100c', mottleR: .27, mottleG: .16, mottleB: .13, mottleK: '1.1 0 0 0 -0.42' },
    black: { label: 'Black', ecwid: 'Black', addon: 'Black', hex: '#262322', edge: '#0e0d0c', hi: '#45403d', strap: '#1b1918', engrave: '#8a837d', mottleR: .16, mottleG: .15, mottleB: .145, mottleK: '0.9 0 0 0 -0.38' }
  };
  // Engraving fonts (self-hosted free fonts, as offered on marketcenterco.com). scale evens out how big
  // each one looks at the same size; real = the font's actual name, for the workshop.
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
  // Engraving positions 1-6 from the Virtual Leather "Apron Sketch" (1200 x 1800 drawing units), plus the
  // pocket on styles that have one. Optional sizing per spot (defaults in metrics()): fs = letter size and
  // logoH = logo height at 100%; maxW / maxH = the most the spot can take before we shrink to fit.
  var POS = {
    1: { x: 600, y: 465, w: 330, h: 90, label: 'Chest' },
    2: { x: 600, y: 580, w: 330, h: 70, label: 'Under chest' },
    3: { x: 285, y: 880, w: 210, h: 70, label: 'Left' },
    4: { x: 730, y: 930, w: 280, h: 56, label: 'Right' },
    5: { x: 235, y: 1640, w: 260, h: 120, label: 'Down left' },
    6: { x: 965, y: 1640, w: 260, h: 120, label: 'Down right' }
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

  /* ---------- SVG preview (drawn after the Virtual Leather reference illustrations) ---------- */
  var W = 1200, H = 1800;
  var STRAP_BLACK = '#1b1918'; // neck and waist straps are always black
  var BIB = 'M350,236 Q350,220 366,220 Q600,242 834,220 Q850,220 850,236 L850,560 C860,760 1000,900 1160,950 ' +
    'L1160,1742 Q1160,1760 1142,1760 L58,1760 Q40,1760 40,1742 L40,950 C200,900 340,760 350,560 Z';
  // In reality there are two straps: each rises from the apron, crosses diagonally through the
  // back connector and continues over the opposite shoulder down to the waist hook.
  var STRAP_A = 'M390,318 V230 C390,172 452,170 530,132 L670,26 C742,-12 962,22 1025,170 ' +
    'C1050,280 1055,430 1060,560 L1065,650 C1070,770 1155,775 1155,690 L1155,620';
  var STRAP_B = 'M810,318 V230 C810,172 748,170 670,132 L530,26 C458,-12 238,22 175,170 ' +
    'C150,280 145,430 140,560 L135,650 C130,770 45,775 45,690 L45,620';

  // Engraving boxes that differ per style (to stay clear of that style's pockets and straps).
  var POS_OVERRIDES = {
    bbq: {
      1: { y: 440, fs: 84, maxW: 470, maxH: 270, logoH: 225, stdH: 225 },
      chestBig: { y: 485, maxH: 380, logoH: 320, stdH: 320 },   // spot 1 when spot 2 is removed
      2: { y: 615, fs: 54, maxW: 470, maxH: 80, logoH: 70 },
      3: { x: 378, y: 972, fs: 58, maxW: 330, maxH: 190, logoH: 156, stdH: 156 },
      // Spot 4 lines up with the beer circle in spot 3, as the owner asked: its guide, a logo and text (all its lines
      // together) sit between the circle's top and bottom (899-1045, 146 tall), and at 100% they're as tall as the
      // circle, or as big as fits the width. Bigger isn't offered.
      4: { x: 851, y: 972, h: 146, fs: 210, stdW: 300, maxW: 300, maxH: 240, logoH: 146, stdH: 240, inkH: 146, inkAll: true },
      5: { fs: 70, maxW: 330, maxH: 200, logoH: 180, inkH: 42 },
      6: { fs: 70, maxW: 330, maxH: 200, logoH: 180, inkH: 42 },
      pocket: { x: 860, y: 1222, w: 200, h: 150, label: 'Pocket', fs: 50, stdW: 190, maxW: 230, maxH: 250, logoH: 150 }
    },
    barber: {
      1: { y: 440, fs: 84, maxW: 470, maxH: 270, logoH: 225, stdH: 225 },
      chestBig: { y: 485, maxH: 380, logoH: 320, stdH: 320 },
      2: { y: 615, fs: 54, maxW: 470, maxH: 80, logoH: 70 },
      3: { x: 326, y: 955, w: 250, h: 64, maxW: 320, maxH: 120, logoH: 100 },
      4: { x: 800, y: 955, w: 250, h: 64, maxW: 300, maxH: 120, logoH: 100 },
      5: { fs: 70, maxW: 330, maxH: 200, logoH: 180, inkH: 42 },
      6: { fs: 70, maxW: 330, maxH: 200, logoH: 180, inkH: 42 },
      pocket: { x: 800, y: 1166, w: 200, h: 150, fs: 50, stdW: 190, maxW: 230, maxH: 220, logoH: 150 }
    },
    split: {
      1: { y: 380, fs: 80, maxW: 420, maxH: 200, logoH: 170, stdH: 170 },
      chestBig: { y: 425, maxH: 270, logoH: 240, stdH: 240 },
      2: { y: 515, h: 60, fs: 50, maxW: 420, maxH: 70, logoH: 60 },
      3: { x: 370, y: 870, w: 200, h: 60, maxW: 240, maxH: 100, logoH: 90 },
      4: { x: 235, y: 1610, w: 260, h: 120, label: 'Left leg', fs: 70, maxW: 320, maxH: 200, logoH: 170 },
      pocket: { x: 680, y: 790, w: 190, h: 140, fs: 46, stdW: 180, maxW: 220, maxH: 190, logoH: 130 }
    },
    simple: {
      1: { y: 440, fs: 84, maxW: 470, maxH: 270, logoH: 225, stdH: 225 },
      chestBig: { y: 485, maxH: 380, logoH: 320, stdH: 320 },
      2: { y: 615, fs: 54, maxW: 470, maxH: 80, logoH: 70 },
      3: { x: 378, y: 935, w: 250, h: 64, maxW: 300, maxH: 110, logoH: 96 },
      4: { x: 822, y: 935, w: 250, h: 64, maxW: 300, maxH: 110, logoH: 96 },
      5: { fs: 70, maxW: 330, maxH: 200, logoH: 180, inkH: 42 },
      6: { fs: 70, maxW: 330, maxH: 200, logoH: 180, inkH: 42 },
      pocket: { x: 600, y: 1200, w: 300, h: 150, fs: 60, stdW: 280, maxW: 420, maxH: 260, logoH: 180 }
    },
    wood: {
      1: { y: 330, w: 300, h: 85, fs: 74, maxW: 400, maxH: 170, logoH: 150, stdH: 150 },
      chestBig: { y: 375, maxH: 250, logoH: 220, stdH: 220 },
      2: { y: 455, w: 300, h: 60, fs: 48, maxW: 400, maxH: 60, logoH: 54 },
      pocket: { x: 690, y: 645, w: 170, h: 150, fs: 44, stdW: 160, maxW: 190, maxH: 200, logoH: 130 }
    }
  };
  // A style that is a version of another apron (look) shares its engraving boxes and fittings.
  function lookOf(styleKey) { return (STYLES[styleKey] || {}).look || styleKey; }
  Object.keys(STYLES).forEach(function (k) { if (STYLES[k].look) POS_OVERRIDES[k] = POS_OVERRIDES[STYLES[k].look]; });
  function posFor(styleKey, p) {
    var o = (POS_OVERRIDES[styleKey] || {})[p] || {}, base = POS[p] || {}, b = {};
    for (var k in base) b[k] = base[k];
    for (var j in o) b[j] = o[j];
    return b;
  }
  // stdW / stdH: the room used for the standard (100%) size; maxW / maxH: the most a bigger size may take.
  // inkH: the tallest the engraving may be in that spot (the letters as they look, in any lettering, or a logo).
  // On the lower spots 5 and 6 it's 42 units: "TEST" in Montserrat at 70 x 80%, the owner's chosen height. There
  // the standard (100%) size is that largest one. It applies to each line of text, or with inkAll to all the lines
  // together (centred by the letters as they look), for a spot that must stay within a band.
  function metrics(b) {
    var maxW = b.maxW || b.w + 80, maxH = b.maxH || b.h * 2;
    return { fs: b.fs || Math.min(96, b.h * 1.1), maxW: maxW, maxH: maxH, logoH: b.logoH || b.h * 1.6,
      stdW: b.stdW || Math.min(b.w + 60, maxW * 0.85), stdH: b.stdH || maxH * 0.7, inkH: b.inkH || 0, inkAll: !!b.inkAll };
  }
  // Spots offered on a style, in order: '1'..'n', then 'pocket' where the style has one.
  function positionsOf(styleKey) {
    var s = STYLES[styleKey], list = [];
    for (var i = 1; i <= s.positions; i++) list.push(String(i));
    if (s.pocket) list.push('pocket');
    return list;
  }
  // A spot's name on the chosen style ("Chest", "Left"..., or a style's own, like the split-leg's "Left leg").
  function curStyle() { return val('style') || 'bbq'; }
  function spotLabel(p, styleKey) {
    var o = (POS_OVERRIDES[styleKey || curStyle()] || {})[p];
    return o && o.label || (p === 'pocket' ? 'Pocket' : POS[p].label);
  }
  function posLabel(p) { return p === 'pocket' ? 'Pocket' : p + ' (' + spotLabel(p) + ')'; }

  // What each spot offers and starts with, per apron style (from each apron's sketch): its choices, the
  // one it starts on, and where it sits ("where"). Spot 2 can be removed to make the chest logo or design
  // bigger. Suggested designs: Grill Master on the BBQ (plain and patterned) and simple aprons' chest, the
  // beer circle on the plain BBQ apron's drink holder. Spots without a plan offer text or a logo, starting on text (chest) or none.
  var SLOT_KEYS = ['1', '2', '3', '4', '5', '6', 'pocket'];
  var MODE_LABELS = { text: 'Text', design: 'Suggested designs', logo: 'Your logo', none: 'None' };
  function underChest(designs) {
    return { modes: ['none', 'text'], def: 'text', lines: 2, noneLabel: designs ? 'None (bigger chest design)' : 'None (bigger chest logo)',
      hint: 'Smaller text under the chest. ' + (designs ? 'Designs and logos' : 'Logos') + ' usually fill the chest, so you can remove this spot to make them bigger.' };
  }
  function spotPlan(where) { return { modes: ['none', 'text', 'logo'], def: 'none', where: where }; }
  var CHEST_WITH_DESIGNS = { modes: ['none', 'text', 'design', 'logo'], def: 'text', designs: ['grillmaster'] };
  var SLOT_PLANS = {
    bbq: {
      1: CHEST_WITH_DESIGNS,
      2: underChest(true),
      3: { modes: ['none', 'design', 'text', 'logo'], def: 'design', designs: ['beer'], where: 'Top of drink holder' },
      4: spotPlan('Top of pocket'),
      pocket: spotPlan('On the pocket')
    },
    barber: { 2: underChest(false), 3: spotPlan('Above the scissor loops'), 4: spotPlan('Above the pocket'), pocket: spotPlan('On the pocket') },
    bbqpattern: { 1: CHEST_WITH_DESIGNS, 2: underChest(true), pocket: spotPlan('On the pocket') },
    simple: { 1: CHEST_WITH_DESIGNS, 2: underChest(true), 3: spotPlan('Above the pocket'), 4: spotPlan('Above the pocket'), pocket: spotPlan('On the centre pocket') },
    split: { 2: underChest(false), 3: spotPlan('Beside the chest pocket'), 4: spotPlan('Bottom of the left leg'), pocket: spotPlan('On the chest pocket') },
    wood: { 2: underChest(false), pocket: spotPlan('On the chest pocket') }
  };
  function planFor(styleKey, p) {
    var plan = (SLOT_PLANS[styleKey] || {})[p];
    if (plan) return plan;
    // "None" always comes first, so every spot lists its choices in the same order.
    return p === '1' || p === '2' ? { modes: ['none', 'text', 'logo'], def: 'text' } : { modes: ['none', 'text', 'logo'], def: 'none' };
  }

  // Suggested designs, drawn in a 1000-wide box (height = 1000 / aspect). Text the customer fills in
  // is drawn live in the lettering they choose. To add a design: give it an entry here (artwork as SVG
  // paths, or an image drawn with el('image')) and list its key in a spot's designs above.
  var DESIGNS = {
    // The owner's Grill Master artwork (forks, flame, "Grill Master"), traced into design-art.js by
    // tools/trace-designs.mjs. Only the name and the Est. year change; they sit where the original's were.
    grillmaster: {
      label: 'Grill Master', aspect: 1388 / 1497, defFont: 'classic',
      fields: [
        { key: 'name', label: 'Name', required: true, max: 18, placeholder: 'e.g. MIKE', sample: 'MIKE' },
        { key: 'year', label: 'Est. year', max: 4, placeholder: 'e.g. 1986', sample: '1986', numeric: true }
      ],
      draw: function (g, o) {
        var art = (window.VL_DESIGN_ART || {}).grillmaster;
        if (art) el('path', { d: art.d, fill: o.ink, transform: 'scale(' + (1000 / art.w).toFixed(5) + ')' }, g);
        var serif = '"Playfair Display", Georgia, serif', nf = FONTS[o.font] || FONTS.classic;
        textFit(g, { x: 134, y: 407, anchor: 'start', size: 45, family: serif, weight: 700 }, 'EST.', o.ink, o.year ? 1 : 0.4);
        textFit(g, { x: 890, y: 408, anchor: 'end', size: 45, family: serif, weight: 700 }, o.year || 'YEAR', o.ink, o.year ? 1 : 0.4);
        // The name sits on the original's baseline, as big as the gap between the artwork allows.
        textFit(g, { x: 500, y: 559, size: 132 * nf.scale, maxW: 940, family: nf.family, weight: nf.weight }, o.name || 'YOUR NAME', o.ink, o.name ? 1 : 0.4);
      }
    },
    beer: {
      label: 'If you can read this, get me a beer', short: 'Beer circle', aspect: 1, fields: [],
      draw: function (g, o) {
        el('circle', { cx: 500, cy: 500, r: 468, fill: 'none', stroke: o.ink, 'stroke-width': 30 }, g);
        var lines = ['IF YOU CAN', 'READ THIS', 'GET ME A', 'BEER'], size = 178, f = FONTS.anton;
        var ts = lines.map(function (l, i) {
          return textFit(g, { x: 500, y: 330 + i * 168, size: size, family: f.family, weight: f.weight }, l, o.ink, 1);
        });
        // One size for all lines: the largest that keeps every line inside the circle.
        var k = Math.min.apply(null, ts.map(function (t, i) {
          var c = 330 + i * 168 - size * 0.36, half = Math.sqrt(Math.max(0, 385 * 385 - (c - 500) * (c - 500)));
          var w = 1; try { w = t.getComputedTextLength() || 1; } catch (e) { /* not rendered */ }
          return Math.min(1, (2 * half) / w);
        }));
        ts.forEach(function (t) { t.setAttribute('font-size', (size * k).toFixed(1)); });
      }
    }
  };
  function designLabel(id) { return (DESIGNS[id] || {}).label || id; }
  // A line of text that shrinks to maxW if needed. Returns the <text> element.
  function textFit(g, o, str, ink, opacity) {
    var t = el('text', { x: o.x, y: o.y, 'text-anchor': o.anchor || 'middle', fill: ink, 'fill-opacity': opacity == null ? 1 : opacity,
      'font-family': o.family, 'font-weight': o.weight || 400, 'font-size': o.size }, g);
    t.textContent = str;
    if (o.maxW) {
      var w = 0; try { w = t.getComputedTextLength(); } catch (e) { /* not rendered */ }
      if (w > o.maxW) t.setAttribute('font-size', (o.size * o.maxW / w).toFixed(1));
    }
    return t;
  }
  // Where the optional bottle opener hangs on each style.
  var OPENER_AT = { bbq: [598, 1170], barber: [424, 745], simple: [1010, 990], split: [185, 1410], wood: [973, 990] };

  function rivet(g, x, y, r) {
    el('circle', { cx: x, cy: y, r: r || 9, fill: 'url(#metal)', stroke: 'rgba(0,0,0,.35)', 'stroke-width': 1.5 }, g);
  }
  function plate(g, x, y, w, h, acc, rx) {
    return el('rect', { x: x, y: y, width: w, height: h, rx: rx == null ? 8 : rx, fill: 'url(#accGrad)', stroke: acc.edge, 'stroke-width': 3, filter: 'url(#drop)' }, g);
  }
  function shape(g, d, acc) {
    return el('path', { d: d, fill: 'url(#accGrad)', stroke: acc.edge, 'stroke-width': 3, filter: 'url(#drop)' }, g);
  }
  function stitchRect(g, x, y, w, h) {
    el('rect', { x: x, y: y, width: w, height: h, rx: 4, fill: 'none', stroke: 'rgba(255,240,225,.55)', 'stroke-width': 2.5, 'stroke-dasharray': '10 8' }, g);
  }
  // Tool-loop strip: base strap with raised leather loops between rivet pairs.
  function loops(g, x, y, w, h, n, acc) {
    plate(g, x, y, w, h, acc, 6);
    var lw = (w - 40) / n;
    for (var i = 0; i < n; i++) {
      el('rect', { x: x + 20 + i * lw + 8, y: y - 8, width: lw - 16, height: h + 16, rx: 12, fill: 'url(#loopGrad)', stroke: acc.edge, 'stroke-width': 3 }, g);
    }
    for (var j = 0; j <= n; j++) {
      var rx = x + 20 + j * lw;
      rivet(g, rx, y + h * 0.3, 6); rivet(g, rx, y + h * 0.7, 6);
    }
  }
  function vstrap(g, x, y, w, h, acc) {
    plate(g, x, y, w, h, acc, 6);
    rivet(g, x + w / 2, y + 22, 7);
    el('path', { d: 'M' + (x + w / 2 - 6) + ',' + (y + h * 0.55) + ' h12 M' + (x + w / 2 - 6) + ',' + (y + h * 0.78) + ' h12', stroke: 'rgba(0,0,0,.6)', 'stroke-width': 3 }, g);
  }
  // Strap with two stitch marks and its pin at one end: the right end, or the left with flip.
  function hstrap(g, x, y, w, h, acc, flip) {
    plate(g, x, y, w, h, acc, 6);
    var a = flip ? x + w - 57 : x + 35, b = flip ? x + w - 92 : x + 70;
    el('path', { d: 'M' + a + ',' + (y + h / 2) + ' h22 M' + b + ',' + (y + h / 2) + ' h22', stroke: 'rgba(0,0,0,.6)', 'stroke-width': 3 }, g);
    rivet(g, flip ? x + 24 : x + w - 24, y + h / 2, 7);
  }
  // Plain strap riveted at both ends (rows = 1 or 2 rivets per end).
  function band(g, x, y, w, h, acc, rows, cols) {
    plate(g, x, y, w, h, acc, 6);
    rows = rows || 1; cols = cols || 1;
    for (var r = 0; r < rows; r++) {
      var ry = rows === 1 ? y + h / 2 : y + h * (r ? 0.72 : 0.28);
      for (var c = 0; c < cols; c++) {
        rivet(g, x + 18 + c * 30, ry, 7); rivet(g, x + w - 18 - c * 30, ry, 7);
      }
    }
  }
  function pocket(g, x, y, w, h, acc) {
    plate(g, x, y, w, h, acc, 8);
    stitchRect(g, x + 12, y + 12, w - 24, h - 24);
    rivet(g, x + 14, y + 14, 8); rivet(g, x + w - 14, y + 14, 8); rivet(g, x + 14, y + h - 14, 8); rivet(g, x + w - 14, y + h - 14, 8);
  }
  // Large kangaroo pocket: narrow top that flares out to a wide base.
  function shapedPocket(g, y0, y1, acc) {
    var f = y0 + (y1 - y0) * 0.55;
    var d = 'M440,' + y0 + ' H760 Q772,' + y0 + ' 776,' + (y0 + 20) + ' C792,' + (y0 + 90) + ' 820,' + (f - 70) + ' 888,' + (f - 10) +
      ' Q900,' + f + ' 900,' + (f + 14) + ' V' + (y1 - 16) + ' Q900,' + y1 + ' 884,' + y1 + ' H316 Q300,' + y1 + ' 300,' + (y1 - 16) +
      ' V' + (f + 14) + ' Q300,' + f + ' 312,' + (f - 10) + ' C380,' + (f - 70) + ' 408,' + (y0 + 90) + ' 424,' + (y0 + 20) + ' Q428,' + y0 + ' 440,' + y0 + ' Z';
    shape(g, d, acc);
    el('path', { d: d, fill: 'none', stroke: 'rgba(255,240,225,.55)', 'stroke-width': 2.5, 'stroke-dasharray': '10 8',
      transform: 'translate(600 ' + ((y0 + y1) / 2) + ') scale(.955 .94) translate(-600 ' + (-(y0 + y1) / 2) + ')' }, g);
    rivet(g, 452, y0 + 16, 7); rivet(g, 748, y0 + 16, 7); rivet(g, 316, f + 12, 7); rivet(g, 884, f + 12, 7);
  }
  function dring(g, x, y, acc) {
    plate(g, x - 30, y - 47, 60, 38, acc, 6);
    rivet(g, x - 12, y - 28, 6); rivet(g, x + 12, y - 28, 6);
    el('path', { d: 'M' + (x - 26) + ',' + (y - 8) + ' h52 a26,26 0 0 1 -52,0 Z', fill: 'none', stroke: 'url(#metal)', 'stroke-width': 7 }, g);
  }
  function ringLoop(g, x, y, acc) {
    plate(g, x - 31, y, 62, 50, acc, 6);
    rivet(g, x - 13, y + 25, 6); rivet(g, x + 13, y + 25, 6);
    el('circle', { cx: x, cy: y + 98, r: 40, fill: 'none', stroke: 'url(#metal)', 'stroke-width': 8 }, g);
  }
  // Optional bottle opener (as the owner's reference): riveted leather tab, metal clip,
  // long black strap with a rivet, round metal opener head and a pointed ring.
  // The riveted tab it hangs from is accessory leather; the long strap is the opener's own colour.
  function opener(g, x, y, acc, oc) {
    el('rect', { x: x - 26, y: y, width: 52, height: 40, rx: 5, fill: 'url(#accGrad)', stroke: acc.edge, 'stroke-width': 3, filter: 'url(#drop)' }, g);
    rivet(g, x - 11, y + 20, 6); rivet(g, x + 11, y + 20, 6);
    el('path', { d: 'M' + (x - 26) + ',' + (y + 42) + ' h52 v10 h-6 v-4 h-40 v4 h-6 Z', fill: 'url(#metal)', stroke: '#8a8a8a', 'stroke-width': 1.5 }, g);
    el('rect', { x: x - 22, y: y + 52, width: 44, height: 180, rx: 6, fill: 'url(#openerGrad)', stroke: oc.edge, 'stroke-width': 2, filter: 'url(#drop)' }, g);
    el('rect', { x: x - 18, y: y + 56, width: 6, height: 172, rx: 3, fill: 'rgba(255,255,255,.1)' }, g);
    rivet(g, x, y + 212, 7);
    el('circle', { cx: x, cy: y + 262, r: 34, fill: 'url(#metal)', stroke: '#8f8f8f', 'stroke-width': 3, filter: 'url(#drop)' }, g);
    el('circle', { cx: x, cy: y + 262, r: 24, fill: '#efefef', stroke: '#b5b5b5', 'stroke-width': 2 }, g);
    el('path', { d: 'M' + x + ',' + (y + 392) + ' L' + (x - 30) + ',' + (y + 364) + ' A40,40 0 1 1 ' + (x + 30) + ',' + (y + 364) + ' Z',
      fill: 'none', stroke: 'url(#metal)', 'stroke-width': 8, 'stroke-linejoin': 'round' }, g);
  }
  // Optional 50 ml protective grease: a round tin and a polishing cloth beside the apron.
  function greaseTin(g) {
    var t = el('g', { filter: 'url(#drop)' }, g);
    el('rect', { x: 1000, y: 655, width: 70, height: 90, rx: 14, fill: '#f2f1ee', stroke: '#c9c7c2', 'stroke-width': 3 }, t);
    el('path', { d: 'M1006,690 h58 M1006,712 h58', stroke: '#dedcd7', 'stroke-width': 2 }, t);
    el('circle', { cx: 955, cy: 700, r: 62, fill: 'url(#metal)', stroke: '#8a8a8a', 'stroke-width': 4 }, t);
    el('circle', { cx: 955, cy: 700, r: 50, fill: '#2f55c9', stroke: '#1f3d9a', 'stroke-width': 2 }, t);
    el('rect', { x: 905, y: 690, width: 100, height: 20, fill: '#1e2428' }, t);
    el('path', { d: 'M935,750 a20,20 0 0 1 40,0 Z', fill: '#e8e8e8' }, t);
  }
  // Optional leather wings at the back cross-over (as the owner's reference): three layered
  // tiers of scalloped feathers on each side, joined by two rivets in the middle.
  function wings(g, acc) {
    // Two-layer leather wings over the strap crossing, traced from the owner's reference:
    // each layer has stepped feather "fingers" pointing outwards, longest at the top.
    // Points for the left wing as [tip, notch, tip, notch, ...]; mirrored for the right.
    function wingPath(topStart, topC1, topC2, pts, end) {
      // Each feather is a smooth rounded lobe: the curve keeps one tangent through the tip
      // (running from the previous notch towards the next one) and only turns sharply in the notches.
      function f(n) { return n.toFixed(1); }
      function tangent(i) {
        var prev = i === 0 ? topC2.split(',').map(Number) : pts[i - 1];
        var next = i === pts.length - 1 ? end[0] : pts[i + 1];
        var dx = next[0] - prev[0], dy = next[1] - prev[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
        return [dx / len, dy / len];
      }
      function dist(a, b) { return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])); }
      function intoTip(from, i, c1) {
        var t = pts[i], T = tangent(i), k = dist(from, t) * 0.5;
        return ' C' + c1 + ' ' + f(t[0] - T[0] * k) + ',' + f(t[1] - T[1] * k) + ' ' + t[0] + ',' + t[1];
      }
      function outOfTip(i, to) {
        var t = pts[i], T = tangent(i), k = dist(t, to) * 0.5;
        return ' C' + f(t[0] + T[0] * k) + ',' + f(t[1] + T[1] * k) + ' ' +
          f(to[0] - (to[0] - t[0]) * 0.25) + ',' + f(to[1] - (to[1] - t[1]) * 0.25) + ' ' + to[0] + ',' + to[1];
      }
      var start = topStart.split(',').map(Number);
      var d = 'M' + topStart + intoTip(start, 0, topC1);
      for (var i = 0; i < pts.length; i += 2) {
        var notch = i + 1 < pts.length ? pts[i + 1] : end[0];
        d += outOfTip(i, notch);
        if (i + 2 < pts.length) {
          var n = pts[i + 1], t2 = pts[i + 2];
          d += intoTip(n, i + 2, f(n[0] + (t2[0] - n[0]) * 0.25) + ',' + f(n[1] + (t2[1] - n[1]) * 0.25));
        }
      }
      for (var j = 1; j < end.length; j++) d += ' L' + end[j][0] + ',' + end[j][1];
      return d + ' Z';
    }
    var back = wingPath('601,38', '555,34', '470,20',
      [[406, 33], [437, 47], [427, 52], [455, 67], [448, 73], [471, 84], [464, 88], [488, 98], [481, 105], [513, 109], [506, 126], [527, 119], [523, 135]],
      [[545, 122], [563, 113], [601, 113]]);
    var front = wingPath('601,54', '565,48', '505,36',
      [[452, 46], [476, 60], [469, 64], [492, 76], [485, 80], [506, 91], [499, 97], [521, 105], [516, 115], [535, 120], [530, 129]],
      [[547, 121], [563, 108], [601, 108]]);
    [1, -1].forEach(function (sgn) {
      var w = el('g', { transform: sgn < 0 ? 'translate(1200 0) scale(-1 1)' : '' }, g);
      el('path', { d: back, fill: 'url(#wingGrad)', stroke: acc.edge, 'stroke-width': 3, 'stroke-linejoin': 'round', filter: 'url(#drop)' }, w);
      el('path', { d: back, fill: 'rgba(0,0,0,.18)' }, w);
      el('path', { d: front, fill: 'url(#wingGrad)', stroke: acc.edge, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, w);
      // tooled lines separating the feathers, running in from each notch
      [[476, 60], [492, 76], [506, 91], [521, 105]].forEach(function (n) {
        var ex = n[0] + (588 - n[0]) * 0.42, ey = n[1] + (92 - n[1]) * 0.42;
        el('path', { d: 'M' + n[0] + ',' + n[1] + ' Q' + ((n[0] + ex) / 2).toFixed(1) + ',' + ((n[1] + ey) / 2 - 4).toFixed(1) + ' ' + ex.toFixed(1) + ',' + ey.toFixed(1),
          fill: 'none', stroke: acc.edge, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.7 }, w);
      });
    });
    rivet(g, 581, 95, 8); rivet(g, 619, 95, 8);
  }

  // Patterned finish: the body is a patchwork of stitched leather panels, each a slightly different
  // shade. Seams run between the engraving spots (chest piece in one, then rows of panels).
  function patchwork(g, main) {
    var rows = [[220, 700, []], [700, 1100, [600]], [1100, 1400, [330, 600]], [1400, 1760, [420, 780]]];
    var tones = [null, ['hi', .18], ['edge', .14], ['hi', .1], ['edge', .2], ['hi', .24], ['edge', .1], ['hi', .14]];
    var k = 0, seams = [];
    rows.forEach(function (r, ri) {
      var xs = [0].concat(r[2], [W]);
      for (var i = 0; i < xs.length - 1; i++, k++) {
        var t = tones[k % tones.length];
        if (t) el('rect', { x: xs[i], y: r[0], width: xs[i + 1] - xs[i], height: r[1] - r[0], fill: main[t[0]], opacity: t[1] }, g);
      }
      if (ri) seams.push('M0,' + r[0] + ' H' + W);
      r[2].forEach(function (x) { seams.push('M' + x + ',' + r[0] + ' V' + r[1]); });
    });
    var d = seams.join(' ');
    el('path', { d: d, fill: 'none', stroke: main.edge, 'stroke-width': 5, opacity: '.8' }, g);
    el('path', { d: d, fill: 'none', stroke: main.hi, 'stroke-width': 2, opacity: '.5', transform: 'translate(2 3)' }, g);
    // Stitching on both sides of every seam.
    [-11, 11].forEach(function (o) {
      var sd = seams.map(function (s) { return /H/.test(s) ? s.replace(/^M0,(\d+)/, function (m, y) { return 'M0,' + (Number(y) + o); }) : s.replace(/^M(\d+),/, function (m, x) { return 'M' + (Number(x) + o) + ','; }); }).join(' ');
      el('path', { d: sd, fill: 'none', stroke: 'rgba(255,236,210,.42)', 'stroke-width': 2.5, 'stroke-dasharray': '9 8' }, g);
    });
  }

  function draw(st) {
    var style = STYLES[st.style], main = COLORS[st.main], acc = COLORS[st.acc];
    // Engraving on the pocket is burned into the accessory leather, everywhere else into the apron body.
    function inkFor(p) { return p === 'pocket' ? acc : main; }
    stage.textContent = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-labelledby': 'apron-title apron-desc' }, stage);
    el('title', { id: 'apron-title' }, svg).textContent = 'Preview of your ' + style.name;
    el('desc', { id: 'apron-desc' }, svg).textContent = main.label + (st.patterned ? ' patterned (patchwork) leather' : ' leather') + ' with ' + acc.label.toLowerCase() + ' accessories and black straps' +
      (st.wings ? ', ' + wingName(st) + ' leather wings' : '') + (st.opener ? ', bottle opener with ' + openerName(st) + ' leather tab' : '') + (st.grease ? ', with a tin of leather care grease and cloth' : '') +
      engravingSummary(st, ', engraved: ', ', no engraving') + '.';

    var defs = el('defs', {}, svg);
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
    var wc = COLORS[wingColor(st)], wgG = el('linearGradient', { id: 'wingGrad', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': wc.hi }, wgG); el('stop', { offset: '1', 'stop-color': wc.hex }, wgG);
    // Bottle opener strap: shaded across its width like the leather loops.
    var oc = COLORS[openerColor(st)], opG = el('linearGradient', { id: 'openerGrad', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: '0', 'stop-color': oc.hex }, opG); el('stop', { offset: '.45', 'stop-color': oc.hi }, opG); el('stop', { offset: '1', 'stop-color': oc.edge }, opG);
    var loopG = el('linearGradient', { id: 'loopGrad', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: '0', 'stop-color': acc.hex }, loopG); el('stop', { offset: '.45', 'stop-color': acc.hi }, loopG); el('stop', { offset: '1', 'stop-color': acc.edge }, loopG);
    var metal = el('linearGradient', { id: 'metal', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': '#ffffff' }, metal); el('stop', { offset: '.5', 'stop-color': '#c9c9c9' }, metal); el('stop', { offset: '1', 'stop-color': '#7d7d7d' }, metal);
    var clip = el('clipPath', { id: 'bibclip' }, defs);
    el('path', { d: BIB }, clip);

    function tube(g, d) {
      el('path', { d: d, stroke: '#8f8a84', 'stroke-width': 38 }, g);
      el('path', { d: d, stroke: STRAP_BLACK, 'stroke-width': 32 }, g);
      el('path', { d: d, stroke: 'rgba(255,255,255,.12)', 'stroke-width': 3, transform: 'translate(-6 -2)' }, g);
    }

    // Apron body
    el('path', { d: BIB, fill: main.hex }, svg);
    var tex = el('g', { 'clip-path': 'url(#bibclip)' }, svg);
    el('rect', { x: 0, y: 0, width: W, height: H, filter: 'url(#mottle)' }, tex);
    el('rect', { x: 0, y: 0, width: W, height: H, filter: 'url(#grain)', opacity: '.5' }, tex);
    if (st.patterned) patchwork(tex, main);
    el('path', { d: BIB, fill: 'none', stroke: main.edge, 'stroke-width': 4 }, svg);

    // The two straps lie on top of the apron, pinned with two rivets each, with metal sliders.
    var harness = el('g', { fill: 'none', 'stroke-linejoin': 'round' }, svg);
    tube(harness, STRAP_B);
    tube(harness, STRAP_A);
    [[143, 460], [1057, 460]].forEach(function (p) {
      el('rect', { x: p[0] - 13, y: p[1] - 26, width: 26, height: 52, rx: 13, fill: 'none', stroke: 'url(#metal)', 'stroke-width': 6 }, svg);
    });
    [[390, 262], [390, 300], [810, 262], [810, 300]].forEach(function (p) { rivet(svg, p[0], p[1], 9); });

    // Back piece. Wings if chosen; otherwise a single flat leather connector in the accessory
    // colour. As on the real apron, each strap lies on the connector from its edge, tucks into a
    // slit and runs underneath to the opposite side, where it comes back out through another slit.
    if (st.wings) {
      wings(svg, COLORS[wingColor(st)]);
    } else {
      var cx = 600, cy = 79, rin = 44;
      var plateD = 'M498,79 L546,6 H654 L702,79 L654,152 H546 Z';
      el('path', { d: plateD, fill: 'url(#accGrad)', stroke: acc.edge, 'stroke-width': 4, 'stroke-linejoin': 'round', filter: 'url(#drop)' }, svg);
      // Straps are visible on the plate only between its edge and the slits.
      var pc = el('clipPath', { id: 'backclip' }, defs);
      el('path', { d: plateD + ' M' + (cx + rin) + ',' + cy + ' A' + rin + ',' + rin + ' 0 1 0 ' + (cx - rin) + ',' + cy + ' A' + rin + ',' + rin + ' 0 1 0 ' + (cx + rin) + ',' + cy + ' Z',
        'clip-rule': 'evenodd' }, pc);
      var onPlate = el('g', { fill: 'none', 'clip-path': 'url(#backclip)' }, svg);
      tube(onPlate, STRAP_B);
      tube(onPlate, STRAP_A);
      // Slits: cut across each strap where it tucks under the plate.
      var dirs = [[0.797, -0.604], [-0.797, -0.604]];
      dirs.forEach(function (d) {
        [1, -1].forEach(function (sgn) {
          var x = cx + d[0] * rin * sgn, y = cy + d[1] * rin * sgn;
          var px = -d[1] * 22, py = d[0] * 22;
          el('path', { d: 'M' + (x + px) + ',' + (y + py) + ' L' + (x - px) + ',' + (y - py), stroke: '#140c09', 'stroke-width': 6, 'stroke-linecap': 'round' }, svg);
          el('path', { d: 'M' + (x + px + d[0] * 4 * sgn) + ',' + (y + py + d[1] * 4 * sgn) + ' L' + (x - px + d[0] * 4 * sgn) + ',' + (y - py + d[1] * 4 * sgn),
            stroke: 'rgba(255,235,215,.35)', 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
        });
      });
    }

    var acs = el('g', {}, svg);
    // Waist tabs with D-rings
    [[25, 948], [1100, 948]].forEach(function (p, i) {
      el('path', { d: i ? 'M1175,958 a20,22 0 0 1 0,40' : 'M25,958 a20,22 0 0 0 0,40', fill: 'none', stroke: 'url(#metal)', 'stroke-width': 7 }, acs);
      plate(acs, p[0], p[1], 75, 58, acc, 5);
      rivet(acs, p[0] + 22, p[1] + 17, 6); rivet(acs, p[0] + 53, p[1] + 17, 6);
      rivet(acs, p[0] + 22, p[1] + 41, 6); rivet(acs, p[0] + 53, p[1] + 41, 6);
    });

    var look = lookOf(st.style), op = OPENER_AT[look];
    if (look === 'bbq') {
      loops(acs, 368, 688, 210, 50, 3, acc);
      loops(acs, 578, 804, 305, 54, 3, acc);
      // Straps either side of the drink holder, each pinned at the end next to it.
      hstrap(acs, 82, 1055, 153, 48, acc); hstrap(acs, 507, 1055, 140, 48, acc, true);
      // Drink holder, its hole cut through so the apron leather shows.
      shape(acs, 'M278,1055 H472 V1082 H440 V1212 Q440,1230 422,1230 H398 L380,1200 L362,1230 H334 Q316,1230 316,1212 V1082 H278 Z' +
        ' M361,1145 a17,36 0 1 0 34,0 a17,36 0 1 0 -34,0 Z', acc).setAttribute('fill-rule', 'evenodd');
      vstrap(acs, 316, 1280, 48, 155, acc); vstrap(acs, 388, 1280, 46, 155, acc);
      if (!st.opener) dring(acs, 598, 1215, acc);
      pocket(acs, 730, 1065, 260, 298, acc);
    } else if (look === 'barber') {
      if (!st.opener) dring(acs, 424, 790, acc);
      band(acs, 605, 780, 225, 24, acc);
      loops(acs, 165, 1040, 323, 75, 3, acc);
      band(acs, 162, 1182, 328, 78, acc, 2);
      pocket(acs, 662, 1037, 275, 256, acc);
      ringLoop(acs, 1081, 1052, acc);
    } else if (look === 'simple') {
      band(acs, 288, 850, 222, 20, acc);
      dring(acs, 728, 790, acc);
      shapedPocket(acs, 978, 1375, acc);
    } else if (look === 'split') {
      loops(acs, 518, 572, 324, 70, 3, acc);
      pocket(acs, 518, 650, 324, 260, acc);
      shapedPocket(acs, 920, 1315, acc);
      band(acs, 58, 1335, 255, 60, acc, 2, 2);
      pocket(acs, 772, 1335, 298, 382, acc);
      // Split between the legs, with black leg straps and riveted corner tabs.
      el('path', { d: 'M575,1762 V1366 A25,25 0 0 1 625,1366 V1762 Z', fill: '#f3ebe0', stroke: main.edge, 'stroke-width': 4 }, svg);
      var legs = el('g', { fill: 'none', 'stroke-linejoin': 'round' }, svg);
      tube(legs, 'M495,1686 H548 C590,1690 592,1778 545,1778 L80,1778 C40,1778 30,1745 40,1712');
      tube(legs, 'M705,1686 H652 C610,1690 608,1778 655,1778 L1120,1778 C1160,1778 1170,1745 1160,1712');
      [[22, 1655], [1090, 1655]].forEach(function (p, i) {
        el('path', { d: i ? 'M1178,1668 a18,20 0 0 1 0,38' : 'M22,1668 a18,20 0 0 0 0,38', fill: 'none', stroke: 'url(#metal)', 'stroke-width': 6 }, svg);
        plate(svg, p[0], p[1], 88, 64, acc, 5);
        rivet(svg, p[0] + 26, p[1] + 20, 6); rivet(svg, p[0] + 62, p[1] + 20, 6);
        rivet(svg, p[0] + 26, p[1] + 44, 6); rivet(svg, p[0] + 62, p[1] + 44, 6);
      });
      [[495, 1686], [705, 1686]].forEach(function (p) { rivet(svg, p[0], p[1], 7); rivet(svg, p[0] + (p[0] < 600 ? 50 : -50), p[1], 7); });
    } else if (look === 'wood') {
      // Layout from the Virtual Leather woodworking sketch: two logo spots high on the chest.
      pocket(acs, 580, 525, 225, 238, acc);
      dring(acs, 412, 820, acc);
      // Hand-warmer pocket: open along both curved sides so hands go in from either side.
      var kd = 'M444,882 H765 C770,960 790,1030 844,1050 V1222 Q844,1236 830,1236 H357 Q343,1236 343,1222 V1050 C397,1030 417,960 444,882 Z';
      shape(acs, kd, acc);
      el('path', { d: 'M454,894 H755 M832,1060 V1224 H355 V1060', fill: 'none', stroke: 'rgba(255,240,225,.55)', 'stroke-width': 2.5, 'stroke-dasharray': '10 8' }, acs);
      el('path', { d: 'M765,882 C770,960 790,1030 844,1050 M444,882 C417,960 397,1030 343,1050', fill: 'none', stroke: acc.edge, 'stroke-width': 6, opacity: '.8' }, acs);
      rivet(acs, 452, 892, 7); rivet(acs, 757, 892, 7); rivet(acs, 352, 1060, 7); rivet(acs, 835, 1060, 7);
      // Side strap with a raised hammer loop between riveted ends.
      plate(acs, 53, 1355, 264, 105, acc, 6);
      el('rect', { x: 140, y: 1340, width: 90, height: 135, rx: 16, fill: 'url(#loopGrad)', stroke: acc.edge, 'stroke-width': 3 }, acs);
      [[75, 1385], [105, 1385], [75, 1430], [105, 1430], [265, 1385], [295, 1385], [265, 1430], [295, 1430]].forEach(function (r) { rivet(acs, r[0], r[1], 7); });
      pocket(acs, 820, 1470, 250, 262, acc);
      // Bottom corner tabs with D-rings and leg ties.
      var ties = el('g', { fill: 'none', 'stroke-linejoin': 'round' }, svg);
      tube(ties, 'M18,1708 C-10,1720 -6,1760 30,1772');
      tube(ties, 'M1182,1708 C1210,1720 1206,1760 1170,1772');
      [[25, 1680], [1095, 1680]].forEach(function (p, i) {
        el('path', { d: i ? 'M1175,1690 a18,20 0 0 1 0,38' : 'M25,1690 a18,20 0 0 0 0,38', fill: 'none', stroke: 'url(#metal)', 'stroke-width': 6 }, svg);
        plate(svg, p[0], p[1], 80, 60, acc, 5);
        rivet(svg, p[0] + 24, p[1] + 18, 6); rivet(svg, p[0] + 56, p[1] + 18, 6);
        rivet(svg, p[0] + 24, p[1] + 42, 6); rivet(svg, p[0] + 56, p[1] + 42, 6);
      });
    }
    if (st.opener && op) opener(acs, op[0], op[1], acc, COLORS[openerColor(st)]);
    if (st.grease) greaseTin(svg);

    drawEngraving(svg, defs, st, main, acc);
  }

  // The box a spot's engraving goes in. The chest grows into spot 2 when 2 is removed.
  function boxFor(st, p) {
    var b = posFor(st.style, p);
    if (p === '1' && st.slots['2'] && st.slots['2'].mode === 'none' && POS_OVERRIDES[st.style] && POS_OVERRIDES[st.style].chestBig) {
      var big = POS_OVERRIDES[st.style].chestBig;
      for (var k in big) b[k] = big[k];
    }
    return b;
  }
  // Does this spot have anything to engrave (or a placeholder to show)?
  function slotShows(sl) { return sl.mode === 'design' || sl.mode === 'logo' || (sl.mode === 'text' && !!sl.text); }

  // Engraving: dashed guides for empty spots (tap one to edit it), then each spot's text, design or
  // logo "burned in" (engraving colour plus a faint highlight). fit[spot] records the size drawn as a
  // % of standard and the biggest % that fits, for the size controls and the order description.
  function drawEngraving(svg, defs, st, main, acc) {
    function inkFor(p) { return p === 'pocket' ? acc : main; }   // the pocket is accessory leather
    var spots = positionsOf(st.style);
    var guides = el('g', { 'aria-hidden': 'true' }, svg);
    fit = {};
    spots.forEach(function (p) {
      var q = boxFor(st, p), sl = st.slots[p], on = p === active;
      if (p === '2' && sl.mode === 'none' && POS_OVERRIDES[st.style] && POS_OVERRIDES[st.style].chestBig) return;
      var g = el('g', { 'data-slot': p }, guides);
      el('rect', { x: q.x - q.w / 2, y: q.y - q.h / 2, width: q.w, height: q.h, rx: 8, fill: 'rgba(255,255,255,0)',
        stroke: slotShows(sl) ? 'none' : on ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.45)', 'stroke-dasharray': '14 10', 'stroke-width': on ? 4 : 3 }, g);
      if (slotShows(sl)) return;
      var t = el('text', { x: q.x, y: q.y + (p === 'pocket' ? 12 : 14), 'text-anchor': 'middle', fill: on ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.65)',
        'font-size': p === 'pocket' ? 34 : 40, 'font-weight': 700, 'font-family': 'Inter, sans-serif' }, g);
      t.textContent = p === 'pocket' ? 'Pocket' : p;
    });
    var activeG = null;
    spots.forEach(function (p) {
      var sl = st.slots[p];
      if (!slotShows(sl)) return;
      var box = boxFor(st, p), m = metrics(box), ink = inkFor(p).engrave;
      var g = el('g', { 'aria-hidden': 'true', 'data-slot': p }, svg);
      if (p === active) activeG = g;
      if (sl.mode === 'text') { fit[p] = drawText(g, box, m, sl, ink, planFor(st.style, p).lines || 3); return; }
      // Logos and designs: an artwork box of a known aspect, standard size limited by the spot.
      var logo = sl.mode === 'logo' ? logos[p] : null, design = sl.mode === 'design' ? DESIGNS[sl.design] : null;
      var aspect = design ? design.aspect : logo ? logo.aspect : 1.6;
      var std = Math.min(m.logoH, m.stdW / aspect, m.stdH), capped = false;
      if (m.inkH) std = Math.min(std, m.inkH);
      var maxPct = Math.max(100, Math.floor(100 * Math.min(m.maxW / (std * aspect), m.maxH / std)));
      var capPct = m.inkH ? pctOf(m.inkH, std) : 0;
      if (capPct && capPct <= maxPct) { maxPct = capPct; capped = true; }
      var pct = Math.min(sl.size, maxPct), h = std * pct / 100, w = h * aspect, x = box.x - w / 2, y = box.y - h / 2;
      fit[p] = { pct: pct, maxPct: maxPct, capped: capped };
      if (design) {
        var k = w / 1000;
        [['#ffe1c8', 0.22, 2], [ink, 1, 0]].forEach(function (layer) {
          var dg = el('g', { transform: 'translate(' + (x + layer[2]).toFixed(1) + ' ' + (y + layer[2]).toFixed(1) + ') scale(' + k.toFixed(4) + ')', opacity: layer[1] }, g);
          var o = { ink: layer[0], font: sl.dfont };
          (design.fields || []).forEach(function (f) { o[f.key] = sl.fields[f.key]; });
          design.draw(dg, o);
        });
      } else if (logo) {
        // The black and white logo is engraved where it is solid; a raw one (not yet converted) by its dark parts.
        var shapeRow = logo.raw ? '-0.2126 -0.7152 -0.0722 1 0' : '0 0 0 1 0';
        [['ink-' + p, ink, 1, 0], ['hi-' + p, '#ffe1c8', 0.22, 2]].forEach(function (f) {
          var rgb = [1, 3, 5].map(function (i) { return (parseInt(f[1].substr(i, 2), 16) / 255).toFixed(3); });
          var flt = el('filter', { id: f[0], 'color-interpolation-filters': 'sRGB' }, defs);
          el('feColorMatrix', { type: 'matrix', values: '0 0 0 0 ' + rgb[0] + '  0 0 0 0 ' + rgb[1] + '  0 0 0 0 ' + rgb[2] + '  ' +
            shapeRow.split(' ').map(function (v) { return (v * f[2]).toString(); }).join(' ') }, flt);
        });
        el('image', { href: logo.src, x: x + 2, y: y + 2, width: w, height: h, preserveAspectRatio: 'xMidYMid meet', filter: 'url(#hi-' + p + ')' }, g);
        el('image', { href: logo.src, x: x, y: y, width: w, height: h, preserveAspectRatio: 'xMidYMid meet', filter: 'url(#ink-' + p + ')' }, g);
      } else {
        el('rect', { x: x, y: y, width: w, height: h, rx: 12, fill: 'rgba(0,0,0,.06)', stroke: ink, 'stroke-width': 3, 'stroke-dasharray': '8 7' }, g);
        var ph = el('text', { x: box.x, y: box.y + h * 0.1, 'text-anchor': 'middle', fill: ink, 'font-size': Math.max(18, h * 0.28).toFixed(1),
          'font-weight': 700, 'font-family': 'Inter, sans-serif', 'letter-spacing': 2 }, g);
        ph.textContent = 'LOGO';
      }
    });
    // Outline the spot being edited.
    if (activeG) {
      try {
        var bb = activeG.getBBox();
        el('rect', { x: bb.x - 14, y: bb.y - 10, width: bb.width + 28, height: bb.height + 20, rx: 10, fill: 'none',
          stroke: 'rgba(255,255,255,.85)', 'stroke-width': 3, 'stroke-dasharray': '10 8', 'pointer-events': 'none', 'aria-hidden': 'true' }, svg);
      } catch (e) { /* not rendered yet */ }
    }
  }

  // Engraved text at the chosen size; the standard size shrinks for long text so 100% always fits.
  function drawText(g, box, m, sl, ink, maxLines) {
    var font = FONTS[sl.font] || FONTS.montserrat;
    var lines = sl.text.split('\n').slice(0, maxLines);
    var base = m.fs * [1, 0.78, 0.62][lines.length - 1] * font.scale;
    var hl = [], texts = [];
    lines.forEach(function (line) {
      var h1 = el('text', { x: box.x + 2, 'text-anchor': 'middle', fill: 'rgba(255,225,200,.22)', 'font-family': font.family, 'font-weight': font.weight, 'font-size': base.toFixed(1) }, g);
      var t = el('text', { x: box.x, 'text-anchor': 'middle', fill: ink, 'font-family': font.family, 'font-weight': font.weight, 'font-size': base.toFixed(1) }, g);
      h1.textContent = line; t.textContent = line;
      hl.push(h1); texts.push(t);
    });
    var widest = Math.max.apply(null, texts.map(function (t) { try { return t.getComputedTextLength(); } catch (e) { return 0; } })) || 1;
    var tall = lines.length * base * 1.08 / font.scale;
    var std = base * Math.min(1, m.stdW / widest, m.stdH / tall), capped = false, capSize = 0;
    var looks = m.inkH ? inkOf(font, lines) : null, block = looks && m.inkAll ? looks.bottom - looks.top : 0;
    if (looks) { capSize = m.inkH / (block || looks.r); std = Math.min(std, capSize); }
    var maxPct = Math.max(100, Math.floor(100 * base * Math.min(m.maxW / widest, m.maxH / tall) / std));
    var capPct = capSize ? pctOf(capSize, std) : 0;
    if (capPct && capPct <= maxPct) { maxPct = capPct; capped = true; }
    var pct = Math.min(sl.size, maxPct), size = Math.max(12, std * pct / 100);
    texts.concat(hl).forEach(function (t) { t.setAttribute('font-size', size.toFixed(1)); });
    // First baseline: lines centred on the spot (the letters as they look, for a band spot).
    var lh = size * 1.08, top = block ? box.y - (looks.top + looks.bottom) / 2 * size : box.y - ((lines.length - 1) * lh) / 2 + size * 0.34;
    texts.forEach(function (t, i) { t.setAttribute('y', (top + i * lh).toFixed(1)); });
    hl.forEach(function (t, i) { t.setAttribute('y', (top + i * lh + 2).toFixed(1)); });
    return { pct: pct, maxPct: maxPct, capped: capped };
  }
  // a as a whole % of b, with a hair of slack so that a size capped at exactly the limit reads 100%, not 99%.
  function pctOf(a, b) { return Math.floor(100 * a / b + 1e-6); }
  // How the letters of these lines look per unit of font size in this lettering, measured on a canvas: r = the
  // tallest line (top of the highest letter to bottom of the lowest); top / bottom = the whole text, lines 1.08
  // apart, from the first line's baseline. Montserrat capitals (0.75 tall) if unknown.
  var inkCache = {}, inkCtx = null;
  function inkOf(font, lines) {
    var key = font.family + '|' + font.weight + '|' + lines.join('\n');
    if (inkCache[key]) return inkCache[key];
    var r = 0, top = Infinity, bottom = -Infinity;
    try {
      inkCtx = inkCtx || document.createElement('canvas').getContext('2d');
      inkCtx.font = font.weight + ' 100px ' + font.family;
      lines.forEach(function (line, i) {
        if (!line.trim()) return;
        var mt = inkCtx.measureText(line), up = (mt.actualBoundingBoxAscent || 0) / 100, down = (mt.actualBoundingBoxDescent || 0) / 100;
        r = Math.max(r, up + down);
        top = Math.min(top, i * 1.08 - up);
        bottom = Math.max(bottom, i * 1.08 + down);
      });
    } catch (e) { r = 0; }
    var o = r > 0.2 ? { r: r, top: top, bottom: bottom } : { r: 0.75, top: -0.75, bottom: (lines.length - 1) * 1.08 };
    // Only remember it once the lettering's own font is in (before that the canvas measures a stand-in font).
    if (!document.fonts || document.fonts.check(font.weight + ' 100px ' + font.family)) inkCache[key] = o;
    return o;
  }

  /* ---------- Engraving spots: one card per spot, built from the plans above ---------- */
  var active = '1';      // the spot being edited (outlined on the preview)
  // spot -> { src (in black and white, as engraved), aspect, name, ok, bw } once a logo file is chosen (kept
  // on this device only); raw = shown as uploaded, not (yet) in black and white.
  var logos = {};
  var fit = {};          // spot -> { pct, maxPct } as drawn (set by drawEngraving)
  var modeTouched = {};  // spots whose choice the customer changed (others follow each style's default)
  var slotsBox = document.getElementById('slots');

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fontPills(name, checked) {
    return '<div class="options font-opts">' + Object.keys(FONTS).map(function (k) {
      return '<label class="opt"><input type="radio" name="' + name + '" value="' + k + '" data-font="' + k + '"' + (k === checked ? ' checked' : '') +
        '><span>' + esc(FONTS[k].label) + '</span></label>';
    }).join('') + '</div>';
  }
  function slotTitle(p, styleKey) { return p === 'pocket' ? 'Pocket' : p + ' · ' + spotLabel(p, styleKey); }
  function buildSlots() {
    var allDesigns = Object.keys(DESIGNS);
    slotsBox.innerHTML = SLOT_KEYS.map(function (p) {
      var id = p;
      return '<fieldset class="slot" id="slot-' + id + '" data-slot="' + id + '">' +
        '<legend><span class="slot-num" aria-hidden="true">' + (p === 'pocket' ? 'P' : p) + '</span> <span class="slot-title">' + esc(slotTitle(p, 'bbq')) + '</span>' +
          '<span class="slot-where"></span><span class="slot-price"></span></legend>' +
        '<p class="hint slot-hint" id="hint-' + id + '"></p>' +
        '<div class="options mode-opts" role="group" aria-label="What goes in ' + esc(slotTitle(p, 'bbq')) + '">' +
          ['text', 'design', 'logo', 'none'].map(function (m) {
            return '<label class="opt"><input type="radio" name="mode-' + id + '" value="' + m + '"><span>' + MODE_LABELS[m] + '</span></label>';
          }).join('') + '</div>' +
        // Text
        '<div class="slot-body" data-for="text">' +
          '<div class="field"><label for="text-' + id + '">Your text</label>' +
          '<textarea id="text-' + id + '" name="text-' + id + '" maxlength="40" rows="2" aria-describedby="count-' + id + '" placeholder="e.g. Grill Master Mike"></textarea>' +
          '<p class="counter" id="count-' + id + '" aria-live="polite"></p></div>' +
          '<fieldset class="option-group"><legend>Lettering</legend>' + fontPills('font-' + id, 'montserrat') + '</fieldset>' +
        '</div>' +
        // Suggested designs
        '<div class="slot-body" data-for="design">' +
          '<fieldset class="option-group"><legend>Pick a design</legend><div class="options design-opts">' +
          allDesigns.map(function (d) {
            return '<label class="opt design-opt" data-design="' + d + '"><input type="radio" name="design-' + id + '" value="' + d + '">' +
              '<span><i class="design-thumb" data-thumb="' + d + '"></i>' + esc(DESIGNS[d].label) + '</span></label>';
          }).join('') + '</div></fieldset>' +
          allDesigns.map(function (d) {
            var fields = DESIGNS[d].fields || [];
            if (!fields.length) return '';
            return '<div class="design-fields" data-design="' + d + '"><div class="two-col">' + fields.map(function (f) {
              var fid = 'd-' + f.key + '-' + id;
              return '<div class="field"><label for="' + fid + '">' + esc(f.label) + (f.required ? '' : ' <span class="muted">(optional)</span>') + '</label>' +
                '<input id="' + fid + '" name="' + fid + '" type="text" maxlength="' + f.max + '" placeholder="' + esc(f.placeholder) + '"' +
                (f.numeric ? ' inputmode="numeric" pattern="[0-9]{4}"' : '') + ' aria-describedby="' + fid + '-error">' +
                '<p class="error" id="' + fid + '-error" aria-live="polite"></p></div>';
            }).join('') + '</div>' +
            '<fieldset class="option-group"><legend>Lettering for the name</legend>' + fontPills('dfont-' + id, DESIGNS[d].defFont || 'montserrat') + '</fieldset></div>';
          }).join('') +
        '</div>' +
        // Logo
        '<div class="slot-body logo-file" data-for="logo">' +
          '<div class="field"><label for="logo-' + id + '">Upload your logo to see it on the preview <span class="muted">(optional)</span></label>' +
          '<input type="file" id="logo-' + id + '" data-slot="' + id + '" accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-describedby="logo-hint-' + id + ' logo-' + id + '-error">' +
          '<p class="hint" id="logo-hint-' + id + '">PNG, JPG, WebP or SVG, up to 15 MB. The preview shows it in black and white, the way it\'s engraved, and it stays on your device. After ordering, send us the original file by WhatsApp or email: we engrave from it, and you approve a proof first.</p>' +
          '<p class="hint logo-kept" id="logo-' + id + '-kept" hidden></p>' +
          '<p class="error" id="logo-' + id + '-error" aria-live="polite"></p></div>' +
        '</div>' +
        // Size (text, design or logo)
        '<div class="size-field">' +
          '<div class="size-head"><label for="size-' + id + '">Size</label><output id="size-' + id + '-out" for="size-' + id + '">100%</output></div>' +
          '<div class="size-row">' +
            '<button type="button" class="size-btn" data-target="size-' + id + '" data-step="-10" aria-label="Smaller">&minus;</button>' +
            '<input type="range" id="size-' + id + '" name="size-' + id + '" min="50" max="150" step="10" value="100" aria-describedby="size-' + id + '-fit">' +
            '<button type="button" class="size-btn" data-target="size-' + id + '" data-step="10" aria-label="Bigger">+</button>' +
          '</div><p class="fit-note" id="size-' + id + '-fit" aria-live="polite"></p>' +
        '</div>' +
      '</fieldset>';
    }).join('');
    drawThumbs();
  }
  // Design thumbnails, drawn with sample text (again once fonts arrive, so the text is measured right).
  function drawThumbs() {
    Array.prototype.forEach.call(slotsBox.querySelectorAll('[data-thumb]'), function (box) {
      var d = DESIGNS[box.getAttribute('data-thumb')];
      box.textContent = '';
      var svg = el('svg', { viewBox: '0 0 1000 ' + Math.round(1000 / d.aspect), 'aria-hidden': 'true', focusable: 'false' }, box);
      var o = { ink: '#2b1d16', font: d.defFont };
      (d.fields || []).forEach(function (f) { o[f.key] = f.sample; });
      d.draw(svg, o);
    });
  }
  buildSlots();
  // Start every spot on its default for the opening style.
  function applyDefaults(styleKey, force) {
    SLOT_KEYS.forEach(function (p) {
      if (modeTouched[p] && !force) return;
      var plan = planFor(styleKey, p);
      var r = form.querySelector('input[name="mode-' + p + '"][value="' + plan.def + '"]');
      if (r) r.checked = true;
      if (plan.designs) {
        var d = form.querySelector('input[name="design-' + p + '"][value="' + plan.designs[0] + '"]');
        if (d && !val('design-' + p)) d.checked = true;
      }
    });
  }
  applyDefaults(val('style') || 'bbq', true);

  /* ---------- Apron size (production patterns) ----------
   * The size we cut, from the wearer's height, using the workshop's patterns (width x length, cm):
   * S up to 1.69 m (55.4 wide, 70-74 long), "normal" 1.70-1.75 m (56 x 76), X from 1.76 m (56 wide,
   * 77-90 long). With a BMI of 30 or more we cut the wider "OB" version of the same pattern: 60 cm wide,
   * letter M up to 1.79 m and X from 1.80 m. In-between heights take the nearest pattern (the longer one
   * when it's halfway). The same rule applies to every apron style. */
  var PATTERNS = [   // [up to cm, pattern, letter, width, length]
    [162, '1.60', 'S', 55.4, 70], [166, '1.65', 'S', 55.4, 72], [169, '1.68', 'S', 55.4, 74],
    [175, 'normal', '', 56, 76], [177, '1.77', 'X', 56, 77], [178, '1.78', 'X', 56, 80],
    [181, '1.80', 'X', 56, 81], [183, '1.83', 'X', 56, 82], [185, '1.85', 'X', 56, 84],
    [186, '1.86', 'X', 56, 85], [188, '1.88', 'X', 56, 86], [190, '1.90', 'X', 56, 87],
    [193, '1.92', 'X', 56, 88], [Infinity, '1.96/2.00', 'X', 56, 90]
  ];
  function num(s) { return parseFloat(String(s).replace(',', '.')); }
  // Height in cm from what the customer typed: "180", "180 cm", "1.80 m", "1,80", "5'11", "5 ft 11 in",
  // "5ft11", "71 in". imperial: true when given in feet or inches.
  function parseHeight(text) {
    var t = String(text || '').toLowerCase().replace(/[’′]/g, "'").replace(/[”″]/g, '"').trim(), m;
    if (!t) return null;
    if ((m = /^(\d)\s*(?:'|ft|feet|foot)\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:"|''|in|inch|inches)?)?$/.exec(t))) {
      return { cm: (Number(m[1]) * 12 + (m[2] ? num(m[2]) : 0)) * 2.54, imperial: true };
    }
    if ((m = /^(\d{2,3}(?:[.,]\d+)?)\s*(?:"|''|in|inch|inches)$/.exec(t))) return { cm: num(m[1]) * 2.54, imperial: true };
    if ((m = /^(\d(?:[.,]\d{1,2})?)\s*(?:m|mt|mts|meters?|metres?)?$/.exec(t))) {
      var v = num(m[1]);
      if (v >= 1.2 && v <= 2.5) return { cm: v * 100, imperial: false };
      // "5.11" with no unit: 5 ft 11 in
      if (!/m/.test(t) && v >= 4 && v < 8) { var parts = m[1].split(/[.,]/), inch = parts[1] ? Number(parts[1]) : 0; if (inch < 12) return { cm: (Number(parts[0]) * 12 + inch) * 2.54, imperial: true }; }
      return null;
    }
    if ((m = /^(\d{3}(?:[.,]\d+)?)\s*(?:cm|cms|centimet(?:er|re)s?)?$/.exec(t))) { var c = num(m[1]); return c >= 120 && c <= 250 ? { cm: c, imperial: false } : null; }
    return null;
  }
  // Weight in kg: "85", "85 kg", "187 lb", "187 lbs", "13 st", "13 st 5 lb". No unit: pounds when the
  // height was given in feet and inches, otherwise kilos.
  function parseWeight(text, imperial) {
    var t = String(text || '').toLowerCase().trim(), m;
    if (!t) return null;
    if ((m = /^(\d{1,2})\s*(?:st|stone)s?\s*(?:(\d{1,2})\s*(?:lb|lbs|pounds?)?)?$/.exec(t))) return (Number(m[1]) * 14 + (m[2] ? Number(m[2]) : 0)) * 0.45359237;
    if ((m = /^(\d{2,3}(?:[.,]\d+)?)\s*(kg|kgs|kilos?|kilograms?|lb|lbs|pounds?)?$/.exec(t))) {
      var v = num(m[1]), lb = m[2] ? /^(lb|pound)/.test(m[2]) : imperial;
      var kg = lb ? v * 0.45359237 : v;
      return kg >= 30 && kg <= 300 ? kg : null;
    }
    return null;
  }
  // { width, length, pattern, letter, wide, heightCm } or null when the height can't be read.
  function apronSize(heightText, weightText) {
    var h = parseHeight(heightText);
    if (!h) return null;
    var cm = Math.round(h.cm), kg = parseWeight(weightText, h.imperial), row = PATTERNS[0];
    for (var i = 0; i < PATTERNS.length; i++) { row = PATTERNS[i]; if (cm <= row[0]) break; }
    var wide = kg != null && kg / Math.pow(h.cm / 100, 2) >= 30;
    return { width: wide ? 60 : row[3], length: row[4], pattern: row[1] + (wide ? ' OB' : ''),
      letter: wide ? (cm <= 179 ? 'M' : 'X') : row[2], wide: wide, heightCm: cm, imperial: h.imperial };
  }
  function sizeLabel(z) { return String(z.width) + ' × ' + z.length + ' cm'; }

  /* ---------- State, summary, validation ---------- */
  function read() {
    var st = {
      style: val('style') || 'bbq', main: val('main') || 'tan', acc: val('acc') || 'brown', notes: val('notes'),
      height: val('height'), weight: val('weight'), email: val('email'), phone: val('phone'),
      wings: val('wings'), wingColor: val('wingColor'), opener: val('opener'), openerColor: val('openerColor'), grease: val('grease'),
      slots: {}
    };
    // Patterned (patchwork panels): the patterned BBQ apron.
    st.patterned = !!STYLES[st.style].patterned;
    SLOT_KEYS.forEach(function (p) {
      var design = val('design-' + p), fields = {};
      ((DESIGNS[design] || {}).fields || []).forEach(function (f) { fields[f.key] = val('d-' + f.key + '-' + p); });
      st.slots[p] = {
        mode: val('mode-' + p) || 'none', size: Number(val('size-' + p)) || 100,
        text: (form.elements['text-' + p].value || '').replace(/\r/g, '').replace(/\n{2,}/g, '\n').trim(),
        font: FONTS[val('font-' + p)] ? val('font-' + p) : 'montserrat',
        design: design, fields: fields, dfont: FONTS[val('dfont-' + p)] ? val('dfont-' + p) : 'classic'
      };
    });
    return st;
  }
  // The spots in use on this style, each with a one-line description (for the order, summary and WhatsApp).
  function slotLines(st, short) {
    var out = [], list = positionsOf(st.style);
    list.forEach(function (p) {
      var sl = st.slots[p], where = short ? (p === 'pocket' ? 'Pocket' : p) : 'Position ' + posLabel(p), size = (fit[p] ? fit[p].pct : sl.size) + '%';
      if (sl.mode === 'text' && sl.text) {
        out.push(short ? where + ': "' + sl.text.replace(/\n/g, ' ') + '"'
          : where + ': text "' + sl.text.replace(/\n/g, ' / ') + '", font ' + fontName(sl.font) + ', size ' + size + ' of standard');
      } else if (sl.mode === 'design' && DESIGNS[sl.design]) {
        var d = DESIGNS[sl.design];
        out.push(short ? where + ': ' + (d.short || d.label) : where + ': "' + d.label + '" design' +
          (d.fields || []).map(function (f) { return sl.fields[f.key] ? ', ' + f.label.toLowerCase() + ' "' + sl.fields[f.key] + '"' : ''; }).join('') +
          ((d.fields || []).length ? ', font ' + fontName(sl.dfont) : '') + ', size ' + size + ' of standard');
      } else if (sl.mode === 'logo') {
        out.push(short ? where + ': your logo' : where + ': customer\'s logo, size ' + size + ' of standard' +
          (logos[p] ? ', previewed with "' + logos[p].name.slice(0, 60) + '"' : '') + ' (customer will send the file by WhatsApp or email)');
      }
    });
    if (!short && st.slots['2'].mode === 'none' && list.indexOf('2') !== -1 && POS_OVERRIDES[st.style] && POS_OVERRIDES[st.style].chestBig &&
      st.slots['1'].mode !== 'none' && st.slots['1'].mode !== 'text') out.push('Position 2 left empty so the chest design is bigger');
    return out;
  }
  function engravingSummary(st, prefix, none) {
    var l = slotLines(st, true);
    return l.length ? prefix + l.join(', ') : none;
  }
  function describe(st, ref) {
    var parts = slotLines(st, false);
    if (!parts.length) parts.push('Engraving: none');
    var eng = engravings(st);
    if (eng.extra) parts.push('Engravings: ' + eng.count + ' (' + FREE_ENGRAVINGS + ' included + ' + eng.extra + ' extra)');
    var z = apronSize(st.height, st.weight);
    if (z) parts.push('Size guide: ' + z.width + ' x ' + z.length + ' cm (pattern ' + z.pattern + (z.letter ? ' ' + z.letter : '') + ')');
    if (st.patterned) parts.push('Finish: patterned (patchwork panels)');
    if (st.notes) parts.push('Notes: ' + st.notes);
    parts.push('Designed on virtualleather.net' + (ref ? ' (ref ' + ref + ')' : ''));
    return parts.join(' | ');
  }

  var summaryEls = {
    style: document.getElementById('sum-style'), colors: document.getElementById('sum-colors'),
    engraving: document.getElementById('sum-engraving'), extras: document.getElementById('sum-extras'),
    total: document.getElementById('sum-total'), tag: document.getElementById('preview-tag'),
    engravings: document.getElementById('sum-engravings'), engravingsDt: document.getElementById('sum-engravings-dt')
  };
  var wingField = document.getElementById('wing-color-field');
  var openerField = document.getElementById('opener-color-field');
  var waLink = document.getElementById('design-whatsapp');

  // Wings and bottle opener follow the accessory colour unless the customer picks another.
  var SHORT = { tan: 'tan', brown: 'dark brown', black: 'black' };
  function wingColor(st) { return COLORS[st.wingColor] ? st.wingColor : st.acc; }
  function wingName(st) { return SHORT[wingColor(st)]; }
  function openerColor(st) { return COLORS[st.openerColor] ? st.openerColor : st.acc; }
  function openerName(st) { return SHORT[openerColor(st)]; }

  // Engraving count for the price. A spot counts when something is on it (text, a design or a logo),
  // and the chest (spots 1 and 2) counts once. Spots are counted in order (chest first), so the first
  // FREE_ENGRAVINGS are included. Returns each spot's tag ('included' or 'extra') and the number of extras.
  function engravings(st) {
    var tags = {}, n = 0, chest = false;
    positionsOf(st.style).forEach(function (p) {
      var sl = st.slots[p];
      if (!(sl.mode === 'logo' || (sl.mode === 'design' && DESIGNS[sl.design]) || (sl.mode === 'text' && sl.text))) return;
      var isChest = p === '1' || p === '2';
      if (!isChest || !chest) n++;
      if (isChest) chest = true;
      tags[p] = n > FREE_ENGRAVINGS ? 'extra' : 'included';
    });
    if (!ENGRAVING_ID) return { count: n, extra: 0, tags: {} };
    return { count: n, extra: Math.max(0, n - FREE_ENGRAVINGS), tags: tags };
  }

  function total(st) {
    return PRICE + (st.wings ? EXTRA_PRICE : 0) + (st.opener ? EXTRA_PRICE : 0) + (st.grease ? EXTRA_PRICE : 0) +
      engravings(st).extra * ENGRAVING_PRICE;
  }

  // The WhatsApp message: short, plain lines that open by asking to talk the design through.
  // (The full workshop detail, with fonts and sizes, goes in the order description instead.)
  function spotName(p) { return p === 'pocket' ? 'Pocket' : spotLabel(p) + ' (' + p + ')'; }
  function waMessage(st) {
    var lines = [], hasLogo = false, extras = [];
    var bigChest = POS_OVERRIDES[st.style] && POS_OVERRIDES[st.style].chestBig && (st.slots['1'].mode === 'design' || st.slots['1'].mode === 'logo');
    lines.push('Apron: ' + STYLES[st.style].name);
    lines.push('Leather: ' + COLORS[st.main].label + (st.patterned ? ', patterned (patchwork panels)' : '') + ', with ' + COLORS[st.acc].label.toLowerCase() + ' accessories');
    var z = apronSize(st.height, st.weight);
    if (st.height) lines.push('Wearer: ' + st.height + (st.weight ? ', ' + st.weight : '') + (z ? ' (about ' + sizeLabel(z) + ')' : ''));
    positionsOf(st.style).forEach(function (p) {
      var sl = st.slots[p], size = (fit[p] ? fit[p].pct : sl.size), bigger = size !== 100 ? ', size ' + size + '%' : '';
      if (sl.mode === 'text' && sl.text) {
        lines.push(spotName(p) + ': "' + sl.text.replace(/\n/g, ' / ') + '" in ' + FONTS[sl.font].label + ' lettering' + bigger);
      } else if (sl.mode === 'design' && DESIGNS[sl.design]) {
        var d = DESIGNS[sl.design], f = sl.fields || {};
        lines.push(spotName(p) + ': ' + (d.fields && d.fields.length ? d.label + ' design' : '"' + d.label + '" design') +
          (f.name ? ', name "' + f.name + '"' : '') + (f.year ? ', Est. ' + f.year : '') +
          (d.fields && d.fields.length ? ' (' + FONTS[sl.dfont].label + ' lettering)' : '') + bigger);
      } else if (sl.mode === 'logo') {
        hasLogo = true;
        lines.push(spotName(p) + ': my logo' + bigger);
      } else if (p === '2' && sl.mode === 'none' && bigChest) {
        lines.push('Under chest (2): left empty so the chest design is bigger');
      }
    });
    var eng = engravings(st);
    if (eng.extra) lines.push('Extra engravings: ' + eng.extra + ' (+$' + eng.extra * ENGRAVING_PRICE + ')');
    if (st.wings) extras.push('leather wings (' + wingName(st) + ')');
    if (st.opener) extras.push('bottle opener (' + openerName(st) + ')');
    if (st.grease) extras.push('protective leather grease');
    if (extras.length) lines.push('Extras: ' + extras.join(', '));
    if (st.notes) lines.push('Notes: ' + st.notes);
    return 'Hi Virtual Leather! I\'d like to discuss my apron design with you before I order.\n\n' +
      '*My design*\n- ' + lines.join('\n- ') + '\n\n' +
      (hasLogo ? 'I\'ll send my logo file in this chat.\n\n' : '') +
      'Can we talk it through?';
  }

  // Extras offered per style (default: all). The barber apron has no bottle opener.
  var ALL_EXTRAS = ['wings', 'opener', 'grease'];
  function syncExtras(st) {
    var allowed = STYLES[st.style].extras || ALL_EXTRAS;
    ALL_EXTRAS.forEach(function (name) {
      var box = form.elements[name];
      if (!box) return;
      var on = allowed.indexOf(name) !== -1;
      box.disabled = !on;
      if (!on) box.checked = false;
      box.closest('.check').hidden = !on;
    });
  }

  // Show the spots this style has, each with only its own choices and the fields for the chosen one.
  function syncSlots(st) {
    var list = positionsOf(st.style);
    SLOT_KEYS.forEach(function (p) {
      var card = document.getElementById('slot-' + p), plan = planFor(st.style, p), sl = st.slots[p];
      var shown = list.indexOf(p) !== -1;
      card.hidden = !shown;
      Array.prototype.forEach.call(card.querySelectorAll('input[name="mode-' + p + '"]'), function (r) {
        var ok = plan.modes.indexOf(r.value) !== -1;
        r.disabled = !ok || !shown;
        r.closest('.opt').hidden = !ok;
        var label = r.value === 'none' && plan.noneLabel ? plan.noneLabel : MODE_LABELS[r.value];
        if (r.nextElementSibling.textContent !== label) r.nextElementSibling.textContent = label;
        if (r.checked && !ok) {
          r.checked = false;
          form.querySelector('input[name="mode-' + p + '"][value="' + plan.def + '"]').checked = true;
        }
      });
      // Order the choices as the plan lists them (only moving them when the order changes: moving a
      // button while it's being clicked would lose the click).
      var group = card.querySelector('.mode-opts');
      var order = Array.prototype.map.call(group.querySelectorAll('input'), function (r) { return r.value; })
        .filter(function (m) { return plan.modes.indexOf(m) !== -1; }).join();
      if (order !== plan.modes.join()) plan.modes.forEach(function (m) { group.appendChild(group.querySelector('input[value="' + m + '"]').closest('.opt')); });
      var mode = val('mode-' + p) || plan.def;
      // The spot's name on this style, and where it is (e.g. "Top of drink holder"), shown beside it.
      var title = card.querySelector('.slot-title'), titleText = slotTitle(p, st.style);
      if (title.textContent !== titleText) {
        title.textContent = titleText;
        card.querySelector('.mode-opts').setAttribute('aria-label', 'What goes in ' + titleText);
      }
      var where = card.querySelector('.slot-where'), whereText = plan.where ? '\u00b7 ' + plan.where : '';
      if (where.textContent !== whereText) where.textContent = whereText;
      var hint = card.querySelector('.slot-hint');
      hint.textContent = plan.hint || '';
      hint.hidden = !plan.hint;
      Array.prototype.forEach.call(card.querySelectorAll('.slot-body'), function (b) { b.hidden = b.getAttribute('data-for') !== mode; });
      card.querySelector('.size-field').hidden = mode === 'none';
      // Designs offered in this spot
      var designs = plan.designs || [];
      Array.prototype.forEach.call(card.querySelectorAll('.design-opt'), function (o) {
        var ok = designs.indexOf(o.getAttribute('data-design')) !== -1;
        o.hidden = !ok;
        o.querySelector('input').disabled = !ok;
        if (!ok) o.querySelector('input').checked = false;
      });
      if (designs.length && !val('design-' + p)) form.querySelector('input[name="design-' + p + '"][value="' + designs[0] + '"]').checked = true;
      var design = val('design-' + p);
      Array.prototype.forEach.call(card.querySelectorAll('.design-fields'), function (f) { f.hidden = f.getAttribute('data-design') !== design; });
      var ta = form.elements['text-' + p], maxLines = plan.lines || 3;
      ta.rows = maxLines > 2 ? 2 : 1;
      card.querySelector('label[for="text-' + p + '"]').textContent = 'Your text (up to ' + maxLines + ' line' + (maxLines > 1 ? 's' : '') + ')';
      document.getElementById('count-' + p).textContent = ta.value.length + ' / 40 characters' + (maxLines > 1 ? ' · Enter starts a new line' : '');
      card.classList.toggle('is-active', p === active);
      if (sl.mode !== mode) sl.mode = mode;
    });
  }

  // The size we'll cut, shown under height and weight and in the summary.
  var sizeNote = document.getElementById('size-note'), sumSize = document.getElementById('sum-size'), sumSizeDt = document.getElementById('sum-size-dt');
  function syncSize(st) {
    var z = apronSize(st.height, st.weight);
    sumSize.hidden = sumSizeDt.hidden = sizeNote.hidden = !z;
    if (!z) return;
    sumSize.textContent = sizeLabel(z);
    // In feet and inches too when that's how the height was given.
    var inches = function (c) { return Math.round(c / 2.54); }, ft = Math.floor(z.heightCm / 30.48), inch = Math.round(z.heightCm / 2.54 - ft * 12);
    var text = 'We\'ll cut this apron to about ' + sizeLabel(z) + (z.imperial ? ' (' + inches(z.width) + ' × ' + inches(z.length) + ' in)' : '') +
      ', width × length, for a height of ' + (z.imperial ? ft + ' ft ' + inch + ' in' : (z.heightCm / 100).toFixed(2) + ' m') +
      (z.wide ? ', in our wider cut' : '') + '. The neck and waist straps adjust.';
    if (sizeNote.textContent !== text) sizeNote.textContent = text;
  }

  // Price tag beside each spot in use: "Included", or "+$5" once the included engravings are used up.
  function syncPrices(st) {
    var tags = engravings(st).tags;
    SLOT_KEYS.forEach(function (p) {
      var tag = document.getElementById('slot-' + p).querySelector('.slot-price');
      var text = tags[p] === 'extra' ? '+$' + ENGRAVING_PRICE : tags[p] === 'included' ? 'Included' : '';
      if (tag.textContent !== text) tag.textContent = text;
      tag.classList.toggle('is-extra', tags[p] === 'extra');
    });
  }

  // Keep each size slider within what fits its spot, so the % shown always matches the preview.
  // Returns true if a slider had to come down (the preview is then redrawn).
  function clampSizes(st) {
    var changed = false;
    if (document.fonts && document.fonts.status === 'loading') return false;
    positionsOf(st.style).forEach(function (p) {
      var input = form.elements['size-' + p], min = Number(input.min), f = fit[p], v = st.slots[p].size;
      if (!f || v <= f.maxPct || v <= min) return;
      input.value = Math.max(min, Math.floor(f.maxPct / 10) * 10);
      changed = changed || Number(input.value) !== v;
    });
    return changed;
  }
  function syncSizes(st) {
    positionsOf(st.style).forEach(function (p) {
      var input = form.elements['size-' + p], v = st.slots[p].size, f = fit[p], step = Number(input.step);
      var atFit = !!f && v + step > f.maxPct, shown = f ? f.pct : v;
      document.getElementById('size-' + p + '-out').textContent = shown + '%';
      input.setAttribute('aria-valuetext', shown + '%');
      Array.prototype.forEach.call(form.querySelectorAll('.size-btn[data-target="size-' + p + '"]'), function (b) {
        b.disabled = Number(b.getAttribute('data-step')) < 0 ? v <= Number(input.min) : v >= Number(input.max) || atFit;
      });
      var bigChest = p === '1' && POS_OVERRIDES[st.style] && POS_OVERRIDES[st.style].chestBig && st.slots['2'].mode !== 'none';
      document.getElementById('size-' + p + '-fit').textContent = !atFit || v >= Number(input.max) ? '' :
        f.capped ? 'That\'s the biggest size for this spot.' :
        'That\'s the biggest that fits this spot.' + (st.slots[p].mode === 'text' ? ' For bigger letters, use fewer letters or another line.' : '') +
        (bigChest && st.slots[p].mode !== 'text' ? ' Set spot 2 to "None" to make it bigger.' : '');
    });
  }

  function update() {
    var st = read();
    syncExtras(st);
    syncSlots(st);
    st = read();
    wingField.hidden = !st.wings;
    openerField.hidden = !st.opener;
    draw(st);
    if (clampSizes(st)) { st = read(); draw(st); }
    syncSizes(st);
    syncPrices(st);
    summaryEls.style.textContent = STYLES[st.style].name;
    summaryEls.colors.textContent = COLORS[st.main].label + (st.patterned ? ', patterned' : '') + ' / ' + COLORS[st.acc].label;
    syncSize(st);
    summaryEls.engraving.textContent = engravingSummary(st, '', 'None');
    var ex = [];
    if (st.wings) ex.push('Wings (' + wingName(st) + ')'); if (st.opener) ex.push('Bottle opener (' + openerName(st) + ')'); if (st.grease) ex.push('Leather grease');
    summaryEls.extras.textContent = ex.length ? ex.join(', ') : 'None';
    var extraEng = engravings(st).extra;
    summaryEls.engravings.hidden = summaryEls.engravingsDt.hidden = !extraEng;
    summaryEls.engravings.textContent = extraEng + ' × $' + ENGRAVING_PRICE;
    summaryEls.total.textContent = '$' + total(st);
    summaryEls.tag.textContent = STYLES[st.style].name;
    // Real photos and description of the chosen apron, under the preview.
    var galleryKey = STYLES[st.style].gallery || st.style;
    Array.prototype.forEach.call(document.querySelectorAll('.style-gallery'), function (g) { g.hidden = g.getAttribute('data-style') !== galleryKey; });
    if (waLink) waLink.href = 'https://wa.me/' + C.whatsappNumber + '?text=' + encodeURIComponent(waMessage(st));
  }

  // Analytics. The designer is the product page for each apron, so seeing it (and switching style)
  // counts as viewing that apron: GA4 view_item / Meta ViewContent, once per style per visit, with the
  // Ecwid product ID so Meta can match it to the catalogue. Suggested designs and logo uploads are
  // GA4-only select_content events, to see which designs customers like.
  var viewed = {}, designerSeen = false, picked = {};
  function itemFor(styleKey) {
    var s = STYLES[styleKey];
    return { item_id: String(s.id), item_name: s.name, item_category: 'Aprons', price: PRICE, quantity: 1 };
  }
  function trackView(styleKey) {
    if (!designerSeen || viewed[styleKey] || !VL.track) return;
    viewed[styleKey] = true;
    VL.track('view_item', { currency: C.currency, value: PRICE, items: [itemFor(styleKey)] });
  }
  function trackPick(type, id, spot) {
    var key = type + ':' + id + ':' + spot;
    if (picked[key] || !VL.track) return;
    picked[key] = true;
    VL.track('select_content', { content_type: type, content_id: id, engraving_spot: spot, item_id: String(STYLES[val('style') || 'bbq'].id) });
  }
  if ('IntersectionObserver' in window) {
    var seen = new IntersectionObserver(function (entries) {
      if (!entries.some(function (en) { return en.isIntersecting; })) return;
      seen.disconnect();
      designerSeen = true;
      trackView(val('style') || 'bbq');
    }, { threshold: 0.25 });
    seen.observe(stage);
  }

  var customised = false;
  // Wing and opener colours follow the accessory colour until the customer picks one themselves.
  var colourPicked = { wingColor: false, openerColor: false };
  function followAccessory() {
    var acc = val('acc');
    Object.keys(colourPicked).forEach(function (name) {
      if (colourPicked[name]) return;
      var r = form.querySelector('input[name="' + name + '"][value="' + acc + '"]');
      if (r) r.checked = true;
    });
  }
  followAccessory();
  form.addEventListener('input', function (e) {
    var n = e.target.name || '';
    if (colourPicked.hasOwnProperty(n)) colourPicked[n] = true;
    if (n === 'acc') followAccessory();
    if (n === 'style') { applyDefaults(e.target.value, false); trackView(e.target.value); }
    if (n.indexOf('mode-') === 0) modeTouched[n.slice(5)] = true;
    if (n.indexOf('text-') === 0) {
      var maxLines = planFor(val('style') || 'bbq', n.slice(5)).lines || 3, lines = e.target.value.split('\n');
      if (lines.length > maxLines) e.target.value = lines.slice(0, maxLines).join('\n');
    }
    if (e.target.getAttribute('aria-invalid') === 'true') {
      if (n.indexOf('d-') === 0) { e.target.setAttribute('aria-invalid', 'false'); document.getElementById(e.target.id + '-error').textContent = ''; }
      else validateField(e.target);
    }
    update();
    if (!customised) {
      customised = true;
      var st = read();
      VL.track && VL.track('customize_product', { currency: C.currency, value: PRICE, items: [itemFor(st.style)] });
    }
    // A suggested design chosen (by switching a spot to designs, or picking another design)
    if (n.indexOf('mode-') === 0 || n.indexOf('design-') === 0) {
      var spot = n.slice(n.indexOf('-') + 1);
      if (val('mode-' + spot) === 'design' && val('design-' + spot)) trackPick('engraving_design', val('design-' + spot), spot);
    }
    saveDraftSoon();
  });
  form.addEventListener('change', function () { update(); saveDraftSoon(); });

  // The spot being edited follows focus; tapping a spot on the preview jumps to its card.
  function setActive(p) {
    if (active === p) return;
    active = p;
    update();
  }
  slotsBox.addEventListener('focusin', function (e) {
    var card = e.target.closest('.slot');
    if (card) setActive(card.getAttribute('data-slot'));
  });
  stage.addEventListener('click', function (e) {
    var hit = e.target.closest ? e.target.closest('[data-slot]') : null;
    if (!hit) return;
    var p = hit.getAttribute('data-slot'), card = document.getElementById('slot-' + p);
    setActive(p);
    if (card && !card.hidden) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var r = card.querySelector('input[name="mode-' + p + '"]:checked');
      if (r) r.focus({ preventScroll: true });
    }
  });

  // - / + buttons beside each size slider.
  slotsBox.addEventListener('click', function (e) {
    var b = e.target.closest('.size-btn');
    if (!b) return;
    var input = document.getElementById(b.getAttribute('data-target'));
    input.value = Math.min(Number(input.max), Math.max(Number(input.min), Number(input.value) + Number(b.getAttribute('data-step'))));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  /* ---------- Customer logos in black and white ----------
   * A laser either burns a spot or it doesn't, so the preview shows the logo the same way, worked out on the
   * customer's device (free, no outside service). It's a quick idea of the engraving: we make the real file
   * from the original they send us, and they approve a proof before we engrave.
   * Logos on a coloured or white background (most of them):
   *  1. The background is the colour along the picture's edges (their median), with a tolerance from how much
   *     they vary: pixels of that colour connected to the edges, and inside the drawing patches of almost
   *     exactly that colour (the hole of an O). The background is never engraved.
   *  2. Inside the drawing, dark and light are split where its own greys separate best (Otsu's method): the
   *     dark parts (outlines, dark fur, lettering) are engraved and the light parts left clear, as drawn.
   *     A one-tone drawing (white lettering on a navy box) is engraved whole.
   *  3. On a light background, light colours beside the logo (a yellow sun next to black lettering) are
   *     engraved too, while light shapes inside it (a star inside a disk) stay clear; a light area holding
   *     details (lettering on a gold button) is outlined instead. On a dark background, the soft rim of light
   *     shapes (snow dots) isn't engraved.
   *  A shaded picture (a photo, a 3-D egg: soft light-to-dark changes rather than drawn edges) is drawn as a
   *     sketch instead: its outline plus what's darker than its surroundings (eyes, a smile).
   * Logos on a see-through background are engraved by their dark parts, or by their shape when they're light.
   * Then edges are smoothed, specks and pinholes removed, and margins trimmed. */
  function otsu(hist, total) {
    var sum = 0, sumB = 0, wB = 0, best = -1, cut = 127, i;
    for (i = 0; i < 256; i++) sum += i * hist[i];
    for (i = 0; i < 256; i++) {
      wB += hist[i];
      if (!wB) continue;
      var wF = total - wB;
      if (!wF) break;
      sumB += i * hist[i];
      var between = wB * wF * Math.pow(sumB / wB - (sum - sumB) / wF, 2);
      if (between > best) { best = between; cut = i; }
    }
    return cut;   // greys up to the cut are the dark side
  }
  // Each connected patch of a mask (side by side, not corner to corner), handed to visit(pixels, count).
  function patches(w, h, mask, visit) {
    var n = w * h, seen = new Uint8Array(n), stack = new Int32Array(n), list = new Int32Array(n);
    for (var s = 0; s < n; s++) {
      if (seen[s] || !mask[s]) continue;
      var top = 0, len = 0;
      stack[top++] = s; seen[s] = 1;
      while (top) {
        var i = stack[--top], x = i % w;
        list[len++] = i;
        if (x > 0 && !seen[i - 1] && mask[i - 1]) { seen[i - 1] = 1; stack[top++] = i - 1; }
        if (x < w - 1 && !seen[i + 1] && mask[i + 1]) { seen[i + 1] = 1; stack[top++] = i + 1; }
        if (i >= w && !seen[i - w] && mask[i - w]) { seen[i - w] = 1; stack[top++] = i - w; }
        if (i < n - w && !seen[i + w] && mask[i + w]) { seen[i + w] = 1; stack[top++] = i + w; }
      }
      visit(list, len);
    }
  }
  // A mask grown by one pixel all round.
  function grow(w, h, m) {
    var out = new Uint8Array(w * h), x, y, i;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      if (m[i] || (x > 0 && m[i - 1]) || (x < w - 1 && m[i + 1]) || (y > 0 && m[i - w]) || (y < h - 1 && m[i + w]) ||
          (x > 0 && y > 0 && m[i - w - 1]) || (x < w - 1 && y > 0 && m[i - w + 1]) ||
          (x > 0 && y < h - 1 && m[i + w - 1]) || (x < w - 1 && y < h - 1 && m[i + w + 1])) out[i] = 1;
    }
    return out;
  }
  // Light patches of the drawing that touch the background around it become engraved (light colours beside
  // the logo); patches enclosed by the logo stay clear.
  function engraveBeside(w, h, ink, light, around) {
    var n = w * h, minPatch = Math.max(16, n * 0.0005);
    patches(w, h, light, function (list, len) {
      if (len < minPatch) return;
      for (var m = 0; m < len; m++) {
        var j = list[m], jx = j % w;
        if ((jx > 0 && around[j - 1]) || (jx < w - 1 && around[j + 1]) || (j >= w && around[j - w]) || (j < n - w && around[j + w])) {
          for (m = 0; m < len; m++) ink[list[m]] = 1;
          return;
        }
      }
    });
  }
  // The picture at working size (up to 720 px, enough for the preview; small pictures are enlarged so edges
  // stay smooth). Throws when the browser won't let the page read it.
  function logoImage(img) {
    var w = img.naturalWidth || img.width || 600, h = img.naturalHeight || img.height || 600;
    var k = Math.min(4, 720 / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cw, ch);
    return { w: cw, h: ch, data: ctx.getImageData(0, 0, cw, ch).data };
  }
  // The band, a few pixels wide, along the inside of the background around the drawing: its outline.
  function outlineBand(w, h, around) {
    var band = around, t = Math.max(2, Math.round(Math.min(w, h) * 0.006));
    for (var i = 0; i < t; i++) band = grow(w, h, band);
    return band;
  }
  // A shaded picture as a sketch: its outline, plus what is darker than the drawing around it (a window of about a
  // tenth of the picture, background left out), so the shading itself stays clear.
  function sketch(w, h, L, bgAll, bgm) {
    var n = w * h, ink = new Uint8Array(n), band = outlineBand(w, h, bgm), W = w + 1, x, y;
    var sum = new Float64Array(W * (h + 1)), cnt = new Float64Array(W * (h + 1));
    for (y = 0; y < h; y++) {
      var rs = 0, rc = 0;
      for (x = 0; x < w; x++) {
        var q = y * w + x;
        if (!bgAll[q]) { rs += L[q]; rc++; }
        sum[(y + 1) * W + x + 1] = sum[y * W + x + 1] + rs;
        cnt[(y + 1) * W + x + 1] = cnt[y * W + x + 1] + rc;
      }
    }
    var R = Math.max(4, Math.round(Math.min(w, h) * 0.05));
    for (y = 0; y < h; y++) {
      var y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1);
      for (x = 0; x < w; x++) {
        var p = y * w + x;
        if (bgAll[p]) continue;
        if (band[p]) { ink[p] = 1; continue; }
        var x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1);
        var s = sum[y1 * W + x1] - sum[y0 * W + x1] - sum[y1 * W + x0] + sum[y0 * W + x0];
        var c = cnt[y1 * W + x1] - cnt[y0 * W + x1] - cnt[y1 * W + x0] + cnt[y0 * W + x0];
        if (c && L[p] < s / c - 24) ink[p] = 1;
      }
    }
    return ink;
  }
  // Which pixels to engrave (before clean-up): 1 = engraved.
  function engraveMask(im) {
    var w = im.w, h = im.h, n = w * h, d = im.data, body = new Uint8Array(n), L = new Uint8Array(n), clear = 0, i, j, x, y;
    for (i = 0; i < n; i++) {
      body[i] = d[i * 4 + 3] >= 128 ? 1 : 0;
      if (!body[i]) clear++;
      L[i] = Math.round(0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]);
    }
    var edge = [], edgeClear = 0;
    for (x = 0; x < w; x++) { edge.push(x); if (h > 1) edge.push(n - w + x); }
    for (y = 1; y < h - 1; y++) { edge.push(y * w); if (w > 1) edge.push(y * w + w - 1); }
    for (i = 0; i < edge.length; i++) if (!body[edge[i]]) edgeClear++;
    if (clear > n * 0.05 && edgeClear * 2 > edge.length) return seeThroughMask(w, h, d, body, L, edge);

    // 1. The background: its colour, its tolerance, the part around the drawing (bgm) and all of it (bgAll).
    var rs = [], gs = [], bs = [], num = function (a, b) { return a - b; };
    for (i = 0; i < edge.length; i++) { j = edge[i]; if (body[j]) { rs.push(d[j * 4]); gs.push(d[j * 4 + 1]); bs.push(d[j * 4 + 2]); } }
    var ink = new Uint8Array(n);
    if (!rs.length) return ink;
    rs.sort(num); gs.sort(num); bs.sort(num);
    var mid = rs.length >> 1, br = rs[mid], bgG = gs[mid], bb = bs[mid];
    var dist = function (q) { var a = d[q * 4] - br, b = d[q * 4 + 1] - bgG, c = d[q * 4 + 2] - bb; return Math.sqrt(a * a + b * b + c * c); };
    var ed = [];
    for (i = 0; i < edge.length; i++) if (body[edge[i]]) ed.push(dist(edge[i]));
    ed.sort(num);
    var tol = Math.min(90, Math.max(40, 2.5 * ed[Math.floor(ed.length * 0.8)])), tight = Math.min(tol, 25);
    var near = new Uint8Array(n), bgm = new Uint8Array(n), bgAll = new Uint8Array(n), stack = new Int32Array(n), top = 0;
    for (i = 0; i < n; i++) near[i] = !body[i] || dist(i) <= tol ? 1 : 0;
    for (i = 0; i < edge.length; i++) { j = edge[i]; if (near[j] && !bgm[j]) { bgm[j] = 1; stack[top++] = j; } }
    while (top) {
      j = stack[--top]; x = j % w;
      if (x > 0 && near[j - 1] && !bgm[j - 1]) { bgm[j - 1] = 1; stack[top++] = j - 1; }
      if (x < w - 1 && near[j + 1] && !bgm[j + 1]) { bgm[j + 1] = 1; stack[top++] = j + 1; }
      if (j >= w && near[j - w] && !bgm[j - w]) { bgm[j - w] = 1; stack[top++] = j - w; }
      if (j < n - w && near[j + w] && !bgm[j + w]) { bgm[j + w] = 1; stack[top++] = j + w; }
    }
    // Inside the drawing a tighter match, so dark lines close to a dark background stay part of the drawing.
    for (i = 0; i < n; i++) bgAll[i] = bgm[i] || (body[i] && dist(i) <= tight) ? 1 : 0;
    var bgL = 0.2126 * br + 0.7152 * bgG + 0.0722 * bb, bgLight = bgL >= 128;

    // 2. Dark and light inside the drawing, and whether it has real contrast (judged away from its rim).
    var hist = [], cnt = 0;
    for (i = 0; i < 256; i++) hist[i] = 0;
    for (i = 0; i < n; i++) if (!bgAll[i]) { hist[L[i]]++; cnt++; }
    if (!cnt) return ink;
    var cut = otsu(hist, cnt);
    // A shaded picture (a photo, a 3-D egg) fades from light to dark instead of having drawn edges, so its main
    // idea is its outline and the details darker than their surroundings (eyes, a smile), not its shading.
    var soft = [];
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      j = y * w + x;
      if (bgAll[j] || L[j] > cut) continue;
      if ((!bgAll[j - 1] && L[j - 1] > cut) || (!bgAll[j + 1] && L[j + 1] > cut) || (!bgAll[j - w] && L[j - w] > cut) || (!bgAll[j + w] && L[j + w] > cut))
        soft.push(Math.abs(L[j + 1] - L[j - 1]) + Math.abs(L[j + w] - L[j - w]));
    }
    if (soft.length >= 50) {
      soft.sort(num);
      if (soft[soft.length >> 2] < 25) return sketch(w, h, L, bgAll, bgm);
    }
    var rim = grow(w, h, grow(w, h, bgAll)), cd = 0, cl = 0, sd = 0, sl = 0;
    for (i = 0; i < n; i++) {
      if (rim[i]) continue;
      if (L[i] <= cut) { cd++; sd += L[i]; } else { cl++; sl += L[i]; }
    }
    var core = cd + cl;
    if (core < 50 || !cd || !cl || cd < core * 0.03 || cl < core * 0.03 || sl / cl - sd / cd < 40) {
      for (i = 0; i < n; i++) ink[i] = bgAll[i] ? 0 : 1;   // a one-tone drawing: engrave all of it
      return ink;
    }
    for (i = 0; i < n; i++) {
      if (bgAll[i] || L[i] > cut) continue;
      if (!bgLight && rim[i] && L[i] > bgL + 40) continue;   // the soft rim of light shapes on a dark background
      ink[i] = 1;
    }
    // 3. On a light background, light colours beside the logo (a yellow sun) are engraved and light shapes inside
    //    it stay clear; a light area holding details (lettering on a gold button) gets only its outline, so the
    //    details stay readable.
    if (bgLight) {
      var light = new Uint8Array(n), id = new Int32Array(n), sizes = [0], touches = [0], holds = [0], nid = 0;
      for (i = 0; i < n; i++) light[i] = !bgAll[i] && !ink[i] ? 1 : 0;
      patches(w, h, light, function (list, len) {
        var out = 0;
        nid++;
        for (var m = 0; m < len; m++) {
          var q = list[m], qx = q % w;
          id[q] = nid;
          if (!out && ((qx > 0 && bgm[q - 1]) || (qx < w - 1 && bgm[q + 1]) || (q >= w && bgm[q - w]) || (q < n - w && bgm[q + w]))) out = 1;
        }
        sizes.push(len); touches.push(out); holds.push(0);
      });
      // Dark parts that don't reach the background around the logo sit inside the light areas they touch.
      patches(w, h, ink, function (list, len) {
        var seen = [], free = false;
        for (var m = 0; m < len && !free; m++) {
          var q = list[m], qx = q % w, nb = [qx > 0 ? q - 1 : -1, qx < w - 1 ? q + 1 : -1, q >= w ? q - w : -1, q < n - w ? q + w : -1];
          for (var k = 0; k < 4; k++) {
            if (nb[k] < 0) continue;
            if (bgm[nb[k]]) { free = true; break; }
            if (id[nb[k]]) seen.push(id[nb[k]]);
          }
        }
        if (!free) for (m = 0; m < seen.length; m++) holds[seen[m]] = 1;
      });
      var edgeBand = outlineBand(w, h, bgm), minPatch = Math.max(16, n * 0.0005);
      for (i = 0; i < n; i++) {
        var pid = id[i];
        if (!pid || !touches[pid] || sizes[pid] < minPatch) continue;
        if (!holds[pid] || edgeBand[i]) ink[i] = 1;
      }
    }
    return ink;
  }
  // Logos on a see-through background: greys with the see-through parts backed with black (a light logo) or
  // white; dark and light split by Otsu's method; the side filling the edges is the background. Coloured parts
  // left with the background but clearly another colour, beside the logo, are engraved too.
  function seeThroughMask(w, h, d, body, L, edge) {
    var n = w * h, solid = 0, lum = 0, i, j, x;
    for (i = 0; i < n; i++) if (body[i]) { solid++; lum += L[i]; }
    var backing = solid && lum / solid > 153 ? 0 : 255, v = new Uint8Array(n), hist = [];
    for (i = 0; i < 256; i++) hist[i] = 0;
    for (i = 0; i < n; i++) { v[i] = body[i] ? L[i] : backing; hist[v[i]]++; }
    var cut = otsu(hist, n), darkEdge = 0;
    for (i = 0; i < edge.length; i++) if (v[edge[i]] <= cut) darkEdge++;
    var inkDark = darkEdge * 2 <= edge.length, ink = new Uint8Array(n);
    for (i = 0; i < n; i++) if (body[i] && (inkDark ? v[i] <= cut : v[i] > cut)) ink[i] = 1;
    // The background colour: the average of the edge pixels left clear (the backing where see-through).
    var s0 = 0, s1 = 0, s2 = 0, count = 0;
    for (i = 0; i < edge.length; i++) {
      j = edge[i];
      if (ink[j]) continue;
      if (body[j]) { s0 += d[j * 4]; s1 += d[j * 4 + 1]; s2 += d[j * 4 + 2]; } else { s0 += backing; s1 += backing; s2 += backing; }
      count++;
    }
    if (!count) return ink;
    s0 /= count; s1 /= count; s2 /= count;
    var apart = new Uint8Array(n), open = new Uint8Array(n), outside = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      if (ink[i] || !body[i]) continue;
      var d0 = d[i * 4] - s0, d1 = d[i * 4 + 1] - s1, d2 = d[i * 4 + 2] - s2;
      if (d0 * d0 + d1 * d1 + d2 * d2 > 6400) apart[i] = 1;   // more than 80 apart (of 441)
    }
    // The background around the logo: clear, background-coloured patches that reach the picture's edges.
    for (i = 0; i < n; i++) open[i] = !ink[i] && !apart[i] ? 1 : 0;
    patches(w, h, open, function (list, len) {
      for (var m = 0; m < len; m++) {
        var q = list[m]; x = q % w;
        if (x === 0 || x === w - 1 || q < w || q >= n - w) {
          for (m = 0; m < len; m++) outside[list[m]] = 1;
          return;
        }
      }
    });
    engraveBeside(w, h, ink, apart, outside);
    return ink;
  }
  // Smooth the edges (each pixel follows most of its 3 x 3 block), then drop specks and fill pinholes.
  function cleanUp(w, h, ink) {
    var n = w * h, out = new Uint8Array(n), gaps = new Uint8Array(n), speck = Math.max(9, n * 0.0001), x, y, i;
    for (y = 0; y < h; y++) {
      var ya = y > 0 ? y - 1 : 0, yb = y < h - 1 ? y + 1 : h - 1;
      for (x = 0; x < w; x++) {
        var xa = x > 0 ? x - 1 : 0, xb = x < w - 1 ? x + 1 : w - 1, on = 0, all = 0;
        for (var yy = ya; yy <= yb; yy++) for (var xx = xa; xx <= xb; xx++) { on += ink[yy * w + xx]; all++; }
        out[y * w + x] = on * 2 > all ? 1 : 0;
      }
    }
    patches(w, h, out, function (list, len) { if (len < speck) for (var m = 0; m < len; m++) out[list[m]] = 0; });
    for (i = 0; i < n; i++) gaps[i] = out[i] ? 0 : 1;
    patches(w, h, gaps, function (list, len) {
      if (len >= speck) return;
      for (var m = 0; m < len; m++) {
        var j = list[m], jx = j % w;
        if (jx === 0 || jx === w - 1 || j < w || j >= n - w) return;   // open to the outside: not a pinhole
      }
      for (m = 0; m < len; m++) out[list[m]] = 1;
    });
    return out;
  }
  // The logo in black (engraved) on clear, trimmed (2 px margin): { src, aspect, ok } (ok false = nothing to engrave).
  function trimmedPng(out, w, h) {
    var x0 = w, y0 = h, x1 = -1, y1 = -1, x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (!out[y * w + x]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    var cv = document.createElement('canvas');
    if (x1 < 0) { cv.width = cv.height = 1; return { src: cv.toDataURL('image/png'), aspect: w / h, ok: false }; }
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(w - 1, x1 + 2); y1 = Math.min(h - 1, y1 + 2);
    var tw = x1 - x0 + 1, th = y1 - y0 + 1;
    cv.width = tw; cv.height = th;
    var cx = cv.getContext('2d'), im = cx.createImageData(tw, th), o = im.data;
    for (y = 0; y < th; y++) for (x = 0; x < tw; x++) if (out[(y + y0) * w + x + x0]) o[(y * tw + x) * 4 + 3] = 255;
    cx.putImageData(im, 0, 0);
    return { src: cv.toDataURL('image/png'), aspect: tw / th, ok: true };
  }
  function digitize(img) {
    var im = logoImage(img);
    return trimmedPng(cleanUp(im.w, im.h, engraveMask(im)), im.w, im.h);
  }
  // A logo kept from an earlier visit. Logos kept before the preview showed them in black and white (in colour)
  // are converted now; until then they show as before.
  function reviveLogo(p) {
    var l = logos[p];
    if (!l) return;
    if (l.bw || l.orig) {   // already black and white (orig, adj and swap came from a short-lived version)
      l.bw = true; delete l.orig; delete l.adj; delete l.swap;
      return;
    }
    l.raw = true;
    var img = new Image();
    img.onload = function () {
      if (logos[p] !== l) return;
      try {
        var r = digitize(img);
        l.src = r.src; l.aspect = r.aspect; l.ok = r.ok; l.bw = true;
        delete l.raw; delete l.mode;
      } catch (e) { return; }
      update();
    };
    img.src = l.src;
  }

  // Logo preview: read the file on this device and show it in black and white, as it would be engraved.
  slotsBox.addEventListener('change', function (e) {
    var input = e.target;
    if (input.type !== 'file') return;
    var p = input.getAttribute('data-slot'), err = document.getElementById('logo-' + p + '-error');
    var f = input.files && input.files[0];
    err.textContent = '';
    document.getElementById('logo-' + p + '-kept').hidden = true;
    if (!f) { delete logos[p]; update(); return; }
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) {
      err.textContent = 'Please choose a PNG, JPG, WebP or SVG image.'; input.value = ''; return;
    }
    if (f.size > 15 * 1024 * 1024) {
      err.textContent = 'That file is over 15 MB. Please choose a smaller one, or just send it to us after ordering.'; input.value = ''; return;
    }
    var url = URL.createObjectURL(f), img = new Image();
    img.onload = function () {
      var l = { name: f.name };
      try {
        var r = digitize(img);
        l.src = r.src; l.aspect = r.aspect; l.ok = r.ok; l.bw = true;
        URL.revokeObjectURL(url);
      } catch (ex) {
        // The browser wouldn't let us read the picture: show it as it is, engraved by its dark parts.
        l.src = url; l.raw = true; l.ok = true; l.aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
      }
      logos[p] = l;
      if (!l.ok) err.textContent = 'This image looks blank on the preview. You can still send it to us after ordering.';
      trackPick('logo_upload', 'customer_logo', p);
      update();
      saveDraftSoon();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      err.textContent = 'Sorry, we couldn\'t open that image. Please try another file, or send it to us after ordering.';
      input.value = '';
    };
    img.src = url;
  });

  // Show each lettering choice in its own font once the designer is close to the screen, so the
  // font files are only downloaded by people who scroll to it; re-measure the preview when fonts arrive.
  function styleFontChoices() {
    Array.prototype.forEach.call(form.querySelectorAll('input[data-font]'), function (r) {
      var f = FONTS[r.value], span = r.nextElementSibling;
      if (!f || !span) return;
      span.style.fontFamily = f.family;
      span.style.fontWeight = f.weight;
      span.style.fontSize = (1.05 * Math.min(f.scale, 1.5)).toFixed(2) + 'rem';
    });
  }
  if ('IntersectionObserver' in window) {
    var near = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { near.disconnect(); styleFontChoices(); }
    }, { rootMargin: '600px 0px' });
    near.observe(form);
  } else styleFontChoices();
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', function () { drawThumbs(); update(); });

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

  /* ---------- Saved designs: carry on where you left off, and change an apron already in the cart ---------- */
  // Kept on this device by VL.saved (main.js). editingRef is the design in the cart being changed:
  // submitting then replaces that apron and its extras in the cart instead of adding another one.
  var SAVE = VL.saved, editingRef = null, lastRef = null, restoredDraft = false, busy = false, draftTimer = null;
  var savedBar = document.getElementById('saved-bar');
  var STYLE_SHORT = { bbq: 'BBQ apron', bbqpattern: 'patterned BBQ apron', barber: 'barber apron', simple: 'simple apron', split: 'split-leg apron', wood: 'woodworking apron' };
  function styleLabel(st) { return STYLE_SHORT[st.style] + ' (' + SHORT[st.main] + ')'; }
  function newRef() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint8Array(4), out = 'VL-';
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < 4; i++) a[i] = Math.floor(Math.random() * 256);
    for (var j = 0; j < 4; j++) out += chars[a[j] % chars.length];
    return out;
  }
  // Everything the customer entered (logo previews too, when they fit in the browser's storage).
  function snapshot() {
    var fields = {}, kept = {}, names = {};
    Array.prototype.forEach.call(form.elements, function (f) {
      if (!f.name || f.type === 'file' || f.type === 'submit' || f.type === 'button') return;
      if (f.type === 'radio') { if (f.checked) fields[f.name] = f.value; }
      else if (f.type === 'checkbox') fields[f.name] = f.checked;
      else fields[f.name] = f.value;
    });
    Object.keys(logos).forEach(function (p) {
      names[p] = logos[p].name;
      if (/^data:image\//.test(logos[p].src)) kept[p] = logos[p];
    });
    return { time: Date.now(), fields: fields, touched: modeTouched, picked: colourPicked, logos: kept, logoNames: names };
  }
  function clearErrors() {
    Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid="true"]'), function (i) { i.setAttribute('aria-invalid', 'false'); });
    Array.prototype.forEach.call(form.querySelectorAll('.error'), function (e) { e.textContent = ''; });
    setStatus('');
  }
  function restore(snap) {
    var f = snap.fields || {};
    // Designs saved when the patterned BBQ apron was a "finish" of the BBQ apron.
    if (f.style === 'bbq' && f.finish === 'patterned') f.style = 'bbqpattern';
    Object.keys(f).forEach(function (name) {
      var input = form.elements[name];
      if (!input) return;
      if (input.length && !input.tagName) Array.prototype.forEach.call(input, function (r) { r.checked = r.value === f[name]; });
      else if (input.type === 'radio') input.checked = input.value === f[name];
      else if (input.type === 'checkbox') input.checked = !!f[name];
      else input.value = f[name];
    });
    var k;
    for (k in modeTouched) delete modeTouched[k];
    for (k in snap.touched || {}) modeTouched[k] = snap.touched[k];
    for (k in colourPicked) colourPicked[k] = !!(snap.picked || {})[k];
    for (k in logos) delete logos[k];
    SLOT_KEYS.forEach(function (p) {
      var l = (snap.logos || {})[p], name = (snap.logoNames || {})[p], note = document.getElementById('logo-' + p + '-kept');
      document.getElementById('logo-' + p).value = '';
      if (l) logos[p] = l;
      note.textContent = l ? 'Showing the logo you added before (' + l.name + '). Choose a file to change it.'
        : name ? 'Choose your logo file (' + name + ') again to see it on the preview.' : '';
      note.hidden = !note.textContent;
      reviveLogo(p);
    });
    clearErrors();
    update();
  }
  // A fresh apron: everything back to the start except the style, email and phone.
  function startNew() {
    var style = val('style') || 'bbq', email = form.elements.email.value, phone = form.elements.phone.value, k;
    form.reset();
    form.querySelector('input[name="style"][value="' + style + '"]').checked = true;
    form.elements.email.value = email;
    form.elements.phone.value = phone;
    for (k in modeTouched) delete modeTouched[k];
    for (k in colourPicked) colourPicked[k] = false;
    for (k in logos) delete logos[k];
    SLOT_KEYS.forEach(function (p) { document.getElementById('logo-' + p + '-kept').hidden = true; });
    applyDefaults(style, true);
    followAccessory();
    editingRef = null;
    restoredDraft = false;
    clearTimeout(draftTimer);
    if (SAVE) SAVE.setDraft(null);
    clearErrors();
    update();
    renderBar();
  }
  function startEditing(d) {
    restore(d.snap);
    editingRef = d.ref;
    restoredDraft = false;
    added.hidden = true;
    form.hidden = false;
    renderBar();
  }
  // Called after each change the customer makes, so the design is still here if they leave the page.
  function saveDraftSoon() {
    if (!SAVE || busy) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      var d = snapshot();
      d.editing = editingRef;
      SAVE.setDraft(d);
    }, 700);
  }
  // The bar above the form: which apron is being changed, or the ones already in the cart.
  function renderBar() {
    if (!savedBar) return;
    var list = SAVE ? SAVE.designs() : [], editing = editingRef && SAVE ? SAVE.find(editingRef) : null;
    if (editingRef && !editing) editingRef = null;
    submit.textContent = editing ? 'Update my apron in the cart' : 'Add to cart';
    savedBar.textContent = '';
    function para(text, strong) {
      var p = document.createElement('p');
      if (strong) { var b = document.createElement('strong'); b.textContent = strong; p.appendChild(b); p.appendChild(document.createTextNode(' ')); }
      p.appendChild(document.createTextNode(text));
      savedBar.appendChild(p);
    }
    var row = document.createElement('div');
    row.className = 'btn-row';
    function button(text, onClick, dark) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (dark ? 'btn-dark' : 'btn-ghost');
      b.textContent = text;
      b.addEventListener('click', onClick);
      row.appendChild(b);
    }
    if (editing) {
      para('Make your changes, then press "Update my apron in the cart". It replaces the one in your cart.', 'You\'re changing the ' + editing.label + ' in your cart.');
      button('Design a new apron instead', function () { startNew(); savedBar.focus(); });
    } else {
      if (list.length) {
        para(list.length > 1 ? 'You have ' + list.length + ' aprons in your cart. Want to change one?' : 'Your ' + list[0].label + ' is in your cart. Want to change something?');
        list.forEach(function (d) {
          button(list.length > 1 ? 'Change your ' + d.label : 'Change my design', function () { startEditing(d); savedBar.focus(); }, true);
        });
      }
      if (restoredDraft) {
        para('We kept the design you were working on' + (list.length ? ' below.' : '.'));
        button('Start again', function () { startNew(); form.querySelector('input[name="style"]:checked').focus(); });
      }
    }
    if (row.firstChild) savedBar.appendChild(row);
    savedBar.hidden = !savedBar.firstChild;
    savedBar.tabIndex = -1;
  }
  // main.js drops designs whose apron has left the cart (for example, removed at checkout).
  document.addEventListener('vl:saved-designs', function () { if (!busy) renderBar(); });

  var status = document.getElementById('designer-status');
  var submit = document.getElementById('designer-submit');
  var added = document.getElementById('designer-added');

  function setStatus(msg, kind) { status.textContent = msg; status.setAttribute('data-kind', kind || ''); }

  function addProduct(E, id, options, quantity) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var t = setTimeout(function () { if (!done) reject(new Error('timeout')); }, 12000);
      E.Cart.addProduct({ id: id, quantity: quantity || 1, options: options, callback: function (success) {
        done = true; clearTimeout(t);
        success === false ? reject(new Error('rejected')) : resolve();
      } });
    });
  }
  // What goes in the cart for a design: the apron, then its extras (Ecwid product IDs and options).
  function cartLines(st, options) {
    var lines = [{ id: STYLES[st.style].id, options: options, qty: 1 }], n = engravings(st).extra;
    if (st.wings) lines.push({ id: 688211109, options: { Color: COLORS[wingColor(st)].addon }, qty: 1 });
    if (st.opener) lines.push({ id: 619483308, options: { Color: COLORS[openerColor(st)].addon }, qty: 1 });
    if (st.grease) lines.push({ id: 619498559, options: {}, qty: 1 });
    if (n) lines.push({ id: ENGRAVING_ID, options: {}, qty: n });
    return lines;
  }
  function addLines(E, lines) {
    return lines.reduce(function (done, l) {
      return done.then(function () { return addProduct(E, l.id, l.options, l.qty); });
    }, Promise.resolve());
  }
  function sameOptions(have, want) {
    have = have || {};
    return Object.keys(want || {}).every(function (k) { return have[k] === want[k]; });
  }
  // Take a design that's being changed out of the cart: its apron and the extras added with it (any of the
  // same extras that belong to other aprons are put back). Resolves with the apron's quantity in the
  // cart, so the updated apron keeps it.
  function takeOut(E, d) {
    return new Promise(function (resolve, reject) {
      E.Cart.get(function (cart) {
        var items = cart && cart.items || [], at = SAVE.lineIndex(d, cart);
        if (at === -1) return resolve(1);
        var drop = [at], back = [], qty = items[at].quantity || 1;
        (d.cart.extras || []).forEach(function (x) {
          for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (drop.indexOf(i) !== -1 || !it.product || it.product.id !== x.id || !sameOptions(it.options, x.options)) continue;
            drop.push(i);
            if (it.quantity > x.qty) back.push({ id: x.id, options: x.options, qty: it.quantity - x.qty });
            return;
          }
        });
        var t = setTimeout(function () { reject(new Error('timeout')); }, 12000);
        E.Cart.removeProducts(drop, function () {
          clearTimeout(t);
          addLines(E, back).then(function () { resolve(qty); }, reject);
        });
      });
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var st = read();
    // Suggested designs: the name is required, the year (if given) must be 4 digits.
    var missing = null;
    positionsOf(st.style).forEach(function (p) {
      var sl = st.slots[p], d = DESIGNS[sl.design];
      if (missing || sl.mode !== 'design' || !d) return;
      (d.fields || []).forEach(function (f) {
        var input = form.elements['d-' + f.key + '-' + p], err = document.getElementById('d-' + f.key + '-' + p + '-error');
        var bad = (f.required && !sl.fields[f.key]) || (f.numeric && sl.fields[f.key] && !/^[0-9]{4}$/.test(sl.fields[f.key]));
        input.setAttribute('aria-invalid', bad ? 'true' : 'false');
        err.textContent = bad ? (f.numeric ? 'Please enter a 4-digit year, for example 1986, or leave it empty.' : 'Please enter the ' + f.label.toLowerCase() + ' for the ' + d.label + ' design.') : '';
        if (bad && !missing) missing = input;
      });
    });
    if (missing) {
      setStatus('Please fill in the highlighted design details.', 'error');
      missing.focus();
      return;
    }
    var bad = ['height', 'weight', 'email', 'phone'].map(function (n) { return form.elements[n]; })
      .filter(function (f) { return !validateField(f); });
    if (bad.length) {
      setStatus('Please check the highlighted fields.', 'error');
      bad[0].focus();
      return;
    }
    var style = STYLES[st.style];
    // Changing a design that's in the cart keeps its ref, and replaces it there instead of adding another.
    var editing = editingRef && SAVE ? SAVE.find(editingRef) : null, ref = editing ? editing.ref : newRef();
    var options = {
      'Main Color': COLORS[st.main].ecwid,
      'Customer Height': st.height,
      'Customer Weight': st.weight,
      'Description For Personalization': describe(st, ref),
      'Email for design confirmation': st.email,
      'Phone Number for shipping confirmation': st.phone
    };
    options[style.secondary] = COLORS[st.acc].ecwid;
    var lines = cartLines(st, options);

    submit.disabled = true;
    busy = true;
    setStatus(editing ? 'Updating your cart…' : 'Adding to your cart…');
    VL.loadEcwid().then(function (E) {
      if (!editing) return addLines(E, lines);
      VL.cartBusy = true;
      return takeOut(E, editing).then(function (qty) { lines[0].qty = qty; return addLines(E, lines); });
    }).then(function () {
      if (SAVE) {
        var list = SAVE.designs().filter(function (d) { return d.ref !== ref; });
        list.push({ ref: ref, time: Date.now(), label: styleLabel(st), snap: snapshot(),
          cart: { apronId: lines[0].id, extras: lines.slice(1) } });
        SAVE.setDesigns(list);
        clearTimeout(draftTimer);
        SAVE.setDraft(null);
      }
      lastRef = ref;
      editingRef = null;
      restoredDraft = false;
      setStatus('');
      showLogoStep(st, ref);
      added.querySelector('h3').textContent = editing ? 'Your apron is updated in the cart ✓' : 'Added to your cart ✓';
      form.hidden = true;
      added.hidden = false;
      added.querySelector('h3').focus();
      added.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function () {
      setStatus('Sorry, we couldn\'t reach the cart (an ad blocker can cause this). Please send us your design on WhatsApp instead. It\'s already written for you.', 'error');
      if (waLink) waLink.focus();
    }).then(function () {
      submit.disabled = false;
      busy = false;
      setTimeout(function () { VL.cartBusy = false; }, 1500);
      renderBar();
    });
  });

  // Logo files can't travel with the cart (adding from this page carries text and choices only), so
  // when a spot uses a logo, the last step is sending the file on WhatsApp or by email.
  function showLogoStep(st, ref) {
    var box = document.getElementById('logo-next');
    if (!box) return;
    var spots = positionsOf(st.style).filter(function (p) { return st.slots[p].mode === 'logo'; });
    box.hidden = !spots.length;
    if (!spots.length) return;
    var where = spots.map(spotName).join(' and ');
    var text = 'Hi Virtual Leather! I\'ve just added a ' + STYLES[st.style].name + ' to my cart on your website (design ref ' + ref + '). Here is my logo for ' + where + ':';
    document.getElementById('logo-next-where').textContent = where;
    document.getElementById('logo-wa').href = 'https://wa.me/' + C.whatsappNumber + '?text=' + encodeURIComponent(text);
    document.getElementById('logo-mail').href = 'mailto:' + C.email + '?subject=' + encodeURIComponent('My logo for my apron order') +
      '&body=' + encodeURIComponent(text + '\n\n(Logo file attached.)\n\nName on the order: ');
  }

  // Photo viewer for the real photos under the preview.
  var viewer = document.getElementById('photo-viewer'), viewerImg = document.getElementById('photo-viewer-img');
  var viewerCap = document.getElementById('photo-viewer-caption'), viewerList = [], viewerAt = 0;
  function showPhoto(i) {
    viewerAt = (i + viewerList.length) % viewerList.length;
    var b = viewerList[viewerAt];
    viewerImg.src = b.getAttribute('data-full');
    viewerImg.alt = b.getAttribute('data-alt');
    viewerCap.textContent = b.getAttribute('data-alt');
  }
  if (viewer && viewer.showModal) {
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.gallery-thumb') : null;
      if (!t) return;
      viewerList = Array.prototype.slice.call(t.closest('.gallery-strip').querySelectorAll('.gallery-thumb'));
      showPhoto(viewerList.indexOf(t));
      viewer.showModal();
    });
    viewer.addEventListener('click', function (e) {
      if (e.target === viewer || e.target.hasAttribute('data-photo-close')) viewer.close();
      else if (e.target.hasAttribute('data-photo-step')) showPhoto(viewerAt + Number(e.target.getAttribute('data-photo-step')));
    });
    viewer.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') showPhoto(viewerAt + 1);
      if (e.key === 'ArrowLeft') showPhoto(viewerAt - 1);
    });
  } else {
    // Older browsers without <dialog>: open the big photo on its own.
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.gallery-thumb') : null;
      if (t) window.open(t.getAttribute('data-full'), '_blank', 'noopener');
    });
  }

  document.getElementById('designer-again').addEventListener('click', function () {
    startNew();
    added.hidden = true; form.hidden = false;
    form.querySelector('input[name="style"]:checked').focus();
  });
  document.getElementById('designer-edit').addEventListener('click', function () {
    editingRef = SAVE && SAVE.find(lastRef) ? lastRef : null;
    added.hidden = true; form.hidden = false;
    renderBar();
    (savedBar.hidden ? form.querySelector('input[name="style"]:checked') : savedBar).focus();
  });

  VL.designer = {
    // finish 'patterned' with 'bbq' (links from before the patterned BBQ apron was its own style) opens it.
    setStyle: function (s, finish) {
      if (s === 'bbq' && finish === 'patterned') s = 'bbqpattern';
      var r = form.querySelector('input[name="style"][value="' + s + '"]');
      if (!r) return;
      if (!r.checked) { r.checked = true; applyDefaults(s, false); trackView(s); }
      update();
    }
  };
  // Deep link: /#design?style=barber is not valid hash syntax, so use data-style buttons or ?style=
  // Pick up where the customer left off: the apron they asked to change (?edit=ref, from the shop), or
  // the design they were working on.
  if (SAVE) {
    var askEdit = /[?&]edit=([\w-]+)/.exec(location.search), toEdit = askEdit && SAVE.find(askEdit[1]), draft = SAVE.draft();
    if (draft && (!toEdit || draft.editing === toEdit.ref)) {
      restore(draft);
      editingRef = draft.editing && SAVE.find(draft.editing) ? draft.editing : null;
      restoredDraft = !editingRef;
    } else if (toEdit) {
      startEditing(toEdit);
    }
    renderBar();
    // The design reference has done its job: keep it out of the address (and so out of analytics).
    if (askEdit && history.replaceState) {
      history.replaceState(history.state, '', location.pathname + location.search.replace(/([?&])edit=[^&]*&?/, '$1').replace(/[?&]$/, '') + location.hash);
    }
  }
  var qs = /[?&]style=(\w+)/.exec(location.search), qf = /[?&]finish=(\w+)/.exec(location.search);
  if (qs) VL.designer.setStyle(qs[1], qf && qf[1]);

  update();
})();
