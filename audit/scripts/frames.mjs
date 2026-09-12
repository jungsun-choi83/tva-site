// T10 을 '다른 작업 없이' 단독으로 돌려 before/after 프레임을 같은 조건에서 비교한다.
// (run-T.mjs 안에서 잰 1440 값은 캡처가 같이 돌고 있어 CPU 경합으로 8.5fps 까지 떨어졌다 — 그 값은 쓰지 않는다)
//   node audit/scripts/frames.mjs <라벨> <BASE_URL>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [, , label = 'now', base = 'http://127.0.0.1:18768'] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const src = fs.readFileSync(path.join(process.cwd(), 'audit', 'scripts', 'T10.js'), 'utf8');
const out = { label, base, ranAt: new Date().toISOString(), 구간: {} };
const browser = await chromium.launch({ args: ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'] });

for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w <= 768 ? 2 : 1, ...(w <= 768 ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
  await sleep(4000);
  const vp = {};
  // 구간마다 그 구간의 시작 위치로 간 뒤 6초 동안 실제 휠로 굴리며 프레임을 잰다
  for (const id of ['home', 'drop', 'about', 'ending']) {
    const top = await p.evaluate(s => document.getElementById(s)?.offsetTop ?? 0, id);
    await p.evaluate(v => scrollTo({ top: v, behavior: 'instant' }), top + 40);
    await sleep(1600);
    await p.evaluate(src).catch(() => {});
    const until = Date.now() + 6200;
    while (Date.now() < until) { await p.mouse.wheel(0, 200); await sleep(80); }
    await sleep(700);
    vp[id] = await p.evaluate(() => window.__auditFrames || null);
    console.log(`${w}x${h} ${id}:`, JSON.stringify(vp[id]));
  }
  out.구간[`${w}x${h}`] = vp;
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(process.cwd(), 'audit', 'measurements', `frames-${label}.json`), JSON.stringify(out, null, 1));
console.log('저장 frames-' + label + '.json');
