// 사용법
//   캡처: node audit/capture.mjs capture <라벨> [chromium,webkit,firefox]
//   비교: node audit/capture.mjs diff <이전라벨> <이후라벨>
// 필요: npm i -D playwright pixelmatch pngjs  (브라우저: npx playwright install chromium webkit firefox)
import { chromium, webkit, firefox } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

// ===== 설정: 사이트에 맞게 수정 =====
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:18768';
const PAGES = ['/', '/privacy.html'];       // INVENTORY.md 의 전체 페이지
const VIEWPORTS = [
  { name: '320', width: 320, height: 568, mobile: true },
  { name: '390', width: 390, height: 844, mobile: true },
  { name: '768', width: 768, height: 1024, mobile: true },
  { name: '1024x768', width: 1024, height: 768, mobile: true },
  { name: '1280x650', width: 1280, height: 650 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
];
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots');
const MAX_STEPS = 80;                       // 페이지당 최대 스크롤 캡처 수 (이 사이트 최장: 1440px 약 50장)
// ===================================

const [, , mode, a, b] = process.argv;
const slug = p => (p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/[^\w가-힣-]+/g, '_'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 스무스 스크롤이 멈출 때까지 대기 (최대 4초)
const waitScrollStable = async page => { let prev = -1, same = 0; for (let t = 0; t < 20 && same < 3; t++) { const y = await page.evaluate(() => scrollY); same = y === prev ? same + 1 : 0; prev = y; await sleep(100); } };

async function capture(label, browserList = 'chromium') {
  const engines = { chromium, webkit, firefox };
  const log = [];
  for (const bn of browserList.split(',')) {
    // 이 컨테이너의 바깥 통신은 에이전트 프록시를 거친다. 프록시를 안 물리면 Google Fonts·Pretendard 가
    // 전부 실패해 웹폰트 없는 화면이 찍힌다(타이포 검사가 무의미해짐). 로컬 서버는 프록시에서 제외한다.
    const PROXY = process.env.AUDIT_PROXY;
    const browser = await engines[bn].launch(PROXY ? { args: ['--ignore-certificate-errors', `--proxy-server=${PROXY}`, '--proxy-bypass-list=127.0.0.1;localhost'] } : {});
    for (const vp of VIEWPORTS) {
      for (const p of PAGES) {
        const dir = path.join(OUT, label, bn, vp.name, slug(p));
        fs.mkdirSync(dir, { recursive: true });
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: vp.mobile ? 2 : 1,
          ...(vp.mobile && bn !== 'firefox' ? { isMobile: true, hasTouch: true } : {}),
        });
        const page = await ctx.newPage();
        const entry = { browser: bn, viewport: vp.name, page: p, consoleErrors: [], pageErrors: [], failedRequests: [], steps: 0 };
        page.on('console', m => m.type() === 'error' && entry.consoleErrors.push(m.text()));
        page.on('pageerror', e => entry.pageErrors.push(String(e)));
        page.on('requestfailed', r => entry.failedRequests.push(`${r.failure()?.errorText} ${r.url()}`));
        page.on('response', r => r.status() >= 400 && entry.failedRequests.push(`${r.status()} ${r.url()}`));
        try {
          await page.goto(BASE_URL + p, { waitUntil: 'load', timeout: 60000 });
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          await page.evaluate(() => document.fonts?.ready);
          await sleep(2500);                                   // 인트로·프리로더 대기
          await page.mouse.move(vp.width / 2, vp.height / 2).catch(() => {});
          // 이 사이트는 app.js 가 휠을 가로채 '구역 단위'로 건너뛴다. 휠만으로 내리면 한 뷰포트당
          // 6장 남짓만 찍히고 ABOUT 7칸·낙하 통로·엔딩 단계 같은 스크롤 연동 구간의 속살이 통째로 빠진다.
          // 그래서 캡처는 문서 높이를 기준으로 한 절대 위치로 옮기며 찍는다(휠 체감은 T9·T10 이 따로 잰다).
          const dy = Math.round(vp.height * 0.8);
          const docH = await page.evaluate(() => document.documentElement.scrollHeight);
          const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil((docH - vp.height) / dy) + 1));
          for (let i = 0; i < steps; i++) {
            await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), i * dy);
            await waitScrollStable(page);
            await sleep(700);                                   // 스크롤 트리거 애니메이션 대기
            await page.screenshot({ path: path.join(dir, `${String(i).padStart(2, '0')}.png`) });
            entry.steps = i + 1;
            if (await page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2)) break;
          }
          entry.docSize = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, scrollHeight: document.documentElement.scrollHeight }));
          entry.horizontalOverflow = entry.docSize.scrollWidth > entry.docSize.clientWidth;
        } catch (e) {
          entry.fatal = String(e);
        }
        log.push(entry);
        console.log(`${bn} ${vp.name} ${p}: ${entry.steps}장${entry.horizontalOverflow ? ' ⚠️가로넘침' : ''}${entry.fatal ? ' ❌' + entry.fatal : ''}`);
        await ctx.close();
      }
    }
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, label, 'capture-log.json'), JSON.stringify(log, null, 2));
}

function diff(before, after) {
  const rows = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => (f.isDirectory() ? walk(path.join(d, f.name)) : f.name.endsWith('.png') ? [path.join(d, f.name)] : []));
  for (const fa of walk(path.join(OUT, before))) {
    const rel = path.relative(path.join(OUT, before), fa), fb = path.join(OUT, after, rel);
    if (!fs.existsSync(fb)) { rows.push({ 파일: rel, 변화율: '이후 없음' }); continue; }
    const A = PNG.sync.read(fs.readFileSync(fa)), B = PNG.sync.read(fs.readFileSync(fb));
    if (A.width !== B.width || A.height !== B.height) { rows.push({ 파일: rel, 변화율: `크기 다름 ${A.width}x${A.height} → ${B.width}x${B.height}` }); continue; }
    const out = new PNG({ width: A.width, height: A.height });
    const n = pixelmatch(A.data, B.data, out.data, A.width, A.height, { threshold: 0.1 });
    const pct = (n / (A.width * A.height)) * 100;
    if (n > 0) { const dp = path.join(OUT, `diff_${before}_${after}`, rel); fs.mkdirSync(path.dirname(dp), { recursive: true }); fs.writeFileSync(dp, PNG.sync.write(out)); }
    rows.push({ 파일: rel, 변화율: +pct.toFixed(3) });
  }
  rows.sort((x, y) => (typeof y.변화율 === 'number' ? y.변화율 : 101) - (typeof x.변화율 === 'number' ? x.변화율 : 101));
  fs.writeFileSync(path.join(OUT, `diff_${before}_${after}.json`), JSON.stringify(rows, null, 2));
  console.table(rows.filter(r => r.변화율 !== 0).slice(0, 60));
  console.log(`변화 있는 파일 ${rows.filter(r => r.변화율 !== 0).length} / 전체 ${rows.length}. 차이 이미지: screenshots/diff_${before}_${after}/`);
}

if (mode === 'capture') await capture(a || 'before', b);
else if (mode === 'diff') diff(a, b);
else console.log('사용법: node audit/capture.mjs capture <라벨> [chromium,webkit,firefox] | diff <이전> <이후>');
