import sharp from 'sharp';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const ending = path.join('C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12/assets/ending');
const src = path.join(cursor, 'ending-botanical-real.png');

function warmOverlay(w, h) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <radialGradient id="w" cx="78%" cy="38%" r="52%">
      <stop offset="0" stop-color="#fff8ea" stop-opacity=".34"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#w)"/>
</svg>`);
}

async function plate(size, dest) {
  const [w, h] = size;
  await sharp(src)
    .resize(w, h, { fit: 'cover' })
    .modulate({ brightness: 1.12, saturation: 1.08 })
    .composite([{ input: warmOverlay(w, h), blend: 'screen' }])
    .webp({ quality: 90 })
    .toFile(dest);
}

await plate([1672, 941], path.join(ending, 'living-room-clean-v1.webp'));
await plate([1024, 576], path.join(ending, 'living-room-clean-v1-1024.webp'));
await plate([1024, 1536], path.join(ending, 'living-room-mobile-v1.webp'));
await plate([768, 1152], path.join(ending, 'living-room-mobile-v1-768.webp'));
console.log('r29 botanical ending plates ready');
