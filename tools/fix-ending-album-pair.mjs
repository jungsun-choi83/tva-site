import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preview = path.join(root, 'tools/.preview');
const W = 1672;
const H = 941;

async function raw(src) {
  const { data, info } = await sharp(src).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, ...info };
}

const orig = await raw(path.join(preview, 'living-room-clean-v1-orig.webp'));
const withAlbum = await raw(path.join(root, 'assets/ending/living-room-clean-v1.webp'));
const album = Buffer.from(orig.data);
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let i = 0; i < W * H; i++) {
  const p = i * 4;
  const dr = Math.abs(withAlbum.data[p] - orig.data[p]);
  const dg = Math.abs(withAlbum.data[p + 1] - orig.data[p + 1]);
  const db = Math.abs(withAlbum.data[p + 2] - orig.data[p + 2]);
  const diff = dr + dg + db;
  if (diff > 42) {
    album[p] = withAlbum.data[p];
    album[p + 1] = withAlbum.data[p + 1];
    album[p + 2] = withAlbum.data[p + 2];
    album[p + 3] = 255;
    const x = i % W, y = (i - x) / W;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  } else {
    album[p] = 0; album[p + 1] = 0; album[p + 2] = 0; album[p + 3] = 0;
  }
}
const pad = 8;
minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad);
const cut = await sharp(album, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
  .png()
  .toBuffer();
const rotated = await sharp(cut).rotate(180, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const rotMeta = await sharp(rotated).metadata();
const left = Math.round(minX + ((maxX - minX + 1) - rotMeta.width) / 2);
const top = Math.round(minY + ((maxY - minY + 1) - rotMeta.height) / 2);
const baked = await sharp(orig.data, { raw: { width: W, height: H, channels: 4 } })
  .png()
  .toBuffer();
const roomBuf = await sharp(baked).composite([{ input: rotated, left: Math.max(0, left), top: Math.max(0, top) }]).png().toBuffer();
await sharp(roomBuf).webp({ quality: 92, effort: 5 }).toFile(path.join(root, 'assets/ending/living-room-clean-v2.webp'));
await sharp(roomBuf).resize({ width: 1024 }).webp({ quality: 90, effort: 5 }).toFile(path.join(root, 'assets/ending/living-room-clean-v2-1024.webp'));
await sharp(roomBuf).jpeg({ quality: 90 }).toFile(path.join(preview, 'living-room-album-sofa.jpg'));
await sharp(rotated).png().toFile(path.join(preview, 'album-rotated-cut.png'));
console.log('album box', { minX, minY, maxX, maxY, left, top, rw: rotMeta.width, rh: rotMeta.height });

const pairSrc = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets/goya-girl-look-cube-app.png';
const pairOut = path.join(root, 'assets/goya/goya-girl-buddy-sit.png');
const { data, info } = await sharp(pairSrc).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width, h = info.height;
const key = { r: 0, g: 0, b: 0, n: 0 };
for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, 0], [0, h >> 1]]) {
  const p = (y * w + x) * 4;
  key.r += data[p]; key.g += data[p + 1]; key.b += data[p + 2]; key.n += 1;
}
key.r /= key.n; key.g /= key.n; key.b /= key.n;
const isMag = (r, g, b) => {
  const mag = Math.min(r, b) - g;
  const dist = Math.hypot(r - key.r, g - key.g, b - key.b);
  return dist < 70 || (r > 140 && b > 80 && g < 150 && mag > 18 && r - g > 28);
};
for (let i = 0; i < w * h; i++) {
  const p = i * 4;
  const r = data[p], g = data[p + 1], b = data[p + 2];
  if (isMag(r, g, b)) {
    data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    continue;
  }
  const mag = Math.min(r, b) - g;
  if (mag > 6 && r > 80 && b > 50 && g < 190) {
    const t = Math.min(1, mag / 48);
    data[p] = Math.round(r * (1 - t) + g * t);
    data[p + 2] = Math.round(b * (1 - t) + g * t);
    data[p + 3] = Math.round(data[p + 3] * (1 - t * 0.55));
  }
  if (data[p + 3] < 20) { data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0; }
}
let pminX = w, pminY = h, pmaxX = 0, pmaxY = 0;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 18) {
      if (x < pminX) pminX = x; if (x > pmaxX) pmaxX = x;
      if (y < pminY) pminY = y; if (y > pmaxY) pmaxY = y;
    }
  }
}
const pp = 8;
pminX = Math.max(0, pminX - pp); pminY = Math.max(0, pminY - pp);
pmaxX = Math.min(w - 1, pmaxX + pp); pmaxY = Math.min(h - 1, pmaxY + pp);
await sharp(data, { raw: { width: w, height: h, channels: 4 } })
  .extract({ left: pminX, top: pminY, width: pmaxX - pminX + 1, height: pmaxY - pminY + 1 })
  .png()
  .toFile(pairOut);
const pairMeta = await sharp(pairOut).metadata();
console.log('pair', pairMeta.width, pairMeta.height);

const pairH = Math.round(H * 0.43);
const pairBuf = await sharp(pairOut).resize({ height: pairH }).png().toBuffer();
const seatY = Math.round(H * 0.705);
const hip = 0.50;
const px = Math.round(W * 0.42);
const py = Math.round(seatY - pairH * hip);
await sharp(roomBuf).composite([{ input: pairBuf, left: px, top: py }]).jpeg({ quality: 90 }).toFile(path.join(preview, 'ending-sit-check.jpg'));
console.log('place', { px, py, pairH });
