import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const goyaDir = path.join(root, 'assets/goya');
const bgDir = path.join(root, 'sofa-journey/assets/bg');

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

const poses = [
  ['goya-present.png', 'present.png'],
  ['goya-letter.png', 'letter.png'],
  ['goya-point.png', 'point.png'],
  ['goya-lookup.png', 'lookup.png'],
  ['goya-tablet.png', 'tablet.png'],
  ['goya-archive.png', 'archive.png'],
  ['goya-usher.png', 'usher.png'],
  ['goya-sit-sofa.png', 'sit-sofa.png'],
];
for (const [src, dest] of poses) {
  await cutMagenta(path.join(cursor, src), path.join(goyaDir, dest), { square: 1254 });
}

await cutMagenta(path.join(cursor, 'photocard-clear-frame.png'), path.join(goyaDir, 'goya-photocard-fall.png'), { square: 1254, pad: 36 });

const pairs = ['01','02','03','04','05','07','10','12','01','02','03','04','05','07','10'];
const dests = [
  'b1-1920s.webp','c1-1936.webp','c2-1945.webp','b2-1956.webp','c3-1964.webp',
  'b3-1969.webp','c4-1977.webp','c5-1985.webp','b4-1988.webp','b5-1989.webp',
  'b6-1991.webp','c6-1996.webp','b7-2002.webp','c7-2006.webp','c8-2012.webp',
];
fs.mkdirSync(bgDir, { recursive: true });
for (let i = 0; i < dests.length; i++) {
  await sharp(path.join(cursor, `hx-pair-${pairs[i]}.png`)).resize(1672, 941, { fit: 'cover' }).webp({ quality: 86 }).toFile(path.join(bgDir, dests[i]));
  console.log('era', dests[i]);
}

await fs.promises.copyFile(path.join(goyaDir, 'present.png'), path.join(root, 'assets/goya-idle.png'));
console.log('r17 apply done');
