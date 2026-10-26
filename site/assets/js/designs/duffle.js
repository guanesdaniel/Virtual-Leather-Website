/* Virtual Leather — the leather duffle bag for the product designer (product-designer.js).
   Drawing units: the side view is 630 units for the bag's 50 cm length; the round end (27 cm across) is
   drawn face-on to its right, at its own scale. */
window.VL_PRODUCT_DESIGN = {
  id: 619501024,
  name: 'personalised leather duffle bag',
  label: 'Duffle bag',
  price: 180,
  viewBox: '0 0 1000 560',
  desc: 'Side view of the duffle bag, and its round end',
  // Where engravings can go. zone: a box (x, y, w, h) or a circle (cx, cy, r) the engraving stays inside.
  // perMm: drawing units per millimetre there. text / logo: height in mm (min, max, starting size).
  places: {
    body: {
      label: 'Body', long: 'the body, between the bands',
      zone: { x: 264, y: 206, w: 240, h: 222 }, perMm: 1.26,
      text: [10, 60, 30], logo: [30, 150, 90]
    },
    lid: {
      label: 'Round end', long: 'the round end',
      zone: { cx: 860, cy: 290, r: 92 }, perMm: 0.874,
      text: [10, 50, 24], logo: [30, 160, 100]
    }
  },
  // Draws the bag into g (an empty SVG group). t = the leather tone of the bag, s = straps and handles;
  // each has hex, hi (highlight), edge (shadow). h.el(name, attrs, parent) makes an SVG element.
  draw: function (g, t, s, h) {
    var el = h.el, defs = el('defs', {}, g);
    function shade(id, tone, vertical) {
      var gr = el('linearGradient', vertical ? { id: id, x1: 0, y1: 0, x2: 0, y2: 1 } : { id: id, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
      el('stop', { offset: '0', 'stop-color': tone.edge }, gr);
      el('stop', { offset: '.18', 'stop-color': tone.hi }, gr);
      el('stop', { offset: '.5', 'stop-color': tone.hex }, gr);
      el('stop', { offset: '1', 'stop-color': tone.edge }, gr);
    }
    shade('pd-body', t, true);
    shade('pd-band', s, true);
    var rg = el('radialGradient', { id: 'pd-end', cx: '.42', cy: '.38', r: '.7' }, defs);
    el('stop', { offset: '0', 'stop-color': t.hi }, rg);
    el('stop', { offset: '.6', 'stop-color': t.hex }, rg);
    el('stop', { offset: '1', 'stop-color': t.edge }, rg);

    // Handles (behind the bag), the far one darker.
    el('path', { d: 'M236,176 C252,52 500,52 516,176', fill: 'none', stroke: s.edge, 'stroke-width': 22, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M228,186 C246,74 506,74 524,186', fill: 'none', stroke: s.hex, 'stroke-width': 24, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M228,186 C246,74 506,74 524,186', fill: 'none', stroke: s.hi, 'stroke-width': 3, 'stroke-dasharray': '6 6', opacity: '.55', transform: 'translate(0,-6)' }, g);

    // Body: a cylinder seen from the side, with the zip along the top.
    var body = 'M120,170 H630 C672,170 690,240 690,310 C690,380 672,450 630,450 H120 C78,450 60,380 60,310 C60,240 78,170 120,170 Z';
    el('path', { d: body, fill: 'url(#pd-body)', stroke: t.edge, 'stroke-width': 2 }, g);
    el('path', { d: 'M126,182 H624 C660,182 676,244 676,310 C676,376 660,438 624,438 H126 C90,438 74,376 74,310 C74,244 90,182 126,182 Z',
      fill: 'none', stroke: t.edge, 'stroke-width': 1.6, 'stroke-dasharray': '5 6', opacity: '.55' }, g);
    el('path', { d: 'M110,190 H640', stroke: '#1b1512', 'stroke-width': 9, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M112,190 H638', stroke: '#8d847c', 'stroke-width': 5, 'stroke-dasharray': '2 3' }, g);
    el('rect', { x: 92, y: 182, width: 18, height: 30, rx: 4, fill: '#a99d90', stroke: '#5b5249', 'stroke-width': 1.5 }, g);

    // The round end, seen at an angle on the right of the side view.
    el('ellipse', { cx: 656, cy: 310, rx: 34, ry: 139, fill: 'url(#pd-end)', stroke: t.edge, 'stroke-width': 2 }, g);
    el('ellipse', { cx: 656, cy: 310, rx: 27, ry: 128, fill: 'none', stroke: t.edge, 'stroke-width': 1.4, 'stroke-dasharray': '5 6', opacity: '.6' }, g);

    // The two leather bands, with stitching and rivets.
    [212, 520].forEach(function (x) {
      el('rect', { x: x, y: 160, width: 36, height: 300, rx: 6, fill: 'url(#pd-band)', stroke: s.edge, 'stroke-width': 1.5 }, g);
      [x + 6, x + 30].forEach(function (sx) {
        el('path', { d: 'M' + sx + ',170 V450', stroke: s.hi, 'stroke-width': 1.6, 'stroke-dasharray': '6 6', opacity: '.6' }, g);
      });
      [196, 424].forEach(function (y) {
        el('circle', { cx: x + 18, cy: y, r: 6.5, fill: '#cdb98f', stroke: '#6e5e3e', 'stroke-width': 1.5 }, g);
      });
    });

    // Round end, face-on.
    el('circle', { cx: 860, cy: 290, r: 118, fill: 'url(#pd-end)', stroke: t.edge, 'stroke-width': 2 }, g);
    el('circle', { cx: 860, cy: 290, r: 106, fill: 'none', stroke: t.edge, 'stroke-width': 1.6, 'stroke-dasharray': '5 6', opacity: '.6' }, g);

    var label = { 'text-anchor': 'middle', fill: '#5f534b', 'font-family': 'Inter, system-ui, sans-serif', 'font-size': 22, 'font-weight': 600 };
    el('text', Object.assign({ x: 375, y: 500 }, label), g).textContent = 'Side';
    el('text', Object.assign({ x: 860, y: 446 }, label), g).textContent = 'Round end';
  }
};
