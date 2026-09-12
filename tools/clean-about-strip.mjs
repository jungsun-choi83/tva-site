import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets/about-walk');
const PANEL = 1774;
const files = ['_p0-company.png', '_p1-letter.png', '_p2-identity.png', '_p3-holo.png', '_p4-motion.png', '_p5-archive.png'];

const first = await sharp(path.join(dir, files[0])).metadata();
const H = first.height;
const W = PANEL * 6;
const C = 3;
const panels = [];
for (const f of files) {
  const { data } = await sharp(path.join(dir, f)).resize(PANEL, H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  panels.push(data);
}
const getP = (p, x, y) => {
  const i = (y * PANEL + x) * C;
  return [panels[p][i], panels[p][i + 1], panels[p][i + 2]];
};
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const cream = getP(0, 36, 40);
const out = Buffer.alloc(W * H * C);
const set = (x, y, r, g, b) => {
  const i = (y * W + x) * C;
  out[i] = r; out[i + 1] = g; out[i + 2] = b;
};

for (let p = 0; p < 6; p++) {
  const x0 = p * PANEL;
  const boxL = x0 + Math.round(PANEL * 0.428);
  const boxR = x0 + PANEL - 16;
  const boxT = Math.round(H * 0.078);
  const boxB = Math.round(H * 0.875);
  const titles = [];
  const tx0 = Math.round(PANEL * 0.428) + 6;
  const tx1 = tx0 + 520;
  const ty0 = boxT + 10;
  const ty1 = boxT + 108;
  for (let y = ty0; y < ty1; y++) {
    for (let x = tx0; x < tx1; x++) {
      const [r, g, b] = getP(p, x, y);
      if (luma(r, g, b) < 70) continue;
      titles.push([x0 + x, y, r, g, b]);
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = x0; x < x0 + PANEL; x++) {
      const floorBar = y >= H - 12 && x >= boxL - 12;
      if (floorBar) { set(x, y, 14, 14, 14); continue; }
      const inBox = x >= boxL && x <= boxR && y >= boxT && y <= boxB;
      if (inBox) set(x, y, 8, 8, 8);
      else set(x, y, cream[0], cream[1], cream[2]);
    }
  }
  for (const [x, y, r, g, b] of titles) set(x, y, r, g, b);
  console.log('panel', p, 'titles', titles.length);
}

await sharp(out, { raw: { width: W, height: H, channels: 3 } })
  .webp({ quality: 93 })
  .toFile(path.join(dir, 'strip.webp'));
await sharp(out, { raw: { width: W, height: H, channels: 3 } })
  .extract({ left: 0, top: 0, width: PANEL, height: H })
  .png()
  .toFile(path.join(dir, '_p0-check.png'));
await sharp(out, { raw: { width: W, height: H, channels: 3 } })
  .extract({ left: PANEL, top: 0, width: PANEL, height: H })
  .png()
  .toFile(path.join(dir, '_p1-check.png'));
console.log('rewrote strip from original panels');
