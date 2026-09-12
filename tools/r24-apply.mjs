import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const gallery = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12/gallery-original/assets/photos/optimized';
fs.mkdirSync(gallery, { recursive: true });

for (let i = 1; i <= 8; i++) {
  const src = path.join(cursor, `era-selfie-${String(i).padStart(2, '0')}.png`);
  const dest = path.join(gallery, `${String(i).padStart(2, '0')}.avif`);
  await sharp(src).resize(1200, 1500, { fit: 'cover', position: 'attention' }).avif({ quality: 62 }).toFile(dest);
  console.log('selfie', path.basename(dest));
}

console.log('r24 photos done');
