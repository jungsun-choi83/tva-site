// 내용이 바뀐 파일만 ?v= 토큰을 새 값으로 바꾼다 (#N09).
//   node audit/scripts/bump-version.mjs
// 기준 커밋(BASE)과 비교해 바뀐 파일을 찾고, 그 파일을 부르는 '모든 곳'의 ?v= 를 TOKEN 으로 통일한다.
// 같은 파일을 서로 다른 ?v= 로 부르던 곳도 이 과정에서 하나로 합쳐진다.
import fs from 'node:fs'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
const ROOT = process.cwd();
const TOKEN = process.env.TOKEN || 'eb-20260912';
const BASE = process.env.BASE || 'f2d8262';
const changed = new Set(execFileSync('git', ['diff', '--name-only', BASE], { encoding: 'utf8' }).split('\n').filter(Boolean));
const SKIP = new Set(['.git', 'node_modules', 'audit', 'vendor']);
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (SKIP.has(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(html|css|js|mjs)$/.test(e.name)) files.push(p); } })(ROOT);
const RE = /((?:\.\.?\/)?[A-Za-z0-9_./-]+\.(?:css|js|mjs))\?v=([A-Za-z0-9._-]+)/g;
let n = 0; const touched = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const next = src.replace(RE, (m, rel, tok) => {
    const abs = path.resolve(path.dirname(f), rel);
    const r = path.relative(ROOT, abs);
    if (!changed.has(r)) return m;
    if (tok === TOKEN) return m;
    n++; touched.push(`${path.relative(ROOT, f)}: ${rel}?v=${tok} → ?v=${TOKEN}`);
    return `${rel}?v=${TOKEN}`;
  });
  if (next !== src) fs.writeFileSync(f, next);
}
console.log(touched.join('\n'));
console.log('바꾼 참조 ' + n + '곳');
