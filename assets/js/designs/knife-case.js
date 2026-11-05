/* Virtual Leather — the leather knife roll for the product designer (product-designer.js).
   Two views, as on marketcenterco.com's knife case: rolled up (the outside) and open (the inside).
   Drawing units: rolled, the case's 45 cm length is 830 units; open, its 45 cm width is 600 units.
   The large case (76 cm) is drawn the same, at its own scale. */
window.VL_PRODUCT_DESIGN = {
  id: 619492031,
  name: 'personalised leather knife roll',
  label: 'Knife roll',
  price: 170,
  viewBox: '0 0 1000 800',
  desc: 'The knife roll',
  accent: ['Straps and handle', 'straps'],
  // Both engravings (outside and inside) are included: no "Extra engraving" in the cart.
  extraEngravings: false,
  // The preview shows one view at a time (box: the part of the drawing it shows); choosing an
  // engraving shows its view.
  views: {
    outside: { label: 'Rolled up', box: '0 0 1000 320' },
    inside: { label: 'Open', box: '120 335 760 465' }
  },
  // Sizes (the Ecwid "Size" option). ecwid: the store's spelling of the choice, with fall-backs tried in
  // turn if the cart doesn't take it. scale: drawing units per mm compared with the small case.
  sizes: [
    { key: 'small', label: 'Small', ecwid: ['Small: 45cm x 36 cm', 'Small: 45cm x 36 cm​'], price: 170, scale: 1,
      summary: 'Small, 45 × 36 cm open, 6 knives' },
    { key: 'large', label: 'Large', ecwid: ['Large: 76cm x 52 cm'], price: 190, scale: 45 / 76,
      summary: 'Large, 76 × 52 cm open, 7 knives, shoulder strap' }
  ],
  // Where engravings can go. zone: a box (x, y, w, h) the engraving stays inside; view: the view it's on.
  // perMm: drawing units per millimetre there (small case). text / logo: height in mm (min, max, starting size).
  places: {
    outside: {
      label: 'Outside', long: 'the outside, between the straps', view: 'outside',
      zone: { x: 292, y: 162, w: 386, h: 92 }, perMm: 1.84,
      text: [8, 40, 16], logo: [20, 48, 40]
    },
    inside: {
      label: 'Inside flap', long: 'the inside flap', view: 'inside',
      zone: { x: 398, y: 384, w: 384, h: 196 }, perMm: 1.33,
      text: [8, 50, 18], logo: [20, 120, 60]
    }
  },
  // Suggested designs for "Image or logo" (artwork in design-art.js, the apron designer's).
  ideas: [
    { key: 'grillemblem', label: 'Grill Master emblem' },
    { key: 'dadlegend', label: 'Dad Legend' },
    { key: 'bestdad', label: 'Best Dad Ever' }
  ],
  // The cart: the store's own options for the knife roll.
  cartOptions: function (o, d) {
    return {
      'Size': o.Size,
      'Main Color': o['Main Color'],
      'Secondary Color (Straps)': d.straps.ecwid,
      'Front Personalized Text (Rolled)': d.lines('outside') || 'None',
      'Interior Personalization Description': d.description,
      'Email for design confirmation': o['Email for design confirmation'],
      'Phone Number for shipping confirmation': o['Phone Number for shipping confirmation']
    };
  },
  // Draws the case into g (an empty SVG group). t = the leather tone of the case, s = the straps;
  // each has hex, hi (highlight), edge (shadow). h.el(name, attrs, parent) makes an SVG element;
  // h.size is the chosen size's key.
  draw: function (g, t, s, h) {
    var el = h.el, defs = el('defs', {}, g), large = h.size === 'large';
    function grad(id, tone, stops, across) {
      var gr = el('linearGradient', across ? { id: id, x1: 0, y1: 0, x2: 1, y2: 0 } : { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      stops.forEach(function (st) { el('stop', { offset: st[0], 'stop-color': tone[st[1]], 'stop-opacity': st[2] == null ? 1 : st[2] }, gr); });
    }
    // Leather grain: long streaks along the roll, softer clouds on the open case.
    function grain(id, freq, strength) {
      var f = el('filter', { id: id, x: 0, y: 0, width: 1, height: 1, 'color-interpolation-filters': 'sRGB' }, defs);
      el('feTurbulence', { type: 'fractalNoise', baseFrequency: freq, numOctaves: 3, seed: 7, result: 'n' }, f);
      el('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0.12  0 0 0 0 0.05  0 0 0 0 0.02  ' + strength + ' 0 0 0 ' + (-strength * .45).toFixed(2), result: 'd' }, f);
      el('feComposite', { in: 'd', in2: 'SourceAlpha', operator: 'in', result: 'dg' }, f);
      var m = el('feMerge', {}, f);
      el('feMergeNode', { in: 'SourceGraphic' }, m);
      el('feMergeNode', { in: 'dg' }, m);
    }
    grad('pd-roll', t, [['0', 'edge'], ['.14', 'hex'], ['.32', 'hi'], ['.62', 'hex'], ['.9', 'edge'], ['1', 'edge']]);
    grad('pd-strap', s, [['0', 'edge'], ['.3', 'hi'], ['.7', 'hex'], ['1', 'edge']], true);
    grad('pd-strapv', s, [['0', 'hi'], ['.5', 'hex'], ['1', 'edge']]);
    grad('pd-tube', t, [['0', 'edge'], ['.22', 'hex'], ['.45', 'hi'], ['.8', 'hex'], ['1', 'edge']], true);
    grad('pd-flap', t, [['0', 'hi'], ['.6', 'hex'], ['1', 'hex']]);
    grad('pd-steel', { a: '#8d949b', b: '#e6eaee', c: '#b4bbc2' }, [['0', 'a'], ['.4', 'b'], ['1', 'c']], true);
    grad('pd-wood', { a: '#5a3418', b: '#a8723f', c: '#7a4a22' }, [['0', 'a'], ['.45', 'b'], ['1', 'c']], true);
    grain('pd-grain-roll', '0.002 0.07', 0.6);
    grain('pd-grain-flat', '0.008 0.014', 0.9);
    function rivet(x, y, r) {
      el('circle', { cx: x, cy: y, r: r || 4.5, fill: '#e3e0da', stroke: '#76716a', 'stroke-width': 1.2 }, g);
    }
    function stitch(d, tone, op) { el('path', { d: d, fill: 'none', stroke: tone, 'stroke-width': 1.4, 'stroke-dasharray': '5 5', opacity: op || '.5' }, g); }

    /* ---- Rolled up (the outside) ---- */
    // Shadow under the roll.
    el('ellipse', { cx: 490, cy: 288, rx: 430, ry: 14, fill: '#000', opacity: '.12' }, g);
    // Shoulder strap (large case): from the left tab, over the top, to the right tab.
    if (large) {
      el('path', { d: 'M118,124 C190,-6 790,-6 862,124', fill: 'none', stroke: s.edge, 'stroke-width': 24, 'stroke-linecap': 'round' }, g);
      el('path', { d: 'M118,124 C190,-6 790,-6 862,124', fill: 'none', stroke: s.hex, 'stroke-width': 19, 'stroke-linecap': 'round' }, g);
    }
    // The carry handle, an arch between the straps.
    el('path', { d: 'M366,142 C366,38 614,38 614,142', fill: 'none', stroke: s.edge, 'stroke-width': 40 }, g);
    el('path', { d: 'M366,142 C366,38 614,38 614,142', fill: 'none', stroke: s.hex, 'stroke-width': 34 }, g);
    el('path', { d: 'M366,138 C366,46 614,46 614,138', fill: 'none', stroke: s.hi, 'stroke-width': 1.4, 'stroke-dasharray': '5 5', opacity: '.6' }, g);
    // The roll: a cylinder seen from the side, rounded on the left, with its spiral end on the right.
    var roll = el('g', { filter: 'url(#pd-grain-roll)' }, g);
    el('path', { d: 'M86,120 H902 V272 H86 C72,272 66,262 66,248 V144 C66,130 72,120 86,120 Z', fill: 'url(#pd-roll)' }, roll);
    el('path', { d: 'M86,120 H902 V272 H86 C72,272 66,262 66,248 V144 C66,130 72,120 86,120 Z', fill: 'none', stroke: t.edge, 'stroke-width': 1.6 }, g);
    // The outer flap's edge along the bottom.
    el('path', { d: 'M70,246 H902', stroke: t.edge, 'stroke-width': 2, opacity: '.55' }, g);
    el('path', { d: 'M70,249 H902', stroke: t.hi, 'stroke-width': 1, opacity: '.35' }, g);
    // The end: layers of leather rolled up.
    el('ellipse', { cx: 902, cy: 196, rx: 22, ry: 76, fill: t.hex, stroke: t.edge, 'stroke-width': 1.6 }, g);
    [60, 44, 28, 14].forEach(function (ry, i) {
      el('ellipse', { cx: 902 + i * 1.5, cy: 196, rx: ry * 22 / 76, ry: ry, fill: 'none', stroke: t.edge, 'stroke-width': 1.3, opacity: '.6' }, g);
    });
    el('ellipse', { cx: 908, cy: 196, rx: 2.5, ry: 6, fill: '#1b1410' }, g);
    // Short tabs at each end of the top, and the handle's tabs.
    [[96, 126], [854, 126], [350, 126], [598, 126]].forEach(function (p) {
      el('rect', { x: p[0], y: p[1] - 6, width: 34, height: 40, rx: 3, fill: 'url(#pd-strapv)', stroke: s.edge, 'stroke-width': 1.2 }, g);
      rivet(p[0] + 17, p[1] + 4, 3.6); rivet(p[0] + 17, p[1] + 22, 3.6);
    });
    // The two straps round the roll, each with a stud.
    [216, 726].forEach(function (x) {
      el('rect', { x: x, y: 110, width: 44, height: 176, rx: 7, fill: 'url(#pd-strap)', stroke: s.edge, 'stroke-width': 1.5 }, g);
      el('circle', { cx: x + 22, cy: 210, r: 5.5, fill: '#cfd3d6', stroke: '#5d6266', 'stroke-width': 1.3 }, g);
      el('path', { d: 'M' + (x + 22) + ',216 v10', stroke: '#2a201b', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    });

    /* ---- Open (the inside) ---- */
    var L = 200, R = 800, T = 350, B = 790, FX = 382, FB = 592, pockets = large ? 7 : 6;
    // Strap ends showing at the sides.
    [440, 712].forEach(function (y) {
      el('rect', { x: L - 22, y: y - 14, width: 30, height: 28, rx: 9, fill: 'url(#pd-strapv)', stroke: s.edge, 'stroke-width': 1.2 }, g);
      el('rect', { x: R - 8, y: y - 14, width: 30, height: 28, rx: 9, fill: 'url(#pd-strapv)', stroke: s.edge, 'stroke-width': 1.2 }, g);
    });
    var flat = el('g', { filter: 'url(#pd-grain-flat)' }, g);
    el('rect', { x: L, y: T, width: R - L, height: B - T, rx: 14, fill: t.hex }, flat);
    el('rect', { x: L, y: T, width: R - L, height: B - T, rx: 14, fill: 'none', stroke: t.edge, 'stroke-width': 2 }, g);
    // The strap rivets down the left panel.
    [378, 492, 618, 762].forEach(function (y) { rivet(288, y, 3.4); rivet(304, y, 3.4); });
    // Knife blades (steel) showing between the flap and the pockets.
    var pw = (R - 12 - (FX + 4)) / pockets;
    for (var i = 0; i < pockets; i++) {
      var cx = FX + 4 + pw * (i + .5);
      if (large && i === pockets - 1) continue;
      el('rect', { x: cx - pw * .2, y: FB - 10, width: pw * .4, height: 62, fill: 'url(#pd-steel)', stroke: '#6f767d', 'stroke-width': 1 }, g);
      el('rect', { x: cx - pw * .26, y: FB + 40, width: pw * .52, height: 12, rx: 2, fill: '#2d3236' }, g);
    }
    // The flap over the blades, with its shadow and stitching along the top.
    el('rect', { x: FX - 4, y: T + 4, width: R - FX + 4, height: FB - T + 4, rx: 14, fill: '#000', opacity: '.18' }, g);
    var flap = el('g', { filter: 'url(#pd-grain-flat)' }, g);
    el('path', { d: 'M' + FX + ',' + T + ' H' + (R - 14) + ' Q' + R + ',' + T + ' ' + R + ',' + (T + 14) + ' V' + (FB - 14) + ' Q' + R + ',' + FB + ' ' + (R - 14) + ',' + FB +
      ' H' + (FX + 14) + ' Q' + FX + ',' + FB + ' ' + FX + ',' + (FB - 14) + ' Z', fill: 'url(#pd-flap)' }, flap);
    el('path', { d: 'M' + FX + ',' + T + ' H' + (R - 14) + ' Q' + R + ',' + T + ' ' + R + ',' + (T + 14) + ' V' + (FB - 14) + ' Q' + R + ',' + FB + ' ' + (R - 14) + ',' + FB +
      ' H' + (FX + 14) + ' Q' + FX + ',' + FB + ' ' + FX + ',' + (FB - 14) + ' Z', fill: 'none', stroke: t.edge, 'stroke-width': 1.6 }, g);
    stitch('M' + (FX + 10) + ',' + (T + 12) + ' H' + (R - 10), t.hi, '.7');
    // The pockets: a leather tube for each knife, with a window showing the handle.
    var top = FB + 46, bot = B - 6;
    for (var j = 0; j < pockets; j++) {
      var x0 = FX + 4 + pw * j, x1 = x0 + pw, mid = (x0 + x1) / 2, isFlat = large && j === pockets - 1;
      el('path', { d: 'M' + x0 + ',' + bot + ' V' + (top + 14) + ' Q' + x0 + ',' + top + ' ' + (x0 + 14) + ',' + top + ' H' + (x1 - 14) + ' Q' + x1 + ',' + top + ' ' + x1 + ',' + (top + 14) + ' V' + bot + ' Z',
        fill: isFlat ? t.hex : 'url(#pd-tube)', stroke: t.edge, 'stroke-width': 1.4 }, g);
      if (!isFlat) {
        el('rect', { x: mid - pw * .17, y: top + 58, width: pw * .34, height: 64, rx: pw * .17, fill: t.edge, opacity: '.7' }, g);
        el('rect', { x: mid - pw * .12, y: top + 62, width: pw * .24, height: 56, rx: pw * .12, fill: 'url(#pd-wood)' }, g);
      }
      [top + 8, bot - 10].forEach(function (y) { rivet(x0 + 5, y, 3.2); });
      if (j === pockets - 1) [top + 8, bot - 10].forEach(function (y) { rivet(x1 - 5, y, 3.2); });
    }
    [top + 76].forEach(function (y) { rivet(FX + 9, y, 3.2); rivet(R - 13, y, 3.2); });
  }
};
