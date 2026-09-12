import sharp from 'sharp';
const src = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets/landing-metal-seated.png';
const bg = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12/sofa-journey/assets/bg';
const plate = await sharp(src).resize(1672, 941, { fit: 'cover' }).png().toBuffer();
await sharp(plate).webp({ quality: 91 }).toFile(`${bg}/landing-sofa-empty-v2.webp`);
await sharp(plate).png().toFile(`${bg}/landing-home-preview.png`);
const dust = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1672" height="941">
  <defs><radialGradient id="g" cx="52%" cy="38%" r="26%">
    <stop offset="0%" stop-color="#e8c97a" stop-opacity="0.18"/>
    <stop offset="55%" stop-color="#6ecfc8" stop-opacity="0.08"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`);
await sharp(plate).composite([{ input: dust, blend: 'screen' }]).webp({ quality: 91 }).toFile(`${bg}/b8-2020s.webp`);
console.log('landing plates ok');
