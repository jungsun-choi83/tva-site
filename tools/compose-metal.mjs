import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const goyaDir = path.join(root, 'assets/goya');
const bgDir = path.join(root, 'sofa-journey/assets/bg');
const heroDir = path.join(root, 'assets/hero');

function isMagenta(r, g, b) {
  const mag = Math.min(r, b) - g;
  return r > 80 && b > 55 && g < 130 && mag > 22 && (r + b) > g * 1.9;
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
      if (mag > 8 && r > 60 && b > 45 && g < 140) {
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

async function cutMagenta(src, dest, { square = 0, pad = 12 } = {}) {
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
  const m = await sharp(dest).metadata();
  console.log('cut', path.basename(dest), m.width + 'x' + m.height);
  return dest;
}

const metalPath = await cutMagenta(path.join(cursor, 'metal-magenta.png'), path.join(heroDir, 'beam-metal-cutout.png'));
await cutMagenta(path.join(cursor, 'goya-black-sit-back.png'), path.join(goyaDir, 'goya-sit-watch.png'), { square: 1254 });

const cube = await sharp(metalPath).resize({ width: 360, height: 400, fit: 'inside' }).png().toBuffer();
const cm = await sharp(cube).metadata();
const room = await sharp(path.join(cursor, 'landing-empty-cabinet.png')).resize(1672, 941, { fit: 'cover' }).png().toBuffer();
const left = Math.round(1672 * 0.515 - cm.width * 0.48);
const top = Math.round(941 * 0.175);
const shadow = await sharp({
  create: { width: Math.round(cm.width * 0.78), height: 28, channels: 4, background: { r: 18, g: 10, b: 6, alpha: 0.38 } },
}).blur(10).png().toBuffer();

const composed = await sharp(room).composite([
  { input: shadow, left: left + 28, top: top + cm.height - 18 },
  { input: cube, left, top },
]).png().toBuffer();

await sharp(composed).webp({ quality: 91 }).toFile(path.join(bgDir, 'landing-sofa-empty-v2.webp'));
await sharp(composed).png().toFile(path.join(bgDir, 'landing-home-preview.png'));

const dust = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1672" height="941">
  <defs><radialGradient id="g" cx="53%" cy="32%" r="28%">
    <stop offset="0%" stop-color="#e8c97a" stop-opacity="0.22"/>
    <stop offset="55%" stop-color="#6ecfc8" stop-opacity="0.10"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`);
await sharp(composed).composite([{ input: dust, blend: 'screen' }]).webp({ quality: 91 }).toFile(path.join(bgDir, 'b8-2020s.webp'));

const heroCube = await sharp(metalPath).resize({ width: 920, height: 920, fit: 'inside' }).png().toBuffer();
const hm = await sharp(heroCube).metadata();
await sharp({ create: { width: 1920, height: 1080, channels: 4, background: { r: 7, g: 7, b: 9, alpha: 1 } } })
  .composite([{ input: heroCube, left: 1920 - hm.width - 70, top: Math.round((1080 - hm.height) / 2) }])
  .png()
  .toFile(path.join(heroDir, 'beam-device-1920x1080.png'));

console.log('compose', { left, top, cw: cm.width, ch: cm.height, hw: hm.width, hh: hm.height });
