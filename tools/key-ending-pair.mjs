import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets/goya-girl-look-cube-app.png';
const dst = path.join(root, 'assets/goya/goya-girl-buddy-sit.png');
const preview = path.join(root, 'tools/.preview');

function floodKey(data, w, h) {
  const key = { r: 0, g: 0, b: 0, n: 0 };
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, 0]];
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
    const mag = Math.min(r, b) - g;
    if (r > 170 && b > 90 && g < 140 && mag > 40 && r - g > 50) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    } else if (data[p + 3] < 18) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    }
  }
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
floodKey(data, info.width, info.height);
let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 16) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
}
const pad = 10;
minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
maxX = Math.min(info.width - 1, maxX + pad); maxY = Math.min(info.height - 1, maxY + pad);
await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
  .png()
  .toFile(dst);
const pair = await sharp(dst).metadata();
console.log('sit', pair.width, pair.height);

const room = path.join(root, 'assets/ending/living-room-clean-v1.webp');
const pairH = Math.round(941 * 0.43);
const pairBuf = await sharp(dst).resize({ height: pairH }).png().toBuffer();
const seatY = Math.round(941 * 0.705);
const hip = 0.50;
const left = Math.round(1672 * 0.345);
const top = Math.round(seatY - pairH * hip);
await sharp(room).resize(1672, 941).composite([{ input: pairBuf, left, top }]).jpeg({ quality: 90 }).toFile(path.join(preview, 'ending-sit-check.jpg'));
console.log('preview', { left, top, pairH });
