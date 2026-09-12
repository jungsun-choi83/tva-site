import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync } from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const labSrc = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets/ending-lab-iso.jpg';
const roomDir = path.join(root, 'assets/ending/r10-image-first');
const endDir = path.join(root, 'assets/ending');

const labMeta = await sharp(labSrc).metadata();
console.log('lab src', labMeta.width, labMeta.height);

await sharp(labSrc)
  .resize(2048, 1365, { fit: 'cover', position: 'centre' })
  .webp({ quality: 95, effort: 5 })
  .toFile(path.join(roomDir, 'room-lab-v1.webp'));
await sharp(labSrc)
  .resize(1536, 1024, { fit: 'cover', position: 'centre' })
  .jpeg({ quality: 94 })
  .toFile(path.join(endDir, '_lab-preview.jpg'));

const metal = path.join(endDir, 'living-room-preview.jpg');
await sharp(metal).resize(1672, 941, { fit: 'cover' }).webp({ quality: 95, effort: 5 }).toFile(path.join(endDir, 'living-room-clean-v1.webp'));
await sharp(metal).resize(1400, 788, { fit: 'cover' }).webp({ quality: 94, effort: 5 }).toFile(path.join(endDir, 'living-room-clean-v1-1024.webp'));

console.log('lab + living-room quality plates written');
