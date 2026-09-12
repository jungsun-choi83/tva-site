import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preview = path.join(root, 'tools/.preview');
const roomOrig = path.join(preview, 'living-room-clean-v1-orig.webp');
const albumSrc = path.join(preview, 'ending-album-only.png');

async function flattenOnTable(src, { width, flatten, skew, rotate }) {
  const rotated = await sharp(src)
    .rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const flat = await sharp(rotated)
    .affine(
      [
        [1, skew],
        [0, flatten],
      ],
      { background: { r: 0, g: 0, b: 0, alpha: 0 }, interpolator: sharp.interpolators.nohalo }
    )
    .png()
    .toBuffer();
  const meta = await sharp(flat).metadata();
  const pad = 16;
  const sil = await sharp(flat).ensureAlpha().modulate({ brightness: 0 }).blur(6).png().toBuffer();
  const base = await sharp({
    create: {
      width: meta.width + pad * 2,
      height: meta.height + pad * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
  return sharp(base)
    .composite([
      { input: sil, left: pad + 3, top: pad + 5, blend: 'over' },
      { input: flat, left: pad, top: pad, blend: 'over' },
    ])
    .png()
    .toBuffer();
}

const album = await flattenOnTable(albumSrc, {
  width: 420,
  flatten: 0.42,
  skew: 0.22,
  rotate: -18,
});
await sharp(album).png().toFile(path.join(preview, 'laid-album-flat.png'));
const albumMeta = await sharp(album).metadata();
console.log('album', albumMeta.width, albumMeta.height);

const baked = await sharp(roomOrig)
  .resize(1672, 941, { fit: 'fill' })
  .composite([{ input: album, left: 748, top: 618, blend: 'over' }])
  .png()
  .toBuffer();
await sharp(baked).png().toFile(path.join(preview, 'living-room-baked.png'));
await sharp(baked)
  .extract({ left: 620, top: 520, width: 620, height: 280 })
  .png()
  .toFile(path.join(preview, 'ending-table-zoom.png'));
await sharp(baked)
  .webp({ quality: 92, effort: 5 })
  .toFile(path.join(root, 'assets/ending/living-room-clean-v1.webp'));
await sharp(baked)
  .resize({ width: 1024 })
  .webp({ quality: 90, effort: 5 })
  .toFile(path.join(root, 'assets/ending/living-room-clean-v1-1024.webp'));
console.log('baked flat album toward sofa');
