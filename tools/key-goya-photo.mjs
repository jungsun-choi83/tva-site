import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const jobs = [
  ['goya-photo-walk-a.png', 'goya/goya-photo-walk-a.png'],
  ['goya-photo-walk-b.png', 'goya/goya-photo-walk-b.png'],
  ['goya-photo-walk-c.png', 'goya/goya-photo-walk-c.png'],
  ['goya-photo-walk-d.png', 'goya/goya-photo-walk-d.png'],
];
const CANVAS = 1024;
const SHOE = 990;

function floodKey(data, w, h) {
  const key = { r: 0, g: 0, b: 0, n: 0 };
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, 0], [0, h >> 1], [w - 1, h >> 1]]) {
    const p = (y * w + x) * 4;
    key.r += data[p]; key.g += data[p + 1]; key.b += data[p + 2]; key.n += 1;
  }
  key.r /= key.n; key.g /= key.n; key.b /= key.n;
  const isBg = i => {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const dist = Math.hypot(r - key.r, g - key.g, b - key.b);
    const mag = Math.min(r, b) - g;
    return dist < 88 || (r > 150 && g < 120 && b > 70 && mag > 12 && r - g > 36);
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = i => { if (i >= 0 && i < w * h && !seen[i] && isBg(i)) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x + 1 < w) push(i + 1);
    if (i >= w) push(i - w);
    if (i + w < w * h) push(i + w);
  }
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (seen[i]) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
      continue;
    }
    const r = data[p], g = data[p + 1], b = data[p + 2], a = data[p + 3];
    const x = i % w, y = (i - x) / w;
    const near = (x > 0 && seen[i - 1]) || (x + 1 < w && seen[i + 1]) || (y > 0 && seen[i - w]) || (y + 1 < h && seen[i + w]);
    const mag = Math.min(r, b) - g;
    if (near && mag > 8 && r > 90) {
      const t = Math.min(1, mag / 55);
      data[p] = Math.round(r * (1 - t) + g * t);
      data[p + 2] = Math.round(b * (1 - t) + g * t);
      data[p + 3] = Math.round(a * (1 - t * 0.72));
    }
    if (data[p + 3] < 16) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    }
    const mag2 = Math.min(data[p], data[p + 2]) - data[p + 1];
    if (data[p] > 180 && data[p + 1] < 90 && mag2 > 40) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    }
  }
}

function boxOf(data, w, h, pad = 8) {
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

for (const [srcName, destRel] of jobs) {
  const { data, info } = await sharp(path.join(cursor, srcName)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  floodKey(data, info.width, info.height);
  const box = boxOf(data, info.width, info.height, 4);
  const cut = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(box)
    .png()
    .toBuffer();
  const inkH = 930;
  const scaled = await sharp(cut).resize({ width: 900, height: 930, fit: 'inside' }).png().toBuffer();
  const sm = await sharp(scaled).metadata();
  const left = Math.round((CANVAS - sm.width) / 2);
  const top = SHOE - sm.height;
  const dest = path.join(root, 'assets', destRel);
  await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: scaled, left, top }]).png().toFile(dest);
  const { data: out, info: oi } = await sharp(dest).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = oi.width, minY = oi.height, maxX = 0, maxY = 0;
  for (let y = 0; y < oi.height; y++) {
    for (let x = 0; x < oi.width; x++) {
      if (out[(y * oi.width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const cx = (minX + maxX) / 2;
  console.log(JSON.stringify({
    file: destRel,
    bodyL: minX, bodyR: maxX, bodyT: minY, shoeB: maxY,
    fx: +(cx / CANVAS).toFixed(3),
    fy: +(maxY / CANVAS).toFixed(3),
    top: +(minY / CANVAS).toFixed(3),
    bot: +(maxY / CANVAS).toFixed(3),
  }));
}
