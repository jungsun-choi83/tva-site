// 분홍 테두리가 가장 몰려 있는 곳을 찾아 전/후를 나란히 확대해 붙인다.
import { PNG } from 'pngjs'; import fs from 'node:fs'; import path from 'node:path';
const [beforeDir, afterDir, file, outPath, sizeArg, zoomArg] = process.argv.slice(2);
const S = +(sizeArg || 170), Z = +(zoomArg || 4);
const A = PNG.sync.read(fs.readFileSync(path.join(beforeDir, file)));
const B = PNG.sync.read(fs.readFileSync(path.join(afterDir, file)));
const { width: w, height: h } = A;
// 64px 격자로 훑어 오염 픽셀이 가장 많은 칸을 찾는다
let best = { n: -1, x: 0, y: 0 };
for (let gy = 0; gy + S <= h; gy += 32) for (let gx = 0; gx + S <= w; gx += 32) {
  let n = 0;
  for (let y = gy; y < gy + S; y += 2) for (let x = gx; x < gx + S; x += 2) {
    const q = (y * w + x) * 4, a = A.data[q + 3];
    if (a === 0 || a >= 250) continue;
    if (Math.min(A.data[q], A.data[q + 2]) - A.data[q + 1] > 14) n++;
  }
  if (n > best.n) best = { n, x: gx, y: gy };
}
const GAP = 14, W = S * Z * 2 + GAP, H = S * Z;
const out = new PNG({ width: W, height: H });
const 칠 = (px, i, r, g, b, a) => { px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = a; };
for (let i = 0; i < W * H; i++) 칠(out.data, i * 4, 246, 242, 232, 255);   // 사이트 크림색 바탕
for (const [src, ox] of [[A, 0], [B, S * Z + GAP]]) {
  for (let y = 0; y < H; y++) for (let x = 0; x < S * Z; x++) {
    const sx = best.x + ((x / Z) | 0), sy = best.y + ((y / Z) | 0);
    const q = (sy * w + sx) * 4, a = src.data[q + 3] / 255;
    const o = (y * W + (x + ox)) * 4;
    // 크림 바탕 위에 합성 — 실제 화면과 같은 조건에서 테두리를 본다
    칠(out.data, o, Math.round(src.data[q]*a + 246*(1-a)), Math.round(src.data[q+1]*a + 242*(1-a)), Math.round(src.data[q+2]*a + 232*(1-a)), 255);
  }
}
fs.writeFileSync(outPath, PNG.sync.write(out));
console.log(`${file} · 가장 심한 곳 (${best.x},${best.y}) ${S}px, 오염 표본 ${best.n}개 · ${Z}배 확대 → ${outPath}`);
