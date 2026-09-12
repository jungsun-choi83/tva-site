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
const brandDir = path.join(root, 'assets/brand');

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

function keyNearBlack(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const luma = r * 0.3 + g * 0.59 + b * 0.11;
    if (luma < 28) {
      data[i + 3] = 0;
    } else if (luma < 48) {
      data[i + 3] = Math.round(data[i + 3] * ((luma - 28) / 20));
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

async function fitOnCanvas(src, dest, canvasW, canvasH, { widthFrac = 0.42, leftFrac = 0.22, topFrac = 0.18 } = {}) {
  const meta = await sharp(src).metadata();
  const targetW = Math.round(canvasW * widthFrac);
  const resized = await sharp(src).resize({ width: targetW, height: Math.round(targetW * ((meta.height || targetW) / (meta.width || targetW))), fit: 'inside' }).png().toBuffer();
  const rm = await sharp(resized).metadata();
  const left = Math.max(0, Math.round(canvasW * leftFrac));
  const top = Math.max(0, Math.round(canvasH * topFrac));
  const tmp = dest + '.tmp.webp';
  await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left, top: Math.min(top, Math.max(0, canvasH - (rm.height || 1))) }])
    .webp({ quality: 90 })
    .toFile(tmp);
  try { fs.copyFileSync(tmp, dest); }
  catch {
    const alt = dest.replace(/(\.[a-z]+)$/i, '-goya$1');
    fs.copyFileSync(tmp, alt);
    console.log('wrote-alt', path.basename(alt));
  }
  try { fs.unlinkSync(tmp); } catch {}
  console.log('canvas', path.basename(dest), canvasW, canvasH, rm.width, rm.height);
}

await cutMagenta(path.join(cursor, 'goya-lie-watch.png'), path.join(goyaDir, 'lie-sofa.png'), { square: 1254 });
await cutMagenta(path.join(cursor, 'goya-case.png'), path.join(goyaDir, 'archive.png'), { square: 1254 });
await sharp(path.join(goyaDir, 'archive.png')).png().toFile(path.join(goyaDir, 'folders-case.png'));

const botanical = path.join(cursor, 'ending-botanical-nocat.png');
await plate(botanical, path.join(bgDir, 'c8-2012.webp'));
await plate(botanical, path.join(bgDir, 'b8-2020s.webp'));
await plate(botanical, path.join(bgDir, 'landing-sofa-empty-v2.webp'));
await plate(botanical, path.join(endingDir, 'living-room-clean-v1.webp'));
await plate(botanical, path.join(endingDir, 'living-room-clean-v1-1024.webp'), [1024, 576]);
await plate(botanical, path.join(endingDir, 'living-room-mobile-v1.webp'), [1024, 1536]);
await plate(botanical, path.join(endingDir, 'living-room-mobile-v1-768.webp'), [768, 1152]);
await sharp(botanical).resize(1672, 941, { fit: 'cover' }).png().toFile(path.join(endingDir, 'living-room-preview.png'));

const { data: markRaw, info: markInfo } = await sharp(path.join(cursor, 'eternal-beam-mark-rich.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const markPx = Buffer.from(markRaw);
keyNearBlack(markPx);
const markBuf = await sharp(markPx, { raw: { width: markInfo.width, height: markInfo.height, channels: 4 } })
  .trim({ threshold: 4 })
  .png()
  .toBuffer();
await sharp(markBuf).resize({ width: 1400, height: 180, fit: 'inside' }).png().toFile(path.join(brandDir, 'eternal-beam-mark.png'));
console.log('mark', (await sharp(path.join(brandDir, 'eternal-beam-mark.png')).metadata()).width);

await sharp(path.join(goyaDir, 'archive.png')).webp({ quality: 90 }).toFile(path.join(mascotDir, 'archive-02.webp'));
await sharp(path.join(goyaDir, 'archive.png')).webp({ quality: 90 }).toFile(path.join(mascotDir, 'transparent/archive-02.webp'));

const wall = await sharp(path.join(contactDir, 'mailwall-nochar.webp')).metadata();
await fitOnCanvas(path.join(goyaDir, 'present.png'), path.join(contactDir, 'mailwall-char.webp'), wall.width, wall.height, {
  widthFrac: 0.52, leftFrac: 0.46, topFrac: 0.05,
});

const scWait = await sharp(path.join(contactDir, 'sc-wait.webp')).metadata();
await fitOnCanvas(path.join(goyaDir, 'present.png'), path.join(contactDir, 'sc-wait.webp'), scWait.width, scWait.height, {
  widthFrac: 0.58, leftFrac: 0.08, topFrac: 0.18,
});
const scHold = await sharp(path.join(contactDir, 'sc-hold.webp')).metadata();
await fitOnCanvas(path.join(goyaDir, 'letter.png'), path.join(contactDir, 'sc-hold.webp'), scHold.width, scHold.height, {
  widthFrac: 0.58, leftFrac: 0.08, topFrac: 0.16,
});
const scPost = await sharp(path.join(contactDir, 'sc-post.webp')).metadata();
await fitOnCanvas(path.join(goyaDir, 'letter.png'), path.join(contactDir, 'sc-post.webp'), scPost.width, scPost.height, {
  widthFrac: 0.58, leftFrac: 0.08, topFrac: 0.16,
});
const scRest = await sharp(path.join(contactDir, 'sc-rest.webp')).metadata();
await fitOnCanvas(path.join(goyaDir, 'idle.png'), path.join(contactDir, 'sc-rest.webp'), scRest.width, scRest.height, {
  widthFrac: 0.58, leftFrac: 0.12, topFrac: 0.18,
});
console.log('r21 apply done');
