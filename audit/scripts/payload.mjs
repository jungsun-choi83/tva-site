// 첫 로드(스크롤하지 않고 머무를 때) 실제로 받은 바이트를 잰다.
//   node audit/scripts/payload.mjs <라벨> <BASE_URL> [머무는초]
// 두 가지를 같이 적는다.
//   transferSize = 브라우저가 실제로 받은 바이트(압축 후). 캐시에서 나오면 0.
//   content-length 합 = 응답 헤더가 말하는 크기(교차 확인용)
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const [, , label = 'now', base = 'http://127.0.0.1:18768', hold = '9'] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const headers = [];
p.on('response', r => { try { headers.push({ u: r.url(), len: +(r.headers()['content-length'] || 0) }); } catch {} });
await p.goto(base + '/', { waitUntil: 'load', timeout: 90000 });
await sleep(+hold * 1000);
const timing = await p.evaluate(() => performance.getEntriesByType('resource').map(e => ({ u: e.name, t: e.transferSize || 0, d: e.decodedBodySize || 0 })));
const sum = a => a.reduce((s, x) => s + x, 0);
const out = {
  label, base, ranAt: new Date().toISOString(), 머무는초: +hold,
  transfer합MB: +(sum(timing.map(x => x.t)) / 1048576).toFixed(2),
  contentLength합MB: +(sum(headers.map(x => x.len)) / 1048576).toFixed(2),
  요청수: timing.length,
  큰것: [...timing].sort((a, b) => b.t - a.t).slice(0, 10).map(x => ({ 파일: x.u.split('/').pop().split('?')[0], KB: Math.round(x.t / 1024) })),
  낙하영상: timing.filter(x => /photo-shaft-fall/.test(x.u)).map(x => ({ 파일: x.u.split('/').pop().split('?')[0], KB: Math.round(x.t / 1024) })),
};
await ctx.close(); await browser.close();
fs.writeFileSync(path.join(process.cwd(), 'audit', 'measurements', `payload-${label}.json`), JSON.stringify(out, null, 1));
console.log(`${label}: transfer ${out.transfer합MB}MB · content-length 합 ${out.contentLength합MB}MB · 요청 ${out.요청수}건`);
console.log('  큰 것:', out.큰것.slice(0, 6).map(x => `${x.파일} ${x.KB}KB`).join(' · '));
console.log('  낙하 영상:', out.낙하영상.length ? out.낙하영상.map(x => `${x.파일} ${x.KB}KB`).join(' · ') : '받지 않음 ✅');
