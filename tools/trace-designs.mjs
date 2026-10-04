// Turns the owner's suggested-design artwork into vector shapes for the apron designer.
// For each design: blank out the words customers replace (they're drawn live in the designer),
// crop to the artwork, trace it, and write the shapes to site/assets/js/design-art.js.
//   npm run designs
import sharp from 'sharp';
import potrace from 'potrace';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const trace = promisify(potrace.trace);

const DESIGNS = {
  // tools/design-src/grill-master.jpg (2000 x 2000): blank out "EST.", the year and the name.
  grillmaster: {
    src: 'tools/design-src/grill-master.jpg',
    erase: [
      { left: 470, top: 728, width: 142, height: 70 },    // EST.
      { left: 1393, top: 731, width: 148, height: 68 },   // 1974
      { left: 395, top: 885, width: 1253, height: 122 }   // the name
    ],
    crop: { left: 295, top: 219, width: 1388, height: 1497 }
  }
};

const out = {};
for (const [key, d] of Object.entries(DESIGNS)) {
  const patches = await Promise.all(d.erase.map(async (r) => ({
    input: await sharp({ create: { width: r.width, height: r.height, channels: 3, background: '#fff' } }).png().toBuffer(),
    left: r.left, top: r.top
  })));
  const cleaned = await sharp(d.src).flatten({ background: '#fff' }).composite(patches).png().toBuffer();
  const art = await sharp(cleaned).extract(d.crop).greyscale().png().toBuffer();
  const svg = await trace(art, { threshold: 128, turdSize: 25, optTolerance: 0.3, color: '#000', background: 'transparent' });
  const path = /<path d="([^"]+)"/.exec(svg);
  if (!path) throw new Error('No shapes traced for ' + key);
  // One decimal place is far finer than the engraving needs, and keeps the file small.
  const dPath = path[1].replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10)).replace(/\s+/g, ' ').trim();
  out[key] = { w: d.crop.width, h: d.crop.height, d: dPath };
  console.log(key + ': ' + out[key].d.length + ' characters of path data');
}

await writeFile('site/assets/js/design-art.js',
  '/* Suggested-design artwork for the apron designer, traced from the owner\'s files by tools/trace-designs.mjs. */\n' +
  'window.VL_DESIGN_ART = ' + JSON.stringify(out) + ';\n');
console.log('Wrote site/assets/js/design-art.js');
