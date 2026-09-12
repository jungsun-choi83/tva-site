import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const goyaDir = path.join(root, 'assets/goya');

function isMagenta(r, g, b) {
  const mag = Math.min(r, b) - g;
  return r > 80 && b > 55 && g < 145 && mag > 16 && (r + b) > g * 1.8;
}

function keyMagenta(data, w, h) {
  const n = w * h;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    if (isMagenta(r, g, b)) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    } else {
      const mag = Math.min(r, b) - g;
      if (mag > 8 && r > 60 && b > 45 && g < 155) {
        data[p] = Math.max(g, r - mag);
        data[p + 2] = Math.max(g, b - mag);
      }
    }
  }
  const copy = Buffer.from(data);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    if (copy[i + 3] !== 0) continue;
    let c = 0, sr = 0, sg = 0, sb = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const ni = ((y + oy) * w + (x + ox)) * 4;
      if (copy[ni + 3] > 80) { c++; sr += copy[ni]; sg += copy[ni + 1]; sb += copy[ni + 2]; }
    }
    if (c >= 2) {
      data[i] = Math.round(sr / c);
      data[i + 1] = Math.round(sg / c);
      data[i + 2] = Math.round(sb / c);
      data[i + 3] = Math.min(150, c * 22);
    }
  }
}

async function cutMagenta(src, dest, { square = 0, pad = 16 } = {}) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  keyMagenta(pixels, info.width, info.height);
  let buf = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 6 })
    .png()
    .toBuffer();
  if (square) {
    const resized = await sharp(buf).resize({ width: square - pad * 2, height: square - pad * 2, fit: 'inside' }).png().toBuffer();
    const rm = await sharp(resized).metadata();
    buf = await sharp({ create: { width: square, height: square, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: resized, left: Math.round((square - rm.width) / 2), top: Math.round((square - rm.height) / 2) }])
      .png()
      .toBuffer();
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(buf).png().toFile(dest);
  console.log('cut', path.basename(dest));
  return dest;
}

async function makeGlassCard(src, dest) {
  await cutMagenta(src, dest, { square: 1254, pad: 48 });
  const { data, info } = await sharp(dest).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = Buffer.from(data);
  const w = info.width, h = info.height;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const a = px[i + 3];
    if (a < 8) continue;
    const nx = Math.abs(x / w - 0.5) * 2;
    const ny = Math.abs(y / h - 0.5) * 2;
    const edge = Math.max(nx, ny);
    const glass = edge > 0.78 ? 0.94 : 0.48;
    px[i + 3] = Math.round(a * glass);
  }
  await sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toFile(dest);
  console.log('glass', path.basename(dest));
}

const poses = [
  ['goya-casual-idle.png', 'idle.png'],
  ['goya-casual-walk1.png', 'walk1.png'],
  ['goya-casual-walk2.png', 'walk2.png'],
  ['goya-casual-sit.png', 'sit.png'],
  ['goya-casual-sit.png', 'sit-sofa.png'],
  ['goya-casual-point.png', 'point.png'],
  ['goya-casual-present.png', 'present.png'],
  ['goya-casual-letter.png', 'letter.png'],
  ['goya-casual-lookup.png', 'lookup.png'],
  ['goya-casual-tablet.png', 'tablet.png'],
  ['goya-casual-archive.png', 'archive.png'],
  ['goya-casual-usher.png', 'usher.png'],
];
for (const [src, dest] of poses) {
  await cutMagenta(path.join(cursor, src), path.join(goyaDir, dest), { square: 1254 });
}
const fall = await cutMagenta(path.join(cursor, 'goya-casual-fall.png'), path.join(goyaDir, 'goya-fall-surprise.png'), { square: 1254 });
await fs.promises.copyFile(fall, path.join(goyaDir, 'goya-fall-flail.png'));
await fs.promises.copyFile(fall, path.join(goyaDir, 'goya-fall-mid.png'));
await fs.promises.copyFile(fall, path.join(goyaDir, 'goya-fall-tuck.png'));

const cards = [
  ['card-retriever.png', 'card-retriever.png'],
  ['card-tabby.png', 'card-tabby.png'],
  ['card-shiba.png', 'card-shiba.png'],
  ['card-grey-cat.png', 'card-grey-cat.png'],
  ['card-husky.png', 'card-husky.png'],
  ['card-beagle.png', 'card-beagle.png'],
  ['card-puppy.png', 'card-puppy.png'],
  ['card-black-cat.png', 'card-black-cat.png'],
];
for (const [src, dest] of cards) {
  await makeGlassCard(path.join(cursor, src), path.join(goyaDir, dest));
}
await fs.promises.copyFile(path.join(goyaDir, 'card-shiba.png'), path.join(goyaDir, 'goya-photocard-fall.png'));
await fs.promises.copyFile(path.join(goyaDir, 'idle.png'), path.join(root, 'assets/goya-idle.png'));
console.log('r18 apply done');
