// 코랄(연어색) 테두리 검출 — 털의 황갈색과 구분한다.
//   황갈색 털  rgb(230,170,110): G 가 B 보다 훨씬 높다 (G-B ≈ 60)
//   코랄 테두리 rgb(245,126,125): G 와 B 가 거의 같다 (G-B ≈ 1) 이면서 R 만 크게 높다
import { PNG } from 'pngjs'; import fs from 'node:fs'; import path from 'node:path';
const RIM = +(process.env.RIM || 5), dir = 'assets/goya';
const 코랄 = (r,g,b) => (r - g) > 55 && Math.abs(g - b) < 26 && r > 120;
for (const f of process.argv.slice(2)) {
  const p = PNG.sync.read(fs.readFileSync(path.join(dir, f)));
  const { width: w, height: h, data: d } = p;
  const 가 = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (d[i * 4 + 3] < 40) continue;
    let 닿 = false;
    for (let dy = -RIM; dy <= RIM && !닿; dy++) for (let dx = -RIM; dx <= RIM; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || xx < 0 || yy >= h || xx >= w || d[(yy * w + xx) * 4 + 3] === 0) { 닿 = true; break; }
    }
    if (닿) 가[i] = 1;
  }
  let 띠=0,띠코랄=0,속=0,속코랄=0;
  for (let i = 0; i < w * h; i++) {
    const q = i*4; if (d[q+3] < 40) continue;
    const c = 코랄(d[q], d[q+1], d[q+2]);
    if (가[i]) { 띠++; if (c) 띠코랄++; } else { 속++; if (c) 속코랄++; }
  }
  console.log(`${f.padEnd(14)} 테두리 ${(띠코랄/Math.max(띠,1)*100).toFixed(1).padStart(5)}%  안쪽 ${(속코랄/Math.max(속,1)*100).toFixed(2).padStart(5)}%   (테두리 ${띠코랄}px / 안쪽 ${속코랄}px)`);
}
