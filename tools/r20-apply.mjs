import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const goyaDir = path.join(root, 'assets/goya');
const bgDir = path.join(root, 'sofa-journey/assets/bg');
const mascotDir = path.join(root, 'assets/mascot');
const endingDir = path.join(root, 'assets/ending');
const contactDir = path.join(root, 'assets/contact/letterbox');

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
}

async function cutMagenta(src, dest, { square = 0, pad = 16, webp = false } = {}) {
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
  if (webp) await sharp(buf).webp({ quality: 90 }).toFile(dest);
  else await sharp(buf).png().toFile(dest);
  console.log('cut', path.basename(dest));
  return dest;
}

async function plate(src, dest, size = [1672, 941]) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(src).resize(size[0], size[1], { fit: 'cover', position: 'centre' }).webp({ quality: 88 }).toFile(dest);
  console.log('plate', path.basename(dest));
}

const eras = [
  'hx-anadol-01.png','hx-anadol-02.png','hx-anadol-03.png','hx-anadol-06.png',
  'hx-anadol-04.png','hx-anadol-07.png','hx-anadol-05.png','hx-anadol-02.png',
  'hx-anadol-03.png','hx-anadol-01.png','hx-anadol-06.png','hx-anadol-04.png',
  'hx-anadol-07.png','hx-anadol-05.png','ending-botanical-empty.png','ending-botanical-empty.png',
];
const dests = [
  'b1-1920s.webp','c1-1936.webp','c2-1945.webp','b2-1956.webp','c3-1964.webp',
  'b3-1969.webp','c4-1977.webp','c5-1985.webp','b4-1988.webp','b5-1989.webp',
  'b6-1991.webp','c6-1996.webp','b7-2002.webp','c7-2006.webp','c8-2012.webp','b8-2020s.webp',
];
for (let i = 0; i < dests.length; i++) {
  await plate(path.join(cursor, eras[i]), path.join(bgDir, dests[i]));
}

await plate(path.join(cursor, 'ending-botanical-empty.png'), path.join(bgDir, 'landing-sofa-empty-v2.webp'));
await plate(path.join(cursor, 'ending-botanical-empty.png'), path.join(endingDir, 'living-room-clean-v1.webp'));
await plate(path.join(cursor, 'ending-botanical-empty.png'), path.join(endingDir, 'living-room-clean-v1-1024.webp'), [1024, 576]);
await plate(path.join(cursor, 'ending-botanical-empty.png'), path.join(endingDir, 'living-room-mobile-v1.webp'), [1024, 1536]);
await plate(path.join(cursor, 'ending-botanical-empty.png'), path.join(endingDir, 'living-room-mobile-v1-768.webp'), [768, 1152]);

await cutMagenta(path.join(cursor, 'goya-lie-sofa.png'), path.join(goyaDir, 'lie-sofa.png'), { square: 1254 });
await cutMagenta(path.join(cursor, 'goya-folders.png'), path.join(goyaDir, 'folders.png'), { square: 1254 });
await cutMagenta(path.join(cursor, 'goya-mailbox-wave.png'), path.join(goyaDir, 'mailbox-wave.png'), { square: 1254 });

await cutMagenta(path.join(cursor, 'goya-folders.png'), path.join(mascotDir, 'archive-01.webp'), { square: 1254, webp: true });
await sharp(path.join(goyaDir, 'archive.png')).webp({ quality: 90 }).toFile(path.join(mascotDir, 'archive-02.webp'));
await sharp(path.join(goyaDir, 'present.png')).webp({ quality: 90 }).toFile(path.join(mascotDir, 'transparent/archive-02.webp'));
await sharp(path.join(goyaDir, 'point.png')).webp({ quality: 90 }).toFile(path.join(mascotDir, 'archive-03.webp'));
await sharp(path.join(goyaDir, 'usher.png')).webp({ quality: 90 }).toFile(path.join(mascotDir, 'archive-04.webp'));
await cutMagenta(path.join(cursor, 'goya-mailbox-wave.png'), path.join(contactDir, 'mailwall-char.webp'), { square: 1254, webp: true });
console.log('r20 apply done');
