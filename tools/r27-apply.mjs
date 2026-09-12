import sharp from 'sharp';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const bg = path.join(root, 'sofa-journey/assets/bg');
const goya = path.join(root, 'assets/goya');
const ending = path.join(root, 'assets/ending');
const W = 1672, H = 941;

function keyDark(raw, inf, lumaCut = 18) {
  const p = Buffer.from(raw);
  for (let i = 0; i < p.length; i += 4) {
    const luma = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11;
    if (luma < lumaCut) p[i + 3] = 0;
    else if (luma < lumaCut + 16) p[i + 3] = Math.round(p[i + 3] * ((luma - lumaCut) / 16));
  }
  return sharp(p, { raw: { width: inf.width, height: inf.height, channels: 4 } }).png().toBuffer();
}

async function trimCard(src, dest) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const keyed = await keyDark(data, info, 14);
  await sharp(keyed).trim({ threshold: 6 }).png().toFile(dest);
}

await trimCard(path.join(goya, 'goya-photocard-fall.png'), path.join(goya, 'photocard-insert-a.png'));
await trimCard(path.join(goya, 'card-tabby.png'), path.join(goya, 'photocard-insert-b.png'));

async function wallPortrait(src, w, h, frameRgb, mat = 7) {
  const innerW = w - mat * 2, innerH = h - mat * 2;
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const keyed = await keyDark(data, info, 12);
  const photo = await sharp(keyed).trim({ threshold: 8 }).resize(innerW, innerH, { fit: 'cover' }).png().toBuffer();
  return sharp({
    create: { width: w, height: h, channels: 4, background: { r: frameRgb[0], g: frameRgb[1], b: frameRgb[2], alpha: 1 } },
  }).composite([
    { input: photo, left: mat, top: mat },
    { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="rgb(${Math.max(0, frameRgb[0] - 18)},${Math.max(0, frameRgb[1] - 16)},${Math.max(0, frameRgb[2] - 14)})" stroke-width="2"/><rect x="${mat - 1}" y="${mat - 1}" width="${innerW + 2}" height="${innerH + 2}" fill="none" stroke="#1a1612" stroke-width="1.2"/></svg>`) },
  ]).modulate({ brightness: 0.82, saturation: 0.92 }).png().toBuffer();
}

const shibaSrc = path.join(goya, 'card-shiba.png');
const tabbySrc = path.join(goya, 'card-tabby.png');
const leftFrame = await wallPortrait(shibaSrc, 118, 148, [196, 186, 168], 8);
const rightFrame = await wallPortrait(tabbySrc, 102, 148, [28, 24, 22], 7);

const light = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="w" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff6e4" stop-opacity=".38"/>
      <stop offset=".22" stop-color="#ffe7c0" stop-opacity=".12"/>
      <stop offset=".5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="r" cx="8%" cy="24%" r="42%">
      <stop offset="0" stop-color="#fffaf0" stop-opacity=".32"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#w)"/>
  <rect width="100%" height="100%" fill="url(#r)"/>
</svg>`);

const plate = await sharp(path.join(bg, 'landing-home-preview.png'))
  .resize(W, H, { fit: 'cover' })
  .modulate({ brightness: 1.16, saturation: 1.04 })
  .composite([
    { input: light, blend: 'screen' },
    { input: leftFrame, left: 572, top: 2 },
    { input: rightFrame, left: 710, top: 18 },
  ])
  .webp({ quality: 88 })
  .toBuffer();

await sharp(plate).toFile(path.join(bg, 'landing-sofa-empty-v2.webp'));
await sharp(plate).toFile(path.join(ending, 'living-room-clean-v1.webp'));
await sharp(plate).resize(1024).webp({ quality: 84 }).toFile(path.join(ending, 'living-room-clean-v1-1024.webp'));
await sharp(plate).resize(1024).webp({ quality: 84 }).toFile(path.join(ending, 'living-room-mobile-v1.webp'));
await sharp(plate).resize(768).webp({ quality: 82 }).toFile(path.join(ending, 'living-room-mobile-v1-768.webp'));

console.log('r27 plates and photocards ready');
