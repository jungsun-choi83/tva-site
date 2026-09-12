import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursorAssets = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const goyaDir = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12/assets/goya';

function chromaKey(data, w, h) {
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const maxRB = Math.max(r, b);
    const greenness = g - maxRB;
    let a = data[p + 3];
    if (g > 70 && greenness > 28 && g > r * 1.12 && g > b * 1.12) a = 0;
    else if (g > 60 && greenness > 14) {
      a = Math.max(0, Math.min(a, 255 - greenness * 6));
      data[p + 1] = Math.min(g, maxRB + 12);
    }
    data[p + 3] = a;
  }
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    const i = p * 4;
    if (data[i + 3] < 12) { stack.push(p); return; }
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (g > 90 && g - Math.max(r, b) > 20) stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    data[p * 4 + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
}

async function keyToGoya(src, dest) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  chromaKey(pixels, info.width, info.height);
  const trimmed = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 12 })
    .png()
    .toBuffer();
  const size = 1254;
  const fit = 1158;
  const resized = await sharp(trimmed).resize({ width: fit, height: fit, fit: 'inside' }).png().toBuffer();
  const rm = await sharp(resized).metadata();
  const left = Math.round((size - rm.width) / 2);
  const top = Math.round((size - rm.height) / 2);
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(dest);
  console.log('wrote', dest, rm.width, 'x', rm.height);
}

const frames = [
  ['goya-walk-a-key.png', 'walk-a.png'],
  ['goya-walk-b-key.png', 'walk-b.png'],
  ['goya-walk-c-key.png', 'walk-c.png'],
  ['goya-walk-d-key.png', 'walk-d.png'],
];
for (const [srcName, destName] of frames) {
  await keyToGoya(path.join(cursorAssets, srcName), path.join(goyaDir, destName));
}
