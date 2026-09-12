// CLS 를 before/after 같은 조건에서 비교한다.
// T7 안의 CLS 는 '어디까지 얼마나 빨리 내렸는가'에 따라 크게 달라져 두 판을 견줄 수 없다.
// 여기서는 **같은 절대 위치를 같은 간격으로** 지나가며 누적 CLS 를 읽는다.
//   node audit/scripts/cls.mjs <라벨> <BASE_URL>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [, , label = 'now', base = 'http://127.0.0.1:18768'] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'] });
const out = { label, base, ranAt: new Date().toISOString(), 뷰포트: {} };

for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w <= 768 ? 2 : 1, ...(w <= 768 ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    window.__cls = 0; window.__shift = [];
    new PerformanceObserver(l => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__cls += e.value; window.__shift.push({ v: +e.value.toFixed(4), src: (e.sources || []).map(s => ({ el: s.node ? s.node.nodeName.toLowerCase() + '.' + String(s.node.className || '').split(' ')[0] : '?', 이전: s.previousRect ? [Math.round(s.previousRect.x), Math.round(s.previousRect.y), Math.round(s.previousRect.width), Math.round(s.previousRect.height)] : null, 이후: s.currentRect ? [Math.round(s.currentRect.x), Math.round(s.currentRect.y), Math.round(s.currentRect.width), Math.round(s.currentRect.height)] : null })) }); } }).observe({ type: 'layout-shift', buffered: true });
  });
  await p.goto(base + '/', { waitUntil: 'load', timeout: 120000 });
  await sleep(3000);
  const 로드후 = await p.evaluate(() => window.__cls);
  // 문서 높이의 0~100% 를 40단계로 같은 간격·같은 대기시간으로 지나간다
  const docH = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let i = 0; i <= 40; i++) {
    await p.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), Math.round((docH - h) * i / 40));
    await sleep(320);
  }
  await sleep(1000);
  const r = await p.evaluate(() => {
    const byEl = {};
    for (const s of window.__shift) for (const n of s.src) byEl[n.el] = +((byEl[n.el] || 0) + s.v).toFixed(4);
    const 큰이동 = [...window.__shift].sort((a, b) => b.v - a.v).slice(0, 6);
    return { 누적CLS: +window.__cls.toFixed(4), 이동횟수: window.__shift.length, 원인상위: Object.entries(byEl).sort((a, b) => b[1] - a[1]).slice(0, 5), 큰이동 };
  });
  out.뷰포트[`${w}x${h}`] = { 로드후CLS: +로드후.toFixed(4), ...r, 문서높이: docH };
  console.log(`${w}x${h} 누적CLS ${r.누적CLS} (로드 직후 ${로드후.toFixed(4)}) · 이동 ${r.이동횟수}회 · 원인 ${JSON.stringify(r.원인상위.slice(0, 3))}`);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(process.cwd(), 'audit', 'measurements', `cls-${label}.json`), JSON.stringify(out, null, 1));
console.log('저장 cls-' + label + '.json');
