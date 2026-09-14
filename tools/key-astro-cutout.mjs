import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets/c__Users____AppData_Roaming_Cursor_User_workspaceStorage_49169b2e67def388f5bbb3d140febc14_images_image-aff5e11b-089b-4798-9b44-a71276454a1f.png';
const dest = path.join(root, 'assets/goya/eb-astro-goya.png');

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const n = w * h;
const cx = (w - 1) / 2, cy = (h - 1) / 2, rad = Math.min(w, h) / 2 - 1;

const isSpace = i => {
  const p = i * 4;
  const R = data[p], G = data[p + 1], B = data[p + 2], A = data[p + 3];
  const x = i % w, y = (i / w) | 0;
  if (A < 8) return true;
  if (Math.hypot(x - cx, y - cy) > rad + 0.2) return true;
  const lum = 0.299 * R + 0.587 * G + 0.114 * B;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
  const sat = mx - mn;
  const tan = R > 78 && G > 42 && R - B > 24 && R >= G - 8;
  const orange = R > 140 && R - G > 30 && G > 60 && B < 90;
  const earth = B > 82 && B > R + 8 && G > 48 && y / h > 0.50 && sat > 28;
  if (earth) return true;
  const station = x / w > 0.66 && y / h < 0.34;
  if (station) return true;
  if (lum >= 58) return false;
  if (tan || orange) return false;
  if (sat < 28 && lum >= 48) return false;
  const dark = lum < 38;
  const nebula = sat > 50 && B >= G && B >= R * 0.9 && lum < 52;
  return dark || nebula;
};

const seen = new Uint8Array(n);
const stack = [];
const push = i => {
  if (i < 0 || i >= n || seen[i] || !isSpace(i)) return;
  seen[i] = 1;
  stack.push(i);
};
for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
while (stack.length) {
  const i = stack.pop();
  const x = i % w;
  if (x > 0) push(i - 1);
  if (x + 1 < w) push(i + 1);
  if (i >= w) push(i - w);
  if (i + w < n) push(i + w);
}

for (let i = 0; i < n; i++) {
  if (!seen[i]) continue;
  const p = i * 4;
  data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
}

// 가장자리만 아주 약하게. 팔·다리가 희미해지지 않게 유지.
for (let y = 1; y < h - 1; y++) {
  for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, p = i * 4;
    if (data[p + 3] === 0) continue;
    let gone = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (data[((y + dy) * w + x + dx) * 4 + 3] === 0) gone++;
    }
    if (gone >= 5) data[p + 3] = Math.min(data[p + 3], 230);
  }
}

const label = new Int32Array(n).fill(-1);
let best = 0, bestSize = 0, lab = 0;
for (let i = 0; i < n; i++) {
  if (data[i * 4 + 3] < 12 || label[i] >= 0) continue;
  const q = [i];
  label[i] = lab;
  let size = 0;
  while (q.length) {
    const j = q.pop();
    size++;
    const x = j % w;
    const neigh = [x > 0 ? j - 1 : -1, x + 1 < w ? j + 1 : -1, j >= w ? j - w : -1, j + w < n ? j + w : -1];
    for (const k of neigh) {
      if (k < 0 || label[k] >= 0 || data[k * 4 + 3] < 12) continue;
      label[k] = lab;
      q.push(k);
    }
  }
  if (size > bestSize) { bestSize = size; best = lab; }
  lab++;
}
for (let i = 0; i < n; i++) {
  if (label[i] === best) continue;
  const p = i * 4;
  data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
}

let minX = w, minY = h, maxX = 0, maxY = 0;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] < 20) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
}
const pad = 10;
const left = Math.max(0, minX - pad);
const top = Math.max(0, minY - pad);
const cropW = Math.min(w - left, maxX - minX + 1 + pad * 2);
const cropH = Math.min(h - top, maxY - minY + 1 + pad * 2);
await sharp(data, { raw: { width: w, height: h, channels: 4 } })
  .extract({ left, top, width: cropW, height: cropH })
  .png()
  .toFile(dest);
const ox = ((minX + maxX) / 2 - left) / cropW;
const oy = (maxY - top) / cropH;
console.log(JSON.stringify({ dest, cropW, cropH, ox: +ox.toFixed(3), oy: +oy.toFixed(3), bestSize }));
