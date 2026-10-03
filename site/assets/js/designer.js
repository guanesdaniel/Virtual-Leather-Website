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
    wood:   { id: 619498560, name: 'Woodworking apron', positions: 2, secondary: 'Secondary Color (Attachment/Pockets)' }
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

  /* ---------- SVG preview (drawn after the Virtual Leather reference illustrations) ---------- */
  var W = 1200, H = 1800;
  var STRAP_BLACK = '#1b1918'; // neck and waist straps are always black
  var BIB = 'M350,236 Q350,220 366,220 Q600,242 834,220 Q850,220 850,236 L850,560 C860,760 1000,900 1160,950 ' +
    'L1160,1742 Q1160,1760 1142,1760 L58,1760 Q40,1760 40,1742 L40,950 C200,900 340,760 350,560 Z';
  var STRAP_L = 'M390,300 V215 C390,165 440,125 545,98';
  var STRAP_R = 'M810,300 V215 C810,165 760,125 655,98';
  var OUTER_L = 'M545,45 C340,20 205,45 175,170 C150,280 145,430 140,560 L135,650 C130,770 45,775 45,690 L45,620';
  var OUTER_R = 'M655,45 C860,20 995,45 1025,170 C1050,280 1055,430 1060,560 L1065,650 C1070,770 1155,775 1155,690 L1155,620';

  // Engraving boxes that differ per style (to stay clear of that style's pockets and straps).
  var POS_OVERRIDES = {
    bbq:    { 3: { x: 381, y: 1005 }, 4: { x: 851, y: 1000 } },
    split:  { 1: { y: 420 }, 2: { y: 505, h: 60 }, 3: { x: 170, y: 1010, w: 210 }, 4: { x: 1030, y: 1010, w: 210 } },
    simple: { 3: { x: 378, y: 935, w: 250, h: 64 }, 4: { x: 822, y: 935, w: 250, h: 64 } },
    wood:   { 1: { y: 330, w: 300, h: 85 }, 2: { y: 440, w: 300, h: 70 } }
  };
  function posFor(styleKey, p) {
    var o = (POS_OVERRIDES[styleKey] || {})[p];
    if (!o) return POS[p];
    var b = {}; for (var k in POS[p]) b[k] = POS[p][k];
    for (var j in o) b[j] = o[j];
    return b;
  }
  // Where the optional bottle opener hangs on each style.
  var OPENER_AT = { bbq: [598, 1170], barber: [424, 745], simple: [1010, 990], split: [185, 1410], wood: [150, 985] };

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
  function hstrap(g, x, y, w, h, acc) {
    plate(g, x, y, w, h, acc, 6);
    el('path', { d: 'M' + (x + 35) + ',' + (y + h / 2) + ' h22 M' + (x + 70) + ',' + (y + h / 2) + ' h22', stroke: 'rgba(0,0,0,.6)', 'stroke-width': 3 }, g);
    rivet(g, x + w - 24, y + h / 2, 7);
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
  function opener(g, x, y, acc) {
    plate(g, x - 26, y, 52, 40, acc, 5);
    rivet(g, x - 11, y + 20, 6); rivet(g, x + 11, y + 20, 6);
    el('path', { d: 'M' + (x - 26) + ',' + (y + 42) + ' h52 v10 h-6 v-4 h-40 v4 h-6 Z', fill: 'url(#metal)', stroke: '#8a8a8a', 'stroke-width': 1.5 }, g);
    el('rect', { x: x - 22, y: y + 52, width: 44, height: 180, rx: 6, fill: STRAP_BLACK, stroke: '#000', 'stroke-width': 2, filter: 'url(#drop)' }, g);
    el('rect', { x: x - 18, y: y + 56, width: 6, height: 172, rx: 3, fill: 'rgba(255,255,255,.08)' }, g);
    rivet(g, x, y + 212, 7);
    el('circle', { cx: x, cy: y + 262, r: 34, fill: 'url(#metal)', stroke: '#8f8f8f', 'stroke-width': 3, filter: 'url(#drop)' }, g);
    el('circle', { cx: x, cy: y + 262, r: 24, fill: '#efefef', stroke: '#b5b5b5', 'stroke-width': 2 }, g);
    el('path', { d: 'M' + x + ',' + (y + 392) + ' L' + (x - 30) + ',' + (y + 364) + ' A40,40 0 1 1 ' + (x + 30) + ',' + (y + 364) + ' Z',
      fill: 'none', stroke: 'url(#metal)', 'stroke-width': 8, 'stroke-linejoin': 'round' }, g);
  }
  // Optional leather wings at the back cross-over (as the owner's reference): three layered
  // tiers of scalloped feathers on each side, joined by two rivets in the middle.
  function wings(g, acc) {
    function tier(len, top, h, n) {
      var cx = 600, x0 = cx - len;
      var d = 'M' + cx + ',' + top + ' C' + (cx - len * 0.35) + ',' + (top - h * 0.55) + ' ' + (cx - len * 0.8) + ',' + (top - h * 0.45) + ' ' + x0 + ',' + (top + h * 0.05);
      var seg = len / n, base = top + h * 0.5;
      for (var i = 0; i < n; i++) {
        var xa = x0 + i * seg, xb = xa + seg, yb = base + (i + 1) * (h * 0.5 / n);
        d += ' Q' + (xa + seg * 0.25) + ',' + (yb + h * 0.55) + ' ' + xb + ',' + yb;
      }
      return d + ' L' + cx + ',' + (top + h) + ' Z';
    }
    var tiers = [tier(150, 112, 40, 4), tier(205, 92, 42, 5), tier(250, 68, 46, 6)];
    [1, -1].forEach(function (s) {
      var w = el('g', { transform: (s < 0 ? 'translate(1200 0) scale(-1 1) ' : '') + 'rotate(14 600 100)' }, g);
      tiers.forEach(function (d) {
        el('path', { d: d, fill: 'url(#accGrad)', stroke: acc.edge, 'stroke-width': 3, 'stroke-linejoin': 'round', filter: 'url(#drop)' }, w);
      });
    });
    el('ellipse', { cx: 600, cy: 104, rx: 34, ry: 22, fill: 'url(#accGrad)', stroke: acc.edge, 'stroke-width': 3 }, g);
    rivet(g, 587, 104, 7); rivet(g, 613, 104, 7);
  }

  function draw(st) {
    var style = STYLES[st.style], main = COLORS[st.main], acc = COLORS[st.acc];
    stage.textContent = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-labelledby': 'apron-title apron-desc' }, stage);
    el('title', { id: 'apron-title' }, svg).textContent = 'Preview of your ' + style.name;
    el('desc', { id: 'apron-desc' }, svg).textContent = main.label + ' leather with ' + acc.label.toLowerCase() + ' accessories and black straps' +
      (st.wings ? ', leather wings' : '') + (st.opener ? ', bottle opener' : '') +
      (st.text ? ', engraved "' + st.text.replace(/\n/g, ' ') + '" at position ' + st.pos + ' (' + POS[st.pos].label.toLowerCase() + ')' : ', no engraving') + '.';

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

    // Black harness straps with sliders, and the back piece (hexagon, or wings if chosen).
    var harness = el('g', { fill: 'none', 'stroke-linejoin': 'round' }, svg);
    [OUTER_L, OUTER_R, STRAP_L, STRAP_R].forEach(function (d) { tube(harness, d); });
    [[143, 460], [1057, 460]].forEach(function (p) {
      el('rect', { x: p[0] - 13, y: p[1] - 26, width: 26, height: 52, rx: 13, fill: 'none', stroke: 'url(#metal)', 'stroke-width': 6 }, svg);
    });
    if (st.wings) wings(svg, acc);
    else shape(svg, 'M500,78 L535,15 H665 L700,78 L665,142 H535 Z', acc);

    // Apron body
    el('path', { d: BIB, fill: main.hex }, svg);
    var tex = el('g', { 'clip-path': 'url(#bibclip)' }, svg);
    el('rect', { x: 0, y: 0, width: W, height: H, filter: 'url(#mottle)' }, tex);
    el('rect', { x: 0, y: 0, width: W, height: H, filter: 'url(#grain)', opacity: '.5' }, tex);
    el('path', { d: BIB, fill: 'none', stroke: main.edge, 'stroke-width': 4 }, svg);
    [[388, 258], [388, 296], [812, 258], [812, 296]].forEach(function (p) { rivet(svg, p[0], p[1], 9); });

    var acs = el('g', {}, svg);
    // Waist tabs with D-rings
    [[25, 948], [1100, 948]].forEach(function (p, i) {
      el('path', { d: i ? 'M1175,958 a20,22 0 0 1 0,40' : 'M25,958 a20,22 0 0 0 0,40', fill: 'none', stroke: 'url(#metal)', 'stroke-width': 7 }, acs);
      plate(acs, p[0], p[1], 75, 58, acc, 5);
      rivet(acs, p[0] + 22, p[1] + 17, 6); rivet(acs, p[0] + 53, p[1] + 17, 6);
      rivet(acs, p[0] + 22, p[1] + 41, 6); rivet(acs, p[0] + 53, p[1] + 41, 6);
    });

    var op = OPENER_AT[st.style];
    if (st.style === 'bbq') {
      loops(acs, 368, 688, 210, 50, 3, acc);
      loops(acs, 578, 804, 305, 54, 3, acc);
      hstrap(acs, 82, 1055, 153, 48, acc); hstrap(acs, 507, 1055, 140, 48, acc);
      shape(acs, 'M278,1055 H472 V1082 H440 V1212 Q440,1230 422,1230 H398 L380,1200 L362,1230 H334 Q316,1230 316,1212 V1082 H278 Z', acc);
      el('ellipse', { cx: 378, cy: 1145, rx: 17, ry: 36, fill: main.edge }, acs);
      vstrap(acs, 316, 1280, 48, 155, acc); vstrap(acs, 388, 1280, 46, 155, acc);
      if (!st.opener) dring(acs, 598, 1215, acc);
      pocket(acs, 730, 1065, 260, 298, acc);
    } else if (st.style === 'barber') {
      if (!st.opener) dring(acs, 424, 790, acc);
      band(acs, 605, 780, 225, 24, acc);
      loops(acs, 165, 1040, 323, 75, 3, acc);
      band(acs, 162, 1182, 328, 78, acc, 2);
      pocket(acs, 662, 1037, 275, 256, acc);
      ringLoop(acs, 1081, 1052, acc);
    } else if (st.style === 'simple') {
      band(acs, 288, 850, 222, 20, acc);
      dring(acs, 728, 790, acc);
      shapedPocket(acs, 978, 1375, acc);
    } else if (st.style === 'split') {
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
    } else if (st.style === 'wood') {
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
    if (st.opener && op) opener(acs, op[0], op[1], acc);

    // Position guides
    var guides = el('g', { 'aria-hidden': 'true' }, svg);
    for (var p = 1; p <= style.positions; p++) {
      var q = posFor(st.style, p);
      var on = String(p) === String(st.pos);
      if (on && st.text) continue;
      el('rect', { x: q.x - q.w / 2, y: q.y - q.h / 2, width: q.w, height: q.h, rx: 8, fill: 'none',
        stroke: on ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.4)', 'stroke-dasharray': '14 10', 'stroke-width': on ? 4 : 3 }, guides);
      var t = el('text', { x: q.x, y: q.y + 14, 'text-anchor': 'middle', fill: on ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.6)', 'font-size': 40, 'font-weight': 700, 'font-family': 'Inter, sans-serif' }, guides);
      t.textContent = p;
    }

    // Engraving: dark burned-in lettering with a faint highlight.
    if (st.text) {
      var font = FONTS[st.font], box = posFor(st.style, st.pos);
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
