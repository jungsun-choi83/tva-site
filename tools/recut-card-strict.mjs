import sharp from 'sharp';
const src = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets/goya-card-only.png';
const dest = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12/assets/goya/goya-photocard-fall.png';

function isMag(r, g, b) {
  return r > 150 && b > 90 && g < 90 && (Math.min(r, b) - g) > 40;
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width, h = info.height, pixels = Buffer.from(data);
const seen = new Uint8Array(w * h);
const stack = [];
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const p = y * w + x;
  if (seen[p]) return;
  seen[p] = 1;
  const i = p * 4;
  if (isMag(pixels[i], pixels[i + 1], pixels[i + 2])) stack.push(p);
};
for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
while (stack.length) {
  const p = stack.pop();
  const x = p % w, y = (p / w) | 0;
  pixels[p * 4 + 3] = 0;
  push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
}
let buf = await sharp(pixels, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 8 }).png().toBuffer();
const square = 1254, pad = 40;
const resized = await sharp(buf).resize({ width: square - pad * 2, height: square - pad * 2, fit: 'inside' }).png().toBuffer();
const rm = await sharp(resized).metadata();
await sharp({ create: { width: square, height: square, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: resized, left: Math.round((square - rm.width) / 2), top: Math.round((square - rm.height) / 2) }])
  .png()
  .toFile(dest);
console.log('card', rm.width, rm.height);
