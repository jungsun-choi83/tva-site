import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cursorAssets = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';

function floodKey(data, w, h, isBg) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (seen[i]) return;
    seen[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const p = i * 4;
    if (!isBg(data[p], data[p + 1], data[p + 2], data[p + 3])) continue;
    data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }
}

function fringe(data, w, h) {
  const copy = Buffer.from(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = (y * w + x) * 4;
      if (copy[p + 3] < 12) continue;
      let empty = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (copy[((y + dy) * w + (x + dx)) * 4 + 3] < 12) empty++;
        }
      }
      if (empty >= 3) {
        const r = copy[p], g = copy[p + 1], b = copy[p + 2];
        const lum = (r + g + b) / 3;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        if (lum > 210 && sat < 40) {
          data[p + 3] = 0; data[p] = 0; data[p + 1] = 0; data[p + 2] = 0;
        } else if (empty >= 5) {
          data[p + 3] = Math.round(copy[p + 3] * 0.4);
        }
      }
    }
  }
}

async function cropSquare(data, w, h, dest, pad = 18) {
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 18) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const side = Math.max(cw, ch);
  const extracted = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: cw, height: ch })
    .png()
    .toBuffer();
  await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: extracted, left: Math.round((side - cw) / 2), top: Math.round((side - ch) / 2) }])
    .png()
    .toFile(dest);
  console.log('wrote', dest, side, 'content', cw, ch);
}

const goyaSrc = path.join(root, 'assets/goya/goya-letter-search.png');
const { data: goya, info: gi } = await sharp(goyaSrc).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
floodKey(goya, gi.width, gi.height, (r, g, b, a) => {
  if (a < 8) return true;
  const lum = (r + g + b) / 3;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  const pink = r > 170 && g < 90 && b > 40 && (r - g) > 90;
  const cream = lum > 218 && sat < 26 && (r - b) < 28 && b > 200;
  return pink || cream;
});
fringe(goya, gi.width, gi.height);
await cropSquare(goya, gi.width, gi.height, path.join(root, 'assets/goya/goya-letter-search.png'));

const paperSrc = path.join(cursorAssets, 'c__Users____AppData_Roaming_Cursor_User_workspaceStorage_49169b2e67def388f5bbb3d140febc14_images____-bd7f684a-b231-4be9-8841-f951e94f4463.jpg');
const { data: paper, info: pi } = await sharp(paperSrc).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
floodKey(paper, pi.width, pi.height, (r, g, b) => {
  const lum = (r + g + b) / 3;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  return lum > 228 && sat < 22;
});
fringe(paper, pi.width, pi.height);
let minX = pi.width, minY = pi.height, maxX = 0, maxY = 0;
for (let y = 0; y < pi.height; y++) {
  for (let x = 0; x < pi.width; x++) {
    if (paper[(y * pi.width + x) * 4 + 3] > 18) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
}
const pad = 8;
minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
maxX = Math.min(pi.width - 1, maxX + pad); maxY = Math.min(pi.height - 1, maxY + pad);
const paperOut = path.join(root, 'assets/contact/letter-sheet.png');
await sharp(paper, { raw: { width: pi.width, height: pi.height, channels: 4 } })
  .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
  .png()
  .toFile(paperOut);
console.log('wrote', paperOut, maxX - minX + 1, maxY - minY + 1);

const hallSrc = path.join(cursorAssets, 'c__Users____AppData_Roaming_Cursor_User_workspaceStorage_49169b2e67def388f5bbb3d140febc14_images__-d28c34e5-ca8f-4fd9-a348-42297342edde.jpg');
const hallDir = path.join(root, 'assets/contact');
await sharp(hallSrc).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 86 }).toFile(path.join(hallDir, 'archive-hall.webp'));
await sharp(hallSrc).resize({ width: 1920, withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(path.join(hallDir, 'archive-hall.jpg'));
console.log('wrote archive hall');
