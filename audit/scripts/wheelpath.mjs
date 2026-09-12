// 마우스 휠만으로 첫 화면에서 문의까지 내려가는 길을 한 칸씩 기록한다.
// '몇 번 굴리면 어디에 서는가'와 'CONTACT 에 멈출 수 있는가'를 눈으로 셀 수 있게 남긴다.
//   node audit/scripts/wheelpath.mjs <라벨> <BASE_URL> [한번delta] [간격ms]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [, , label = 'now', base = 'http://127.0.0.1:18768', dy = '100', gap = '150'] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'] });
const out = { label, base, 한번delta: +dy, 간격ms: +gap, ranAt: new Date().toISOString(), 경로: [] };
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
await sleep(3500);
await p.evaluate(() => scrollTo(0, 0));
await sleep(1200);

const 어디 = () => p.evaluate(() => {
  const mid = innerHeight / 2;
  let 구역 = '-';
  for (const s of document.querySelectorAll('main > section[id]')) {
    const r = s.getBoundingClientRect();
    if (r.top <= mid && r.bottom >= mid) { 구역 = s.id; break; }
  }
  const c = document.getElementById('contact')?.getBoundingClientRect();
  return { y: Math.round(scrollY), 구역, contact화면중앙: c ? (c.top <= innerHeight * .6 && c.bottom >= innerHeight * .4) : false, contactTop: c ? Math.round(c.top) : null };
});

let 멈춘적 = false;
for (let i = 0; i <= 60; i++) {
  const s = await 어디();
  out.경로.push({ 굴린횟수: i, ...s });
  if (s.contact화면중앙) 멈춘적 = true;
  const 끝 = await p.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2);
  if (끝) break;
  await p.mouse.wheel(0, +dy);
  await sleep(+gap);
}
out.CONTACT에멈춘적 = 멈춘적;
// 구역별로 몇 번 굴려야 지나가는지
const 구역별 = {};
for (const r of out.경로) 구역별[r.구역] = (구역별[r.구역] || 0) + 1;
out.구역별굴린횟수 = 구역별;
out.마지막 = out.경로.at(-1);
await ctx.close();
await browser.close();
fs.writeFileSync(path.join(process.cwd(), 'audit', 'measurements', `wheelpath-${label}.json`), JSON.stringify(out, null, 1));
console.log('CONTACT 에 멈춘 적:', 멈춘적, '· 마지막', JSON.stringify(out.마지막));
console.log('구역별 굴린 횟수:', JSON.stringify(구역별));
console.log(out.경로.map(r => `${String(r.굴린횟수).padStart(2)}회 y=${String(r.y).padStart(6)} ${r.구역}${r.contact화면중앙 ? ' ★CONTACT' : ''}`).join('\n'));
