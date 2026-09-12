// T1~T12 를 실제 브라우저에서 돌려 audit/measurements/ 에 JSON 으로 남긴다.
//   node audit/scripts/run-T.mjs <라벨> <BASE_URL> [폭x높이,폭x높이...] [T1,T2,...]
// 예) node audit/scripts/run-T.mjs before http://127.0.0.1:18769 1440x900,390x844
//
// - T7 은 새로고침 직후 + 페이지 끝까지 내린 뒤 두 번 읽는다(누적 CLS·긴 프레임).
// - T5 는 lazy 이미지 때문에 끝까지 내린 뒤에 읽는다.
// - T9 는 합성 휠이 네이티브 스크롤을 움직이지 못하므로, 아래에서 Playwright 의 실제 휠로 한 번 더 잰다.
// - T10 은 실제 휠로 6초간 굴리며 프레임을 잰다.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [, , label = 'now', base = 'http://127.0.0.1:18768', vpArg = '1440x900,390x844', onlyArg = ''] = process.argv;
const OUT = path.join(process.cwd(), 'audit', 'measurements');
fs.mkdirSync(OUT, { recursive: true });
const viewports = vpArg.split(',').map(v => { const [w, h] = v.split('x').map(Number); return { w, h, name: v }; });
const only = onlyArg ? new Set(onlyArg.split(',')) : null;
const src = id => fs.readFileSync(path.join(process.cwd(), 'audit', 'scripts', `${id}.js`), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 문서 끝까지 실제 휠로 내린다 (lazy 이미지·스크롤 트리거를 전부 깨운다)
async function scrollToEnd(page, vh) {
  let last = -1;
  for (let i = 0; i < 90; i++) {
    const y = await page.evaluate(() => scrollY);
    const bottom = await page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2);
    if (bottom || (i > 0 && y === last)) break;
    last = y;
    await page.mouse.wheel(0, Math.round(vh * 0.85));
    await sleep(260);
  }
}

// 실제(isTrusted) 휠로 T9 과 같은 지표를 낸다
async function realWheel(page) {
  const rows = [];
  const run = async (name, steps, gap, ms = 1600) => {
    await page.evaluate(() => scrollTo(0, 200));
    await sleep(900);
    const y0 = await page.evaluate(() => scrollY);
    const t0 = Date.now();
    const samples = [];
    const sampler = setInterval(async () => {
      try { samples.push([Date.now() - t0, (await page.evaluate(() => scrollY)) - y0]); } catch {}
    }, 16);
    for (const d of steps) { await page.mouse.wheel(0, d); if (gap) await sleep(gap); }
    await sleep(ms);
    clearInterval(sampler);
    await sleep(60);
    if (!samples.length) return;
    const total = samples.at(-1)[1];
    const start = samples.find(p => Math.abs(p[1]) > 0.5)?.[0];
    const t90 = samples.find(p => Math.abs(p[1]) >= Math.abs(total) * 0.9)?.[0];
    let stop = null;
    for (let i = samples.length - 1; i > 0; i--) if (Math.abs(samples[i][1] - samples[i - 1][1]) > 0.5) { stop = samples[i][0]; break; }
    rows.push({ 테스트: name, 총이동px: Math.round(total), 반응시작ms: start ?? '무반응', '90%도달ms': total ? t90 ?? '-' : '-', 멈춤ms: stop ?? '-' });
  };
  await run('실제휠 1칸 (100)', [100], 0);
  await run('실제휠 3칸 연속 (100×3, 60ms)', [100, 100, 100], 60);
  await run('실제휠 고해상도 (4×25, 8ms)', Array(25).fill(4), 8, 2000);
  await run('실제휠 트랙패드 플릭 (감쇠 30회)', Array.from({ length: 30 }, (_, i) => Math.max(1, Math.round(40 * Math.exp(-i / 8)))), 16, 2200);
  return rows;
}

const result = { label, base, ranAt: new Date().toISOString(), engine: 'chromium', viewports: {} };
const browser = await chromium.launch({ args: ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'] });

for (const vp of viewports) {
  const isMobile = vp.w <= 768;
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: isMobile ? 2 : 1,
    ...(isMobile ? { isMobile: true, hasTouch: true } : {}),
  });
  const page = await ctx.newPage();
  const consoleErrors = [], pageErrors = [], failed = [];
  page.on('console', m => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 300)));
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
  page.on('requestfailed', r => failed.push(`${r.failure()?.errorText} ${r.url()}`));
  page.on('response', r => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));

  const bag = {};
  await page.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await sleep(3000);

  // T7 은 로드 직후에 관찰을 걸어 둔다
  if (!only || only.has('T7')) bag.T7_초기 = await page.evaluate(src('T7')).catch(e => ({ error: String(e).slice(0, 200) }));

  for (const id of ['T1', 'T2', 'T3', 'T4', 'T6', 'T8', 'T11', 'T12']) {
    if (only && !only.has(id)) continue;
    bag[id] = await page.evaluate(src(id)).catch(e => ({ error: String(e).slice(0, 200) }));
  }

  // 실제 휠 지표 + 합성 휠(T9)
  if (!only || only.has('T9')) {
    bag.T9_합성 = await page.evaluate(src('T9')).catch(e => ({ error: String(e).slice(0, 200) }));
    bag.T9_실제휠 = await realWheel(page).catch(e => ({ error: String(e).slice(0, 200) }));
  }

  // T10: 실제로 굴리면서 6초 프레임 측정
  if (!only || only.has('T10')) {
    await page.evaluate(() => scrollTo(0, 0));
    await sleep(500);
    await page.evaluate(src('T10')).catch(() => {});
    const until = Date.now() + 6200;
    while (Date.now() < until) { await page.mouse.wheel(0, 240); await sleep(90); }
    await sleep(600);
    bag.T10 = await page.evaluate(() => window.__auditFrames || null).catch(() => null);
  }

  // 끝까지 내린 뒤: lazy 이미지(T5)와 누적 성능(T7)
  await scrollToEnd(page, vp.h);
  await sleep(1200);
  if (!only || only.has('T5')) bag.T5 = await page.evaluate(src('T5')).catch(e => ({ error: String(e).slice(0, 200) }));
  if (!only || only.has('T7')) bag.T7_끝까지 = await page.evaluate(() => window.__auditPerf || null).catch(() => null);
  bag.가로넘침_문서 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  bag.문서높이 = await page.evaluate(() => document.documentElement.scrollHeight);
  bag.콘솔에러 = consoleErrors;
  bag.페이지에러 = pageErrors;
  bag.실패요청 = failed;

  result.viewports[vp.name] = bag;
  console.log(`${vp.name}: 콘솔에러 ${consoleErrors.length} · 실패요청 ${failed.length} · 가로넘침 ${bag.가로넘침_문서}px · 문서높이 ${bag.문서높이}px`);
  await ctx.close();
}
await browser.close();
const file = path.join(OUT, `T-${label}.json`);
fs.writeFileSync(file, JSON.stringify(result, null, 1));
console.log('저장:', file);
