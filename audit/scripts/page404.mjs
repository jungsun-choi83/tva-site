// /404.html 을 필수 폭 전부에서 확인한다 (가로 넘침·링크 과녁·한 화면에 들어오는지)
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const [, , label = 'now', base = 'http://127.0.0.1:18768'] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch({ args: ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'] });
const out = { label, base, ranAt: new Date().toISOString(), 폭: {} };
for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1280, 650], [1440, 900], [1920, 1080]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w <= 768 ? 2 : 1, ...(w <= 768 ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  await p.goto(base + '/404.html', { waitUntil: 'load', timeout: 60000 });
  await p.evaluate(() => document.fonts?.ready).catch(() => {});
  await sleep(1200);
  out.폭[`${w}x${h}`] = await p.evaluate(() => {
    const links = [...document.querySelectorAll('.links a')].map(a => { const r = a.getBoundingClientRect(); return { 글: a.textContent.trim(), 과녁: Math.round(Math.min(r.width, r.height)), 화면안: r.top >= 0 && r.bottom <= innerHeight }; });
    return {
      가로넘침px: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      문서높이: document.documentElement.scrollHeight,
      한화면: document.documentElement.scrollHeight <= innerHeight + 1,
      링크수: links.length, 과녁24미만: links.filter(l => l.과녁 < 24).length, 화면밖링크: links.filter(l => !l.화면안).map(l => l.글),
      제목: document.querySelector('h1')?.innerText.replace(/\n/g, ' '),
      noindex: document.querySelector('meta[name=robots]')?.content,
    };
  });
  await ctx.close();
}
await b.close();
fs.writeFileSync(path.join(process.cwd(), 'audit', 'measurements', `page404-${label}.json`), JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out.폭)) console.log(k, JSON.stringify(v));
