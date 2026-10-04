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
    bbq:    { id: 619498562, name: 'BBQ apron with beer holder', positions: 6, pocket: true, secondary: 'Secondary Color (Attachment/Pockets)' },
    barber: { id: 619492033, name: 'Barber apron', positions: 6, secondary: 'Secondary Color (Attachment/Pockets)', extras: ['wings', 'grease'] },
    simple: { id: 619505538, name: 'Simple apron', positions: 6, secondary: 'Secondary Color (Attachments/Pockets)' },
    split:  { id: 619501025, name: 'Split-leg forging & tattoo apron', positions: 2, secondary: 'Secondary Color (Attachment/Pockets)' },
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
      1: { fs: 84, maxW: 470, maxH: 170, logoH: 170 },
      2: { fs: 60, maxW: 470, maxH: 110, logoH: 110 },
      3: { x: 381, y: 1005, fs: 58, maxW: 300, maxH: 150, logoH: 140 },
      4: { x: 851, y: 1000, fs: 58, maxW: 300, maxH: 150, logoH: 140 },
      5: { fs: 70, maxW: 330, maxH: 200, logoH: 180 },
      6: { fs: 70, maxW: 330, maxH: 200, logoH: 180 },
      pocket: { x: 860, y: 1222, w: 200, h: 150, label: 'Pocket', fs: 50, stdW: 190, maxW: 230, maxH: 250, logoH: 150 }
    },
    barber: { 3: { x: 326, y: 955, w: 250, h: 64 }, 4: { x: 800, y: 955, w: 250, h: 64 } },
    split:  { 1: { y: 420 }, 2: { y: 505, h: 60 } },
    simple: { 3: { x: 378, y: 935, w: 250, h: 64 }, 4: { x: 822, y: 935, w: 250, h: 64 } },
    wood:   { 1: { y: 330, w: 300, h: 85 }, 2: { y: 440, w: 300, h: 70 } }
  };
  function posFor(styleKey, p) {
    var o = (POS_OVERRIDES[styleKey] || {})[p] || {}, base = POS[p] || {}, b = {};
    for (var k in base) b[k] = base[k];
    for (var j in o) b[j] = o[j];
    return b;
  }
  // stdW / stdH: the room used for the standard (100%) size; maxW / maxH: the most a bigger size may take.
  function metrics(b) {
    var maxW = b.maxW || b.w + 80, maxH = b.maxH || b.h * 2;
    return { fs: b.fs || Math.min(96, b.h * 1.1), maxW: maxW, maxH: maxH, logoH: b.logoH || b.h * 1.6,
      stdW: b.stdW || Math.min(b.w + 60, maxW * 0.85), stdH: b.stdH || maxH * 0.7 };
  }
  // Spots offered on a style, in order: '1'..'n', then 'pocket' where the style has one.
  function positionsOf(styleKey) {
    var s = STYLES[styleKey], list = [];
    for (var i = 1; i <= s.positions; i++) list.push(String(i));
    if (s.pocket) list.push('pocket');
    return list;
  }
  function posLabel(p) { return p === 'pocket' ? 'Pocket' : p + ' (' + POS[p].label + ')'; }
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
    el('rect', { x: x - 26, y: y, width: 52, height: 40, rx: 5, fill: 'url(#openerGrad)', stroke: acc.edge, 'stroke-width': 3, filter: 'url(#drop)' }, g);
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

  function draw(st) {
    var style = STYLES[st.style], main = COLORS[st.main], acc = COLORS[st.acc];
    // Engraving on the pocket is burned into the accessory leather, everywhere else into the apron body.
    function inkFor(p) { return p === 'pocket' ? acc : main; }
    stage.textContent = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-labelledby': 'apron-title apron-desc' }, stage);
    el('title', { id: 'apron-title' }, svg).textContent = 'Preview of your ' + style.name;
    el('desc', { id: 'apron-desc' }, svg).textContent = main.label + ' leather with ' + acc.label.toLowerCase() + ' accessories and black straps' +
      (st.wings ? ', ' + wingName(st) + ' leather wings' : '') + (st.opener ? ', bottle opener with ' + openerName(st) + ' leather tab' : '') + (st.grease ? ', with a tin of leather care grease and cloth' : '') +
      (st.text ? ', engraved "' + st.text.replace(/\n/g, ' ') + '" in ' + FONTS[st.font].label + ' at position ' + posLabel(st.pos) : ', no engraved text') +
      (st.logo ? ', logo at position ' + posLabel(st.logoPos) : '') + '.';

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
    var oc = COLORS[openerColor(st)], opG = el('linearGradient', { id: 'openerGrad', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': oc.hi }, opG); el('stop', { offset: '1', 'stop-color': oc.hex }, opG);
    var loopG = el('linearGradient', { id: 'loopGrad', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: '0', 'stop-color': acc.hex }, loopG); el('stop', { offset: '.45', 'stop-color': acc.hi }, loopG); el('stop', { offset: '1', 'stop-color': acc.edge }, loopG);
    var metal = el('linearGradient', { id: 'metal', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': '#ffffff' }, metal); el('stop', { offset: '.5', 'stop-color': '#c9c9c9' }, metal); el('stop', { offset: '1', 'stop-color': '#7d7d7d' }, metal);
    var clip = el('clipPath', { id: 'bibclip' }, defs);
    el('path', { d: BIB }, clip);
    // Uploaded logos are shown "burned in": the logo's shape (its dark parts, or for a light logo on a
    // transparent background its opaque parts) in the engraving colour, plus a faint highlight.
    if (st.logo && logoData) {
      var shapeRow = logoData.mode === 'alpha' ? '0 0 0 1 0' : '-0.2126 -0.7152 -0.0722 1 0';
      [['logoInk', inkFor(st.logoPos).engrave, 1], ['logoHi', '#ffe1c8', 0.22]].forEach(function (f) {
        var rgb = [1, 3, 5].map(function (i) { return (parseInt(f[1].substr(i, 2), 16) / 255).toFixed(3); });
        var flt = el('filter', { id: f[0], 'color-interpolation-filters': 'sRGB' }, defs);
        el('feColorMatrix', { type: 'matrix', values: '0 0 0 0 ' + rgb[0] + '  0 0 0 0 ' + rgb[1] + '  0 0 0 0 ' + rgb[2] + '  ' +
          shapeRow.split(' ').map(function (v) { return (v * f[2]).toString(); }).join(' ') }, flt);
      });
    }

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
    if (st.opener && op) opener(acs, op[0], op[1], COLORS[openerColor(st)]);
    if (st.grease) greaseTin(svg);

    // Engraving spots: dashed guides you can tap. A spot that holds the text or logo shows that instead.
    var spots = positionsOf(st.style);
    var editing = active === 'logo' && st.logo ? 'logo' : 'text';
    var guides = el('g', { 'aria-hidden': 'true' }, svg);
    spots.forEach(function (p) {
      var q = posFor(st.style, p);
      var used = (st.text && p === st.pos) || (st.logo && p === st.logoPos);
      var on = p === (editing === 'logo' ? st.logoPos : st.pos);
      var g = el('g', { 'data-pos': p }, guides);
      el('rect', { x: q.x - q.w / 2, y: q.y - q.h / 2, width: q.w, height: q.h, rx: 8, fill: 'rgba(255,255,255,0)',
        stroke: used ? 'none' : on ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.45)', 'stroke-dasharray': '14 10', 'stroke-width': on ? 4 : 3 }, g);
      if (used) return;
      var t = el('text', { x: q.x, y: q.y + (p === 'pocket' ? 12 : 14), 'text-anchor': 'middle', fill: on ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.65)',
        'font-size': p === 'pocket' ? 34 : 40, 'font-weight': 700, 'font-family': 'Inter, sans-serif' }, g);
      t.textContent = p === 'pocket' ? 'Pocket' : p;
    });

    // Engraved text: dark burned-in lettering with a faint highlight, at the chosen size. maxPct is the
    // biggest size (as % of standard) that fits the spot; update() keeps the slider within it.
    var textG = null, logoG = null;
    fit.text = fit.logo = null;
    if (st.text) {
      var font = FONTS[st.font] || FONTS.montserrat, box = posFor(st.style, st.pos), m = metrics(box), ink = inkFor(st.pos);
      var lines = st.text.split('\n').slice(0, 3);
      var base = m.fs * [1, 0.78, 0.62][lines.length - 1] * font.scale;
      textG = el('g', { 'aria-hidden': 'true', 'data-item': 'text' }, svg);
      var hl = [], texts = [];
      lines.forEach(function (line) {
        var h1 = el('text', { x: box.x + 2, 'text-anchor': 'middle', fill: 'rgba(255,225,200,.22)', 'font-family': font.family, 'font-weight': font.weight, 'font-size': base.toFixed(1) }, textG);
        var t = el('text', { x: box.x, 'text-anchor': 'middle', fill: ink.engrave, 'font-family': font.family, 'font-weight': font.weight, 'font-size': base.toFixed(1) }, textG);
        h1.textContent = line; t.textContent = line;
        hl.push(h1); texts.push(t);
      });
      // Standard size: the spot's letter size, made smaller if the text is too long for the spot.
      var widest = Math.max.apply(null, texts.map(function (t) { try { return t.getComputedTextLength(); } catch (e) { return 0; } })) || 1;
      var tall = lines.length * base * 1.08 / font.scale;
      var std = base * Math.min(1, m.stdW / widest, m.stdH / tall);
      var maxPct = Math.max(100, Math.floor(100 * base * Math.min(m.maxW / widest, m.maxH / tall) / std));
      var pct = Math.min(st.textSize, maxPct), size = Math.max(12, std * pct / 100);
      texts.concat(hl).forEach(function (t) { t.setAttribute('font-size', size.toFixed(1)); });
      fit.text = { pct: pct, maxPct: maxPct };
      var lh = size * 1.08, top = box.y - ((lines.length - 1) * lh) / 2 + size * 0.34;
      texts.forEach(function (t, i) { t.setAttribute('y', (top + i * lh).toFixed(1)); });
      hl.forEach(function (t, i) { t.setAttribute('y', (top + i * lh + 2).toFixed(1)); });
    }

    // Logo: the uploaded image, or a placeholder until one is chosen.
    if (st.logo) {
      var lb = posFor(st.style, st.logoPos), lm = metrics(lb);
      var aspect = logoData ? logoData.aspect : 1.6;
      var lstd = Math.min(lm.logoH, lm.stdW / aspect, lm.stdH);
      var lmax = Math.max(100, Math.floor(100 * Math.min(lm.maxW / (lstd * aspect), lm.maxH / lstd)));
      var lpct = Math.min(st.logoSize, lmax), lhgt = lstd * lpct / 100, lwid = lhgt * aspect;
      fit.logo = { pct: lpct, maxPct: lmax };
      logoG = el('g', { 'aria-hidden': 'true', 'data-item': 'logo' }, svg);
      var lx = lb.x - lwid / 2, ly = lb.y - lhgt / 2;
      if (logoData) {
        el('image', { href: logoData.src, x: lx + 2, y: ly + 2, width: lwid, height: lhgt, preserveAspectRatio: 'xMidYMid meet', filter: 'url(#logoHi)' }, logoG);
        el('image', { href: logoData.src, x: lx, y: ly, width: lwid, height: lhgt, preserveAspectRatio: 'xMidYMid meet', filter: 'url(#logoInk)' }, logoG);
      } else {
        el('rect', { x: lx, y: ly, width: lwid, height: lhgt, rx: 12, fill: 'rgba(0,0,0,.06)', stroke: inkFor(st.logoPos).engrave, 'stroke-width': 3, 'stroke-dasharray': '8 7' }, logoG);
        var ph = el('text', { x: lb.x, y: lb.y + lhgt * 0.1, 'text-anchor': 'middle', fill: inkFor(st.logoPos).engrave, 'font-size': Math.max(18, lhgt * 0.28).toFixed(1),
          'font-weight': 700, 'font-family': 'Inter, sans-serif', 'letter-spacing': 2 }, logoG);
        ph.textContent = 'LOGO';
      }
    }

    // Outline what's being edited, so it's clear what a tap on the preview will move.
    var editG = editing === 'logo' ? logoG : textG;
    if (editG && (textG && logoG)) {
      try {
        var bb = editG.getBBox();
        el('rect', { x: bb.x - 14, y: bb.y - 10, width: bb.width + 28, height: bb.height + 20, rx: 10, fill: 'none',
          stroke: 'rgba(255,255,255,.85)', 'stroke-width': 3, 'stroke-dasharray': '10 8', 'pointer-events': 'none', 'aria-hidden': 'true' }, svg);
      } catch (e) { /* not rendered yet */ }
    }
  }

  /* ---------- State, summary, validation ---------- */
  var active = 'text';   // what a tap on the preview moves: 'text' or 'logo'
  var logoData = null;   // { src, aspect, mode, name } once a logo file is chosen (kept on this device only)
  var fit = {};          // sizes actually drawn, as % of standard (set by draw)

  function read() {
    return {
      style: val('style') || 'bbq', main: val('main') || 'tan', acc: val('acc') || 'brown',
      text: (form.elements.engraving.value || '').replace(/\r/g, '').replace(/\n{2,}/g, '\n').trim(),
      font: FONTS[val('font')] ? val('font') : 'montserrat', pos: val('position') || '1', textSize: Number(val('textSize')) || 100,
      logo: val('logo'), logoPos: val('logoPos') || '', logoSize: Number(val('logoSize')) || 100, notes: val('notes'),
      height: val('height'), weight: val('weight'), email: val('email'), phone: val('phone'),
      wings: val('wings'), wingColor: val('wingColor'), opener: val('opener'), openerColor: val('openerColor'), grease: val('grease')
    };
  }

  function describe(st) {
    var parts = [];
    if (st.text) {
      parts.push('Engraving text: "' + st.text.replace(/\n/g, ' / ') + '"');
      parts.push('Font: ' + fontName(st.font));
      parts.push('Position: ' + posLabel(st.pos));
      parts.push('Text size: ' + (fit.text ? fit.text.pct : st.textSize) + '% of standard');
    } else {
      parts.push('Engraving text: none');
    }
    if (st.logo) {
      parts.push('Logo: position ' + posLabel(st.logoPos) + ', size ' + (fit.logo ? fit.logo.pct : st.logoSize) + '% of standard' +
        (logoData ? ', previewed with "' + logoData.name.slice(0, 60) + '"' : '') + '. Customer will send the logo file by WhatsApp or email');
    }
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
  var wingField = document.getElementById('wing-color-field');
  var openerField = document.getElementById('opener-color-field');
  var waLink = document.getElementById('design-whatsapp');

  // Wings and bottle opener follow the accessory colour unless the customer picks another.
  var SHORT = { tan: 'tan', brown: 'dark brown', black: 'black' };
  function wingColor(st) { return COLORS[st.wingColor] ? st.wingColor : st.acc; }
  function wingName(st) { return SHORT[wingColor(st)]; }
  function openerColor(st) { return COLORS[st.openerColor] ? st.openerColor : st.acc; }
  function openerName(st) { return SHORT[openerColor(st)]; }

  function total(st) { return PRICE + (st.wings ? EXTRA_PRICE : 0) + (st.opener ? EXTRA_PRICE : 0) + (st.grease ? EXTRA_PRICE : 0); }

  function waMessage(st) {
    return 'Hi Virtual Leather! I designed an apron on your website:\n' +
      '- Style: ' + STYLES[st.style].name + '\n' +
      '- Main leather: ' + COLORS[st.main].label + '\n' +
      '- Accessories: ' + COLORS[st.acc].label + '\n' +
      '- ' + describe(st).split(' | ').slice(0, -1).join('\n- ') + '\n' +
      (st.wings ? '- Extra: leather wings (' + wingName(st) + ')\n' : '') + (st.opener ? '- Extra: bottle opener (' + openerName(st) + ')\n' : '') + (st.grease ? '- Extra: protective leather grease 50 ml\n' : '') +
      'Can you help me finish my order?';
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

  // Show only the spots this style has, for the text and for the logo. The logo starts in the pocket
  // where there is one, otherwise in the first spot the text isn't using.
  function syncPositions(st) {
    var list = positionsOf(st.style);
    ['position', 'logoPos'].forEach(function (name) {
      var radios = form.querySelectorAll('input[name="' + name + '"]'), ok = false;
      Array.prototype.forEach.call(radios, function (r) {
        var show = list.indexOf(r.value) !== -1;
        r.disabled = !show;
        r.closest('.opt').hidden = !show;
        if (r.checked && !show) r.checked = false;
        if (r.checked) ok = true;
      });
      if (ok) return;
      var pick = name === 'position' ? '1' : ['pocket', '2', '1', '3', '4', '5', '6'].filter(function (p) {
        return list.indexOf(p) !== -1 && p !== (val('position') || '1');
      })[0];
      var r = form.querySelector('input[name="' + name + '"][value="' + pick + '"]');
      if (r) r.checked = true;
    });
  }

  var sizeOut = { textSize: document.getElementById('text-size-out'), logoSize: document.getElementById('logo-size-out') };
  var fitNote = { textSize: document.getElementById('text-size-fit'), logoSize: document.getElementById('logo-size-fit') };
  var logoItem = document.getElementById('logo-item'), textItem = document.getElementById('text-item');
  var logoPosError = document.getElementById('logo-pos-error');
  function overlap(st) { return st.logo && st.text && st.pos === st.logoPos; }
  // Keep each size slider within what fits its spot, so the % shown always matches the preview.
  // Returns true if a slider had to come down (the preview is then redrawn).
  function clampSizes(st) {
    var changed = false;
    [['textSize', st.textSize, fit.text], ['logoSize', st.logoSize, fit.logo]].forEach(function (s) {
      var input = form.elements[s[0]], min = Number(input.min);
      if (!s[2] || s[1] <= s[2].maxPct || s[1] <= min) return;
      if (document.fonts && document.fonts.status === 'loading') return;
      input.value = Math.max(min, Math.floor(s[2].maxPct / 10) * 10);
      changed = changed || Number(input.value) !== s[1];
    });
    return changed;
  }
  function syncSizes(st) {
    [['textSize', st.textSize, fit.text, 'text'], ['logoSize', st.logoSize, fit.logo, 'logo']].forEach(function (s) {
      var input = form.elements[s[0]], step = Number(input.step);
      var atFit = !!s[2] && s[1] + step > s[2].maxPct;
      var shown = s[2] ? s[2].pct : s[1];
      sizeOut[s[0]].textContent = shown + '%';
      input.setAttribute('aria-valuetext', shown + '%');
      Array.prototype.forEach.call(form.querySelectorAll('.size-btn[data-target="' + input.id + '"]'), function (b) {
        b.disabled = Number(b.getAttribute('data-step')) < 0 ? s[1] <= Number(input.min) : s[1] >= Number(input.max) || atFit;
      });
      var onChest = (s[3] === 'text' ? st.pos : st.logoPos) === '1';
      fitNote[s[0]].textContent = !atFit || s[1] >= Number(input.max) ? '' : s[3] === 'text'
        ? 'That\'s the biggest that fits this spot. For bigger letters, use fewer letters' + (onChest ? ' or a second line.' : ', a second line or the chest (1).')
        : 'That\'s the biggest that fits this spot.' + (onChest ? '' : ' For a bigger logo, pick a roomier spot such as the chest (1).');
    });
  }

  function update() {
    var st = read();
    syncPositions(st);
    syncExtras(st);
    st = read();
    wingField.hidden = !st.wings;
    openerField.hidden = !st.opener;
    logoItem.hidden = !st.logo;
    if (!st.logo && active === 'logo') active = 'text';
    textItem.classList.toggle('is-active', active === 'text');
    logoItem.classList.toggle('is-active', active === 'logo');
    draw(st);
    if (clampSizes(st)) { st = read(); draw(st); }
    syncSizes(st);
    logoPosError.textContent = overlap(st) ? 'Your text is already at this spot. Please pick another position for the logo.' : '';
    summaryEls.style.textContent = STYLES[st.style].name;
    summaryEls.colors.textContent = COLORS[st.main].label + ' / ' + COLORS[st.acc].label;
    var eng = [];
    if (st.text) eng.push('"' + st.text.replace(/\n/g, ' ') + '" · ' + FONTS[st.font].label + ' · ' + (st.pos === 'pocket' ? 'pocket' : 'position ' + st.pos));
    if (st.logo) eng.push('logo · ' + (st.logoPos === 'pocket' ? 'pocket' : 'position ' + st.logoPos));
    summaryEls.engraving.textContent = eng.length ? eng.join(' + ') : 'None';
    var ex = [];
    if (st.wings) ex.push('Wings (' + wingName(st) + ')'); if (st.opener) ex.push('Bottle opener (' + openerName(st) + ')'); if (st.grease) ex.push('Leather grease');
    summaryEls.extras.textContent = ex.length ? ex.join(', ') : 'None';
    summaryEls.total.textContent = '$' + total(st);
    summaryEls.tag.textContent = STYLES[st.style].name;
    counter.textContent = form.elements.engraving.value.length + ' / 40 characters';
    if (waLink) waLink.href = 'https://wa.me/' + C.whatsappNumber + '?text=' + encodeURIComponent(waMessage(st));
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
    if (colourPicked.hasOwnProperty(e.target.name)) colourPicked[e.target.name] = true;
    if (e.target.name === 'acc') followAccessory();
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

  // What a tap on the preview moves: whichever of text / logo the customer is working on.
  function setActive(which) {
    if (active === which) return;
    active = which;
    update();
  }
  textItem.addEventListener('focusin', function () { setActive('text'); });
  logoItem.addEventListener('focusin', function () { setActive('logo'); });
  form.elements.logo.addEventListener('change', function () { setActive(this.checked ? 'logo' : 'text'); });

  // Tap an empty spot to move what you're editing there; tap the text or logo to edit that one.
  stage.addEventListener('click', function (e) {
    var hit = e.target.closest ? e.target.closest('[data-item], [data-pos]') : null;
    if (!hit) return;
    var st = read();
    if (hit.hasAttribute('data-item')) { setActive(hit.getAttribute('data-item')); return; }
    var p = hit.getAttribute('data-pos');
    if (active === 'text' && st.logo && st.logoPos === p) { setActive('logo'); return; }
    if (active === 'logo' && st.text && st.pos === p) { setActive('text'); return; }
    var r = form.querySelector('input[name="' + (active === 'logo' && st.logo ? 'logoPos' : 'position') + '"][value="' + p + '"]');
    if (r && !r.disabled) { r.checked = true; update(); }
  });

  // - / + buttons beside each size slider.
  Array.prototype.forEach.call(form.querySelectorAll('.size-btn'), function (b) {
    b.addEventListener('click', function () {
      var input = document.getElementById(b.getAttribute('data-target'));
      var v = Math.min(Number(input.max), Math.max(Number(input.min), Number(input.value) + Number(b.getAttribute('data-step'))));
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  // Logo preview: read the file on this device, trim empty margins, and decide how to "burn" it in.
  var logoFile = document.getElementById('logo-file'), logoFileError = document.getElementById('logo-file-error');
  logoFile.addEventListener('change', function () {
    var f = logoFile.files && logoFile.files[0];
    logoFileError.textContent = '';
    if (!f) { logoData = null; update(); return; }
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) {
      logoFileError.textContent = 'Please choose a PNG, JPG, WebP or SVG image.'; logoFile.value = ''; return;
    }
    if (f.size > 15 * 1024 * 1024) {
      logoFileError.textContent = 'That file is over 15 MB. Please choose a smaller one, or just send it to us after ordering.'; logoFile.value = ''; return;
    }
    var url = URL.createObjectURL(f), img = new Image();
    img.onload = function () {
      logoData = prepareLogo(img, url, f.name);
      if (logoData.src !== url) URL.revokeObjectURL(url);
      if (!logoData.ok) logoFileError.textContent = 'This image looks blank on the preview. You can still send it to us after ordering.';
      setActive('logo');
      update();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      logoFileError.textContent = 'Sorry, we couldn\'t open that image. Please try another file, or send it to us after ordering.';
      logoFile.value = '';
    };
    img.src = url;
  });
  function prepareLogo(img, url, name) {
    var w = img.naturalWidth || 600, h = img.naturalHeight || 600, k = Math.min(1, 900 / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, cw, ch);
    try {
      var d = ctx.getImageData(0, 0, cw, ch).data, clear = 0, solid = 0, lum = 0, i;
      for (i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) clear++;
        else { solid++; lum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; }
      }
      // A light logo on a transparent background is engraved by its shape; anything else by its dark parts.
      var mode = clear > cw * ch * 0.05 && solid && lum / solid > 0.6 ? 'alpha' : 'dark';
      var x0 = cw, y0 = ch, x1 = -1, y1 = -1;
      for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) {
        i = (y * cw + x) * 4;
        var ink = mode === 'alpha' ? d[i + 3] >= 128 : d[i + 3] >= 128 && (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) < 200;
        if (ink) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return { src: c.toDataURL('image/png'), aspect: cw / ch, mode: mode, name: name, ok: false };
      var pad = 2, cx0 = Math.max(0, x0 - pad), cy0 = Math.max(0, y0 - pad);
      var tw = Math.min(cw, x1 + pad + 1) - cx0, th = Math.min(ch, y1 + pad + 1) - cy0;
      var t = document.createElement('canvas'); t.width = tw; t.height = th;
      t.getContext('2d').drawImage(c, cx0, cy0, tw, th, 0, 0, tw, th);
      return { src: t.toDataURL('image/png'), aspect: tw / th, mode: mode, name: name, ok: true };
    } catch (e) {
      return { src: url, aspect: cw / ch, mode: 'dark', name: name, ok: true };
    }
  }

  // Show each lettering choice in its own font once the designer is close to the screen, so the
  // font files are only downloaded by people who scroll to it; re-measure the preview when fonts arrive.
  function styleFontChoices() {
    Array.prototype.forEach.call(form.querySelectorAll('input[name="font"]'), function (r) {
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
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', function () { update(); });

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
    if (overlap(st)) {
      setStatus('Your text and logo are in the same spot. Please pick another position for the logo.', 'error');
      form.querySelector('input[name="logoPos"]:checked').focus();
      return;
    }
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
        .then(function () { return st.wings ? addProduct(E, 688211109, { Color: COLORS[wingColor(st)].addon }) : null; })
        .then(function () { return st.opener ? addProduct(E, 619483308, { Color: COLORS[openerColor(st)].addon }) : null; })
        .then(function () { return st.grease ? addProduct(E, 619498559, {}) : null; });
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
