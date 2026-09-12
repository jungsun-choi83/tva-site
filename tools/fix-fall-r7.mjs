import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursorAssets = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const mascotDir = path.join(root, 'sofa-journey/assets/mascot');
const bgDir = path.join(root, 'sofa-journey/assets/bg');
const goyaDir = path.join(root, 'assets/goya');

function chromaKey(data, w, h) {
  const idx = (x, y) => (y * w + x) * 4;
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const maxRB = Math.max(r, b);
    const greenness = g - maxRB;
    const luma = (r + g + b) / 3;
    let a = data[p + 3];
    if (g > 70 && greenness > 28 && g > r * 1.12 && g > b * 1.12) {
      a = 0;
    } else if (g > 60 && greenness > 14) {
      a = Math.max(0, Math.min(a, 255 - greenness * 6));
      // despill
      data[p + 1] = Math.min(g, maxRB + 12);
    }
    data[p + 3] = a;
  }
  // flood leftover green from edges
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    const i = p * 4;
    if (data[i + 3] < 12) { stack.push(p); return; }
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (g > 90 && g - Math.max(r, b) > 20) stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    data[p * 4 + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
}

async function cutoutPose(src, destPng, destGoya) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  chromaKey(pixels, info.width, info.height);
  const trimmed = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 12 })
    .png()
    .toBuffer();
  const size = 1254;
  const meta = await sharp(trimmed).metadata();
  const fit = 1158;
  const resized = await sharp(trimmed)
    .resize({ width: fit, height: fit, fit: 'inside' })
    .png()
    .toBuffer();
  const rm = await sharp(resized).metadata();
  const left = Math.round((size - rm.width) / 2);
  const top = Math.round((size - rm.height) / 2);
  const square = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
  fs.mkdirSync(path.dirname(destPng), { recursive: true });
  await sharp(square).png().toFile(destPng);
  if (destGoya) await sharp(square).png().toFile(destGoya);
  console.log('pose', path.basename(destPng), rm.width, 'x', rm.height);
}

const poses = [
  ['goya-smile-fall-surprise.png', 'goya-fall-surprise.png'],
  ['goya-smile-fall-flail.png', 'goya-fall-flail.png'],
  ['goya-smile-fall-mid.png', 'goya-fall-mid.png'],
  ['goya-smile-fall-tuck.png', 'goya-fall-tuck.png'],
  ['goya-smile-sit.png', 'goya-sit-smile.png'],
];

for (const [src, dest] of poses) {
  await cutoutPose(
    path.join(cursorAssets, src),
    path.join(mascotDir, dest),
    path.join(goyaDir, dest),
  );
}

const mhMap = [
  ['mh-01.png', 'b1-1920s.webp'],
  ['mh-02.png', 'c1-1936.webp'],
  ['mh-03.png', 'c2-1945.webp'],
  ['mh-04.png', 'b2-1956.webp'],
  ['mh-05.png', 'c3-1964.webp'],
  ['mh-06.png', 'b3-1969.webp'],
  ['mh-07.png', 'c4-1977.webp'],
  ['mh-08.png', 'c5-1985.webp'],
  ['mh-09.png', 'b4-1988.webp'],
  ['mh-10.png', 'b5-1989.webp'],
  ['mh-11.png', 'b6-1991.webp'],
  ['mh-12.png', 'c6-1996.webp'],
  ['mh-13.png', 'b7-2002.webp'],
  ['mh-14.png', 'c7-2006.webp'],
  ['mh-15.png', 'c8-2012.webp'],
  ['mh-16.png', 'b8-2020s.webp'],
];

for (const [src, dest] of mhMap) {
  const info = await sharp(path.join(cursorAssets, src))
    .resize(1672, 941, { fit: 'cover' })
    .webp({ quality: 82 })
    .toFile(path.join(bgDir, dest));
  console.log('mh', src, '->', dest, info.size);
}

await sharp(path.join(cursorAssets, 'landing-warm-empty.png'))
  .resize(1672, 941, { fit: 'cover' })
  .webp({ quality: 86 })
  .toFile(path.join(bgDir, 'landing-sofa-empty-v2.webp'));
console.log('landing warm empty');
console.log('done');
