import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const brand = path.join(root, 'assets/brand');
const bg = path.join(root, 'sofa-journey/assets/bg');
const W = 1672, H = 941;

const srcLogo = path.join(cursor, 'c__Users____AppData_Roaming_Cursor_User_workspaceStorage_49169b2e67def388f5bbb3d140febc14_images_image-97890b32-0730-4656-bd27-65e9b48f2aae.png');
const { data, info } = await sharp(srcLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const px = Buffer.from(data);
for (let i = 0; i < px.length; i += 4) {
  const luma = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
  if (luma < 22) px[i + 3] = 0;
  else if (luma < 42) px[i + 3] = Math.round(px[i + 3] * ((luma - 22) / 20));
}
const logo = await sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 8 }).png().toBuffer();
await sharp(logo).resize({ width: 1400, height: 180, fit: 'inside' }).png().toFile(path.join(brand, 'eternal-beam-mark.png'));
console.log('logo keyed');

function keyMagenta(raw, inf) {
  const p = Buffer.from(raw);
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    if (r > 80 && b > 55 && g < 145 && Math.min(r, b) - g > 16) p[i] = p[i + 1] = p[i + 2] = p[i + 3] = 0;
  }
  return sharp(p, { raw: { width: inf.width, height: inf.height, channels: 4 } }).png().toBuffer();
}

async function petCover(src, w, h) {
  const { data: raw, info: inf } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const keyed = await keyMagenta(raw, inf);
  return sharp(keyed).trim({ threshold: 8 }).resize(w, h, { fit: 'cover' }).png().toBuffer();
}

async function framed(photo, w, h) {
  const inner = await sharp(photo).resize(w - 10, h - 10, { fit: 'cover' }).png().toBuffer();
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 48, g: 36, b: 24, alpha: 1 } } })
    .composite([
      { input: inner, left: 5, top: 5 },
      { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" fill="none" stroke="#d7b56a" stroke-width="2.2"/></svg>`) },
    ])
    .png()
    .toBuffer();
}

const dogA = path.join(cursor, 'card-shiba.png');
const dogB = path.join(cursor, 'card-tabby.png');
const f1 = await framed(await petCover(dogA, 118, 88), 128, 98);
const f2 = await framed(await petCover(dogB, 96, 118), 106, 128);

const light = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="w" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff6e4" stop-opacity=".4"/>
      <stop offset=".2" stop-color="#ffe7c0" stop-opacity=".14"/>
      <stop offset=".46" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="r" cx="8%" cy="26%" r="44%">
      <stop offset="0" stop-color="#fffaf0" stop-opacity=".36"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#w)"/>
  <rect width="100%" height="100%" fill="url(#r)"/>
</svg>`);

await sharp(path.join(bg, 'landing-home-preview.png'))
  .resize(W, H, { fit: 'cover' })
  .modulate({ brightness: 1.18, saturation: 1.05 })
  .composite([
    { input: light, blend: 'screen' },
    { input: f1, left: 518, top: 38 },
    { input: f2, left: 652, top: 52 },
  ])
  .webp({ quality: 88 })
  .toFile(path.join(bg, 'landing-sofa-empty-v2.webp'));

console.log('landing done');
