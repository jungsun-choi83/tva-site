import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cursorAssets = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const preview = path.join(root, 'tools/.preview');
fs.mkdirSync(preview, { recursive: true });

function floodKey(data, w, h) {
  const key = { r: 0, g: 0, b: 0, n: 0 };
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, 0], [0, h >> 1], [w - 1, h >> 1]];
  for (const [x, y] of corners) {
    const p = (y * w + x) * 4;
    key.r += data[p]; key.g += data[p + 1]; key.b += data[p + 2]; key.n += 1;
  }
  key.r /= key.n; key.g /= key.n; key.b /= key.n;
  const isBg = i => {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const dist = Math.hypot(r - key.r, g - key.g, b - key.b);
    const mag = Math.min(r, b) - g;
    return dist < 92 || (r > 150 && g < 120 && b > 80 && mag > 14 && r - g > 40);
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
    if (seen[i]) { data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0; continue; }
    const r = data[p], g = data[p + 1], b = data[p + 2], a = data[p + 3];
    const x = i % w, y = (i - x) / w;
    const near = (x > 0 && seen[i - 1]) || (x + 1 < w && seen[i + 1]) || (y > 0 && seen[i - w]) || (y + 1 < h && seen[i + w]);
    const mag = Math.min(r, b) - g;
    if (near && mag > 8 && r > 90) {
      const t = Math.min(1, mag / 55);
      data[p] = Math.round(r * (1 - t) + g * t);
      data[p + 2] = Math.round(b * (1 - t) + g * t);
      data[p + 3] = Math.round(a * (1 - t * 0.7));
    }
    if (data[p + 3] < 18) { data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0; }
  }
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const mag = Math.min(r, b) - g;
    const spillG = g - Math.max(r, b);
    if ((r > 170 && b > 90 && g < 140 && mag > 40 && r - g > 50) || spillG > 22 || r + g + b < 28) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    }
  }
}

function boxOf(data, w, h, pad = 6) {
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

async function isolate(src, dst, pad = 8) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  floodKey(data, info.width, info.height);
  const box = boxOf(data, info.width, info.height, pad);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract(box).png().toFile(dst);
  const meta = await sharp(dst).metadata();
  console.log('isolated', path.basename(dst), meta.width, meta.height);
  return dst;
}

async function flattenOnTable(src, { width, flatten, skew, rotate }) {
  const rotated = await sharp(src).rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).resize({ width }).png().toBuffer();
  const flat = await sharp(rotated).affine([[1, skew], [0, flatten]], { background: { r: 0, g: 0, b: 0, alpha: 0 }, interpolator: sharp.interpolators.nohalo }).png().toBuffer();
  const meta = await sharp(flat).metadata();
  const pad = 18;
  const sil = await sharp(flat).ensureAlpha().modulate({ brightness: 0 }).blur(7).png().toBuffer();
  const base = await sharp({ create: { width: meta.width + pad * 2, height: meta.height + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  return sharp(base).composite([
    { input: sil, left: pad + 4, top: pad + 6, blend: 'over' },
    { input: flat, left: pad, top: pad, blend: 'over' },
  ]).png().toBuffer();
}

const pairSrc = path.join(cursorAssets, 'goya-girl-app-sit.png');
const pairOut = path.join(root, 'assets/goya/goya-girl-buddy-sit.png');
await isolate(pairSrc, pairOut, 10);

const albumKeyed = path.join(preview, 'ending-album-3d-keyed.png');
await isolate(path.join(preview, 'ending-album-only.png'), albumKeyed, 4);
const album = await flattenOnTable(albumKeyed, { width: 410, flatten: 1, skew: 0, rotate: 180 });
await sharp(album).png().toFile(path.join(preview, 'laid-album-sofa.png'));
const albumMeta = await sharp(album).metadata();
console.log('album laid', albumMeta.width, albumMeta.height);

const roomOrig = path.join(preview, 'living-room-clean-v1-orig.webp');
const baked = await sharp(roomOrig).resize(1672, 941, { fit: 'fill' }).composite([{ input: album, left: 792, top: 642, blend: 'over' }]).png().toBuffer();
await sharp(baked).png().toFile(path.join(preview, 'living-room-baked.png'));
await sharp(baked).extract({ left: 620, top: 500, width: 680, height: 320 }).jpeg({ quality: 92 }).toFile(path.join(preview, 'ending-table-zoom.jpg'));
await sharp(baked).webp({ quality: 92, effort: 5 }).toFile(path.join(root, 'assets/ending/living-room-clean-v1.webp'));
await sharp(baked).resize({ width: 1024 }).webp({ quality: 90, effort: 5 }).toFile(path.join(root, 'assets/ending/living-room-clean-v1-1024.webp'));

const pairMeta = await sharp(pairOut).metadata();
const pairH = Math.round(941 * 0.42);
const pairW = Math.round(pairH * (pairMeta.width / pairMeta.height));
const pairBuf = await sharp(pairOut).resize({ height: pairH }).png().toBuffer();
const seatY = Math.round(941 * 0.688);
const hip = 0.46;
const left = Math.round(1672 * 0.388);
const top = Math.round(seatY - pairH * hip);
const check = await sharp(baked).composite([{ input: pairBuf, left, top, blend: 'over' }]).jpeg({ quality: 90 }).toFile(path.join(preview, 'ending-sit-check.jpg'));
console.log('pair', pairMeta.width, pairMeta.height, 'place', { left, top, pairW, pairH });
console.log('baked room + sit check');
