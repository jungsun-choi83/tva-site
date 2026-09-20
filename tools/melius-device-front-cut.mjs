import sharp from 'sharp';
import path from 'path';

const root = path.resolve('C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12');
const dest = path.join(root, 'assets/hero/beam-device-melius-front-cut.png');

/** Orthographic front device — transparent PNG for Melius hub */
async function main() {
  const w = 640;
  const h = 720;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 640 720">
  <defs>
    <linearGradient id="body" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3a3d42"/>
      <stop offset="45%" stop-color="#222428"/>
      <stop offset="100%" stop-color="#121316"/>
    </linearGradient>
    <linearGradient id="rim" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#5c6068"/>
      <stop offset="100%" stop-color="#1a1c20"/>
    </linearGradient>
    <linearGradient id="screen" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#141416"/>
      <stop offset="100%" stop-color="#050506"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#000" flood-opacity=".28"/>
    </filter>
  </defs>
  <g filter="url(#soft)">
    <rect x="72" y="48" width="496" height="624" rx="52" ry="52" fill="url(#body)"/>
    <rect x="88" y="64" width="464" height="592" rx="44" ry="44" fill="none" stroke="url(#rim)" stroke-width="6"/>
    <rect x="118" y="108" width="404" height="404" rx="28" ry="28" fill="url(#screen)" stroke="#2a2c30" stroke-width="3"/>
    <rect x="118" y="108" width="404" height="404" rx="28" ry="28" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="1"/>
    <rect x="132" y="532" width="376" height="10" rx="4" fill="#0a0a0c" opacity=".55"/>
    <rect x="268" y="74" width="104" height="14" rx="7" fill="#2e3136"/>
  </g>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(dest);
  console.log('wrote', dest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
