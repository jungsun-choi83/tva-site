import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDesk = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets/ending-room-photo.jpg';
const srcMob = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets/ending-room-photo-mobile.jpg';
const out = path.join(root, 'assets/ending');

const deskMeta = await sharp(srcDesk).metadata();
const mobMeta = await sharp(srcMob).metadata();
console.log('desk', deskMeta.width, deskMeta.height);
console.log('mob', mobMeta.width, mobMeta.height);

const desk = await sharp(srcDesk).resize(1672, 941, { fit: 'cover', position: 'centre' }).toBuffer();

await sharp(desk).webp({ quality: 90 }).toFile(path.join(out, 'living-room-clean-v1.webp'));
await sharp(desk).resize(1024, 576).webp({ quality: 88 }).toFile(path.join(out, 'living-room-clean-v1-1024.webp'));
await sharp(desk).jpeg({ quality: 90 }).toFile(path.join(out, 'living-room-preview.jpg'));
await sharp(desk).jpeg({ quality: 90 }).toFile(path.join(out, '_photo.jpg'));

await sharp(srcMob)
  .resize(1024, 1536, { fit: 'cover', position: 'attention' })
  .webp({ quality: 90 })
  .toFile(path.join(out, 'living-room-mobile-v1.webp'));
await sharp(srcMob)
  .resize(768, 1152, { fit: 'cover', position: 'attention' })
  .webp({ quality: 88 })
  .toFile(path.join(out, 'living-room-mobile-v1-768.webp'));
await sharp(srcMob)
  .resize(1024, 1536, { fit: 'cover', position: 'attention' })
  .jpeg({ quality: 90 })
  .toFile(path.join(out, 'living-room-mobile-preview.jpg'));

await sharp(desk)
  .extract({ left: 1160, top: 200, width: 460, height: 380 })
  .jpeg({ quality: 92 })
  .toFile(path.join(out, '_cube-crop.jpg'));

console.log('wrote photoreal ending plates');
