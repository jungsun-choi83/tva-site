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
    return dist < 88 || (r > 160 && g < 110 && b > 70 && mag > 12 && r - g > 50);
  };

  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = i => { if (i >= 0 && i < w * h && !seen[i] && isBg(i)) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i - x) / w;
    if (x > 0) push(i - 1);
    if (x + 1 < w) push(i + 1);
    if (y > 0) push(i - w);
    if (y + 1 < h) push(i + w);
  }
  for (let pass = 0; pass < 1; pass++) {
    const extra = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (seen[i]) continue;
        if (seen[i - 1] || seen[i + 1] || seen[i - w] || seen[i + w]) extra.push(i);
      }
    }
    for (const i of extra) seen[i] = 1;
  }
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (seen[i]) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
      continue;
    }
    const r = data[p], g = data[p + 1], b = data[p + 2], a = data[p + 3];
    const x = i % w, y = (i - x) / w;
    const nearBg = (x > 0 && seen[i - 1]) || (x + 1 < w && seen[i + 1]) || (y > 0 && seen[i - w]) || (y + 1 < h && seen[i + w]);
    const spillG = g - Math.max(r, b);
    if (nearBg && spillG > 8) {
      const t = Math.min(1, spillG / 50);
      data[p + 1] = Math.round(g * (1 - t) + Math.max(r, b) * t);
      data[p + 3] = Math.round(a * (1 - t * 0.65));
    }
    const mag = Math.min(r, b) - g;
    if (nearBg && mag > 8 && r > 90) {
      const t = Math.min(1, mag / 55);
      data[p] = Math.round(r * (1 - t) + g * t);
      data[p + 2] = Math.round(b * (1 - t) + g * t);
      data[p + 3] = Math.round(a * (1 - t * 0.7));
    }
    if (data[p + 3] < 18) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    }
  }
}

function bounds(data, w, h, pad = 4) {
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

async function isolate(src, dst) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  floodKey(data, info.width, info.height);
  const box = bounds(data, info.width, info.height, 6);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(box)
    .png()
    .toFile(dst);
  const meta = await sharp(dst).metadata();
  console.log('isolated', path.basename(dst), meta.width, meta.height);
  return dst;
}

async function withShadow(src, { blur = 10, dx = 6, dy = 10 } = {}) {
  const meta = await sharp(src).metadata();
  const pad = Math.ceil(blur * 2 + Math.max(dx, dy) + 8);
  const w = meta.width + pad * 2;
  const h = meta.height + pad * 2;
  const sil = await sharp(src).ensureAlpha().modulate({ brightness: 0 }).blur(blur).png().toBuffer();
  const base = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  return sharp(base)
    .composite([
      { input: sil, left: pad + dx, top: pad + dy, blend: 'over' },
      { input: src, left: pad, top: pad, blend: 'over' },
    ])
    .png()
    .toBuffer();
}

async function compositeRoom(roomSrc, overlays, outWebp, outPng, { width = 1672, height = 941 } = {}) {
  const room = sharp(roomSrc).resize(width, height, { fit: 'fill' });
  const inputs = [];
  for (const ov of overlays) {
    const resized = await sharp(ov.src).resize({ width: ov.width }).png().toBuffer();
    const sized = await sharp(resized).metadata();
    const buf = ov.shadow !== false ? await withShadow(resized, ov.shadow || {}) : resized;
    const meta = await sharp(buf).metadata();
    const padX = Math.round((meta.width - sized.width) / 2);
    const padY = Math.round((meta.height - sized.height) / 2);
    inputs.push({
      input: buf,
      left: Math.max(0, Math.round(ov.left - padX)),
      top: Math.max(0, Math.round(ov.top - padY)),
      blend: 'over',
    });
  }
  const baked = await room.composite(inputs).png().toBuffer();
  await sharp(baked).png().toFile(outPng);
  await sharp(baked).webp({ quality: 92, effort: 5 }).toFile(outWebp);
  console.log('baked', path.basename(outWebp));
}

const dropSrc = path.join(cursorAssets, 'drop-cards-green.png');
const endSrc = path.join(cursorAssets, 'ending-album-green.png');
const dropIso = path.join(preview, 'drop-three-cards-iso.png');
const endIso = path.join(preview, 'ending-album-iso.png');
const endAlbumOnly = path.join(preview, 'ending-album-only.png');

await isolate(dropSrc, dropIso);
await isolate(endSrc, endIso);

const albumMeta = await sharp(endIso).metadata();
await sharp(endIso).png().toFile(endAlbumOnly);
console.log('album-only', albumMeta.width, albumMeta.height);

await compositeRoom(
  path.join(preview, 'landing-sofa-empty-v2-orig.webp'),
  [{ src: dropIso, width: 268, left: 438, top: 708, shadow: { blur: 7, dx: 3, dy: 6 } }],
  path.join(root, 'sofa-journey/assets/bg/landing-sofa-empty-v2.webp'),
  path.join(preview, 'landing-sofa-baked.png')
);

await compositeRoom(
  path.join(preview, 'living-room-clean-v1-orig.webp'),
  [
    { src: endAlbumOnly, width: 286, left: 808, top: 612, shadow: { blur: 8, dx: 4, dy: 7 } },
    { src: dropIso, width: 168, left: 1078, top: 652, shadow: { blur: 6, dx: 3, dy: 5 } },
  ],
  path.join(root, 'assets/ending/living-room-clean-v1.webp'),
  path.join(preview, 'living-room-baked.png')
);

await sharp(path.join(preview, 'living-room-baked.png'))
  .resize({ width: 1024 })
  .webp({ quality: 90, effort: 5 })
  .toFile(path.join(root, 'assets/ending/living-room-clean-v1-1024.webp'));
console.log('1024 done');
