import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const goyaDir = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12/assets/goya';
const bgDir = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12/sofa-journey/assets/bg';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';

function isMagenta(r, g, b) {
  const mag = Math.min(r, b) - g;
  return r > 88 && b > 60 && g < 120 && mag > 28 && (r + b) > g * 2.05;
}

function keyAndClose(data, w, h) {
  const n = w * h;
  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    if (isMagenta(r, g, b)) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
      alpha[i] = 0;
    } else {
      // despill
      const mag = Math.min(r, b) - g;
      if (mag > 10 && r > 70 && b > 50) {
        data[p] = Math.max(g + 8, r - mag);
        data[p + 2] = Math.max(g + 8, b - mag);
      }
      alpha[i] = data[p + 3] > 8 ? 1 : 0;
    }
  }
  // morphological close: dilate 2 then erode 2 to seal silhouette bites
  const dilate = (src) => {
    const out = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let on = 0;
      for (let oy = -2; oy <= 2 && !on; oy++) for (let ox = -2; ox <= 2; ox++) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (src[ny * w + nx]) on = 1;
      }
      out[y * w + x] = on;
    }
    return out;
  };
  const erode = (src) => {
    const out = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let on = 1;
      for (let oy = -2; oy <= 2 && on; oy++) for (let ox = -2; ox <= 2; ox++) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) { on = 0; break; }
        if (!src[ny * w + nx]) on = 0;
      }
      out[y * w + x] = on;
    }
    return out;
  };
  let mask = erode(dilate(alpha));
  // keep largest component
  const seen = new Uint8Array(n);
  let best = [];
  for (let i = 0; i < n; i++) {
    if (seen[i] || !mask[i]) continue;
    const cells = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop();
      cells.push(c);
      const x = c % w, y = (c / w) | 0;
      const neigh = [c + 1, c - 1, c + w, c - w];
      const ok = [x + 1 < w, x > 0, y + 1 < h, y > 0];
      for (let k = 0; k < 4; k++) {
        if (!ok[k]) continue;
        const np = neigh[k];
        if (seen[np] || !mask[np]) continue;
        seen[np] = 1;
        stack.push(np);
      }
    }
    if (cells.length > best.length) best = cells;
  }
  const keep = new Uint8Array(n);
  for (const p of best) keep[p] = 1;
  for (let i = 0; i < n; i++) {
    if (!keep[i]) { data[i * 4] = 0; data[i * 4 + 1] = 0; data[i * 4 + 2] = 0; data[i * 4 + 3] = 0; }
    else if (data[i * 4 + 3] < 16) data[i * 4 + 3] = 255;
  }
  // peel one extra rim so leftover key colour never survives
  const rim = Buffer.from(data);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    if (rim[i + 3] < 16) continue;
    const r = rim[i], g = rim[i + 1], b = rim[i + 2];
    const hole =
      rim[((y) * w + (x + 1)) * 4 + 3] < 16 ||
      rim[((y) * w + (x - 1)) * 4 + 3] < 16 ||
      rim[((y + 1) * w + x) * 4 + 3] < 16 ||
      rim[((y - 1) * w + x) * 4 + 3] < 16;
    if (hole && (isMagenta(r, g, b) || (r > 160 && b > 70 && g < 90))) {
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
    }
  }
  // 1px feather using neighbour fur colour, never leftover key colour
  const copy = Buffer.from(data);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    if (copy[i + 3] !== 0) continue;
    let c = 0, sr = 0, sg = 0, sb = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const ni = ((y + oy) * w + (x + ox)) * 4;
      if (copy[ni + 3] > 80) { c++; sr += copy[ni]; sg += copy[ni + 1]; sb += copy[ni + 2]; }
    }
    if (c) {
      data[i] = Math.round(sr / c);
      data[i + 1] = Math.round(sg / c);
      data[i + 2] = Math.round(sb / c);
      data[i + 3] = Math.min(160, c * 20);
    }
  }
}

async function cutout(src, dest, { square = 0 } = {}) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  keyAndClose(pixels, info.width, info.height);
  let buf = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
  if (square) {
    const resized = await sharp(buf).resize({ width: square - 80, height: square - 80, fit: 'inside' }).png().toBuffer();
    const rm = await sharp(resized).metadata();
    buf = await sharp({ create: { width: square, height: square, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: resized, left: Math.round((square - rm.width) / 2), top: Math.round((square - rm.height) / 2) }])
      .png()
      .toBuffer();
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(buf).png().toFile(dest);
  console.log('ok', path.basename(dest));
}

const jobs = [
  ['goya-lux-idle.png', path.join(goyaDir, 'idle.png'), {}],
  ['goya-lux-walk1.png', path.join(goyaDir, 'walk1.png'), {}],
  ['goya-lux-walk2.png', path.join(goyaDir, 'walk2.png'), {}],
  ['goya-lux-sit.png', path.join(goyaDir, 'sit.png'), {}],
  ['goya-lux-fall-surprise.png', path.join(goyaDir, 'goya-fall-surprise.png'), { square: 1254 }],
  ['goya-lux-fall-flail.png', path.join(goyaDir, 'goya-fall-flail.png'), { square: 1254 }],
  ['goya-lux-fall-mid.png', path.join(goyaDir, 'goya-fall-mid.png'), { square: 1254 }],
  ['goya-lux-fall-tuck.png', path.join(goyaDir, 'goya-fall-tuck.png'), { square: 1254 }],
  ['goya-lux-sit-smile.png', path.join(goyaDir, 'goya-cartoon-sit.png'), { square: 1254 }],
];

for (const [src, dest, opt] of jobs) {
  await cutout(path.join(cursor, src), dest, opt);
}

await fs.promises.copyFile(path.join(goyaDir, 'idle.png'), path.join(root, 'assets/goya-idle.png'));

await sharp(path.join(cursor, 'landing-lux-cartoon.png'))
  .resize(1672, 941, { fit: 'cover' })
  .webp({ quality: 88 })
  .toFile(path.join(bgDir, 'landing-sofa-empty-v2.webp'));
await sharp(path.join(cursor, 'landing-lux-cartoon.png'))
  .resize(1672, 941, { fit: 'cover' })
  .webp({ quality: 88 })
  .toFile(path.join(bgDir, 'b8-2020s.webp'));
console.log('landing ok');
