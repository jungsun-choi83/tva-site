import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const goyaDir = path.join(root, 'assets/goya');
const contactDir = path.join(root, 'assets/contact/letterbox');
const brandDir = path.join(root, 'assets/brand');

async function fitTrimmed(src, dest, canvasW, canvasH, { widthFrac, leftFrac, footYFrac }) {
  const trimmed = await sharp(src).trim({ threshold: 8 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const targetW = Math.round(canvasW * widthFrac);
  const targetH = Math.round(targetW * (meta.height / meta.width));
  const resized = await sharp(trimmed).resize({ width: targetW, height: targetH, fit: 'fill' }).png().toBuffer();
  const left = Math.max(0, Math.min(canvasW - targetW, Math.round(canvasW * leftFrac)));
  const top = Math.max(0, Math.min(canvasH - targetH, Math.round(canvasH * footYFrac) - targetH));
  const tmp = dest + '.tmp.webp';
  await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left, top }])
    .webp({ quality: 90 })
    .toFile(tmp);
  fs.copyFileSync(tmp, dest);
  fs.unlinkSync(tmp);
  console.log(path.basename(dest), { targetW, targetH, left, top, foot: top + targetH });
}

const wall = await sharp(path.join(contactDir, 'mailwall-nochar.webp')).metadata();
await fitTrimmed(path.join(goyaDir, 'present.png'), path.join(contactDir, 'mailwall-char.webp'), wall.width, wall.height, {
  widthFrac: 0.36, leftFrac: 0.50, footYFrac: 0.58,
});

const { data, info } = await sharp(path.join(brandDir, 'eternal-beam-mark.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const px = Buffer.from(data);
let opaque = 0, trans = 0, dark = 0;
for (let i = 0; i < px.length; i += 4) {
  if (px[i + 3] < 16) trans++;
  else {
    opaque++;
    if (px[i] + px[i + 1] + px[i + 2] < 40) dark++;
  }
}
console.log('mark', info.width, info.height, { opaque, trans, dark, sample: [...px.slice(0, 16)] });
