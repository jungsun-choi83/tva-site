import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const root = path.resolve('C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12');
const PANEL = 1774;
const STRIP_H = 887;
const PANELS = 6;
const STRIP_W = PANEL * PANELS;
const FLOOR = Math.round(STRIP_H * 0.95); // about-walk.js STRIP.FLOOR
const CLEAR = Math.round(PANEL * 0.4); // left 40% reserved for copy

const PAPER = '#f6f2e8';
const INK = '#0d0d0f';
const GOLD = '#c8a15e';
const CREAM = '#f0ede6';

const goyaIdle = path.join(root, 'assets/goya/idle.png');
const goyaSit = path.join(root, 'assets/goya/sit.png');
const cubeCut = path.join(root, 'assets/brand/device-cube-cut.png');

function svgBuf(w, h, inner) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`
  );
}

async function pngFromSvg(w, h, inner) {
  return sharp(svgBuf(w, h, inner)).png().toBuffer();
}

async function fitHeight(src, height) {
  return sharp(src).resize({ height, fit: 'inside' }).png().toBuffer();
}

async function makePanel(index, title, kicker, extra = []) {
  const alcove = `
    <rect x="${CLEAR + 36}" y="72" width="${PANEL - CLEAR - 72}" height="${FLOOR - 96}" fill="${INK}"/>
    <rect x="${CLEAR + 36}" y="72" width="${PANEL - CLEAR - 72}" height="${FLOOR - 96}" fill="none" stroke="${GOLD}" stroke-width="1.2" opacity=".55"/>
    <line x1="${CLEAR + 64}" y1="${FLOOR - 28}" x2="${PANEL - 56}" y2="${FLOOR - 28}" stroke="${GOLD}" stroke-width="1" opacity=".35"/>
    <text x="${CLEAR + 56}" y="108" fill="${GOLD}" font-family="Georgia, Times, serif" font-size="13" letter-spacing="4">${kicker}</text>
    <text x="${CLEAR + 56}" y="148" fill="${CREAM}" font-family="Georgia, Times, serif" font-size="42">${title}</text>
  `;
  const floor = `
    <rect width="${PANEL}" height="${STRIP_H}" fill="${PAPER}"/>
    <rect x="0" y="${FLOOR}" width="${PANEL}" height="${STRIP_H - FLOOR}" fill="#e7e0d2"/>
    <line x1="0" y1="${FLOOR}" x2="${PANEL}" y2="${FLOOR}" stroke="#d4c4a4" stroke-width="2"/>
  `;
  const base = await pngFromSvg(PANEL, STRIP_H, floor + alcove);
  const layers = [{ input: base, left: 0, top: 0 }, ...extra];
  return sharp({ create: { width: PANEL, height: STRIP_H, channels: 4, background: PAPER } })
    .composite(layers)
    .png()
    .toBuffer();
}

async function makeStrip() {
  const cube = await fitHeight(cubeCut, 310);
  const cubeMeta = await sharp(cube).metadata();
  const goya = await fitHeight(goyaIdle, 340);
  const goyaMeta = await sharp(goya).metadata();
  const sit = await fitHeight(goyaSit, 300);
  const sitMeta = await sharp(sit).metadata();

  const right = (imgW, margin = 90) => PANEL - imgW - margin;
  const onFloor = (imgH, lift = 36) => FLOOR - imgH - lift;

  const panels = await Promise.all([
    makePanel(0, 'COMPANY', '01  ARCHIVE HARDWARE', [
      { input: cube, left: right(cubeMeta.width, 110), top: onFloor(cubeMeta.height, 48) },
    ]),
    makePanel(1, 'LETTER', '02  SOUL TRACE', [
      { input: sit, left: right(sitMeta.width, 120), top: onFloor(sitMeta.height, 40) },
    ]),
    makePanel(2, 'IDENTITY', '03  PIXEL LOCK', [
      { input: goya, left: right(goyaMeta.width, 100), top: onFloor(goyaMeta.height, 20) },
    ]),
    makePanel(3, 'HOLOGRAM', '04  DEVICE', [
      { input: cube, left: right(cubeMeta.width, 80), top: onFloor(cubeMeta.height, 40) },
      { input: await fitHeight(goyaIdle, 220), left: right(cubeMeta.width, 150), top: onFloor(cubeMeta.height, 180) },
    ]),
    makePanel(4, 'MOTION', '05  APP', [
      { input: goya, left: right(goyaMeta.width, 110), top: onFloor(goyaMeta.height, 24) },
    ]),
    makePanel(5, 'ARCHIVE', '06  LIFE RECORD', [
      { input: cube, left: right(cubeMeta.width, 130), top: onFloor(cubeMeta.height, 44) },
    ]),
  ]);

  const outDir = path.join(root, 'assets/about-walk');
  fs.mkdirSync(outDir, { recursive: true });
  const dest = path.join(outDir, 'strip.webp');
  await sharp({ create: { width: STRIP_W, height: STRIP_H, channels: 4, background: PAPER } })
    .composite(panels.map((input, i) => ({ input, left: i * PANEL, top: 0 })))
    .webp({ quality: 82 })
    .toFile(dest);
  console.log('strip', dest, STRIP_W, STRIP_H);
}

function tableSvg(withSheets) {
  const sheets = withSheets
    ? `
    <polygon points="71,327 363,270 425,662 130,717" fill="#f4efe4" stroke="#c8a15e" stroke-width="2"/>
    <text transform="translate(118,430) rotate(-12)" fill="#0d0d0f" font-family="Georgia, Times, serif" font-size="28">LETTER</text>
    <text transform="translate(122,462) rotate(-12)" fill="#8f7034" font-family="Georgia, Times, serif" font-size="13">Soul Trace</text>

    <polygon points="377,297 659,228 750,617 464,682" fill="#141312" stroke="#c8a15e" stroke-width="2"/>
    <text transform="translate(430,400) rotate(-14)" fill="#f0ede6" font-family="Georgia, Times, serif" font-size="26">IDENTITY</text>
    <text transform="translate(434,432) rotate(-14)" fill="#c8a15e" font-family="Georgia, Times, serif" font-size="13">Pixel lock</text>

    <polygon points="670,253 947,203 1050,585 754,645" fill="#0d0d0f" stroke="#c8a15e" stroke-width="2"/>
    <text transform="translate(730,360) rotate(-11)" fill="#f0ede6" font-family="Georgia, Times, serif" font-size="24">HOLOGRAM</text>
    <text transform="translate(734,392) rotate(-11)" fill="#c8a15e" font-family="Georgia, Times, serif" font-size="13">Device</text>

    <polygon points="955,205 1247,171 1324,570 1059,589" fill="#1a1814" stroke="#c8a15e" stroke-width="2"/>
    <text transform="translate(1010,330) rotate(-8)" fill="#f0ede6" font-family="Georgia, Times, serif" font-size="24">ARCHIVE</text>
    <text transform="translate(1014,360) rotate(-8)" fill="#c8a15e" font-family="Georgia, Times, serif" font-size="13">Life record</text>
    `
    : '';
  return `
    <rect width="1671" height="941" fill="#f7f4ed"/>
    <polygon points="40,250 1630,140 1671,941 0,941" fill="#cbb79a"/>
    <polygon points="80,300 1580,190 1620,900 40,900" fill="#d8c4a6"/>
    <line x1="90" y1="310" x2="1570" y2="205" stroke="#b89d78" stroke-width="3"/>
    ${sheets}
  `;
}

async function makeTable() {
  const outDir = path.join(root, 'assets/original-table');
  fs.mkdirSync(outDir, { recursive: true });
  const full = await pngFromSvg(1671, 941, tableSvg(true));
  const empty = await pngFromSvg(1671, 941, tableSvg(false));
  const jobs = [
    ['table-clean-1671.webp', full, 1671],
    ['table-clean-nologo-1671.webp', full, 1671],
    ['table-empty-clean.webp', empty, 1671],
    ['table-clean-960.webp', full, 960],
    ['table-clean-nologo-960.webp', full, 960],
  ];
  for (const [name, buf, width] of jobs) {
    const dest = path.join(outDir, name);
    await sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest);
    console.log('table', name);
  }
}

await makeStrip();
await makeTable();
console.log('done');
