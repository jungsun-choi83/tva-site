import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const CANVAS = 512;

function floodKey(data, w, h) {
  const key = { r: 0, g: 0, b: 0, n: 0 };
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, 0]]) {
    const p = (y * w + x) * 4;
    key.r += data[p]; key.g += data[p + 1]; key.b += data[p + 2]; key.n += 1;
  }
  key.r /= key.n; key.g /= key.n; key.b /= key.n;
  const isBg = i => {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const dist = Math.hypot(r - key.r, g - key.g, b - key.b);
    const mag = Math.min(r, b) - g;
    return dist < 88 || (r > 150 && g < 120 && b > 70 && mag > 12 && r - g > 36);
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = i => { if (i >= 0 && i < w * h && !seen[i] && isBg(i)) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x + 1 < w) push(i + 1);
    if (i >= w) push(i - w);
    if (i + w < w * h) push(i + w);
  }
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (seen[i] || data[p + 3] < 16) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    }
  }
}

function boxOf(data, w, h, pad = 12) {
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 20) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(w - 1, maxX + pad) - Math.max(0, minX - pad) + 1,
    height: Math.min(h - 1, maxY + pad) - Math.max(0, minY - pad) + 1,
  };
}

function fadeHem(data, w, h) {
  const start = Math.floor(h * .82);
  for (let y = start; y < h; y++) {
    const t = (y - start) / Math.max(1, h - 1 - start);
    const mul = 1 - t * t;
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      data[p + 3] = Math.round(data[p + 3] * mul);
      const r = data[p], g = data[p + 1], b = data[p + 2];
      if (r > 170 && g > 140 && b > 100 && r - b > 18 && g > b) data[p + 3] = 0;
    }
  }
}

async function placeOnCanvas(buf) {
  const scaled = await sharp(buf).resize({ width: 470, height: 470, fit: 'inside' }).png().toBuffer();
  const sm = await sharp(scaled).metadata();
  const left = Math.round((CANVAS - sm.width) / 2);
  const top = Math.round((CANVAS - sm.height) * .42);
  return sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: scaled, left, top }]).png().toBuffer();
}

async function metrics(destRel, png) {
  const dest = path.join(root, 'assets', destRel);
  await sharp(png).toFile(dest);
  const { data, info } = await sharp(dest).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const out = {
    file: destRel,
    bodyL: minX, bodyR: maxX, bodyT: minY, shoeB: maxY,
    fx: +((minX + maxX) / 2 / CANVAS).toFixed(3),
    fy: +(maxY / CANVAS).toFixed(3),
    top: +(minY / CANVAS).toFixed(3),
    bot: +(maxY / CANVAS).toFixed(3),
  };
  console.log(JSON.stringify(out));
  return out;
}

async function fromIdleHead(destRel) {
  const src = path.join(root, 'assets/goya/goya-photo-idle.png');
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const yMax = Math.floor(h * .418);
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < yMax; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 16;
  const box = {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(w - 1, maxX + pad) - Math.max(0, minX - pad) + 1,
    height: Math.min(yMax, maxY + pad) - Math.max(0, minY - pad) + 1,
  };
  const { data: cut, info: ci } = await sharp(src).extract(box).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  fadeHem(cut, ci.width, ci.height);
  const png = await sharp(cut, { raw: { width: ci.width, height: ci.height, channels: 4 } }).png().toBuffer();
  return metrics(destRel, await placeOnCanvas(png));
}

async function fromMagenta(srcName, destRel) {
  const { data, info } = await sharp(path.join(cursor, srcName)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  floodKey(data, info.width, info.height);
  fadeHem(data, info.width, info.height);
  const box = boxOf(data, info.width, info.height, 14);
  const cut = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract(box).png().toBuffer();
  return metrics(destRel, await placeOnCanvas(cut));
}

await fromIdleHead('goya/goya-photo-face-smile.png');
await fromMagenta('goya-photo-face-happy.png', 'goya/goya-photo-face-happy.png');
await fromMagenta('goya-photo-face-surprise.png', 'goya/goya-photo-face-surprise.png');
await fromMagenta('goya-paw-print.png', 'goya/goya-paw-print.png');
