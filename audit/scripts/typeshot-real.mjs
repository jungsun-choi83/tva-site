// 이 컨테이너는 fonts.googleapis.com / cdn.jsdelivr.net 으로 나가는 길이 막혀 있어
// 브라우저가 웹폰트를 한 개도 못 받는다 — 그냥 찍으면 전부 대체 글꼴로 나와서
// 서체 비교로는 아무 쓸모가 없다. curl 로는 나가지므로 미리 받아 둔 파일을
// 요청 가로채기로 대신 물려 주고 찍는다. 받아 둔 파일은 저장소에 넣지 않는다.
//   node audit/scripts/typeshot-real.mjs <라벨> <글꼴보관폴더>
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';

const [, , label = 'real', FONTS] = process.argv;
if (!FONTS || !fs.existsSync(FONTS)) { console.error('글꼴 보관 폴더를 넘겨 주세요'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dir = path.join(process.cwd(), 'audit', 'screenshots', 'type');
fs.mkdirSync(dir, { recursive: true });

const googleCss = fs.readFileSync(path.join(FONTS, 'google.css'), 'utf8');
const PRET = path.join(FONTS, 'package/dist/web/variable');
const 해시 = u => crypto.createHash('md5').update(u + '\n').digest('hex').slice(0, 10); // md5sum 과 같은 값(줄바꿈 포함)

const SPOTS = [
  { 이름: 'hero', sel: '#home', off: 0 },
  { 이름: 'about', sel: '#about', off: 120 },
  { 이름: 'records', sel: '#portfolio', off: 60 },
  { 이름: 'original', sel: '#original', off: 200 },
  { 이름: 'contact', sel: '#contact', off: 0 },
];

const browser = await chromium.launch({ args: ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'] });
const 못찾음 = new Set();

for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...(w <= 768 ? { isMobile: true, hasTouch: true } : {}) });

  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: googleCss }));
  await ctx.route('https://fonts.gstatic.com/**', r => {
    const f = path.join(FONTS, 'files', 해시(r.request().url()) + '.woff2');
    if (!fs.existsSync(f)) { 못찾음.add(r.request().url()); return r.abort(); }
    r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(f) });
  });
  await ctx.route('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/**', r => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname.split('/dist/web/variable/')[1] || '');
    const f = path.join(PRET, rel);
    if (!f.startsWith(PRET) || !fs.existsSync(f)) { 못찾음.add(r.request().url()); return r.abort(); }
    r.fulfill({ contentType: rel.endsWith('.css') ? 'text/css' : 'font/woff2', body: fs.readFileSync(f) });
  });

  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:18768/', { waitUntil: 'load', timeout: 60000 });
  await p.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(4000);

  if (w === 1440) {
    const 확인 = await p.evaluate(() => {
      const 잰다 = f => { const s = document.createElement('span');
        s.style.cssText = `position:absolute;left:-9999px;font:100px ${f};white-space:nowrap`;
        s.textContent = 'ETERNAL BEAM'; document.body.append(s);
        const x = Math.round(s.getBoundingClientRect().width); s.remove(); return x; };
      return { 받음: [...document.fonts].filter(f => f.status === 'loaded').length,
               기준_serif: 잰다('serif'),
               Cinzel: 잰다('Cinzel,serif'), ArchivoBlack: 잰다('"Archivo Black",serif'),
               PlexMono: 잰다('"IBM Plex Mono",serif'), Pretendard: 잰다('"Pretendard Variable",serif') };
    });
    console.log(`  [${label}] 글꼴 확인`, JSON.stringify(확인), '— 값이 기준_serif 와 다르면 진짜로 받은 것');
  }

  for (const s of SPOTS) {
    const top = await p.evaluate(q => document.querySelector(q)?.offsetTop ?? null, s.sel);
    if (top == null) continue;
    await p.evaluate(v => scrollTo({ top: v, behavior: 'instant' }), top + s.off);
    await sleep(2200);
    await p.screenshot({ path: path.join(dir, `${label}-${w}-${s.이름}.png`) });
  }
  await ctx.close();
}
await browser.close();
if (못찾음.size) { console.log('  ⚠ 보관함에 없던 글꼴 요청:'); [...못찾음].forEach(u => console.log('    ' + u.slice(0, 100))); }
console.log(`저장 ${label}-*.png`);
