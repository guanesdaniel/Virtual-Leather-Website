/* Virtual Leather — the minimalist leather backpack for the product designer (product-designer.js).
   Drawing units: the front is 400 units for the backpack's 28 cm width (38 cm tall). */
window.VL_PRODUCT_DESIGN = {
  id: 619488531,
  name: 'personalised minimalist leather backpack',
  label: 'Backpack',
  price: 180,
  viewBox: '0 0 600 720',
  desc: 'Front of the minimalist backpack',
  colorOption: 'Color',
  accent: ['Front pocket', 'pocket'],
  extraEngravings: false,  // every engraving is included in the price
  // Where engravings can go. zone: a box (x, y, w, h) the engraving stays inside.
  // perMm: drawing units per millimetre there. text / logo: height in mm (min, max, starting size).
  places: {
    front: {
      label: 'Top front', long: 'the top of the front',
      zone: { x: 150, y: 160, w: 300, h: 220 }, perMm: 1.43,
      text: [10, 60, 30], logo: [30, 140, 90]
    },
    pocket: {
      label: 'Pocket', long: 'the front pocket',
      zone: { x: 160, y: 460, w: 280, h: 150 }, perMm: 1.43,
      text: [8, 45, 20], logo: [20, 100, 60]
    }
  },
  // Draws the backpack into g (an empty SVG group). t = the leather tone of the backpack, s = the front pocket;
  // each has hex, hi (highlight), edge (shadow). h.el(name, attrs, parent) makes an SVG element.
  draw: function (g, t, s, h) {
    var el = h.el, defs = el('defs', {}, g);
    function shade(id, tone) {
      var gr = el('linearGradient', { id: id, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
      el('stop', { offset: '0', 'stop-color': tone.edge }, gr);
      el('stop', { offset: '.12', 'stop-color': tone.hex }, gr);
      el('stop', { offset: '.4', 'stop-color': tone.hi }, gr);
      el('stop', { offset: '.85', 'stop-color': tone.hex }, gr);
      el('stop', { offset: '1', 'stop-color': tone.edge }, gr);
    }
    shade('pd-body', t);
    shade('pd-pocket', s);

    // Shoulder straps (behind the backpack), showing at the sides, with their webbing ends.
    [['M150,128 C70,230 62,470 84,640', 'M84,640 L112,662'], ['M450,128 C530,230 538,470 516,640', 'M516,640 L488,662']].forEach(function (p) {
      el('path', { d: p[0], fill: 'none', stroke: t.edge, 'stroke-width': 30, 'stroke-linecap': 'round' }, g);
      el('path', { d: p[0], fill: 'none', stroke: t.hex, 'stroke-width': 24, 'stroke-linecap': 'round' }, g);
      el('path', { d: p[1], fill: 'none', stroke: '#2a2a2c', 'stroke-width': 18, 'stroke-linecap': 'round' }, g);
    });

    // Top handle.
    el('path', { d: 'M256,114 C258,58 342,58 344,114', fill: 'none', stroke: t.edge, 'stroke-width': 20, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M256,114 C258,58 342,58 344,114', fill: 'none', stroke: t.hex, 'stroke-width': 14, 'stroke-linecap': 'round' }, g);

    // Body: a tall panel with rounded top corners, the zip piping along the top, and stitching.
    var body = 'M100,172 Q100,110 162,110 H438 Q500,110 500,172 V622 Q500,654 468,654 H132 Q100,654 100,622 Z';
    el('path', { d: body, fill: 'url(#pd-body)', stroke: t.edge, 'stroke-width': 2 }, g);
    el('path', { d: 'M112,176 Q112,122 166,122 H434 Q488,122 488,176 V618 Q488,642 464,642 H136 Q112,642 112,618 Z',
      fill: 'none', stroke: t.edge, 'stroke-width': 1.6, 'stroke-dasharray': '5 6', opacity: '.55' }, g);
    el('path', { d: 'M104,168 Q104,114 162,114 H438 Q496,114 496,168', fill: 'none', stroke: t.edge, 'stroke-width': 5, opacity: '.6' }, g);

    // Front pocket, with a dip at the top to reach in.
    var pocket = 'M124,436 Q124,420 140,420 H246 Q300,452 354,420 H460 Q476,420 476,436 V618 Q476,634 460,634 H140 Q124,634 124,618 Z';
    el('path', { d: 'M126,442 Q126,426 142,426 H248 Q300,458 352,426 H458 Q474,426 474,442', fill: 'none', stroke: 'rgba(0,0,0,.28)', 'stroke-width': 8 }, g);
    el('path', { d: pocket, fill: 'url(#pd-pocket)', stroke: s.edge, 'stroke-width': 2 }, g);
    el('path', { d: 'M134,444 Q134,431 147,431 H244 Q300,464 356,431 H453 Q466,431 466,444 V614 Q466,624 456,624 H144 Q134,624 134,614 Z',
      fill: 'none', stroke: s.edge, 'stroke-width': 1.5, 'stroke-dasharray': '5 6', opacity: '.6' }, g);
  }
};
