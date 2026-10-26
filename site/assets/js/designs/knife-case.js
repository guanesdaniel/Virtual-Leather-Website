/* Virtual Leather — the leather knife roll for the product designer (product-designer.js).
   Drawing units: the rolled case on top is 720 units for the small case's 45 cm length; the open case
   below is 518 units for its 45 cm width. The large case (76 cm) is drawn the same, at its own scale. */
window.VL_PRODUCT_DESIGN = {
  id: 619492031,
  name: 'personalised leather knife roll',
  label: 'Knife roll',
  price: 170,
  viewBox: '0 0 1000 780',
  desc: 'The knife roll rolled up, and open',
  strapsLabel: 'Straps',
  // Both engravings (outside and inside) are included: no "Extra engraving" in the cart.
  extraEngravings: false,
  // Sizes (the Ecwid "Size" option). ecwid: the store's spelling of the choice, with fall-backs tried in
  // turn if the cart doesn't take it. scale: drawing units per mm compared with the small case.
  sizes: [
    { key: 'small', label: 'Small', ecwid: ['Small: 45cm x 36 cm', 'Small: 45cm x 36 cm​'], price: 170, scale: 1,
      summary: 'Small, 45 × 36 cm open, 6 knives' },
    { key: 'large', label: 'Large', ecwid: ['Large: 76cm x 52 cm'], price: 190, scale: 45 / 76,
      summary: 'Large, 76 × 52 cm open, 7 knives, shoulder strap' }
  ],
  // Where engravings can go. zone: a box (x, y, w, h) the engraving stays inside.
  // perMm: drawing units per millimetre there (small case). text / logo: height in mm (min, max, starting size).
  places: {
    outside: {
      label: 'Outside', long: 'the outside, between the straps',
      zone: { x: 382, y: 96, w: 236, h: 130 }, perMm: 1.6,
      text: [8, 40, 18], logo: [20, 80, 55]
    },
    inside: {
      label: 'Inside flap', long: 'the inside flap',
      zone: { x: 292, y: 338, w: 416, h: 84 }, perMm: 1.15,
      text: [8, 50, 20], logo: [20, 70, 50]
    }
  },
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
    function shade(id, tone, stops) {
      var gr = el('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      stops.forEach(function (st) { el('stop', { offset: st[0], 'stop-color': tone[st[1]] }, gr); });
    }
    shade('pd-roll', t, [['0', 'edge'], ['.2', 'hi'], ['.55', 'hex'], ['1', 'edge']]);
    shade('pd-strap', s, [['0', 'edge'], ['.25', 'hi'], ['.6', 'hex'], ['1', 'edge']]);
    shade('pd-flat', t, [['0', 'hi'], ['.5', 'hex'], ['1', 'hex']]);
    function rivet(x, y) { el('circle', { cx: x, cy: y, r: 5, fill: '#d9d4cc', stroke: '#6b665f', 'stroke-width': 1.3 }, g); }
    function stitch(d, tone, op) { el('path', { d: d, fill: 'none', stroke: tone, 'stroke-width': 1.6, 'stroke-dasharray': '5 6', opacity: op || '.55' }, g); }

    /* ---- Rolled up (outside) ---- */
    // Shoulder strap (large case): from the left end, over the top, to a buckle on the right.
    if (large) {
      el('path', { d: 'M150,92 C260,4 700,0 852,86', fill: 'none', stroke: s.edge, 'stroke-width': 26, 'stroke-linecap': 'round' }, g);
      el('path', { d: 'M150,92 C260,4 700,0 852,86', fill: 'none', stroke: s.hex, 'stroke-width': 21, 'stroke-linecap': 'round' }, g);
      stitch('M156,84 C262,-2 700,-6 846,78', s.hi);
    }
    // The roll: a cylinder seen from the side, with the outer flap's edge along the bottom.
    var roll = 'M150,70 H850 C872,70 884,120 884,160 C884,200 872,250 850,250 H150 C128,250 116,200 116,160 C116,120 128,70 150,70 Z';
    el('path', { d: roll, fill: 'url(#pd-roll)', stroke: t.edge, 'stroke-width': 2 }, g);
    el('ellipse', { cx: 140, cy: 160, rx: 24, ry: 90, fill: t.hex, stroke: t.edge, 'stroke-width': 2 }, g);
    el('ellipse', { cx: 140, cy: 160, rx: 12, ry: 54, fill: 'none', stroke: t.edge, 'stroke-width': 1.5, opacity: '.6' }, g);
    el('path', { d: 'M164,226 H850', stroke: t.edge, 'stroke-width': 2.5, opacity: '.7' }, g);
    stitch('M164,218 H846', t.edge);
    [176, 204, 232].forEach(function (y) { rivet(128, y - 60); });
    // Two straps round the roll, with a short carry handle between them.
    [330, 638].forEach(function (x) {
      el('rect', { x: x, y: 62, width: 32, height: 196, rx: 5, fill: 'url(#pd-strap)', stroke: s.edge, 'stroke-width': 1.5 }, g);
      stitch('M' + (x + 6) + ',70 V250', s.hi);
      stitch('M' + (x + 26) + ',70 V250', s.hi);
    });
    el('path', { d: 'M346,78 C420,40 580,40 654,78', fill: 'none', stroke: s.edge, 'stroke-width': 20, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M346,78 C420,40 580,40 654,78', fill: 'none', stroke: s.hex, 'stroke-width': 15, 'stroke-linecap': 'round' }, g);
    rivet(346, 80); rivet(654, 80);
    if (large) {
      // The shoulder strap's buckle on the right end.
      el('rect', { x: 826, y: 74, width: 30, height: 26, rx: 4, fill: 'none', stroke: '#c9c4bb', 'stroke-width': 5 }, g);
      rivet(160, 96);
    }

    /* ---- Open (inside) ---- */
    var L = 241, R = 759, T = 320, B = 734, slots = large ? 7 : 6;
    el('rect', { x: L, y: T, width: R - L, height: B - T, rx: 12, fill: 'url(#pd-flat)', stroke: t.edge, 'stroke-width': 2 }, g);
    el('rect', { x: L + 9, y: T + 9, width: R - L - 18, height: B - T - 18, rx: 8, fill: 'none', stroke: t.edge, 'stroke-width': 1.5, 'stroke-dasharray': '5 6', opacity: '.5' }, g);
    // The inside flap that folds over the handles, with its fold line.
    el('path', { d: 'M' + (L + 18) + ',440 H' + (R - 18), stroke: t.edge, 'stroke-width': 2, opacity: '.55' }, g);
    el('text', { x: 500, y: 458, 'text-anchor': 'middle', fill: t.edge, opacity: '.6', 'font-family': 'Inter, system-ui, sans-serif', 'font-size': 13, 'font-weight': 600 }, g).textContent = 'fold';
    // Knife handles above the pockets (the large case's last pocket is the flat pocket, with no knife).
    var pw = (R - L - 40) / slots, py = 556;
    for (var i = 0; i < slots; i++) {
      var cx = L + 20 + pw * (i + .5);
      if (!(large && i === slots - 1)) {
        el('rect', { x: cx - 11, y: 474, width: 22, height: 96, rx: 9, fill: '#2b2724', stroke: '#141210', 'stroke-width': 1.5 }, g);
        el('rect', { x: cx - 13, y: 562, width: 26, height: 8, rx: 2, fill: '#b9b4ac', stroke: '#6b665f', 'stroke-width': 1 }, g);
        rivet(cx, 494); rivet(cx, 528);
      }
    }
    // The pocket panel, with a stitched divider between knives and a finger hole at the top of each.
    el('rect', { x: L + 20, y: py, width: R - L - 40, height: B - py - 20, rx: 6, fill: t.hex, stroke: t.edge, 'stroke-width': 2 }, g);
    el('rect', { x: L + 20, y: py, width: R - L - 40, height: B - py - 20, rx: 6, fill: '#000', opacity: '.12' }, g);
    stitch('M' + (L + 28) + ',' + (py + 8) + ' H' + (R - 28), t.edge, '.6');
    for (var j = 0; j < slots; j++) {
      var sx = L + 20 + pw * j;
      if (j) stitch('M' + sx + ',' + (py + 8) + ' V' + (B - 28), t.edge, '.7');
      if (!(large && j === slots - 1)) el('ellipse', { cx: sx + pw / 2, cy: py + 34, rx: 9, ry: 13, fill: t.edge, opacity: '.55' }, g);
    }

    var label = { 'text-anchor': 'middle', fill: '#5f534b', 'font-family': 'Inter, system-ui, sans-serif', 'font-size': 22, 'font-weight': 600 };
    el('text', Object.assign({ x: 500, y: 290 }, label), g).textContent = 'Outside (rolled up)';
    el('text', Object.assign({ x: 500, y: 768 }, label), g).textContent = 'Inside (open)';
  }
};
