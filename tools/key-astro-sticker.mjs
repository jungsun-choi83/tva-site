import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets/c__Users____AppData_Roaming_Cursor_User_workspaceStorage_49169b2e67def388f5bbb3d140febc14_images_image-aff5e11b-089b-4798-9b44-a71276454a1f.png';
const dest = path.join(root, 'assets/goya/eb-astro-sticker.png');

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const cx = (w - 1) / 2, cy = (h - 1) / 2, r = Math.min(w, h) / 2 - 1;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4;
    const d = Math.hypot(x - cx, y - cy);
    if (d > r + 1.2) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    } else if (d > r - 1.2) {
      data[p + 3] = Math.round(data[p + 3] * Math.max(0, (r + 1.2 - d) / 2.4));
    }
  }
}
await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(dest);
console.log(JSON.stringify({ dest, w, h }));
