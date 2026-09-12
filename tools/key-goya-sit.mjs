import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets/goya-sit-henley-key.png';
const dst = path.join(root, 'assets/goya/goya-sit-henley.png');

function isMagenta(r, g, b) {
  const mag = Math.min(r, b) - g;
  return r > 70 && b > 50 && g < 150 && mag > 12 && (r + b) > g * 1.7;
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
for (let i = 0; i < w * h; i++) {
  const p = i * 4;
  const r = data[p], g = data[p + 1], b = data[p + 2];
  if (isMagenta(r, g, b)) {
    data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
  } else {
    const mag = Math.min(r, b) - g;
    if (mag > 6 && r > 50 && b > 40 && g < 160) {
      const t = Math.min(1, mag / 70);
      data[p + 3] = Math.round(data[p + 3] * (1 - t));
      data[p] = Math.max(g, r - mag);
      data[p + 2] = Math.max(g, b - mag);
    }
  }
}
await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(dst);
console.log('wrote', dst, w, h);
