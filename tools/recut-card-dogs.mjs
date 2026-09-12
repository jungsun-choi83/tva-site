import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const goyaDir = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12/assets/goya';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';

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
  const copy = Buffer.from(data);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    if (copy[i + 3] !== 0) continue;
    let c = 0, sr = 0, sg = 0, sb = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const ni = ((y + oy) * w + (x + ox)) * 4;
      if (copy[ni + 3] > 80) { c++; sr += copy[ni]; sg += copy[ni + 1]; sb += copy[ni + 2]; }
    }
    if (c >= 2) {
      data[i] = Math.round(sr / c);
      data[i + 1] = Math.round(sg / c);
      data[i + 2] = Math.round(sb / c);
      data[i + 3] = Math.min(150, c * 22);
    }
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
  const pad = 48;
  const resized = await sharp(buf).resize({ width: square - pad * 2, height: square - pad * 2, fit: 'inside' }).png().toBuffer();
  const rm = await sharp(resized).metadata();
  buf = await sharp({ create: { width: square, height: square, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left: Math.round((square - rm.width) / 2), top: Math.round((square - rm.height) / 2) }])
    .png()
    .toBuffer();
  await sharp(buf).png().toFile(dest);
  console.log('ok', path.basename(dest), rm.width + 'x' + rm.height);
}

const jobs = [
  ['goya-card-idle.png', path.join(goyaDir, 'idle.png'), 1024],
  ['goya-card-walk1.png', path.join(goyaDir, 'walk1.png'), 1024],
  ['goya-card-sit.png', path.join(goyaDir, 'sit.png'), 1024],
  ['goya-card-sit.png', path.join(goyaDir, 'goya-cartoon-sit.png'), 1254],
  ['goya-card-fall-surprise.png', path.join(goyaDir, 'goya-fall-surprise.png'), 1254],
  ['goya-card-fall-flail.png', path.join(goyaDir, 'goya-fall-flail.png'), 1254],
  ['goya-card-fall-mid.png', path.join(goyaDir, 'goya-fall-mid.png'), 1254],
  ['goya-card-fall-tuck.png', path.join(goyaDir, 'goya-fall-tuck.png'), 1254],
];
for (const [src, dest, square] of jobs) {
  await cut(path.join(cursor, src), dest, square);
}
await fs.promises.copyFile(path.join(goyaDir, 'walk1.png'), path.join(goyaDir, 'walk2.png'));
await fs.promises.copyFile(path.join(goyaDir, 'idle.png'), path.join(root, 'assets/goya-idle.png'));
console.log('recut ok');
