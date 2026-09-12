import sharp from 'sharp';
const src = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12/assets/hero/beam-device-1920x1080.png';
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width, h = info.height, px = Buffer.from(data);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = (y * w + x) * 4;
  const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
  if (a < 8 || x < w * 0.42) continue;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const warm = r > g + 8 && g > b - 4 && r > 90; // gold lettering
  if (warm && lum < 210) continue;
  if (lum < 108) continue;
  const t = Math.min(1, (lum - 108) / 140);
  const glass = 46 + t * 38; // 46..84 instead of 108..255
  const nr = glass * 0.96;
  const ng = glass * 0.97;
  const nb = glass * 1.02;
  px[i] = Math.round(r * (1 - t * 0.82) + nr * t * 0.82);
  px[i + 1] = Math.round(g * (1 - t * 0.82) + ng * t * 0.82);
  px[i + 2] = Math.round(b * (1 - t * 0.82) + nb * t * 0.82);
}
await sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toFile(src);
console.log('glass darkened');
