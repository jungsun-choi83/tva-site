import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proj = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const goyaDir = path.join(root, 'assets/goya');
const endDir = path.join(root, 'assets/ending');

function isMagenta(r, g, b) {
  const mag = Math.min(r, b) - g;
  return r > 70 && b > 50 && g < 160 && mag > 10 && (r + b) > g * 1.55;
}

async function keyMagenta(src, dst) {
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

  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 18) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 28;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const side = Math.max(cw, ch);
  const extracted = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: cw, height: ch })
    .png()
    .toBuffer();
  await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: extracted, left: Math.round((side - cw) / 2), top: Math.round((side - ch) / 2) }])
    .png()
    .toFile(dst);
  console.log('keyed', path.basename(dst), side);
}

await keyMagenta(path.join(proj, 'goya-holo-smile-key.png'), path.join(goyaDir, 'goya-holo-smile.png'));
await keyMagenta(path.join(proj, 'goya-phone-b-pink.png'), path.join(goyaDir, 'goya-phone-tap.png'));

const desk = await sharp(path.join(proj, 'ending-room-metal-cube.jpg'))
  .resize(1672, 941, { fit: 'cover', position: 'centre' })
  .toBuffer();
await sharp(desk).webp({ quality: 90 }).toFile(path.join(endDir, 'living-room-clean-v1.webp'));
await sharp(desk).resize(1024, 576).webp({ quality: 88 }).toFile(path.join(endDir, 'living-room-clean-v1-1024.webp'));
await sharp(desk).jpeg({ quality: 90 }).toFile(path.join(endDir, 'living-room-preview.jpg'));
await sharp(desk)
  .extract({ left: 1120, top: 160, width: 500, height: 420 })
  .jpeg({ quality: 92 })
  .toFile(path.join(endDir, '_cube-crop.jpg'));
console.log('room plates written');
