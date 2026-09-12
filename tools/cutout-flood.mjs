import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const DIST = 52; // max RGB distance from sampled edge colour

function floodAlpha(data, w, h) {
  const idx = (x, y) => (y * w + x) * 4;
  const corner = (x, y) => {
    const i = idx(x, y);
    return [data[i], data[i + 1], data[i + 2]];
  };
  const samples = [corner(2, 2), corner(w - 3, 2), corner(2, h - 3), corner(w - 3, h - 3)];
  const [tr, tg, tb] = samples.reduce((a, s) => [a[0] + s[0] / 4, a[1] + s[1] / 4, a[2] + s[2] / 4], [0, 0, 0]);
  const thresh = DIST * DIST;
  const isBg = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dr = r - tr;
    const dg = g - tg;
    const db = b - tb;
    if (dr * dr + dg * dg + db * db <= thresh) return true;
    const luma = (r + g + b) / 3;
    return luma > 220 && Math.abs(r - g) < 22 && Math.abs(g - b) < 22;
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (isBg(p * 4)) stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p / w) | 0;
    data[p * 4 + 3] = 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  // Strip the white sticker ring. Cream chest stays because it is interior.
  for (let pass = 0; pass < 28; pass++) {
    const kill = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = idx(x, y);
        if (data[i + 3] < 8) continue;
        const luma = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const chroma = Math.max(Math.abs(data[i] - data[i + 1]), Math.abs(data[i + 1] - data[i + 2]));
        if (luma < 170 || chroma > 36) continue;
        const edge =
          data[idx(x + 1, y) + 3] < 8 ||
          data[idx(x - 1, y) + 3] < 8 ||
          data[idx(x, y + 1) + 3] < 8 ||
          data[idx(x, y - 1) + 3] < 8;
        if (edge) kill.push(i);
      }
    }
    if (!kill.length) break;
    for (const i of kill) data[i + 3] = 0;
  }
  // Drop leftover dashed sticker dots (small islands).
  {
    const seen = new Uint8Array(w * h);
    let best = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (seen[p] || data[p * 4 + 3] < 16) continue;
        const cells = [];
        const stack = [p];
        seen[p] = 1;
        while (stack.length) {
          const c = stack.pop();
          cells.push(c);
          const cx = c % w;
          const cy = (c / w) | 0;
          const neigh = [c + 1, c - 1, c + w, c - w];
          const ok = [cx + 1 < w, cx > 0, cy + 1 < h, cy > 0];
          for (let n = 0; n < 4; n++) {
            if (!ok[n]) continue;
            const np = neigh[n];
            if (seen[np] || data[np * 4 + 3] < 16) continue;
            seen[np] = 1;
            stack.push(np);
          }
        }
        if (cells.length > best.length) best = cells;
      }
    }
    const keep = new Uint8Array(w * h);
    for (const p of best) keep[p] = 1;
    for (let p = 0; p < w * h; p++) if (!keep[p]) data[p * 4 + 3] = 0;
  }
  // feather
  const copy = Buffer.from(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y);
      if (copy[i + 3] !== 0) continue;
      let n = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (copy[idx(x + ox, y + oy) + 3] > 0) n++;
      }
      if (n) data[i + 3] = Math.min(255, n * 28);
    }
  }
}

async function cutout(src, dest) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  floodAlpha(pixels, info.width, info.height);
  await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 8 })
    .png()
    .toFile(dest);
  console.log('cutout', path.basename(dest), info.width, info.height);
}

async function makeHero(cubeCut, dest) {
  const W = 1920, H = 1080;
  const bg = await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: 13, g: 13, b: 15, alpha: 1 },
    },
  }).png().toBuffer();
  const glow = await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).png().toBuffer();
  const cube = sharp(cubeCut).resize({ height: 560, fit: 'inside' });
  const cubeBuf = await cube.png().toBuffer();
  const meta = await sharp(cubeBuf).metadata();
  const left = Math.round(W - meta.width - 90);
  const top = Math.round((H - meta.height) / 2 + 70);
  await sharp(bg)
    .composite([
      { input: cubeBuf, left, top },
    ])
    .png()
    .toFile(dest);
  console.log('hero', dest, 'cube at', left, top, meta.width, meta.height);
}

const root = path.resolve('C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12');
const cursorAssets = path.resolve('C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets');
const outDir = path.join(root, 'assets/goya');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(root, 'assets/hero'), { recursive: true });

const jobs = [
  [path.join(cursorAssets, 'goya-cutout-idle.png'), path.join(outDir, 'idle.png')],
  [path.join(cursorAssets, 'goya-cutout-walk1.png'), path.join(outDir, 'walk1.png')],
  [path.join(cursorAssets, 'goya-cutout-walk2.png'), path.join(outDir, 'walk2.png')],
  [path.join(cursorAssets, 'goya-cutout-sit.png'), path.join(outDir, 'sit.png')],
  [path.join(root, 'assets/brand/device-cube.jpg'), path.join(root, 'assets/brand/device-cube-cut.png')],
];

for (const [src, dest] of jobs) await cutout(src, dest);
await makeHero(path.join(root, 'assets/brand/device-cube-cut.png'), path.join(root, 'assets/hero/beam-device-1920x1080.png'));
await fs.promises.copyFile(path.join(outDir, 'idle.png'), path.join(root, 'assets/goya-idle.png'));
console.log('done');
