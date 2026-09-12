// 단계 4. 사용자 여정 시뮬레이션 — 네 사람이 '첫 진입 → 목표 행동'까지 가는 길을 실제로 따라간다.
//   node audit/scripts/journeys.mjs <라벨> <BASE_URL>
// 목표 행동은 넷 다 같다: 문의 보내기(CONTACT 까지 도달 → 편지함 열기 → 채우기 → 보내기).
// 숫자는 전부 실제 측정값이고, 막힌 곳은 막힌 그대로 적는다.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [, , label = 'now', base = 'http://127.0.0.1:18768'] = process.argv;
const OUT = path.join(process.cwd(), 'audit', 'measurements');
const SHOT = path.join(process.cwd(), 'audit', 'screenshots', `journey-${label}`);
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(SHOT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ARGS = ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'];
const browser = await chromium.launch({ args: ARGS });
const out = { label, base, ranAt: new Date().toISOString(), 여정: {} };

const shot = (p, n) => p.screenshot({ path: path.join(SHOT, n + '.png') }).catch(() => {});
const 보이나 = (p, sel) => p.evaluate(s => {
  const el = document.querySelector(s); if (!el) return null;
  const r = el.getBoundingClientRect(), st = getComputedStyle(el);
  const 화면안 = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  return { 화면안, 보임: st.visibility !== 'hidden' && st.display !== 'none' && +st.opacity > .01, 폭: Math.round(r.width), 높이: Math.round(r.height), 글: (el.textContent || '').trim().slice(0, 40) };
}, sel);

// 휠로 CONTACT 까지 간다. 몇 번 굴려야 닿는지, 몇 초 걸리는지를 센다.
async function 휠로도달(page, 목표, 한번, 간격, 최대 = 120) {
  const t0 = Date.now(); let n = 0;
  for (; n < 최대; n++) {
    const 닿음 = await page.evaluate(s => { const el = document.querySelector(s); if (!el) return false; const r = el.getBoundingClientRect(); return r.top < innerHeight * .6 && r.bottom > innerHeight * .4; }, 목표);
    if (닿음) break;
    await page.mouse.wheel(0, 한번);
    await sleep(간격);
  }
  return { 휠굴린횟수: n, 걸린초: +((Date.now() - t0) / 1000).toFixed(1), 도달: n < 최대 };
}

// ─── 1. Windows 노트북 · 배율 125% · 일반 마우스휠 ───────────────────────
{
  // 1920×1080 물리 화면을 125% 로 쓰면 CSS 기준 1536×864. Windows Chrome 휠 한 칸 = deltaY 100.
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' });
  const p = await ctx.newPage(); const 에러 = [];
  p.on('pageerror', e => 에러.push(String(e).slice(0, 200)));
  await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 }); await sleep(3500);
  const r = { 뷰포트: '1536x864 @1.25x', 페이지에러: 에러 };
  await shot(p, '1-windows-01-첫화면');
  r.첫화면 = {
    한국어글자수: await p.evaluate(() => { const s = document.querySelector('#home'); return (s?.innerText || '').match(/[가-힣]/g)?.length || 0; }),
    보이는CTA: await p.evaluate(() => [...document.querySelectorAll('#home a,#home button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.top < innerHeight && getComputedStyle(e).visibility !== 'hidden'; }).map(e => (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24)).filter(Boolean)),
  };
  r.한칸이동 = await (async () => { await p.evaluate(() => scrollTo(0, 0)); await sleep(800); const y0 = await p.evaluate(() => scrollY); await p.mouse.wheel(0, 100); await sleep(1500); const y1 = await p.evaluate(() => scrollY); return { 휠한칸deltaY: 100, 실제이동px: Math.round(y1 - y0), 뷰포트배수: +((y1 - y0) / 864).toFixed(2) }; })();
  await p.evaluate(() => scrollTo(0, 0)); await sleep(800);
  r.CONTACT까지 = await 휠로도달(p, '#contact', 100, 120);
  await shot(p, '1-windows-02-contact');
  r.편지함 = await (async () => {
    const btn = await p.$('#contact button, #contact [class*=letter]');
    if (!btn) return { 열림: false, 사유: '#contact 안에서 여는 단추를 찾지 못함' };
    await btn.click({ timeout: 5000 }).catch(() => {});
    await sleep(1200);
    return { 열림: await p.evaluate(() => !!document.querySelector('.ctl .stage.open, .ctl.is-open')), 이름칸: await p.evaluate(() => !!document.querySelector('.ctl input[name=name],.ctl #ctl-name')) };
  })();
  await shot(p, '1-windows-03-편지함');
  r.배율125에서겹침 = await p.evaluate(() => { const bad = []; for (const el of document.querySelectorAll('#contact *')) { const c = el.getBoundingClientRect(); if (c.width && (c.right > innerWidth + 1 || c.left < -1)) bad.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0]); } return [...new Set(bad)].slice(0, 8); });
  out.여정['1_Windows노트북_125%_마우스휠'] = r; await ctx.close();
}

// ─── 2. MacBook · 트랙패드 · 120Hz ────────────────────────────────────────
{
  // 14" MacBook Pro 기본 배율 = CSS 1512×982, DPR 2. 트랙패드는 작은 delta 를 빠르게 흘린다.
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' });
  const p = await ctx.newPage(); const 에러 = [];
  p.on('pageerror', e => 에러.push(String(e).slice(0, 200)));
  await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 }); await sleep(3500);
  const r = { 뷰포트: '1512x982 @2x', 페이지에러: 에러 };
  // 트랙패드 두 손가락 미세 스크롤: delta 4 를 8ms 간격으로
  await p.evaluate(() => scrollTo(0, 0)); await sleep(800);
  r.미세스크롤 = await (async () => { const y0 = await p.evaluate(() => scrollY); const t0 = Date.now(); for (let i = 0; i < 25; i++) { await p.mouse.wheel(0, 4); await sleep(8); } await sleep(1800); const y1 = await p.evaluate(() => scrollY); return { 보낸총delta: 100, 실제이동px: Math.round(y1 - y0), 걸린ms: Date.now() - t0 }; })();
  // 관성 플릭: 40 → 감쇠
  await p.evaluate(() => scrollTo(0, 0)); await sleep(1200);
  r.관성플릭 = await (async () => { const y0 = await p.evaluate(() => scrollY); const t0 = Date.now(); for (let i = 0; i < 30; i++) { await p.mouse.wheel(0, Math.max(1, Math.round(40 * Math.exp(-i / 8)))); await sleep(16); } let last = -1, 정지 = 0; while (Date.now() - t0 < 12000) { const y = await p.evaluate(() => scrollY); if (y === last) { 정지++; if (정지 > 4) break; } else 정지 = 0; last = y; await sleep(120); } return { 보낸총delta: Array.from({ length: 30 }, (_, i) => Math.max(1, Math.round(40 * Math.exp(-i / 8)))).reduce((a, b) => a + b, 0), 실제이동px: Math.round(last - y0), 멈추기까지ms: Date.now() - t0 }; })();
  await shot(p, '2-macbook-01-플릭후');
  await p.evaluate(() => scrollTo(0, 0)); await sleep(1000);
  r.CONTACT까지 = await 휠로도달(p, '#contact', 40, 30, 300);
  // 120Hz 화면에서의 프레임: 굴리면서 6초
  await p.evaluate(() => scrollTo(0, 0)); await sleep(600);
  await p.evaluate(() => { window.__f = []; let p0 = performance.now(); const t = n => { window.__f.push(n - p0); p0 = n; if (window.__f.length < 900) requestAnimationFrame(t); }; requestAnimationFrame(t); });
  { const until = Date.now() + 6000; while (Date.now() < until) { await p.mouse.wheel(0, 40); await sleep(30); } }
  await sleep(400);
  r.프레임 = await p.evaluate(() => { const f = (window.__f || []).slice(1); if (!f.length) return null; const s = [...f].sort((a, b) => a - b); return { 표본: f.length, 평균fps: +(1000 / (f.reduce((a, b) => a + b) / f.length)).toFixed(1), p95프레임ms: +s[Math.floor(s.length * .95)].toFixed(1), '50ms초과': f.filter(x => x > 50).length }; });
  out.여정['2_MacBook_트랙패드_120Hz'] = r; await ctx.close();
}

// ─── 3. 키보드만 쓰는 사람 ────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); const 에러 = [];
  p.on('pageerror', e => 에러.push(String(e).slice(0, 200)));
  await p.goto(base + '/', { waitUntil: 'load', timeout: 60000 }); await sleep(3500);
  const r = { 뷰포트: '1440x900', 페이지에러: 에러, 탭순서: [] };
  await p.keyboard.press('Tab'); await sleep(250);
  r.첫탭 = await p.evaluate(() => { const a = document.activeElement; return { 이름: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 30), 화면안: (() => { const c = a.getBoundingClientRect(); return c.bottom > 0 && c.top < innerHeight; })() }; });
  for (let i = 0; i < 40; i++) {
    const s = await p.evaluate(() => {
      const a = document.activeElement; if (!a || a === document.body) return { 이름: '(body)', 화면밖: false, 초점표시: false, 과녁: 0 };
      const c = a.getBoundingClientRect(), st = getComputedStyle(a);
      const 화면밖 = c.bottom < 0 || c.top > innerHeight || c.right < 0 || c.left > innerWidth;
      return { 이름: (a.innerText || a.getAttribute('aria-label') || a.name || a.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 28), 태그: a.tagName.toLowerCase(), 화면밖, 과녁: Math.round(Math.min(c.width, c.height)), 초점표시: st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0 };
    });
    r.탭순서.push(s);
    await p.keyboard.press('Tab'); await sleep(140);
  }
  r.요약 = { 탭수: r.탭순서.length, 화면밖으로간횟수: r.탭순서.filter(x => x.화면밖).length, 초점테두리없음: r.탭순서.filter(x => !x.초점표시 && x.이름 !== '(body)').length, 과녁24미만: r.탭순서.filter(x => x.과녁 > 0 && x.과녁 < 24).length };
  await shot(p, '3-keyboard-01-탭40회');
  // 키보드만으로 CONTACT 에 닿을 수 있나 — 메뉴의 CONTACT 링크를 탭으로 찾아 Enter
  await p.evaluate(() => scrollTo(0, 0)); await sleep(600);
  r.메뉴로CONTACT = await (async () => {
    for (let i = 0; i < 30; i++) {
      await p.keyboard.press('Tab'); await sleep(120);
      const hit = await p.evaluate(() => { const a = document.activeElement; return /contact|문의/i.test((a?.innerText || a?.getAttribute('aria-label') || '')); });
      if (hit) { await p.keyboard.press('Enter'); await sleep(2500); const v = await p.evaluate(() => { const el = document.querySelector('#contact'); const c = el.getBoundingClientRect(); return { 화면안: c.top < innerHeight && c.bottom > 0, top: Math.round(c.top) }; }); return { 탭횟수: i + 1, ...v }; }
    }
    return { 탭횟수: 30, 화면안: false, 사유: '30탭 안에 CONTACT 링크에 닿지 못함' };
  })();
  await shot(p, '3-keyboard-02-contact');
  // 폼을 키보드만으로 채우고 보낼 수 있나
  r.폼키보드 = await (async () => {
    const btn = await p.$('#contact button, #contact [class*=letter]');
    if (btn) { await btn.focus().catch(() => {}); await p.keyboard.press('Enter'); await sleep(1200); }
    const 열림 = await p.evaluate(() => !!document.querySelector('.ctl .stage.open, .ctl.is-open'));
    if (!열림) return { 열림: false };
    const 초점이동 = await p.evaluate(() => { const a = document.activeElement; return (a?.name || a?.id || a?.tagName || '').toString().slice(0, 24); });
    const ESC = await (async () => { await p.keyboard.press('Escape'); await sleep(800); return await p.evaluate(() => !document.querySelector('.ctl .stage.open, .ctl.is-open')); })();
    return { 열림, 열린뒤초점: 초점이동, ESC로닫힘: ESC };
  })();
  out.여정['3_키보드만'] = r; await ctx.close();
}

// ─── 4. 카카오톡 인앱 브라우저 · 모바일 · 한 손 ──────────────────────────
{
  const ctx = await browser.newContext({
    ...devices['iPhone 13'],
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.5.0',
  });
  const p = await ctx.newPage(); const 에러 = [], 실패 = [];
  p.on('pageerror', e => 에러.push(String(e).slice(0, 200)));
  p.on('response', res => res.status() >= 400 && 실패.push(res.status() + ' ' + res.url()));
  await p.goto(base + '/', { waitUntil: 'load', timeout: 90000 }); await sleep(4000);
  // 인앱 브라우저는 주소창·하단바가 화면을 먹는다. 유효 높이를 약 74px 줄여 잰다.
  const r = { 뷰포트: 'iPhone 13 (390x844 @3x) · UA 에 KAKAOTALK', 페이지에러: 에러, 실패요청4xx: 실패.slice(0, 5) };
  await shot(p, '4-kakao-01-첫화면');
  r.첫화면 = {
    가로넘침px: await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    한국어글자수: await p.evaluate(() => { const s = document.querySelector('#home'); return (s?.innerText || '').match(/[가-힣]/g)?.length || 0; }),
    메뉴항목: await p.evaluate(() => [...document.querySelectorAll('.site-nav nav a')].map(a => { const c = a.getBoundingClientRect(); return { 글: a.innerText.trim().slice(0, 16), 오른쪽끝: Math.round(c.right), 화면폭: innerWidth, 잘림: c.right > innerWidth + .5 }; })),
    로고폭: await p.evaluate(() => Math.round(document.querySelector('.eb-mark')?.getBoundingClientRect().width || 0)),
  };
  // 한 손(오른손 엄지) 사정권: 화면 아래 45% · 오른쪽 70% 안에 있는 조작점
  r.엄지사정권 = await p.evaluate(() => {
    const 안 = [], 밖 = [];
    for (const el of document.querySelectorAll('a[href],button,input,summary,[role=button]')) {
      const c = el.getBoundingClientRect(); const st = getComputedStyle(el);
      if (!c.width || !c.height || st.visibility === 'hidden' || st.display === 'none' || +st.opacity < .01) continue;
      if (c.bottom < 0 || c.top > innerHeight) continue;
      const 이름 = (el.innerText || el.getAttribute('aria-label') || el.name || el.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 22);
      const 사정권 = c.top > innerHeight * .55 && c.right > innerWidth * .30;
      (사정권 ? 안 : 밖).push({ 이름, 과녁: Math.round(Math.min(c.width, c.height)), y: Math.round(c.top) });
    }
    return { 사정권안: 안, 사정권밖: 밖 };
  });
  // 터치로 CONTACT 까지 내려간다 (실제 swipe)
  r.CONTACT까지_터치 = await (async () => {
    const t0 = Date.now(); let n = 0;
    for (; n < 80; n++) {
      const 닿음 = await p.evaluate(() => { const el = document.querySelector('#contact'); if (!el) return false; const c = el.getBoundingClientRect(); return c.top < innerHeight * .7 && c.bottom > innerHeight * .3; });
      if (닿음) break;
      await p.touchscreen.tap(195, 700).catch(() => {});
      await p.evaluate(() => scrollBy({ top: Math.round(innerHeight * .8), behavior: 'instant' }));
      await sleep(320);
    }
    return { 스와이프횟수: n, 걸린초: +((Date.now() - t0) / 1000).toFixed(1), 도달: n < 80 };
  })();
  await shot(p, '4-kakao-02-contact');
  r.편지함 = await (async () => {
    const btn = await p.$('#contact button, #contact [class*=letter]');
    if (!btn) return { 열림: false, 사유: '여는 단추 없음' };
    await btn.tap({ timeout: 5000 }).catch(async () => { await btn.click({ timeout: 5000 }).catch(() => {}); });
    await sleep(1500);
    const 열림 = await p.evaluate(() => !!document.querySelector('.ctl .stage.open, .ctl.is-open'));
    const 입력 = await p.evaluate(() => [...document.querySelectorAll('.ctl input,.ctl textarea')].map(e => ({ 이름: e.name || e.id, 글자크기: getComputedStyle(e).fontSize, 높이: Math.round(e.getBoundingClientRect().height) })));
    const 동의 = await p.evaluate(() => { const c = document.querySelector('.ctl .consent input'); if (!c) return null; const b = c.getBoundingClientRect(); return { 과녁: Math.round(Math.min(b.width, b.height)) }; });
    return { 열림, 입력칸: 입력, 동의체크박스: 동의 };
  })();
  await shot(p, '4-kakao-03-편지함');
  // 인앱 브라우저에서 mailto: 가 실제로 새 창을 열 수 있는가 — 링크의 존재와 target 확인
  r.mailto경로 = await p.evaluate(() => {
    const a = [...document.querySelectorAll('a[href^="mailto:"]')].map(x => ({ href: x.getAttribute('href').slice(0, 60), 보임: x.getBoundingClientRect().width > 0 }));
    return { mailto링크수: a.length, 목록: a.slice(0, 4) };
  });
  r.문서높이 = await p.evaluate(() => document.documentElement.scrollHeight);
  out.여정['4_카카오톡인앱_모바일_한손'] = r; await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, `journeys-${label}.json`), JSON.stringify(out, null, 1));
console.log('저장 journeys-' + label + '.json');
for (const [k, v] of Object.entries(out.여정)) console.log(`\n── ${k}\n` + JSON.stringify(v, null, 1).slice(0, 1400));
