import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preview = path.join(root, 'tools/.preview');
const roomOrig = path.join(preview, 'landing-sofa-empty-v2-orig.webp');
fs.mkdirSync(preview, { recursive: true });

const cards = [
  {
    name: 'flower',
    src: path.join(preview, 'src-card-flower.png'),
    inset: [44, 22, 44, 40],
    rx: 36,
    cuts: `
      <ellipse cx="18" cy="605" rx="64" ry="110" fill="black"/>
      <ellipse cx="408" cy="640" rx="62" ry="96" fill="black"/>
      <rect x="0" y="648" width="423" height="32" fill="black"/>
    `,
  },
  {
    name: 'peace',
    src: path.join(preview, 'src-card-peace.png'),
    inset: [28, 16, 24, 30],
    rx: 30,
    cuts: `
      <ellipse cx="8" cy="468" rx="58" ry="96" fill="black"/>
      <rect x="0" y="552" width="362" height="28" fill="black"/>
    `,
  },
  {
    name: 'forest',
    src: path.join(preview, 'src-card-forest.png'),
    inset: [26, 18, 24, 44],
    rx: 30,
    cuts: `
      <ellipse cx="50" cy="568" rx="70" ry="40" fill="black"/>
      <ellipse cx="310" cy="572" rx="70" ry="40" fill="black"/>
      <rect x="0" y="558" width="368" height="30" fill="black"/>
    `,
  },
];

async function isolateAcrylic({ name, src, inset, rx, cuts }) {
  const meta = await sharp(src).metadata();
  const { width, height } = meta;
  const [l, t, r, b] = inset;
  const keep = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="${l}" y="${t}" width="${width - l - r}" height="${height - t - b}" rx="${rx}" ry="${rx}" fill="white"/>
    </svg>`
  );
  let buf = await sharp(src)
    .ensureAlpha()
    .composite([{ input: keep, blend: 'dest-in' }])
    .png()
    .toBuffer();
  if (cuts) {
    const cutMask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${cuts}</svg>`
    );
    buf = await sharp(buf)
      .composite([{ input: cutMask, blend: 'dest-out' }])
      .png()
      .toBuffer();
  }
  const trimmed = await sharp(buf).trim({ threshold: 12 }).png().toBuffer();
  const graded = await gradeToLanding(trimmed);
  const gMeta = await sharp(graded).metadata();
  await sharp(graded).png().toFile(path.join(preview, `acrylic-${name}.png`));
  console.log('isolated', name, gMeta.width, gMeta.height);
  return graded;
}

async function gradeToLanding(buf) {
  const meta = await sharp(buf).metadata();
  const w = meta.width;
  const h = meta.height;
  const base = await sharp(buf)
    .modulate({ saturation: 0.78, brightness: 0.9 })
    .linear(0.96, 5)
    .png()
    .toBuffer();
  const warm = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect width="100%" height="100%" fill="#c6a57a" fill-opacity="0.22"/>
    </svg>`
  );
  const roomed = await sharp(base)
    .composite([{ input: warm, blend: 'multiply' }])
    .png()
    .toBuffer();
  const topMute = await sharp(roomed)
    .modulate({ saturation: 0.58, brightness: 0.82 })
    .png()
    .toBuffer();
  const fade = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="white" stop-opacity="1"/>
          <stop offset="32%" stop-color="white" stop-opacity="0.85"/>
          <stop offset="55%" stop-color="white" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`
  );
  const topMasked = await sharp(topMute)
    .composite([{ input: fade, blend: 'dest-in' }])
    .png()
    .toBuffer();
  const shade = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2c2118" stop-opacity="0.18"/>
          <stop offset="42%" stop-color="#2c2118" stop-opacity="0.05"/>
          <stop offset="100%" stop-color="#2c2118" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#s)"/>
    </svg>`
  );
  const rim = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect x="3" y="3" width="${w - 6}" height="${h - 6}" rx="22" ry="22"
        fill="none" stroke="rgba(232,214,176,0.35)" stroke-width="2"/>
    </svg>`
  );
  return sharp(roomed)
    .composite([
      { input: topMasked, blend: 'over' },
      { input: shade, blend: 'multiply' },
      { input: rim, blend: 'over' },
    ])
    .png()
    .toBuffer();
}

async function layCard(card, { rotate = 0, width = 82, flatten = 0.72, skew = 0.1 } = {}) {
  const rotated = await sharp(card)
    .rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const flat = await sharp(rotated)
    .affine(
      [
        [1, skew],
        [0, flatten],
      ],
      { background: { r: 0, g: 0, b: 0, alpha: 0 }, interpolator: sharp.interpolators.nohalo }
    )
    .png()
    .toBuffer();
  const meta = await sharp(flat).metadata();
  const pad = 14;
  const sil = await sharp(flat).ensureAlpha().modulate({ brightness: 0 }).blur(5).png().toBuffer();
  const base = await sharp({
    create: {
      width: meta.width + pad * 2,
      height: meta.height + pad * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
  const laid = await sharp(base)
    .composite([
      { input: sil, left: pad + 2, top: pad + 5, blend: 'over' },
      { input: flat, left: pad, top: pad, blend: 'over' },
    ])
    .png()
    .toBuffer();
  const laidMeta = await sharp(laid).metadata();
  console.log('laid', laidMeta.width, laidMeta.height);
  return laid;
}

const isolated = {};
for (const card of cards) {
  isolated[card.name] = await isolateAcrylic(card);
}

const laid = [
  { name: 'peace', rotate: -6, width: 80, flatten: 0.78, skew: 0.12, left: 588, top: 689 },
  { name: 'forest', rotate: 6, width: 81, flatten: 0.8, skew: 0.08, left: 818, top: 692 },
  { name: 'flower', rotate: 8, width: 74, flatten: 0.76, skew: 0.05, left: 1078, top: 646 },
];

const overlays = [];
for (const spec of laid) {
  const buf = await layCard(isolated[spec.name], spec);
  const meta = await sharp(buf).metadata();
  await sharp(buf).png().toFile(path.join(preview, `laid-acrylic-${spec.name}.png`));
  overlays.push({ input: buf, left: spec.left, top: spec.top, blend: 'over' });
  console.log('place', spec.name, { left: spec.left, top: spec.top, w: meta.width, h: meta.height });
}

const baked = await sharp(roomOrig)
  .resize(1672, 941, { fit: 'fill' })
  .composite(overlays)
  .png()
  .toBuffer();
await sharp(baked).png().toFile(path.join(preview, 'landing-sofa-baked.png'));
await sharp(baked)
  .extract({ left: 420, top: 610, width: 820, height: 310 })
  .png()
  .toFile(path.join(preview, 'table-baked-zoom-v6.png'));
await sharp(baked)
  .webp({ quality: 92, effort: 5 })
  .toFile(path.join(root, 'sofa-journey/assets/bg/landing-sofa-empty-v2.webp'));
console.log('baked muted acrylic photocards');
