// 고야 스프라이트의 '붉은 테두리'를 걷어낸다.
//   node audit/scripts/decon-goya.mjs <읽을폴더> <쓸폴더> <파일...>
//
// ── 무엇이 남아 있었나
// 그림은 색배경 위에서 만들어진 뒤 tools/r20-apply.mjs 의 keyMagenta 로 배경을 뽑았다.
// 그 판별식(mag = min(R,B) - G > 16)은 '빨강과 파랑이 함께 높은' 자홍만 잡는다.
// 그런데 이 묶음의 배경은 자홍이 아니라 연어색(코랄) 계열이라 — 표본 rgb(245,126,125) —
// 파랑이 높지 않아 그물을 빠져나갔고, 실루엣 둘레에 배경색 픽셀이 그대로 남았다.
//
// ── 남았다는 증거 (audit/scripts/_rim3.mjs)
// 실루엣 안쪽 5px 띠에서 코랄 픽셀 비율:
//   idle 29.1% · sit 32.1% · present 34.6% · point 31.6% · usher 29.6%
//   walk-a 0.4% · walk-b 0.7% · walk-c 0.0% · walk-d 0.4%
// 같은 캐릭터인데 나중에 만든 걷는 그림 넉 장에는 없다 → 그림의 일부가 아니라 배경 자국이다.
// 안쪽(테두리 아닌 곳)은 0.04~0.18% 로 사실상 0 이라, 혀처럼 진짜 붉은 부분을 건드릴 위험도 없다.
//
// ── 어떻게 거르나
// 털의 황갈색과 배경의 코랄을 가르는 건 초록과 파랑의 차이다.
//   황갈 털   rgb(230,170,110) → G-B ≈ 60 (파랑이 낮다)
//   코랄 배경 rgb(245,126,125) → G-B ≈  1 (초록과 파랑이 같고 빨강만 높다)
// 그래서 '초록≈파랑' 인 정도(중립도)와 '빨강이 넘치는' 정도를 곱해 배경 비율을 추정하고,
// 그만큼 투명도를 올린 뒤 남은 색의 붉은 기운을 깎는다. 자홍 자국도 같은 패스에서 함께 지운다.
import { PNG } from 'pngjs'; import fs from 'node:fs'; import path from 'node:path';

const RIM   = +(process.env.RIM   || 6);   // 실루엣에서 몇 px 안쪽까지 볼 것인가
const 여유  = +(process.env.ALLOW || 30);  // 이만큼의 붉은 기운은 캐릭터 색으로 인정
const 범위  = +(process.env.RANGE || 60);  // 여유를 넘어선 뒤 이만큼 더 붉으면 전부 배경으로 본다
const 중립폭= +(process.env.NEUT  || 40);  // |G-B| 가 이 값 이상이면 (황갈 털) 배경으로 보지 않는다
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

const [inDir, outDir, ...files] = process.argv.slice(2);
if (!inDir || !outDir || !files.length) { console.error('사용법: decon-goya.mjs <읽을폴더> <쓸폴더> <파일...>'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

for (const f of files) {
  const p = PNG.sync.read(fs.readFileSync(path.join(inDir, f)));
  const { width: w, height: h, data: d } = p;

  // 원래 알파 기준으로 '실루엣 안쪽 RIM px' 띠를 먼저 표시해 둔다 (알파를 고치면 경계가 움직이므로)
  const 띠 = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (d[i * 4 + 3] === 0) continue;
    let 닿 = false;
    for (let dy = -RIM; dy <= RIM && !닿; dy++) for (let dx = -RIM; dx <= RIM; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || xx < 0 || yy >= h || xx >= w || d[(yy * w + xx) * 4 + 3] === 0) { 닿 = true; break; }
    }
    if (닿) 띠[i] = 1;
  }

  let 지움 = 0, 깎음 = 0, 자홍 = 0;
  for (let i = 0; i < w * h; i++) {
    const q = i * 4, a0 = d[q + 3];
    if (a0 === 0) continue;
    const r = d[q], g = d[q + 1], b = d[q + 2];

    // 두 보정 모두 **실루엣 둘레 띠 안에서만** 한다.
    // (2026-09-13: 처음에는 자홍 보정을 반투명 픽셀 전체에 걸었는데, photocard-insert-a.png 처럼
    //  넓은 반투명 유리판이 있는 그림에서 의도된 따뜻한 색조까지 식혀 버렸다 — 16만 픽셀이 바뀌었다.
    //  배경 자국은 정의상 실루엣 둘레에만 있으므로 범위를 띠로 좁힌다.)
    if (!띠[i]) continue;

    // ① 자홍 자국 (초록보다 빨강·파랑이 함께 높은 경우)
    const mag = Math.min(r, b) - g;
    if (mag > 0) {
      d[q] = Math.max(g, r - mag); d[q + 2] = Math.max(g, b - mag); 자홍++;
    }

    // ② 코랄 배경
    const R = d[q], G = d[q + 1], B = d[q + 2];
    const 중립 = clamp(1 - Math.abs(G - B) / 중립폭, 0, 1);           // 초록≈파랑일수록 1
    const 넘침 = Math.max(0, R - Math.max(G, B) - 여유);
    const 배경비 = 중립 * clamp(넘침 / 범위, 0, 1);
    if (배경비 <= 0) continue;
    const a1 = Math.round(a0 * (1 - 배경비));
    d[q + 3] = a1;
    d[q] = Math.min(R, Math.max(G, B) + 여유);                        // 남은 붉은 기운을 깎는다
    if (a1 === 0) 지움++; else 깎음++;
  }

  fs.writeFileSync(path.join(outDir, f), PNG.sync.write(p));
  console.log(`${f.padEnd(14)} 자홍보정 ${String(자홍).padStart(5)} · 코랄 지움 ${String(지움).padStart(5)} · 코랄 옅게 ${String(깎음).padStart(5)}`);
}
