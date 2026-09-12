// 배포 전 빠른 점검. 서버 없이 파일만 읽는다.
//   node qa-check.mjs
// 확인하는 것
//   1) 마크업·CSS·JS 가 가리키는 파일이 실제로 있는가
//   2) 같은 그림을 서로 다른 ?v= 로 부르는 곳이 있는가 (중복 다운로드)
//   3) <img> 의 width/height 가 실제 비율과 맞는가 (레이아웃 흔들림)
//   4) 자리표시자 문자열이 남아 있는가
//   5) 모든 .js 가 문법상 읽히는가
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SKIP = new Set(['.git', 'node_modules', 'audit', 'tools', 'vendor']);
const SELF = 'qa-check.mjs';
const CODE = /\.(html|css|js|mjs)$/;
let fail = 0, warn = 0;
const bad = (m) => { console.log('  ❌ ' + m); fail++; };
const meh = (m) => { console.log('  ⚠️  ' + m); warn++; };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const codeFiles = files.filter(f => CODE.test(f));

// ── 1. 가리키는 파일이 실제로 있는가 ─────────────────────────────────
console.log('\n[1] 가리키는 파일이 실제로 있는가');
const ASSET = /(?:"|'|\(|\s)((?:\.\.?\/)?(?:assets|gallery-assets|gallery-original|sofa-journey|fall-welcome|vendor|room-entry)\/[A-Za-z0-9_./-]+\.[a-z0-9]{2,5})(?:\?[^"')\s]*)?/g;
const missing = new Set();
for (const f of codeFiles) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(ASSET)) {
    if (m[1].includes('...')) continue;   // 주석 안의 줄임표 경로는 검사 대상이 아니다
    const rel = m[1].replace(/^\.\//, '');
    const cand = [path.resolve(path.dirname(f), m[1]), path.join(ROOT, rel)];
    if (!cand.some(c => fs.existsSync(c))) missing.add(`${path.relative(ROOT, f)} → ${m[1]}`);
  }
}
if (missing.size) [...missing].forEach(bad); else console.log('  ✅ 없는 파일 0건');

// ── 2. 같은 파일, 다른 ?v= ──────────────────────────────────────────
// 그림이면 같은 그림을 두 번 내려받고, 자바스크립트 모듈이면 같은 모듈이 두 벌 올라간다.
console.log('\n[2] 같은 파일을 여러 주소로 부르는 곳');
const vers = new Map();
for (const f of codeFiles) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/((?:assets|gallery-assets)\/[A-Za-z0-9_./-]+\.(?:png|jpg|jpeg|webp|avif|svg))(\?v=[A-Za-z0-9._-]*)?/g)) {
    // `?v=${GOYA_V}` 같은 템플릿 자리는 값이 실행할 때 정해지므로 정적 검사 대상이 아니다
    if (m[2] === '?v=' && src.slice(m.index + m[0].length, m.index + m[0].length + 2) === '${') continue;
    if (!vers.has(m[1])) vers.set(m[1], new Set());
    vers.get(m[1]).add(m[2] || '(없음)');
  }
  // 스타일·스크립트는 상대 경로로 부르므로 부르는 파일 기준으로 풀어서 같은 파일인지 본다
  for (const m of src.matchAll(/((?:\.\.?\/)?[A-Za-z0-9_./-]+\.(?:css|js|mjs))\?v=([A-Za-z0-9._-]+)/g)) {
    const abs = path.resolve(path.dirname(f), m[1]);
    if (!fs.existsSync(abs)) continue;
    const key = path.relative(ROOT, abs);
    if (!vers.has(key)) vers.set(key, new Set());
    vers.get(key).add('?v=' + m[2]);
  }
}
let dup = 0;
for (const [file, set] of vers) if (set.size > 1) { meh(`${file} → ${[...set].join(' , ')}`); dup++; }
if (!dup) console.log('  ✅ 중복 주소 0건');

// ── 3. width/height 가 실제 비율과 맞는가 ───────────────────────────
console.log('\n[3] <img> 의 width/height 가 실제 비율과 맞는가');
function dims(p) {
  const b = fs.readFileSync(p);
  if (b.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const mk = b[i + 1];
      if (mk >= 0xc0 && mk <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}
let ratioBad = 0;
for (const f of files.filter(x => x.endsWith('.html'))) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    const s = /src="([^"]+)"/.exec(tag), w = /\bwidth="(\d+)"/.exec(tag), h = /\bheight="(\d+)"/.exec(tag);
    if (!s) continue;
    const p = path.join(ROOT, s[1].split('?')[0]);
    if (!fs.existsSync(p)) continue;
    if (!w || !h) { meh(`${path.relative(ROOT, f)} · ${s[1]} — width/height 없음`); ratioBad++; continue; }
    const d = dims(p);
    if (!d) continue;
    const r1 = +w[1] / +h[1], r2 = d[0] / d[1];
    if (Math.abs(r1 / r2 - 1) > 0.02) { bad(`${path.relative(ROOT, f)} · ${s[1]} — 선언 ${w[1]}×${h[1]} vs 실제 ${d[0]}×${d[1]}`); ratioBad++; }
  }
}
if (!ratioBad) console.log('  ✅ 비율 불일치 0건');

// ── 4. 자리표시자 ───────────────────────────────────────────────────
console.log('\n[4] 자리표시자가 남아 있는가');
const PLACEHOLDER = [
  ['your-domain.example', '배포 주소 자리표시자'],
  ['lorem ipsum', '더미 텍스트'],
  ['TODO', '남은 할 일 표시'],
];
let ph = 0;
for (const f of files.filter(x => /\.(html|css|js|mjs|txt|xml)$/.test(x) && path.basename(x) !== SELF)) {
  const src = fs.readFileSync(f, 'utf8');
  for (const [needle, label] of PLACEHOLDER) {
    if (src.toLowerCase().includes(needle.toLowerCase())) { bad(`${path.relative(ROOT, f)} — ${label}(${needle})`); ph++; }
  }
}
if (!ph) console.log('  ✅ 자리표시자 0건');

// ── 5. 문법 ────────────────────────────────────────────────────────
console.log('\n[5] 자바스크립트 문법');
let syn = 0;
for (const f of files.filter(x => /\.(js|mjs)$/.test(x))) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { bad(`${path.relative(ROOT, f)} — ${String(e.stderr).split('\n').find(l => l.includes('Error')) || '문법 오류'}`); syn++; }
}
if (!syn) console.log('  ✅ 문법 오류 0건');

console.log(`\n결과: 문제 ${fail}건 · 확인 권장 ${warn}건`);
process.exit(fail ? 1 : 0);
