import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const goyaDir = path.join(root, 'assets/goya');
const heroDir = path.join(root, 'assets/hero');
const brandDir = path.join(root, 'assets/brand');
const bgDir = path.join(root, 'sofa-journey/assets/bg');
const aboutDir = path.join(root, 'assets/about-walk');

function isMagenta(r, g, b) {
  const mag = Math.min(r, b) - g;
  return r > 80 && b > 55 && g < 140 && mag > 18 && (r + b) > g * 1.85;
}

function keyMagenta(data, w, h) {
  const n = w * h;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    if (isMagenta(r, g, b)) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    } else {
      const mag = Math.min(r, b) - g;
      if (mag > 8 && r > 60 && b > 45 && g < 150) {
        data[p] = Math.max(g, r - mag);
        data[p + 2] = Math.max(g, b - mag);
      }
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
    if (c >= 2) {
      data[i] = Math.round(sr / c);
      data[i + 1] = Math.round(sg / c);
      data[i + 2] = Math.round(sb / c);
      data[i + 3] = Math.min(150, c * 22);
    }
  }
}

async function cutMagenta(src, dest, { square = 0, pad = 16 } = {}) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  keyMagenta(pixels, info.width, info.height);
  let buf = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 6 })
    .png()
    .toBuffer();
  if (square) {
    const resized = await sharp(buf).resize({ width: square - pad * 2, height: square - pad * 2, fit: 'inside' }).png().toBuffer();
    const rm = await sharp(resized).metadata();
    buf = await sharp({ create: { width: square, height: square, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: resized, left: Math.round((square - rm.width) / 2), top: Math.round((square - rm.height) / 2) }])
      .png()
      .toBuffer();
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(buf).png().toFile(dest);
  const m = await sharp(dest).metadata();
  console.log('cut', path.basename(dest), m.width + 'x' + m.height);
  return dest;
}

async function keyBlackLogo(src, dest) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  for (let i = 0; i < info.width * info.height; i++) {
    const p = i * 4;
    const r = pixels[p], g = pixels[p + 1], b = pixels[p + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < 28) {
      pixels[p + 3] = 0;
    } else {
      const t = Math.min(255, Math.max(0, (lum - 28) * 3));
      pixels[p + 3] = t;
    }
  }
  let buf = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 4 })
    .png()
    .toBuffer();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(buf).png().toFile(dest);
  console.log('logo', path.basename(dest));
  return dest;
}

function isCreamFur(r, g, b, a) {
  if (a < 8) return false;
  const warm = r > 118 && g > 58 && r > b + 18 && b < 170 && r + g > b * 2.1;
  const tan = r > 155 && g > 105 && b > 55 && b < 190 && r >= g - 8 && r > b + 12;
  const cream = r > 190 && g > 150 && b > 90 && b < 210 && r - b > 20;
  return warm || tan || cream;
}

async function stripCreamDogs(src, dest) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, panel = Math.round(w / 6);
  const pixels = Buffer.from(data);
  const mark = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const local = x % panel;
    if (local < panel * 0.34) continue;
    const i = y * w + x, p = i * 4;
    if (isCreamFur(pixels[p], pixels[p + 1], pixels[p + 2], pixels[p + 3])) mark[i] = 1;
  }
  const dilate = (srcMask, rad) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let on = 0;
      for (let oy = -rad; oy <= rad && !on; oy++) for (let ox = -rad; ox <= rad; ox++) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (srcMask[ny * w + nx]) on = 1;
      }
      out[y * w + x] = on;
    }
    return out;
  };
  const kill = dilate(mark, 6);
  for (let i = 0; i < w * h; i++) {
    if (!kill[i]) continue;
    const p = i * 4;
    pixels[p] = 8; pixels[p + 1] = 8; pixels[p + 2] = 8; pixels[p + 3] = 255;
  }
  await sharp(pixels, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 90 }).toFile(dest);
  console.log('about strip cleaned');
}

await cutMagenta(path.join(cursor, 'goya-smile-sit.png'), path.join(goyaDir, 'idle.png'), { square: 1254 });
await fs.promises.copyFile(path.join(goyaDir, 'idle.png'), path.join(goyaDir, 'sit.png'));
await fs.promises.copyFile(path.join(goyaDir, 'idle.png'), path.join(goyaDir, 'goya-cartoon-sit.png'));
await cutMagenta(path.join(cursor, 'goya-smile-run.png'), path.join(goyaDir, 'walk1.png'), { square: 1254 });
await fs.promises.copyFile(path.join(goyaDir, 'walk1.png'), path.join(goyaDir, 'walk2.png'));
const fall = await cutMagenta(path.join(cursor, 'goya-smile-fall.png'), path.join(goyaDir, 'goya-fall-surprise.png'), { square: 1254 });
await fs.promises.copyFile(fall, path.join(goyaDir, 'goya-fall-flail.png'));
await fs.promises.copyFile(fall, path.join(goyaDir, 'goya-fall-mid.png'));
await fs.promises.copyFile(fall, path.join(goyaDir, 'goya-fall-tuck.png'));
await cutMagenta(path.join(cursor, 'photocard-frame-hole.png'), path.join(goyaDir, 'goya-photocard-fall.png'), { square: 1254, pad: 40 });
await cutMagenta(path.join(cursor, 'cube-clean-magenta.png'), path.join(heroDir, 'beam-metal-cutout.png'));

const metalPath = path.join(heroDir, 'beam-metal-cutout.png');
const heroCube = await sharp(metalPath).resize({ width: 900, height: 900, fit: 'inside' }).png().toBuffer();
const hm = await sharp(heroCube).metadata();
await sharp({ create: { width: 1920, height: 1080, channels: 4, background: { r: 7, g: 7, b: 9, alpha: 1 } } })
  .composite([{ input: heroCube, left: 1920 - hm.width - 90, top: Math.round((1080 - hm.height) / 2) }])
  .png()
  .toFile(path.join(heroDir, 'beam-device-1920x1080.png'));
console.log('hero cube', hm.width, hm.height);

const landingSrc = path.join(cursor, 'landing-cozy-home.png');
await sharp(landingSrc).resize(1672, 941, { fit: 'cover' }).webp({ quality: 90 }).toFile(path.join(bgDir, 'landing-sofa-empty-v2.webp'));
await sharp(landingSrc).resize(1672, 941, { fit: 'cover' }).png().toFile(path.join(bgDir, 'landing-home-preview.png'));
await sharp(landingSrc).resize(1672, 941, { fit: 'cover' }).webp({ quality: 90 }).toFile(path.join(bgDir, 'b8-2020s.webp'));

const eras = [
  ['mh-retriever.png', 'b1-1920s.webp'],
  ['mh-tabby.png', 'c1-1936.webp'],
  ['mh-husky.png', 'c2-1945.webp'],
  ['mh-corgi.png', 'b2-1956.webp'],
  ['mh-poodle.png', 'c3-1964.webp'],
  ['mh-blackcat.png', 'b3-1969.webp'],
  ['mh-shepherd.png', 'c4-1977.webp'],
  ['mh-beagle.png', 'c5-1985.webp'],
  ['mh-persian.png', 'b4-1988.webp'],
  ['mh-dachshund.png', 'b5-1989.webp'],
  ['mh-maltese.png', 'b6-1991.webp'],
  ['mh-bsh.png', 'c6-1996.webp'],
  ['mh-collie.png', 'b7-2002.webp'],
  ['mh-pomeranian.png', 'c7-2006.webp'],
  ['mh-ragdoll.png', 'c8-2012.webp'],
];
for (const [src, dest] of eras) {
  await sharp(path.join(cursor, src)).resize(1672, 941, { fit: 'cover' }).webp({ quality: 86 }).toFile(path.join(bgDir, dest));
  console.log('era', dest);
}

const logoSrc = path.join(cursor, 'c__Users____AppData_Roaming_Cursor_User_workspaceStorage_49169b2e67def388f5bbb3d140febc14_images_____-af5bb761-1594-446e-a351-719c671960d9.png');
const logoPng = await keyBlackLogo(logoSrc, path.join(brandDir, 'eternal-beam-mark.png'));
await sharp(logoPng).resize({ width: 720, height: 160, fit: 'inside' }).webp({ quality: 92 }).toFile(path.join(root, 'assets/tva-logo-nav.webp'));
await sharp(logoPng).resize({ width: 1400, height: 280, fit: 'inside' }).webp({ quality: 92 }).toFile(path.join(root, 'assets/tva-logo.webp'));
await sharp(logoPng).resize({ width: 1504, height: 320, fit: 'inside' }).webp({ quality: 92 }).toFile(path.join(root, 'assets/only-tva/walk/tva-logo-tight.webp'));

await stripCreamDogs(path.join(aboutDir, 'strip.webp'), path.join(aboutDir, 'strip.webp'));
await fs.promises.copyFile(path.join(goyaDir, 'idle.png'), path.join(root, 'assets/goya-idle.png'));
console.log('r14 pack done');
