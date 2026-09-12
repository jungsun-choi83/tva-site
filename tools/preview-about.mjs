import sharp from 'sharp';
import path from 'path';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const out = path.join(root, 'tools/.preview');
await sharp(path.join(root, 'assets/about-walk/strip.webp'))
  .extract({ left: 0, top: 0, width: 1774, height: 887 })
  .png()
  .toFile(path.join(out, 'about-panel-01.png'));
await sharp(path.join(root, 'assets/about-walk/sit.webp')).png().toFile(path.join(out, 'about-sit.png'));
await sharp(path.join(root, 'assets/about-walk/stand.webp')).png().toFile(path.join(out, 'about-stand.png'));
await sharp(path.join(root, 'assets/about-walk/walk1.webp')).png().toFile(path.join(out, 'about-walk1.png'));
await sharp(path.join(root, 'sofa-journey/assets/bg/landing-home-preview.png'))
  .resize(960)
  .png()
  .toFile(path.join(out, 'landing-preview.png'));
await sharp(path.join(root, 'sofa-journey/assets/bg/b1-1920s.webp')).png().toFile(path.join(out, 'era-b1.png'));
console.log('preview ok');
