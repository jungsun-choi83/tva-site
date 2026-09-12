import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const bgDir = path.join(root, 'sofa-journey/assets/bg');
const endingDir = path.join(root, 'assets/ending');
const goyaDir = path.join(root, 'assets/goya');
const contactDir = path.join(root, 'assets/contact/letterbox');
const brandDir = path.join(root, 'assets/brand');

function isMagenta(r, g, b) {
  const mag = Math.min(r, b) - g;
  return r > 80 && b > 55 && g < 145 && mag > 16 && (r + b) > g * 1.8;
}
function keyMagenta(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (isMagenta(r, g, b)) { data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; }
  }
}
function keyNearBlack(data) {
  for (let i = 0; i < data.length; i += 4) {
    const luma = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
    if (luma < 28) data[i + 3] = 0;
    else if (luma < 48) data[i + 3] = Math.round(data[i + 3] * ((luma - 28) / 20));
  }
}

async function cutMagenta(src, dest, square = 1254) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  keyMagenta(pixels);
  let buf = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 6 }).png().toBuffer();
  const resized = await sharp(buf).resize({ width: square - 24, height: square - 24, fit: 'inside' }).png().toBuffer();
  const rm = await sharp(resized).metadata();
  buf = await sharp({ create: { width: square, height: square, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left: Math.round((square - rm.width) / 2), top: Math.round((square - rm.height) / 2) }])
    .png().toBuffer();
  await sharp(buf).png().toFile(dest);
  console.log('cut', path.basename(dest));
}

async function plate(src, dest, size = [1672, 941]) {
  await sharp(src).resize(size[0], size[1], { fit: 'cover' }).webp({ quality: 88 }).toFile(dest);
  console.log('plate', path.basename(dest));
}

const vortices = ['hx-vortex-01.png', 'hx-vortex-02.png', 'hx-vortex-03.png'];
const dests = [
  'b1-1920s.webp','c1-1936.webp','c2-1945.webp','b2-1956.webp','c3-1964.webp',
  'b3-1969.webp','c4-1977.webp','c5-1985.webp','b4-1988.webp','b5-1989.webp',
  'b6-1991.webp','c6-1996.webp','b7-2002.webp','c7-2006.webp','c8-2012.webp','b8-2020s.webp',
];
for (let i = 0; i < dests.length; i++) {
  await plate(path.join(cursor, vortices[i % 3]), path.join(bgDir, dests[i]));
}

await plate(path.join(bgDir, 'landing-home-preview.png'), path.join(bgDir, 'landing-sofa-empty-v2.webp'));
await plate(path.join(cursor, 'ending-botanical-real.png'), path.join(endingDir, 'living-room-clean-v1.webp'));
await plate(path.join(cursor, 'ending-botanical-real.png'), path.join(endingDir, 'living-room-clean-v1-1024.webp'), [1024, 576]);
await plate(path.join(cursor, 'ending-botanical-real.png'), path.join(endingDir, 'living-room-mobile-v1.webp'), [1024, 1536]);
await plate(path.join(cursor, 'ending-botanical-real.png'), path.join(endingDir, 'living-room-mobile-v1-768.webp'), [768, 1152]);

await cutMagenta(path.join(cursor, 'goya-lie-watch-noremote.png'), path.join(goyaDir, 'lie-sofa.png'));
await cutMagenta(path.join(cursor, 'goya-ladder-sort.png'), path.join(goyaDir, 'mailbox-wave.png'));

const wall = await sharp(path.join(contactDir, 'mailwall-nochar.webp')).metadata();
const trimmed = await sharp(path.join(goyaDir, 'mailbox-wave.png')).trim({ threshold: 8 }).png().toBuffer();
const tm = await sharp(trimmed).metadata();
const targetH = Math.round(wall.height * 0.62);
const resized = await sharp(trimmed).resize({ height: targetH, width: Math.round(targetH * (tm.width / tm.height)) }).png().toBuffer();
const rm = await sharp(resized).metadata();
const left = Math.max(0, Math.round(wall.width * 0.48));
const top = Math.max(0, wall.height - rm.height - Math.round(wall.height * 0.06));
const tmpChar = path.join(contactDir, 'mailwall-char.tmp.webp');
await sharp({ create: { width: wall.width, height: wall.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: resized, left: Math.min(left, wall.width - rm.width), top }])
  .webp({ quality: 90 })
  .toFile(tmpChar);
try { fs.copyFileSync(tmpChar, path.join(contactDir, 'mailwall-char.webp')); } catch { fs.copyFileSync(tmpChar, path.join(contactDir, 'mailwall-char-goya.webp')); }
try { fs.unlinkSync(tmpChar); } catch {}
console.log('mailwall char', rm.width, rm.height, left, top);

const { data: markRaw, info: markInfo } = await sharp(path.join(cursor, 'eternal-beam-mark-beam-a.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const markPx = Buffer.from(markRaw);
keyNearBlack(markPx);
const markBuf = await sharp(markPx, { raw: { width: markInfo.width, height: markInfo.height, channels: 4 } }).trim({ threshold: 4 }).png().toBuffer();
await sharp(markBuf).resize({ width: 1400, height: 180, fit: 'inside' }).png().toFile(path.join(brandDir, 'eternal-beam-mark.png'));
console.log('r22 apply done');
