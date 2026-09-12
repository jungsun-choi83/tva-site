import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const DIST = 42;
const cursorAssets = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const mascotDir = path.join(root, 'sofa-journey/assets/mascot');
const bgDir = path.join(root, 'sofa-journey/assets/bg');
const framesDir = path.join(root, 'tools/.video-frames');

function floodAlpha(data, w, h) {
  const idx = (x, y) => (y * w + x) * 4;
  const corner = (x, y) => {
    const i = idx(x, y);
    return [data[i], data[i + 1], data[i + 2]];
  };
  const samples = [corner(2, 2), corner(w - 3, 2), corner(2, h - 3), corner(w - 3, h - 3)];
  const [tr, tg, tb] = samples.reduce((a, s) => [a[0] + s[0] / 4, a[1] + s[1] / 4, a[2] + s[2] / 4], [0, 0, 0]);
  const thresh = DIST * DIST;
  const isBg = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dr = r - tr, dg = g - tg, db = b - tb;
    if (dr * dr + dg * dg + db * db <= thresh) return true;
    const luma = (r + g + b) / 3;
    return luma > 232 && Math.abs(r - g) < 18 && Math.abs(g - b) < 18;
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (isBg(p * 4)) stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p / w) | 0;
    data[p * 4 + 3] = 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
}

async function cutoutSquare(src, dest, size = 1254) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  floodAlpha(pixels, info.width, info.height);
  const trimmed = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 10 })
    .png()
    .toBuffer();
  const meta = await sharp(trimmed).metadata();
  const pad = 48;
  const fit = Math.min(size - pad * 2, size - pad * 2);
  const resized = await sharp(trimmed)
    .resize({ width: fit, height: fit, fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const rm = await sharp(resized).metadata();
  const left = Math.round((size - rm.width) / 2);
  const top = Math.round((size - rm.height) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left, top }])
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(dest);
  console.log('pose', path.basename(dest), rm.width, 'x', rm.height, 'at', left, top);
}

async function plate(src, dest, position = 'centre') {
  const info = await sharp(src)
    .resize(1672, 941, { fit: 'cover', position })
    .webp({ quality: 84 })
    .toFile(dest);
  console.log('plate', path.basename(src), '->', path.basename(dest), info.size);
}

const poses = [
  ['goya-fall-surprise.png', 'fall-surprise.webp'],
  ['goya-fall-flail.png', 'fall-flail.webp'],
  ['goya-fall-mid.png', 'fall-flail-mid.webp'],
  ['goya-fall-tuck.png', 'pre-impact-tuck.webp'],
  ['goya-fall-sit.png', 'tva-mascot-sit.webp'],
];

const env = (name) => path.join(cursorAssets, name);
const vid = (name) => path.join(framesDir, name);

const plates = [
  [env('mh-env-01.png'), 'b1-1920s.webp', 'centre'],
  [env('mh-env-02.png'), 'c1-1936.webp', 'centre'],
  [env('mh-env-03.png'), 'c2-1945.webp', 'centre'],
  [env('mh-env-08.png'), 'b2-1956.webp', 'centre'],
  [env('mh-env-10.png'), 'c3-1964.webp', 'centre'],
  [env('mh-env-12.png'), 'b3-1969.webp', 'north'],
  [env('mh-env-04.png'), 'c4-1977.webp', 'centre'],
  [env('mh-env-02.png'), 'c5-1985.webp', 'south'],
  [env('mh-env-05.png'), 'b4-1988.webp', 'centre'],
  [env('mh-env-11.png'), 'b5-1989.webp', 'centre'],
  [env('mh-env-08.png'), 'b6-1991.webp', 'south'],
  [vid('room-dark-4k.png'), 'c6-1996.webp', 'centre'],
  [env('mh-env-07.png'), 'b7-2002.webp', 'centre'],
  [vid('room-cube-4k.png'), 'c7-2006.webp', 'centre'],
  [vid('room-holo-4k.png'), 'c8-2012.webp', 'centre'],
  [vid('room-holo-4k.png'), 'b8-2020s.webp', 'centre'],
];

fs.mkdirSync(mascotDir, { recursive: true });

for (const [srcName, destName] of poses) {
  await cutoutSquare(path.join(cursorAssets, srcName), path.join(mascotDir, destName));
}

for (const [src, dest, pos] of plates) {
  if (!fs.existsSync(src)) throw new Error('missing ' + src);
  await plate(src, path.join(bgDir, dest), pos);
}

await plate(vid('room-cube-4k.png'), path.join(bgDir, 'landing-sofa-empty-v2.webp'), 'centre');
console.log('done');
