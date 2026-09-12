// 뷰포트별로 각 구역이 캡처 몇 번째 장에 나오는지 표로 만든다 (capture.mjs 와 같은 계산: dy = 높이×0.8)
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const [, , label = 'now', base = 'http://127.0.0.1:18768'] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VP = [[320,568],[390,844],[768,1024],[1024,768],[1280,650],[1440,900],[1920,1080]];
const browser = await chromium.launch({ args: ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'] });
const out = { label, base, 뷰포트: {} };
for (const [w, h] of VP) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w <= 768 ? 2 : 1, ...(w <= 768 ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
  await sleep(3000);
  await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await sleep(2500);
  await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(1200);
  const dy = Math.round(h * 0.8);
  out.뷰포트[`${w}`] = await p.evaluate(d => {
    const r = {};
    for (const s of document.querySelectorAll('main > section[id]')) {
      const top = s.offsetTop, bot = top + s.offsetHeight;
      r[s.id] = { top, 높이: s.offsetHeight, 첫장: Math.floor(top / d), 끝장: Math.floor((bot - 1) / d) };
    }
    r.__문서높이 = document.documentElement.scrollHeight;
    return r;
  }, dy);
  out.뷰포트[`${w}`].__dy = dy;
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(process.cwd(), 'audit', 'measurements', `sections-${label}.json`), JSON.stringify(out, null, 1));
for (const [w, v] of Object.entries(out.뷰포트)) console.log(w + 'px (dy ' + v.__dy + ', 문서 ' + v.__문서높이 + '): ' + Object.entries(v).filter(([k]) => !k.startsWith('__')).map(([k, x]) => `${k} ${x.첫장}~${x.끝장}`).join(' · '));
