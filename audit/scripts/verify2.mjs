// 2차 검증 — 상단바 캐릭터가 실제로 어디 서는지, 같은 파일을 서로 다른 주소로 두 번 받는지,
// 정거장 이름표가 한 줄에 들어가는지를 실측한다.
//   node audit/scripts/verify2.mjs <라벨> <BASE_URL>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [, , label = 'now', base = 'http://127.0.0.1:18768'] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'] });
const out = { label, base, ranAt: new Date().toISOString() };

// ── 1. 상단바 캐릭터 폭별 위치 ──────────────────────────────────────────
out.상단바 = [];
for (const w of [320, 360, 390, 414, 480, 560, 640, 700, 760, 768, 900, 1024, 1440, 1920]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
  await sleep(2500);
  // 상단바가 나타나는 자리(RECORDS 구역)로 간다
  await p.evaluate(() => scrollTo({ top: (document.getElementById('portfolio')?.offsetTop || 9000) + 200, behavior: 'instant' }));
  await sleep(2600);
  out.상단바.push(await p.evaluate(() => {
    const m = document.querySelector('.nav-mascot');
    const st = m && getComputedStyle(m);
    const nav = document.querySelector('.site-nav');
    // 글자 상자는 Range 로 잰다 (a 요소 상자에는 좌우 여백이 붙어 있어 겹침을 과장한다)
    const 글자 = [...document.querySelectorAll('.site-nav nav a')].map(a => {
      const r = document.createRange(); r.selectNodeContents(a);
      const b = r.getBoundingClientRect();
      return { 글: a.textContent.trim(), l: Math.round(b.left), r: Math.round(b.right), 현재: a.classList.contains('is-here') };
    });
    const box = m ? m.getBoundingClientRect() : null;
    // 그림에서 실제로 칠해진 가로 범위 (투명 여백을 뺀다)
    let 그림 = null;
    if (m && box && box.width) {
      const c = document.createElement('canvas'); const W = 64, H = 64;
      c.width = W; c.height = H; const g = c.getContext('2d');
      try {
        g.drawImage(m, 0, 0, W, H);
        const d = g.getImageData(0, 0, W, H).data;
        let min = W, max = -1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[((y * W + x) << 2) + 3] > 16) { if (x < min) min = x; if (x > max) max = x; }
        if (max >= 0) 그림 = { l: Math.round(box.left + box.width * min / W), r: Math.round(box.left + box.width * (max + 1) / W) };
      } catch { 그림 = null; }
    }
    const 대상 = 그림 || (box ? { l: Math.round(box.left), r: Math.round(box.right) } : null);
    return {
      폭: innerWidth,
      표시: st ? st.display : '없음',
      바보임: nav ? nav.classList.contains('is-visible') : false,
      상자: box ? { l: Math.round(box.left), r: Math.round(box.right), w: Math.round(box.width) } : null,
      그림범위: 그림,
      화면밖: 대상 ? (대상.r <= 0 || 대상.l >= innerWidth) : null,
      글자와겹침: 대상 ? 글자.filter(t => 대상.l < t.r && 대상.r > t.l).map(t => t.글) : [],
      현재메뉴: (글자.find(t => t.현재) || {}).글 || null,
      메뉴넘침: 글자.filter(t => t.r > innerWidth - 2).map(t => t.글),
    };
  }));
  await ctx.close();
}

// ── 2. 같은 파일을 다른 주소로 두 번 받는가 (모듈·스타일 포함) ─────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const 요청 = [];
  p.on('request', r => { const u = new URL(r.url()); if (u.origin === new URL(base).origin) 요청.push({ path: u.pathname, q: u.search }); });
  await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
  await sleep(4000);
  await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await sleep(5000);
  const m = new Map();
  for (const r of 요청) { if (!m.has(r.path)) m.set(r.path, new Set()); m.get(r.path).add(r.q || '(없음)'); }
  out.중복주소 = [...m].filter(([, s]) => s.size > 1).map(([k, s]) => ({ 파일: k, 주소들: [...s] }));
  out.요청수 = 요청.length;
  await ctx.close();
}

// ── 3. 정거장 이름표가 한 줄에 들어가는가 ───────────────────────────────
out.이름표 = {};
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...(w <= 768 ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
  await sleep(2500);
  const about = await p.evaluate(() => document.getElementById('about')?.offsetTop || 0);
  const 기록 = [];
  for (const f of [0.1, 0.3, 0.5, 0.7, 0.88, 0.97]) {
    const H = await p.evaluate(() => document.getElementById('about')?.offsetHeight || 0);
    await p.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), Math.round(about + H * f));
    await sleep(1400);
    기록.push(await p.evaluate(() => {
      const el = document.querySelector('.studio-stop-label');
      if (!el) return null;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      return { 글: el.textContent.trim(), 줄수: Math.max(1, Math.round(r.height / lh)), 상자높이: Math.round(r.height), 줄높이: +lh.toFixed(1), 폭: Math.round(r.width) };
    }));
  }
  out.이름표[`${w}x${h}`] = 기록;
  await ctx.close();
}

// ── 4. 문의 입력칸 글자 크기 (iOS 자동 확대 기준 16px) ─────────────────
out.입력칸글자 = {};
for (const w of [320, 360, 390, 414, 768]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
  await sleep(2500);
  await p.evaluate(() => scrollTo({ top: document.getElementById('contact')?.offsetTop || 0, behavior: 'instant' }));
  await sleep(1800);
  // 편지지를 연다 (모바일은 'Write 편지 쓰기' 를 눌러야 열린다)
  await p.evaluate(() => { const b = document.querySelector('#contact button'); if (b) b.click(); }).catch(() => {});
  await sleep(1400);
  out.입력칸글자[w] = await p.evaluate(() => [...document.querySelectorAll('.ctl input:not([type=checkbox]):not(.hp), .ctl textarea')].map(e => ({ 이름: e.name || e.id, px: parseFloat(getComputedStyle(e).fontSize) })));
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(process.cwd(), 'audit', 'measurements', `verify2-${label}.json`), JSON.stringify(out, null, 1));
console.log('── 입력칸 글자', JSON.stringify(out.입력칸글자));
console.log('── 상단바');
console.table(out.상단바.map(r => ({ 폭: r.폭, 표시: r.표시, 그림: r.그림범위 ? `${r.그림범위.l}~${r.그림범위.r}` : '-', 화면밖: r.화면밖, 글자겹침: r.글자와겹침.join(',') || '-', 현재: r.현재메뉴, 넘침: r.메뉴넘침.join(',') || '-' })));
console.log('── 중복 주소', JSON.stringify(out.중복주소, null, 1));
console.log('── 이름표', JSON.stringify(out.이름표, null, 1));
console.log('저장 verify2-' + label + '.json');
