import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const root = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12';
const goyaDir = path.join(root, 'assets/goya');
const bgDir = path.join(root, 'sofa-journey/assets/bg');
const previewDir = path.join(root, 'tools/.preview');

function isMagenta(r, g, b) {
  const mag = Math.min(r, b) - g;
  return r > 80 && b > 55 && g < 145 && mag > 16 && (r + b) > g * 1.8;
}

function keyMagenta(data, w, h) {
  const n = w * h;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    if (isMagenta(r, g, b)) {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0;
    } else {
      const mag = Math.min(r, b) - g;
      if (mag > 8 && r > 60 && b > 45 && g < 155) {
        data[p] = Math.max(g, r - mag);
        data[p + 2] = Math.max(g, b - mag);
      }
    }
  }
  const copy = Buffer.from(data);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    if (copy[i + 3] !== 0) continue;
    let c = 0, sr = 0, sg = 0, sb = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const ni = ((y + oy) * w + (x + ox)) * 4;
      if (copy[ni + 3] > 80) { c++; sr += copy[ni]; sg += copy[ni + 1]; sb += copy[ni + 2]; }
    }
    if (c >= 2) {
      data[i] = Math.round(sr / c);
      data[i + 1] = Math.round(sg / c);
      data[i + 2] = Math.round(sb / c);
      data[i + 3] = Math.min(150, c * 22);
    }
  }
}

async function cutMagenta(src, dest, { square = 0, pad = 16 } = {}) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  keyMagenta(pixels, info.width, info.height);
  let buf = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 6 })
    .png()
    .toBuffer();
  if (square) {
    const resized = await sharp(buf).resize({ width: square - pad * 2, height: square - pad * 2, fit: 'inside' }).png().toBuffer();
    const rm = await sharp(resized).metadata();
    buf = await sharp({ create: { width: square, height: square, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: resized, left: Math.round((square - rm.width) / 2), top: Math.round((square - rm.height) / 2) }])
      .png()
      .toBuffer();
  }
  if (dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await sharp(buf).png().toFile(dest);
    console.log('cut', path.basename(dest));
  }
  return buf;
}

async function keyedPng(src) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  keyMagenta(pixels, info.width, info.height);
  return sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
}

await cutMagenta(path.join(cursor, 'goya-boy-sit.png'), path.join(goyaDir, 'sit.png'), { square: 1254 });
await cutMagenta(path.join(cursor, 'goya-boy-stand.png'), path.join(goyaDir, 'idle.png'), { square: 1254 });
await cutMagenta(path.join(cursor, 'goya-boy-walk1.png'), path.join(goyaDir, 'walk1.png'), { square: 1254 });
await cutMagenta(path.join(cursor, 'goya-boy-walk2.png'), path.join(goyaDir, 'walk2.png'), { square: 1254 });
const fall = await cutMagenta(path.join(cursor, 'goya-boy-fall.png'), path.join(goyaDir, 'goya-fall-surprise.png'), { square: 1254 });
await fs.promises.copyFile(path.join(goyaDir, 'goya-fall-surprise.png'), path.join(goyaDir, 'goya-fall-flail.png'));
await fs.promises.copyFile(path.join(goyaDir, 'goya-fall-surprise.png'), path.join(goyaDir, 'goya-fall-mid.png'));
await fs.promises.copyFile(path.join(goyaDir, 'goya-fall-surprise.png'), path.join(goyaDir, 'goya-fall-tuck.png'));
await fs.promises.copyFile(path.join(goyaDir, 'sit.png'), path.join(goyaDir, 'goya-cartoon-sit.png'));

const CARD_W = 900;
const CARD_H = 1200;
const frameKeyed = await keyedPng(path.join(cursor, 'photocard-clear-rim.png'));
const frameMeta = await sharp(frameKeyed).metadata();
const frameFit = await sharp(frameKeyed)
  .resize({ width: CARD_W, height: CARD_H, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const photoFit = await sharp(path.join(cursor, 'goya-boy-card.png'))
  .resize({ width: Math.round(CARD_W * 0.78), height: Math.round(CARD_H * 0.78), fit: 'cover' })
  .png()
  .toBuffer();
const photoMeta = await sharp(photoFit).metadata();
await sharp({ create: { width: CARD_W, height: CARD_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    {
      input: photoFit,
      left: Math.round((CARD_W - photoMeta.width) / 2),
      top: Math.round((CARD_H - photoMeta.height) / 2),
    },
    { input: frameFit, left: 0, top: 0 },
  ])
  .png()
  .toFile(path.join(goyaDir, 'goya-photocard-fall.png'));
console.log('photocard clear frame', frameMeta.width, frameMeta.height);

const W = 1920;
const H = 1080;
const joinGlow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="g" cx="50%" cy="52%" r="38%">
      <stop offset="0%" stop-color="#e8c97a" stop-opacity="0.42"/>
      <stop offset="45%" stop-color="#7ad4c8" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`);

const pets = {
  retriever: 'pet-retriever.png',
  tabby: 'pet-tabby.png',
  husky: 'pet-husky.png',
  whitecat: 'pet-whitecat.png',
  corgi: 'pet-corgi.png',
  blackcat: 'pet-blackcat.png',
  shiba: 'pet-shiba.png',
  calico: 'pet-calico.png',
  beagle: 'pet-beagle.png',
  siamese: 'pet-siamese.png',
  poodle: 'pet-poodle.png',
  bluecat: 'pet-bluecat.png',
  lab: 'pet-lab.png',
  dalmatian: 'pet-dalmatian.png',
};

const pairs = [
  ['retriever', 'tabby', 'mh-env-01.png', 'b1-1920s.webp'],
  ['husky', 'whitecat', 'mh-env-02.png', 'c1-1936.webp'],
  ['corgi', 'blackcat', 'mh-env-03.png', 'c2-1945.webp'],
  ['shiba', 'calico', 'mh-env-05.png', 'b2-1956.webp'],
  ['beagle', 'siamese', 'mh-env-16.png', 'c3-1964.webp'],
  ['poodle', 'bluecat', 'mh-env-17.png', 'b3-1969.webp'],
  ['lab', 'blackcat', 'mh-env-18.png', 'c4-1977.webp'],
  ['dalmatian', 'tabby', 'mh-env-19.png', 'c5-1985.webp'],
  ['retriever', 'whitecat', 'mh-env-20.png', 'b4-1988.webp'],
  ['husky', 'calico', 'mh-env-21.png', 'b5-1989.webp'],
  ['corgi', 'bluecat', 'mh-env-22.png', 'b6-1991.webp'],
  ['shiba', 'blackcat', 'mh-env-23.png', 'c6-1996.webp'],
  ['beagle', 'whitecat', 'mh-env-02.png', 'b7-2002.webp'],
  ['poodle', 'calico', 'mh-env-16.png', 'c7-2006.webp'],
  ['lab', 'tabby', 'mh-env-01.png', 'c8-2012.webp'],
];

async function petSprite(name) {
  const buf = await keyedPng(path.join(cursor, pets[name]));
  return sharp(buf).resize({ width: Math.round(W * 0.68), height: Math.round(H * 0.82), fit: 'inside' }).png().toBuffer();
}

for (let i = 0; i < pairs.length; i++) {
  const [aName, bName, envName, destName] = pairs[i];
  const bg = await sharp(path.join(cursor, envName)).resize(W, H, { fit: 'cover' }).png().toBuffer();
  const [aBuf, bBuf] = await Promise.all([petSprite(aName), petSprite(bName)]);
  const aMeta = await sharp(aBuf).metadata();
  const bMeta = await sharp(bBuf).metadata();
  const aLeft = Math.round(W * 0.02);
  const bLeft = Math.max(aLeft + 48, W - bMeta.width - Math.round(W * 0.02));
  const aTop = Math.round((H - aMeta.height) / 2);
  const bTop = Math.round((H - bMeta.height) / 2 + H * 0.02);
  const out = await sharp(bg)
    .composite([
      { input: joinGlow, left: 0, top: 0 },
      { input: aBuf, left: aLeft, top: aTop },
      { input: bBuf, left: bLeft, top: bTop },
    ])
    .webp({ quality: 90 })
    .toFile(path.join(bgDir, destName));
  console.log('pair', destName, aName, '+', bName, out.size);
}

fs.mkdirSync(previewDir, { recursive: true });
await sharp(path.join(bgDir, 'b1-1920s.webp')).png().toFile(path.join(previewDir, 'era-b1-joined.png'));
await sharp(path.join(goyaDir, 'goya-photocard-fall.png')).png().toFile(path.join(previewDir, 'photocard-r16.png'));
await sharp(path.join(goyaDir, 'sit.png')).png().toFile(path.join(previewDir, 'goya-sit-r16.png'));
console.log('r16 done');
