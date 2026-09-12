import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets/contact/archive-hall.jpg');
const meta = await sharp(src).metadata();
// Cut before the ladder (~56% of the original hall).
const width = Math.round(meta.width * 0.522);
const extract = { left: 0, top: 0, width, height: meta.height };
await sharp(src).extract(extract).webp({ quality: 88 }).toFile(path.join(root, 'assets/contact/archive-drawers.webp'));
await sharp(src).extract(extract).jpeg({ quality: 90 }).toFile(path.join(root, 'assets/contact/archive-drawers.jpg'));
console.log('cropped', meta.width, 'x', meta.height, '->', width, 'x', meta.height);
