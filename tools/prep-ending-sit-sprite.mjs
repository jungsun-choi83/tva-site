import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(
  process.env.USERPROFILE,
  '.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets/goya-girl-buddy-look-cube.png',
);
const out = path.join(root, 'assets/goya/goya-girl-buddy-sit.png');

const image = sharp(src).ensureAlpha();
const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  if (r > 248 && g > 248 && b > 248) data[i + 3] = 0;
  else if (r > 236 && g > 236 && b > 236) {
    const t = (Math.min(r, g, b) - 236) / 12;
    data[i + 3] = Math.round(data[i + 3] * (1 - t));
  }
}
await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim({ threshold: 8 })
  .png()
  .toFile(out);
const meta = await sharp(out).metadata();
console.log('sit sprite', meta.width, meta.height);
