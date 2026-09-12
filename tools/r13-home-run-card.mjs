import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const goyaDir = path.join(root, 'assets/goya');
const bgDir = path.join(root, 'sofa-journey/assets/bg');

function isMagenta(r, g, b) {
  const mag = Math.min(r, b) - g;
  return r > 80 && b > 50 && g < 145 && mag > 16 && (r + b) > g * 1.65;
}

function keyAndKeepInterior(data, w, h) {
  const n = w * h;
  const keep = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    if (isMagenta(r, g, b)) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    } else {
      const mag = Math.min(r, b) - g;
      if (mag > 8 && r > 55 && b > 40 && g < 155) {
        data[p] = Math.max(g, r - mag);
        data[p + 2] = Math.max(g, b - mag);
      }
      keep[i] = data[p + 3] > 10 ? 1 : 0;
    }
  }
  const seen = new Uint8Array(n);
  const blobs = [];
  for (let i = 0; i < n; i++) {
    if (seen[i] || !keep[i]) continue;
    const cells = [];
    let edge = false;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop();
      cells.push(c);
      const x = c % w, y = (c / w) | 0;
      if (x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2) edge = true;
      const neigh = [c + 1, c - 1, c + w, c - w];
      const ok = [x + 1 < w, x > 0, y + 1 < h, y > 0];
      for (let k = 0; k < 4; k++) {
        if (!ok[k]) continue;
        const np = neigh[k];
        if (seen[np] || !keep[np]) continue;
        seen[np] = 1;
        stack.push(np);
      }
    }
    blobs.push({ cells, edge, n: cells.length });
  }
  blobs.sort((a, b) => b.n - a.n);
  const interior = blobs.filter((b) => !b.edge);
  const chosen = (interior[0] && interior[0].n > 800) ? interior[0] : blobs[0];
  const main = new Uint8Array(n);
  if (chosen) for (const p of chosen.cells) main[p] = 1;
  for (let i = 0; i < n; i++) {
    if (!main[i]) { data[i * 4] = 0; data[i * 4 + 1] = 0; data[i * 4 + 2] = 0; data[i * 4 + 3] = 0; }
  }
}

async function cut(src, dest, square) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  keyAndKeepInterior(pixels, info.width, info.height);
  let buf = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 6 })
    .png()
    .toBuffer();
  const pad = 36;
  const resized = await sharp(buf).resize({ width: square - pad * 2, height: square - pad * 2, fit: 'inside' }).png().toBuffer();
  const rm = await sharp(resized).metadata();
  buf = await sharp({ create: { width: square, height: square, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left: Math.round((square - rm.width) / 2), top: Math.round((square - rm.height) / 2) }])
    .png()
    .toBuffer();
  await sharp(buf).png().toFile(dest);
  console.log('ok', path.basename(dest));
}

await cut(path.join(cursor, 'goya-run-right.png'), path.join(goyaDir, 'walk1.png'), 1024);
await fs.promises.copyFile(path.join(goyaDir, 'walk1.png'), path.join(goyaDir, 'walk2.png'));
await cut(path.join(cursor, 'goya-card-only.png'), path.join(goyaDir, 'goya-photocard-fall.png'), 1254);

const plate = await sharp(path.join(cursor, 'landing-80s-home-real.png')).resize(1672, 941, { fit: 'cover' }).png().toBuffer();
await sharp(plate).webp({ quality: 91 }).toFile(path.join(bgDir, 'landing-sofa-empty-v2.webp'));
await sharp(plate).png().toFile(path.join(bgDir, 'landing-home-preview.png'));
const dust = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1672" height="941">
  <defs><radialGradient id="g" cx="48%" cy="52%" r="22%">
    <stop offset="0%" stop-color="#e8c97a" stop-opacity="0.14"/>
    <stop offset="55%" stop-color="#6ecfc8" stop-opacity="0.06"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`);
await sharp(plate).composite([{ input: dust, blend: 'screen' }]).webp({ quality: 91 }).toFile(path.join(bgDir, 'b8-2020s.webp'));
console.log('plates ok');
