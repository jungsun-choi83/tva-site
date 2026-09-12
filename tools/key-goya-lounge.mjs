import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets/goya-ottoman-sit-key.png';
const dst = path.join(root, 'assets/goya/goya-ottoman-sit.png');

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;

function isMagenta(r, g, b) {
  return r > 180 && g < 40 && b > 50 && b < 140 && (r - g) > 140;
}

for (let i = 0; i < w * h; i++) {
  const p = i * 4;
  const r = data[p], g = data[p + 1], b = data[p + 2];
  if (isMagenta(r, g, b)) {
    data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    continue;
  }
  const chroma = r - g;
  if (r > 150 && g < 90 && b > 40 && b < 160 && chroma > 80) {
    const t = Math.min(1, (chroma - 80) / 80);
    data[p + 3] = Math.round(data[p + 3] * (1 - t * 0.92));
    if (data[p + 3] < 12 || g < 18) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    }
  }
}

const copy = Buffer.from(data);
for (let y = 1; y < h - 1; y++) {
  for (let x = 1; x < w - 1; x++) {
    const p = (y * w + x) * 4;
    if (copy[p + 3] < 12) continue;
    let empty = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (copy[((y + dy) * w + (x + dx)) * 4 + 3] < 12) empty++;
      }
    }
    if (empty >= 2) {
      const r = copy[p], g = copy[p + 1], b = copy[p + 2];
      if (r > 140 && g < 90 && (r - g) > 70) {
        data[p + 3] = 0; data[p] = 0; data[p + 1] = 0; data[p + 2] = 0;
      } else if (empty >= 4) {
        data[p + 3] = Math.round(copy[p + 3] * 0.45);
      }
    }
  }
}

let minX = w, minY = h, maxX = 0, maxY = 0;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 18) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
}
const pad = 24;
minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);

const cw = maxX - minX + 1, ch = maxY - minY + 1;
const side = Math.max(cw, ch);
const left = Math.round((side - cw) / 2);
const top = Math.round((side - ch) / 2);
const extracted = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
  .extract({ left: minX, top: minY, width: cw, height: ch })
  .png()
  .toBuffer();
await sharp({
  create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: extracted, left, top }])
  .png()
  .toFile(dst);
console.log('wrote', dst, side, 'content', cw, ch, 'pad', left, top);
