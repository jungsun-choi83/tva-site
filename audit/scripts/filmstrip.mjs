// 문서 전체를 일정 간격으로 찍어 흐름을 눈으로 보게 한다 (웹폰트는 미리 받아 둔 것을 물려 준다).
//   node audit/scripts/filmstrip.mjs <폭> <칸수> <쓸폴더> <글꼴폴더>
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const [, , W0, N0, outDir, FONTS] = process.argv;
const W = +W0 || 1440, N = +N0 || 16;
fs.mkdirSync(outDir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const 해시 = u => crypto.createHash('md5').update(u + '\n').digest('hex').slice(0, 10);
const googleCss = FONTS ? fs.readFileSync(path.join(FONTS, 'google.css'), 'utf8') : null;
const PRET = FONTS ? path.join(FONTS, 'package/dist/web/variable') : null;

const b = await chromium.launch({ args: ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'] });
const H = W <= 768 ? 844 : 900;
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, ...(W <= 768 ? { isMobile: true, hasTouch: true } : {}) });
if (FONTS) {
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: googleCss }));
  await ctx.route('https://fonts.gstatic.com/**', r => {
    const f = path.join(FONTS, 'files', 해시(r.request().url()) + '.woff2');
    fs.existsSync(f) ? r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(f) }) : r.abort();
  });
  await ctx.route('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/**', r => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname.split('/dist/web/variable/')[1] || '');
    const f = path.join(PRET, rel);
    f.startsWith(PRET) && fs.existsSync(f) ? r.fulfill({ contentType: rel.endsWith('.css') ? 'text/css' : 'font/woff2', body: fs.readFileSync(f) }) : r.abort();
  });
}
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:18768/', { waitUntil: 'load', timeout: 60000 });
await p.evaluate(() => document.fonts.ready).catch(() => {});
await sleep(4000);
// 문서 끝까지 한 번 내려 모든 구간을 깨운다
await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
await sleep(5000);
const 총 = await p.evaluate(() => document.documentElement.scrollHeight);
await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
await sleep(2500);

const 구간 = await p.evaluate(() => {
  const r = {};
  for (const s of document.querySelectorAll('main > section[id]')) r[s.id] = { top: s.offsetTop, h: s.offsetHeight };
  return r;
});
const 어디 = y => { let n = '—'; for (const [k, v] of Object.entries(구간)) if (y >= v.top - 2 && y < v.top + v.h) n = k; return n; };

const 목록 = [];
for (let i = 0; i < N; i++) {
  const y = Math.round((총 - H) * i / (N - 1));
  await p.evaluate(v => scrollTo({ top: v, behavior: 'instant' }), y);
  await sleep(1700);
  const f = `${String(i).padStart(2, '0')}-y${y}.png`;
  await p.screenshot({ path: path.join(outDir, f) });
  목록.push({ 칸: i, y, 구간: 어디(y), 파일: f });
  console.log(`${String(i).padStart(2)}  y=${String(y).padStart(6)}  ${(y / 총 * 100).toFixed(1).padStart(5)}%  ${어디(y)}`);
}
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({ 폭: W, 문서높이: 총, 구간, 칸: 목록 }, null, 1));
console.log(`\n문서 ${총}px · ${N}칸 저장`);
await b.close();
