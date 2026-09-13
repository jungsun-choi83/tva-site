// 서체 정리 / 폴더 아이콘 전후 비교용 캡처 + 실제로 그려진 글꼴 집계
//   node audit/scripts/typeshot.mjs <라벨> [BASE]
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';

const [, , label = 'before', base = 'http://127.0.0.1:18768'] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dir = path.join(process.cwd(), 'audit', 'screenshots', 'type');
fs.mkdirSync(dir, { recursive: true });

// 구역별로 '거기서 서체가 제일 잘 보이는' 지점을 잡아 둔다
const SPOTS = [
  { 이름: 'hero',      sel: '#home',      off: 0 },
  { 이름: 'about',     sel: '#about',     off: 120 },
  { 이름: 'records',   sel: '#portfolio', off: 60 },
  { 이름: 'original',  sel: '#original',  off: 200 },
  { 이름: 'contact',   sel: '#contact',   off: 0 },
];

const browser = await chromium.launch({ args: ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'] });
const out = { label, base, ranAt: new Date().toISOString(), 글꼴: {}, 넘침: {} };

for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...(w <= 768 ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
  await p.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(3500);

  for (const s of SPOTS) {
    const top = await p.evaluate(q => document.querySelector(q)?.offsetTop ?? null, s.sel);
    if (top == null) continue;
    await p.evaluate(v => scrollTo({ top: v, behavior: 'instant' }), top + s.off);
    await sleep(2200);
    await p.screenshot({ path: path.join(dir, `${label}-${w}-${s.이름}.png`) });
  }

  // 실제로 '그려진' 글꼴 집계 — 글자가 있는 요소만, 첫 글꼴 이름 기준
  await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(1200);
  out.글꼴[w] = await p.evaluate(() => {
    const 표 = {};
    for (const el of document.querySelectorAll('body *')) {
      const t = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join('');
      if (!t) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const f = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      (표[f] ||= { 횟수: 0, 보기: [] });
      표[f].횟수++;
      if (표[f].보기.length < 4) 표[f].보기.push(t.slice(0, 22));
    }
    return 표;
  });

  // 글자가 상자 밖으로 잘리는지 — 서체를 바꾸면 여기부터 터진다
  out.넘침[w] = await p.evaluate(() => {
    const 목록 = [];
    for (const el of document.querySelectorAll('body *')) {
      const t = el.textContent?.trim(); if (!t) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || !el.offsetParent) continue;
      if (cs.overflow === 'visible' && cs.overflowX === 'visible') continue;
      const dx = el.scrollWidth - el.clientWidth, dy = el.scrollHeight - el.clientHeight;
      if (dx > 2 || dy > 2) 목록.push({ 곳: el.className?.toString?.().slice(0, 40) || el.tagName, 가로: dx, 세로: dy, 글: t.slice(0, 24) });
    }
    return 목록.slice(0, 40);
  });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(process.cwd(), 'audit', 'measurements', `type-${label}.json`), JSON.stringify(out, null, 1));
for (const w of Object.keys(out.글꼴)) {
  console.log(`── ${w}px 그려진 글꼴`);
  for (const [f, v] of Object.entries(out.글꼴[w]).sort((a, b) => b[1].횟수 - a[1].횟수)) console.log(`   ${String(v.횟수).padStart(4)}  ${f}   예) ${v.보기.join(' / ')}`);
  console.log(`   넘침 ${out.넘침[w].length}건`);
}
console.log('저장 type-' + label + '.json');
