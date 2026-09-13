// 캐릭터 그림을 받아 검사하고 기준점을 재서 manifest 로 남긴다.
//   node tools/intake-character.mjs <그림폴더> [--out <manifest경로>]
//
// ── 왜 필요한가
// about-walk.js 의 주석은 "그림마다 몸통 폭·중심·신발 아래끝을 재 두고" 맞춘다고 적혀 있는데,
// 정작 코드는 POSE_METRICS 를 만들 때 **모든 자세에 같은 값 하나(GOYA_METRICS)** 를 넣고 있다.
// 자세마다 실제 값이 다르므로, 자세가 바뀌는 순간 캐릭터가 튀거나 발이 바닥에서 뜬다.
// 이 도구가 자세마다 실제 값을 재서 그 자리를 채운다.
//
// ── 재는 것 (assets/mascot/manifest.json 과 같은 형식)
//   bounds      그림 안에서 캐릭터가 차지하는 네 변 (0~1 로 정규화)
//   footAnchor  바닥에 닿는 점. y = 실루엣의 맨 아래, x = 맨 아래 2% 픽셀의 가로 무게중심
//               (달리는 자세는 디딘 발이 한쪽으로 쏠리므로 몸 중심과 다르다)
//   bodyAnchor  몸의 무게중심. 실루엣 위쪽 55% 구간에 있는 픽셀들의 무게중심
//   bodyL/R     bodyAnchor 높이에서의 몸통 좌우 끝 (자세끼리 몸 크기를 맞출 때 쓴다)
//   bodyT/shoeB 맨 위·맨 아래 (키를 맞출 때 쓴다)
//
// ── 같이 하는 검사
//   [1] 정사각인가 · 크기가 같은가
//   [2] 배경이 진짜 투명한가 (네 모서리 알파 0)
//   [3] 실루엣 둘레에 배경색이 남았는가 — 색배경 위에 그린 뒤 빼내면 생긴다(#G01 의 분홍 후광)
//   [4] 자세끼리 발 높이·눈높이가 맞는가 — 안 맞으면 자세가 바뀔 때 캐릭터가 튄다
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dir = args[0];
const outArg = args.indexOf('--out');
const outPath = outArg >= 0 ? args[outArg + 1] : path.join(dir, 'manifest.json');
if (!dir || !fs.existsSync(dir)) {
  console.error('사용법: node tools/intake-character.mjs <그림폴더> [--only 이름,이름] [--out <manifest경로>]');
  process.exit(1);
}

const onlyArg = args.indexOf('--only');
const only = onlyArg >= 0 ? new Set(args[onlyArg + 1].split(',').map(x => x.trim().replace(/\.png$/i, ''))) : null;
const files = fs.readdirSync(dir)
  .filter(f => /\.png$/i.test(f))
  .filter(f => !only || only.has(f.replace(/\.png$/i, '')))
  .sort();
if (!files.length) { console.error(`${dir} 에 png 가 없습니다.`); process.exit(1); }

const 코랄 = (r, g, b) => (r - g) > 55 && Math.abs(g - b) < 26 && r > 120;   // 코랄 배경 자국
const 자홍 = (r, g, b) => Math.min(r, b) - g > 12;                            // 자홍 배경 자국
const RIM = 5;

const 잰다 = file => {
  const p = PNG.sync.read(fs.readFileSync(path.join(dir, file)));
  const { width: w, height: h, data: d } = p;
  const A = i => d[i * 4 + 3];

  // 실루엣 범위
  let L = w, R = -1, T = h, B = -1, 넓이 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (A(y * w + x) < 24) continue;
    넓이++;
    if (x < L) L = x; if (x > R) R = x;
    if (y < T) T = y; if (y > B) B = y;
  }
  if (B < 0) return { file, 오류: '투명한 픽셀만 있습니다' };

  const 키 = B - T + 1;

  // 발 기준점 — 맨 아래 2% 띠의 가로 무게중심
  const 발띠 = Math.max(1, Math.round(키 * 0.02));
  let fx = 0, fn = 0;
  for (let y = B - 발띠 + 1; y <= B; y++) for (let x = 0; x < w; x++) {
    const a = A(y * w + x); if (a < 24) continue; fx += x * a; fn += a;
  }
  const footX = fn ? fx / fn : (L + R) / 2;

  // 몸 기준점 — 위쪽 55% 구간의 무게중심
  const 몸끝 = T + Math.round(키 * 0.55);
  let bx = 0, by = 0, bn = 0;
  for (let y = T; y <= 몸끝; y++) for (let x = 0; x < w; x++) {
    const a = A(y * w + x); if (a < 24) continue; bx += x * a; by += y * a; bn += a;
  }
  const bodyX = bn ? bx / bn : (L + R) / 2;
  const bodyY = bn ? by / bn : (T + B) / 2;

  // bodyAnchor 높이에서의 몸통 좌우 끝
  const 행 = Math.round(bodyY);
  let bl = w, br = -1;
  for (let x = 0; x < w; x++) if (A(행 * w + x) >= 24) { if (x < bl) bl = x; if (x > br) br = x; }
  if (br < 0) { bl = L; br = R; }

  // 검사
  const 모서리 = [A(0), A(w - 1), A((h - 1) * w), A(h * w - 1)];
  let 띠 = 0, 코 = 0, 자 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (d[i * 4 + 3] < 40) continue;
    let 닿 = false;
    for (let dy = -RIM; dy <= RIM && !닿; dy++) for (let dx = -RIM; dx <= RIM; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || xx < 0 || yy >= h || xx >= w || d[(yy * w + xx) * 4 + 3] === 0) { 닿 = true; break; }
    }
    if (!닿) continue;
    띠++;
    const q = i * 4, r = d[q], g = d[q + 1], b = d[q + 2];
    if (코랄(r, g, b)) 코++;
    if (자홍(r, g, b)) 자++;
  }

  const n = v => +v.toFixed(4);
  return {
    file, width: w, height: h,
    bounds: { left: n(L / w), top: n(T / h), right: n((R + 1) / w), bottom: n((B + 1) / h) },
    footAnchor: { x: n(footX / w), y: n((B + 1) / h) },
    bodyAnchor: { x: n(bodyX / w), y: n(bodyY / h) },
    metrics: { w, bodyL: Math.round(bl), bodyR: Math.round(br), bodyT: T, shoeB: B + 1 },
    검사: {
      정사각: w === h,
      모서리투명: 모서리.every(a => a === 0),
      모서리알파: 모서리,
      테두리띠: 띠,
      코랄비: +(코 / Math.max(띠, 1) * 100).toFixed(2),
      자홍비: +(자 / Math.max(띠, 1) * 100).toFixed(2),
    },
  };
};

const 결과 = files.map(잰다);
const 성한것 = 결과.filter(r => !r.오류);

// ── 표
console.log(`\n${dir} · ${files.length}장\n`);
console.log('파일'.padEnd(16) + '크기'.padEnd(12) + '발기준점'.padEnd(18) + '몸기준점'.padEnd(18) + '키'.padEnd(7) + '몸통폭');
for (const r of 결과) {
  if (r.오류) { console.log(r.file.padEnd(16) + '⚠ ' + r.오류); continue; }
  const 키 = r.metrics.shoeB - r.metrics.bodyT;
  const 폭 = r.metrics.bodyR - r.metrics.bodyL;
  console.log(
    r.file.padEnd(16) +
    `${r.width}×${r.height}`.padEnd(12) +
    `${r.footAnchor.x.toFixed(3)}, ${r.footAnchor.y.toFixed(3)}`.padEnd(18) +
    `${r.bodyAnchor.x.toFixed(3)}, ${r.bodyAnchor.y.toFixed(3)}`.padEnd(18) +
    String(키).padEnd(7) + String(폭)
  );
}

// ── 검사 결과
const 문제 = [];
const 크기들 = [...new Set(성한것.map(r => `${r.width}×${r.height}`))];
if (크기들.length > 1) 문제.push(`크기가 섞여 있습니다: ${크기들.join(' / ')}`);
for (const r of 성한것) {
  if (!r.검사.정사각) 문제.push(`${r.file}: 정사각이 아닙니다 (${r.width}×${r.height})`);
  if (!r.검사.모서리투명) 문제.push(`${r.file}: 모서리가 투명하지 않습니다 (알파 ${r.검사.모서리알파.join(',')})`);
  if (r.검사.코랄비 > 1.5) 문제.push(`${r.file}: 실루엣 둘레의 ${r.검사.코랄비}% 가 코랄 배경색입니다 — 색배경 위에 그린 뒤 빼낸 그림입니다`);
  if (r.검사.자홍비 > 1.5) 문제.push(`${r.file}: 실루엣 둘레의 ${r.검사.자홍비}% 가 자홍 배경색입니다 — 위와 같은 원인`);
}
// 자세끼리 발 높이·눈높이가 맞는가
if (성한것.length > 1) {
  const 발 = 성한것.map(r => r.footAnchor.y), 위 = 성한것.map(r => r.bounds.top);
  const 폭발 = Math.max(...발) - Math.min(...발), 폭위 = Math.max(...위) - Math.min(...위);
  console.log(`\n자세끼리 발 높이 차이 ${(폭발 * 100).toFixed(1)}% · 머리 높이 차이 ${(폭위 * 100).toFixed(1)}% (캔버스 기준)`);
  if (폭발 > 0.02) 문제.push(`발 높이가 자세마다 ${(폭발 * 100).toFixed(1)}% 어긋납니다 — 자세가 바뀔 때 캐릭터가 위아래로 튑니다`);
  if (폭위 > 0.06) 문제.push(`머리 높이가 자세마다 ${(폭위 * 100).toFixed(1)}% 어긋납니다 — 자세가 바뀔 때 키가 달라 보입니다`);
}

console.log('');
if (문제.length) { console.log(`⚠ 확인할 것 ${문제.length}건`); 문제.forEach(m => console.log('   · ' + m)); }
else console.log('✅ 검사 통과 — 크기·투명도·배경 자국·기준점 정합 모두 이상 없음');

// ── manifest
const poses = {};
for (const r of 성한것) {
  poses[r.file.replace(/\.png$/i, '')] = {
    file: r.file, width: r.width, height: r.height,
    footAnchor: r.footAnchor, bodyAnchor: r.bodyAnchor,
    bounds: r.bounds, metrics: r.metrics,
  };
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({
  schemaVersion: 1,
  kind: 'independent-pose-sequence',
  measuredAt: new Date().toISOString(),
  measuredBy: 'tools/intake-character.mjs',
  note: 'footAnchor 는 바닥에 닿는 점(y=실루엣 맨 아래, x=맨 아래 2% 띠의 가로 무게중심), bodyAnchor 는 위쪽 55% 구간의 무게중심. metrics 는 about-walk.js 가 자세끼리 크기를 맞출 때 쓰는 캔버스 픽셀 값이다.',
  poses,
}, null, 1) + '\n');
console.log(`\n저장 ${outPath} · 자세 ${Object.keys(poses).length}개`);
