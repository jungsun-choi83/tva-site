import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const goyaDir = path.join(root, 'assets/goya');
const bgDir = path.join(root, 'sofa-journey/assets/bg');
const favDir = path.join(root, 'assets/favicon');

function isMagenta(r, g, b) {
  const mag = Math.min(r, b) - g;
  return r > 80 && b > 55 && g < 145 && mag > 16 && (r + b) > g * 1.8;
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
      if (mag > 8 && r > 60 && b > 45 && g < 155) {
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
  console.log('cut', path.basename(dest));
  return dest;
}

await cutMagenta(path.join(cursor, 'goya-anthro-sit.png'), path.join(goyaDir, 'sit.png'), { square: 1254 });
await cutMagenta(path.join(cursor, 'goya-anthro-stand.png'), path.join(goyaDir, 'idle.png'), { square: 1254 });
await cutMagenta(path.join(cursor, 'goya-anthro-walk1.png'), path.join(goyaDir, 'walk1.png'), { square: 1254 });
await cutMagenta(path.join(cursor, 'goya-anthro-walk2.png'), path.join(goyaDir, 'walk2.png'), { square: 1254 });
const fall = await cutMagenta(path.join(cursor, 'goya-anthro-fall.png'), path.join(goyaDir, 'goya-fall-surprise.png'), { square: 1254 });
await fs.promises.copyFile(fall, path.join(goyaDir, 'goya-fall-flail.png'));
await fs.promises.copyFile(fall, path.join(goyaDir, 'goya-fall-mid.png'));
await fs.promises.copyFile(fall, path.join(goyaDir, 'goya-fall-tuck.png'));
await fs.promises.copyFile(path.join(goyaDir, 'sit.png'), path.join(goyaDir, 'goya-cartoon-sit.png'));

const photoTmp = path.join(goyaDir, '_photo-tmp.png');
const frameTmp = path.join(goyaDir, '_frame-tmp.png');
await cutMagenta(path.join(cursor, 'goya-dress-photocard.png'), photoTmp, { square: 1254, pad: 80 });
await cutMagenta(path.join(cursor, 'photocard-glow-frame.png'), frameTmp, { square: 1254, pad: 24 });
const { data: pd, info: pi } = await sharp(photoTmp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const photo = Buffer.from(pd);
for (let i = 0; i < pi.width * pi.height; i++) photo[i * 4 + 3] = Math.round(photo[i * 4 + 3] * 0.52);
const photoSoft = await sharp(photo, { raw: { width: pi.width, height: pi.height, channels: 4 } }).png().toBuffer();
await sharp({ create: { width: 1254, height: 1254, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: photoSoft, left: 0, top: 0 },
    { input: frameTmp, left: 0, top: 0 },
  ])
  .png()
  .toFile(path.join(goyaDir, 'goya-photocard-fall.png'));
fs.unlinkSync(photoTmp);
fs.unlinkSync(frameTmp);
console.log('photocard glow');

const landing = path.join(cursor, 'landing-tiny-shelf.png');
await sharp(landing).resize(1672, 941, { fit: 'cover' }).webp({ quality: 90 }).toFile(path.join(bgDir, 'landing-sofa-empty-v2.webp'));
await sharp(landing).resize(1672, 941, { fit: 'cover' }).png().toFile(path.join(bgDir, 'landing-home-preview.png'));
await sharp(landing).resize(1672, 941, { fit: 'cover' }).webp({ quality: 90 }).toFile(path.join(bgDir, 'b8-2020s.webp'));
console.log('landing tiny shelf');

const eras = [
  ['hx-01-goldcaustic.png', 'b1-1920s.webp'],
  ['hx-02-ice.png', 'c1-1936.webp'],
  ['hx-03-wire.png', 'c2-1945.webp'],
  ['hx-04-glass.png', 'b2-1956.webp'],
  ['hx-05-prism.png', 'c3-1964.webp'],
  ['hx-06-constellation.png', 'b3-1969.webp'],
  ['hx-07-mercury.png', 'c4-1977.webp'],
  ['hx-08-ink.png', 'c5-1985.webp'],
  ['hx-09-bloom.png', 'b4-1988.webp'],
  ['hx-10-circuit.png', 'b5-1989.webp'],
  ['hx-11-xray.png', 'b6-1991.webp'],
  ['hx-12-lantern.png', 'c6-1996.webp'],
  ['hx-13-lightning.png', 'b7-2002.webp'],
  ['hx-14-water.png', 'c7-2006.webp'],
  ['hx-15-kintsugi.png', 'c8-2012.webp'],
];
for (const [src, dest] of eras) {
  await sharp(path.join(cursor, src)).resize(1672, 941, { fit: 'cover' }).webp({ quality: 86 }).toFile(path.join(bgDir, dest));
  console.log('era', dest);
}

fs.mkdirSync(favDir, { recursive: true });
await cutMagenta(path.join(cursor, 'goya-face-icon.png'), path.join(goyaDir, 'goya-face.png'), { square: 512, pad: 24 });
await sharp(path.join(goyaDir, 'goya-face.png')).resize(192, 192).png().toFile(path.join(favDir, 'favicon-192.png'));
await sharp(path.join(goyaDir, 'goya-face.png')).resize(180, 180).png().toFile(path.join(favDir, 'favicon-180.png'));
await sharp(path.join(goyaDir, 'goya-face.png')).resize(32, 32).webp({ quality: 90 }).toFile(path.join(favDir, 'favicon-32.webp'));
await fs.promises.copyFile(path.join(goyaDir, 'idle.png'), path.join(root, 'assets/goya-idle.png'));
console.log('r15 apply done');
