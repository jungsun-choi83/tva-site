import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const goyaDir = path.join(root, 'assets/goya');
const bgDir = path.join(root, 'sofa-journey/assets/bg');
const heroDir = path.join(root, 'assets/hero');
const metalSrc = path.join(root, 'assets/ref/metal-cube.png');
const breath = path.join(root, 'assets/ref/goya-breath-01.png');

function isMagenta(r, g, b) {
  const mag = Math.min(r, b) - g;
  return r > 88 && b > 60 && g < 120 && mag > 28 && (r + b) > g * 2.05;
}

function keyMagenta(data, w, h) {
  const n = w * h;
  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    if (isMagenta(r, g, b)) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
      alpha[i] = 0;
    } else {
      const mag = Math.min(r, b) - g;
      if (mag > 10 && r > 70 && b > 50) {
        data[p] = Math.max(g + 8, r - mag);
        data[p + 2] = Math.max(g + 8, b - mag);
      }
      alpha[i] = data[p + 3] > 8 ? 1 : 0;
    }
  }
  const dilate = (src, rad = 2) => {
    const out = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let on = 0;
      for (let oy = -rad; oy <= rad && !on; oy++) for (let ox = -rad; ox <= rad; ox++) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (src[ny * w + nx]) on = 1;
      }
      out[y * w + x] = on;
    }
    return out;
  };
  const erode = (src, rad = 2) => {
    const out = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let on = 1;
      for (let oy = -rad; oy <= rad && on; oy++) for (let ox = -rad; ox <= rad; ox++) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) { on = 0; break; }
        if (!src[ny * w + nx]) on = 0;
      }
      out[y * w + x] = on;
    }
    return out;
  };
  let mask = erode(dilate(alpha));
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

async function cutGoya(src, dest, square = 1254) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  keyMagenta(pixels, info.width, info.height);
  let buf = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
  const resized = await sharp(buf).resize({ width: square - 80, height: square - 80, fit: 'inside' }).png().toBuffer();
  const rm = await sharp(resized).metadata();
  buf = await sharp({ create: { width: square, height: square, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left: Math.round((square - rm.width) / 2), top: Math.round((square - rm.height) / 2) }])
    .png()
    .toBuffer();
  await sharp(buf).png().toFile(dest);
  console.log('goya', path.basename(dest));
}

function floodDark(data, w, h, dist = 28) {
  const idx = (x, y) => (y * w + x) * 4;
  const samples = [];
  for (const [x, y] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3], [w >> 1, 2], [2, h >> 1], [w - 3, h >> 1]]) {
    const i = idx(x, y);
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  const [tr, tg, tb] = samples.reduce((a, s) => [a[0] + s[0] / samples.length, a[1] + s[1] / samples.length, a[2] + s[2] / samples.length], [0, 0, 0]);
  const thresh = dist * dist;
  const isBg = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dr = r - tr, dg = g - tg, db = b - tb;
    if (dr * dr + dg * dg + db * db <= thresh) return true;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // leftover sparkle / dark studio dust
    if (luma < 38) return true;
    if (luma > 140 && Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 150) {
      // isolated watermark sparkle — only if very small later
      return false;
    }
    return false;
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
    const x = p % w, y = (p / w) | 0;
    data[p * 4 + 3] = 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  // drop tiny leftover blobs (sparkle)
  const label = new Int32Array(w * h).fill(-1);
  let blobs = [];
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] < 8 || label[i] !== -1) continue;
    const cells = [];
    const st = [i];
    label[i] = blobs.length;
    while (st.length) {
      const c = st.pop();
      cells.push(c);
      const x = c % w, y = (c / w) | 0;
      for (const np of [c + 1, c - 1, c + w, c - w]) {
        if (np < 0 || np >= w * h) continue;
        if (label[np] !== -1) continue;
        if (data[np * 4 + 3] < 8) continue;
        const nx = np % w, ny = (np / w) | 0;
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        label[np] = blobs.length;
        st.push(np);
      }
    }
    blobs.push(cells);
  }
  blobs.sort((a, b) => b.length - a.length);
  const keep = new Set(blobs[0] || []);
  if (blobs[1] && blobs[1].length > blobs[0].length * 0.04) {
    // NFC card may be a separate island if the stem is thin — keep second if reasonably large
    for (const c of blobs[1]) keep.add(c);
  }
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] < 8) continue;
    if (!keep.has(i)) {
      data[i * 4] = 0; data[i * 4 + 1] = 0; data[i * 4 + 2] = 0; data[i * 4 + 3] = 0;
    }
  }
  // 1px feather
  const copy = Buffer.from(data);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    if (copy[i + 3] !== 0) continue;
    let c = 0, sr = 0, sg = 0, sb = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const ni = ((y + oy) * w + (x + ox)) * 4;
      if (copy[ni + 3] > 80) { c++; sr += copy[ni]; sg += copy[ni + 1]; sb += copy[ni + 2]; }
    }
    if (c >= 3) {
      data[i] = Math.round(sr / c);
      data[i + 1] = Math.round(sg / c);
      data[i + 2] = Math.round(sb / c);
      data[i + 3] = Math.min(140, c * 18);
    }
  }
}

async function cutMetal() {
  const { data, info } = await sharp(metalSrc).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  floodDark(pixels, info.width, info.height, 26);
  const trimmed = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 6 })
    .png()
    .toBuffer();
  const dest = path.join(root, 'assets/hero/beam-metal-cutout.png');
  await sharp(trimmed).png().toFile(dest);
  console.log('metal cutout', dest, await sharp(dest).metadata().then(m => `${m.width}x${m.height}`));
  return dest;
}

async function stampCard(cutoutPath) {
  const meta = await sharp(cutoutPath).metadata();
  const w = meta.width, h = meta.height;
  // NFC card sits on the top-right of the cube in the source photo.
  // After trim, card is still the upper-right protrusion.
  const face = await sharp(breath)
    .extract({ left: 280, top: 220, width: 400, height: 480 })
    .resize(160, 190, { fit: 'cover' })
    .png()
    .toBuffer();
  // place roughly on the printed card photo area (upper-right)
  const left = Math.round(w * 0.72);
  const top = Math.round(h * 0.04);
  const stamped = await sharp(cutoutPath)
    .composite([{ input: face, left, top, blend: 'over' }])
    .png()
    .toBuffer();
  // The card photo is small; skip if placement looks wrong — we'll also save unstamped.
  await sharp(cutoutPath).png().toFile(path.join(root, 'assets/hero/beam-metal-cutout-raw.png'));
  return cutoutPath;
}

async function composeLanding(cutoutPath) {
  const roomSrc = path.join(cursor, 'landing-empty-cabinet.png');
  const room = await sharp(roomSrc).resize(1672, 941, { fit: 'cover' }).png().toBuffer();
  const cube = await sharp(cutoutPath)
    .resize({ width: 430, height: 430, fit: 'inside' })
    .png()
    .toBuffer();
  const cm = await sharp(cube).metadata();
  // cabinet top is center of the empty room
  const left = Math.round(1672 * 0.50 - cm.width * 0.42);
  const top = Math.round(941 * 0.28);
  // warm contact shadow
  const shadow = await sharp({
    create: { width: Math.round(cm.width * 0.92), height: 36, channels: 4, background: { r: 20, g: 12, b: 8, alpha: 0.45 } },
  }).blur(12).png().toBuffer();
  const out = await sharp(room)
    .composite([
      { input: shadow, left: left + 18, top: top + cm.height - 28 },
      { input: cube, left, top },
    ])
    .webp({ quality: 90 })
    .toFile(path.join(bgDir, 'landing-sofa-empty-v2.webp'));
  await sharp(room)
    .composite([
      { input: shadow, left: left + 18, top: top + cm.height - 28 },
      { input: cube, left, top },
    ])
    .png()
    .toFile(path.join(bgDir, 'landing-home-preview.png'));
  console.log('landing', left, top, cm.width, cm.height, out.size);
}

async function composeHero(cutoutPath) {
  const cube = await sharp(cutoutPath)
    .resize({ width: 980, height: 980, fit: 'inside' })
    .png()
    .toBuffer();
  const cm = await sharp(cube).metadata();
  const left = 1920 - cm.width - 80;
  const top = Math.round((1080 - cm.height) / 2);
  await sharp({ create: { width: 1920, height: 1080, channels: 4, background: { r: 8, g: 8, b: 10, alpha: 1 } } })
    .composite([{ input: cube, left, top }])
    .png()
    .toFile(path.join(heroDir, 'beam-device-1920x1080.png'));
  console.log('hero', left, top, cm.width, cm.height);
}

async function composeB8(cutoutPath) {
  // landing plate already has the metal cube; add a soft gold/cyan dust overlay for the last tunnel frame
  const land = path.join(bgDir, 'landing-home-preview.png');
  const dust = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1672" height="941">
      <defs>
        <radialGradient id="g" cx="54%" cy="38%" r="32%">
          <stop offset="0%" stop-color="#f0d48a" stop-opacity="0.28"/>
          <stop offset="45%" stop-color="#7ad7d0" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`
  );
  await sharp(land)
    .composite([{ input: dust, blend: 'screen' }])
    .webp({ quality: 90 })
    .toFile(path.join(bgDir, 'b8-2020s.webp'));
  console.log('b8 ok');
}

const jobs = [
  ['goya-black-idle.png', path.join(goyaDir, 'idle.png'), 1024],
  ['goya-black-walk1.png', path.join(goyaDir, 'walk1.png'), 1024],
  ['goya-black-sit.png', path.join(goyaDir, 'sit.png'), 1024],
  ['goya-black-sit-watch.png', path.join(goyaDir, 'goya-sit-watch.png'), 1254],
  ['goya-black-sit.png', path.join(goyaDir, 'goya-cartoon-sit.png'), 1254],
  ['goya-black-fall-surprise.png', path.join(goyaDir, 'goya-fall-surprise.png'), 1254],
  ['goya-black-fall-flail.png', path.join(goyaDir, 'goya-fall-flail.png'), 1254],
  ['goya-black-fall-mid.png', path.join(goyaDir, 'goya-fall-mid.png'), 1254],
  ['goya-black-fall-tuck.png', path.join(goyaDir, 'goya-fall-tuck.png'), 1254],
];

const cutoutPath = await cutMetal();
await stampCard(cutoutPath);
await composeLanding(cutoutPath);
await composeHero(cutoutPath);
await composeB8(cutoutPath);

for (const [src, dest, square] of jobs) {
  const full = path.join(cursor, src);
  if (!fs.existsSync(full)) { console.log('skip missing', src); continue; }
  await cutGoya(full, dest, square);
}

await fs.promises.copyFile(path.join(goyaDir, 'idle.png'), path.join(root, 'assets/goya-idle.png'));
await fs.promises.copyFile(path.join(goyaDir, 'walk1.png'), path.join(goyaDir, 'walk2.png')).catch(() => {});
console.log('done');
