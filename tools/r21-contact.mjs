import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const goyaDir = path.join(root, 'assets/goya');
const contactDir = path.join(root, 'assets/contact/letterbox');

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
  try {
    fs.copyFileSync(tmp, dest);
    console.log('canvas', path.basename(dest), canvasW, canvasH, rm.width, rm.height);
  } catch (err) {
    const alt = dest.replace(/(\.[a-z]+)$/i, '-goya$1');
    fs.copyFileSync(tmp, alt);
    console.log('wrote-alt', path.basename(alt), err.message);
  }
  try { fs.unlinkSync(tmp); } catch {}
}

const wall = await sharp(path.join(contactDir, 'mailwall-nochar.webp')).metadata();
await fitOnCanvas(path.join(goyaDir, 'present.png'), path.join(contactDir, 'mailwall-char.webp'), wall.width, wall.height, {
  widthFrac: 0.52, leftFrac: 0.46, topFrac: 0.05,
});

for (const [file, pose, opt] of [
  ['sc-wait.webp', 'present.png', { widthFrac: 0.58, leftFrac: 0.08, topFrac: 0.18 }],
  ['sc-hold.webp', 'letter.png', { widthFrac: 0.58, leftFrac: 0.08, topFrac: 0.16 }],
  ['sc-post.webp', 'letter.png', { widthFrac: 0.58, leftFrac: 0.08, topFrac: 0.16 }],
  ['sc-rest.webp', 'idle.png', { widthFrac: 0.58, leftFrac: 0.12, topFrac: 0.18 }],
]) {
  const meta = await sharp(path.join(contactDir, file)).metadata();
  await fitOnCanvas(path.join(goyaDir, pose), path.join(contactDir, file), meta.width, meta.height, opt);
}
console.log('contact goya done');
