import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const out = path.join(root, 'tools/.preview');
fs.mkdirSync(out, { recursive: true });
const strip = path.join(root, 'assets/about-walk/strip.webp');
const meta = await sharp(strip).metadata();
console.log('strip', meta.width, meta.height);
const panel = Math.round(meta.width / 6);
for (let i = 0; i < 6; i++) {
  await sharp(strip)
    .extract({ left: Math.min(i * panel, meta.width - panel), top: 0, width: panel, height: meta.height })
    .png()
    .toFile(path.join(out, `about-panel-0${i + 1}.png`));
}
await sharp(path.join(root, 'sofa-journey/assets/bg/landing-sofa-empty-v2.webp')).png().toFile(path.join(out, 'landing-v2.png'));
await sharp(path.join(root, 'sofa-journey/assets/mascot/greeting-wave.webp')).png().toFile(path.join(out, 'ending-wave.png'));
console.log('panels ok', panel);
