import sharp from 'sharp';
import path from 'path';

const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const bg = path.join(root, 'sofa-journey/assets/bg');
const W = 1672, H = 941;

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

await sharp(path.join(bg, 'landing-home-preview.png'))
  .resize(W, H, { fit: 'cover' })
  .modulate({ brightness: 1.16, saturation: 1.04 })
  .composite([{ input: light, blend: 'screen' }])
  .webp({ quality: 88 })
  .toFile(path.join(bg, 'landing-sofa-empty-v2.webp'));

console.log('r28 landing — original human frames kept');
