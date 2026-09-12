import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proj = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const endDir = path.join(root, 'assets/ending');
const goyaDir = path.join(root, 'assets/goya');

function isMagenta(r, g, b) {
  const mag = Math.min(r, b) - g;
  return r > 70 && b > 50 && g < 160 && mag > 10 && (r + b) > g * 1.55;
}

async function keyMagenta(src, dst, pad = 6, eraseLeftFur = false) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    if (isMagenta(r, g, b)) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
      continue;
    }
    const mag = Math.min(r, b) - g;
    if (mag > 5 && r > 45 && b > 35 && g < 170) {
      const t = Math.min(1, mag / 70);
      data[p + 3] = Math.round(data[p + 3] * (1 - t));
      data[p] = Math.max(g, r - mag);
      data[p + 2] = Math.max(g, b - mag);
    }
  }
  if (eraseLeftFur) {
    for (let y = Math.floor(h * .48); y < Math.floor(h * .72); y++) {
      for (let x = 0; x < w * .22; x++) {
        const p = (y * w + x) * 4;
        if (data[p + 3] < 18) continue;
        const r = data[p], g = data[p + 1], b = data[p + 2];
        const isFur = r > 40 && g > 25 && b < 110 && r > b + 12 && g < 170;
        const isSweater = r > 190 && g > 170 && b > 140;
        const isSkin = r > 160 && g > 110 && b > 80 && r > b + 20;
        if (isFur && !isSweater && !isSkin) data[p + 3] = 0;
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
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: cw, height: ch })
    .png()
    .toFile(dst);
  console.log('keyed', path.basename(dst), cw, ch);
}

const inspect = path.join(root, 'tools/_ending-stripe.png');
await sharp(path.join(proj, 'ending-room-stripe.png')).resize(1672, 941, { fit: 'cover', position: 'centre' }).png().toFile(inspect);
await sharp(inspect).webp({ quality: 95, effort: 5 }).toFile(path.join(endDir, 'living-room-clean-v1.webp'));
await sharp(inspect).resize(1400, 788).webp({ quality: 94, effort: 5 }).toFile(path.join(endDir, 'living-room-clean-v1-1024.webp'));
console.log('room 1672 941');

await keyMagenta(path.join(proj, 'goya-girl-buddy.png'), path.join(goyaDir, 'goya-girl-buddy.png'), 6, true);
await keyMagenta(path.join(proj, 'goya-holo-quad.png'), path.join(goyaDir, 'goya-holo-quad.png'), 8, false);
