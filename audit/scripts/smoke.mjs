// 최종 재감사용 빠른 점검 — 폭마다 문서 끝까지 실제 휠로 내리며 오류·넘침을 본다.
//   node audit/scripts/smoke.mjs <라벨> <BASE_URL>
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const [, , label = 'now', base = 'http://127.0.0.1:18768'] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch({ args: ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'] });
const out = { label, base, ranAt: new Date().toISOString(), 폭: {} };
for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w <= 768 ? 2 : 1, ...(w <= 768 ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const con = [], perr = [], fail = [];
  p.on('console', m => m.type() === 'error' && con.push(m.text().slice(0, 160)));
  p.on('pageerror', e => perr.push(String(e).slice(0, 200)));
  p.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === new URL(base).origin) fail.push(r.status() + ' ' + r.url().split('/').pop()); });
  await p.goto(base + '/', { waitUntil: 'load', timeout: 90000 });
  await sleep(3000);
  let last = -1;
  for (let i = 0; i < 70; i++) {
    const y = await p.evaluate(() => scrollY);
    const bot = await p.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2);
    if (bot || (i > 3 && y === last)) break;
    last = y; await p.mouse.wheel(0, Math.round(h * .85)); await sleep(240);
  }
  await sleep(1500);
  out.폭[`${w}x${h}`] = {
    콘솔에러: con, 페이지에러: perr, 내부실패요청: fail,
    가로넘침px: await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    문서높이: await p.evaluate(() => document.documentElement.scrollHeight),
    맨아래도달: await p.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 4),
    상단바캐릭터: await p.evaluate(() => { const m = document.querySelector('.nav-mascot'); return m ? getComputedStyle(m).display : '없음'; }),
    메뉴잘림: await p.evaluate(() => [...document.querySelectorAll('.site-nav nav a')].filter(a => a.getBoundingClientRect().right > innerWidth + .5).map(a => a.textContent.trim())),
  };
  const r = out.폭[`${w}x${h}`];
  console.log(`${w}x${h} 콘솔에러 ${con.length} · 페이지에러 ${perr.length} · 내부4xx ${fail.length} · 가로넘침 ${r.가로넘침px}px · 끝도달 ${r.맨아래도달} · 캐릭터 ${r.상단바캐릭터} · 메뉴잘림 ${r.메뉴잘림.length}`);
  if (perr.length) console.log('   페이지에러:', perr.slice(0, 3));
  if (fail.length) console.log('   내부4xx:', fail.slice(0, 5));
  await ctx.close();
}
await b.close();
fs.writeFileSync(path.join(process.cwd(), 'audit', 'measurements', `smoke-${label}.json`), JSON.stringify(out, null, 1));
console.log('저장 smoke-' + label + '.json');
