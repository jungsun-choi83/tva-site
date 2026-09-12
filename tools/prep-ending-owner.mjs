import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proj = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const goyaDir = path.join(root, 'assets/goya');

function isMagenta(r, g, b) {
  const mag = Math.min(r, b) - g;
  return r > 70 && b > 50 && g < 160 && mag > 10 && (r + b) > g * 1.55;
}

async function extractContent(data, w, h, pad, dst, label) {
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
  console.log(label, path.basename(dst), cw, ch);
}

async function keyMagenta(src, dst, pad = 8) {
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
  await extractContent(data, w, h, pad, dst, 'keyed');
}

async function retrimPng(src, dst, pad = 8) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  await extractContent(data, info.width, info.height, pad, dst, 'retrim');
}

await keyMagenta(path.join(proj, 'goya-holo-smile-v2.png'), path.join(goyaDir, 'goya-holo-smile.png'), 8);
await keyMagenta(path.join(proj, 'owner-girl-watch.png'), path.join(goyaDir, 'owner-girl-sit.png'), 8);
await retrimPng(path.join(goyaDir, 'goya-phone-tap.png'), path.join(goyaDir, 'goya-phone-tap.png'), 8);
