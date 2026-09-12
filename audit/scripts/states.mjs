// 컴포넌트 상태·사용자 설정을 실제로 열어 보고 audit/measurements/*.json 으로 남긴다.
//   node audit/scripts/states.mjs <BASE_URL>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:18768';
const OUT = path.join(process.cwd(), 'audit', 'measurements');
const ARGS = ['--ignore-certificate-errors', '--proxy-server=http://127.0.0.1:42285', '--proxy-bypass-list=127.0.0.1;localhost'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const save = (name, data) => { fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 1)); console.log('저장', name); };

const browser = await chromium.launch({ args: ARGS });

/* ── 1. prefers-reduced-motion: reduce ───────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 });
  await sleep(4000);
  const r = await p.evaluate(() => ({
    문서높이: document.documentElement.scrollHeight,
    reducedMotion클래스: document.documentElement.classList.contains('reduced-motion'),
    실행중애니메이션: document.getAnimations().filter(a => a.playState === 'running').length,
    상단바캐릭터: (() => { const m = document.querySelector('.nav-mascot'); return m ? getComputedStyle(m).display : '없음'; })(),
    현재메뉴표시: (() => { const a = document.querySelector('.site-nav nav a'); const c = getComputedStyle(a); return { color: c.color }; })(),
    움직임토글: document.querySelector('.motion-toggle')?.getAttribute('aria-pressed'),
  }));
  // 페이지 끝까지 내려가지는지
  await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await sleep(1500);
  r.맨아래도달 = await p.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 4);
  r.페이지에러 = errs;
  save('reduced-motion.json', r);
  await ctx.close();
}

/* ── 2. 다크 모드 ────────────────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 });
  await sleep(3000);
  const r = await p.evaluate(() => ({
    html_colorScheme: getComputedStyle(document.documentElement).colorScheme,
    body배경: getComputedStyle(document.body).backgroundColor,
    body글자색: getComputedStyle(document.body).color,
    themeColor메타: document.querySelector('meta[name=theme-color]')?.content || '없음',
    다크전용규칙수: [...document.styleSheets].reduce((n, s) => { try { return n + [...s.cssRules].filter(x => x.conditionText && /prefers-color-scheme/.test(x.conditionText)).length; } catch { return n; } }, 0),
  }));
  save('dark-mode.json', r);
  await ctx.close();
}

/* ── 3. 브라우저 확대 200% (1440 창을 720 CSS px 로) ─────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 });
  await sleep(3500);
  const 넘침 = async () => p.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const rows = [...document.body.querySelectorAll('*')].map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width && (r.right > W + .5 || r.left < -.5))
      .map(({ el }) => el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]);
    return { 문서가로스크롤: document.documentElement.scrollWidth - W, 넘친요소: [...new Set(rows)].slice(0, 12) };
  });
  const r = { 첫화면: await 넘침() };
  for (const id of ['about', 'portfolio', 'original', 'contact']) {
    await p.evaluate(s => document.getElementById(s)?.scrollIntoView({ block: 'start', behavior: 'instant' }), id);
    await sleep(1500);
    r[id] = await 넘침();
  }
  save('zoom200.json', r);
  await ctx.close();
}

/* ── 4. 문의 편지지 상태 + ORIGINAL 상세창 ───────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const r = {};
  await p.goto(BASE + '/#contact', { waitUntil: 'load', timeout: 60000 });
  await sleep(4500);
  r.열림 = await p.evaluate(() => ({ stage: document.querySelector('#ctl-stage')?.className, 이름칸: !!document.querySelector('#ctl-form input[name=name]') }));

  // (1) 전부 빈 채로 SEND
  await p.click('#ctl-form .send');
  await sleep(500);
  r.빈칸오류 = await p.evaluate(() => ({ 문구: document.querySelector('#ctl-note')?.textContent, 표시된칸: [...document.querySelectorAll('#ctl-form .f.bad')].length }));

  // (2) 이메일 형식만 틀리게
  await p.fill('#ctl-form input[name=name]', '홍길동');
  await p.fill('#ctl-form input[name=email]', 'not-an-email');
  await p.fill('#ctl-form textarea[name=message]', '문의 내용입니다.');
  await p.click('#ctl-form .send');
  await sleep(500);
  r.이메일형식오류 = await p.evaluate(() => document.querySelector('#ctl-note')?.textContent);

  // (3) 동의 미체크
  await p.fill('#ctl-form input[name=email]', 'test@example.com');
  await p.click('#ctl-form .send');
  await sleep(500);
  r.동의미체크 = await p.evaluate(() => ({ 문구: document.querySelector('#ctl-note')?.textContent, consentBad: !!document.querySelector('#ctl-form .consent.bad') }));

  // (4) 개인정보 패널 열기/ESC
  await p.click('#ctl-pvbtn');
  await sleep(350);
  r.개인정보패널열림 = await p.evaluate(() => ({ hidden: document.querySelector('#ctl-privacy')?.hidden, 전문링크: !!document.querySelector('#ctl-privacy a[href="privacy.html"]') }));
  await p.keyboard.press('Escape');
  await sleep(350);
  r.개인정보패널ESC = await p.evaluate(() => document.querySelector('#ctl-privacy')?.hidden);

  // (5) 글자수 경고
  await p.fill('#ctl-form input[name=name]', 'ㄱ'.repeat(55));
  await sleep(300);
  r.글자수경고 = await p.evaluate(() => { const c = document.querySelector('#ctl-form .f .cnt'); return { hidden: c?.hidden, 글: c?.textContent }; });

  // (6) 동의 체크 후 SEND → 완료 화면 (mailto 는 새 창을 열지 않으므로 안전)
  await p.fill('#ctl-form input[name=name]', '홍길동');
  await p.check('#ctl-form input[name=privacy_consent]');
  await p.click('#ctl-form .send');
  await sleep(800);
  r.보낸뒤 = await p.evaluate(() => {
    const el = document.querySelector('#ctl-posted');
    return { hidden: el?.hidden, 문구: el?.innerText?.replace(/\s+/g, ' ').trim(), 다시쓰기: !document.querySelector('#ctl-again')?.hidden };
  });
  await p.click('#ctl-again');
  await sleep(500);
  r.다시쓰기후 = await p.evaluate(() => ({ posted숨김: document.querySelector('#ctl-posted')?.hidden, 이름칸비었나: document.querySelector('#ctl-form input[name=name]')?.value === '' }));

  // ORIGINAL 상세창
  await p.evaluate(() => document.getElementById('original')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await sleep(1800);
  await p.evaluate(() => document.querySelector('.original-table__work')?.click());
  await sleep(600);
  r.original상세 = await p.evaluate(() => {
    const d = document.querySelector('.original-dialog');
    return { open: d?.open, 제목: d?.querySelector('h2')?.textContent, 본문: [...d.querySelectorAll('p')].map(x => x.textContent).filter(Boolean).slice(0, 3), 해시: location.hash };
  });
  await p.keyboard.press('Escape');
  await sleep(500);
  r.original상세ESC = await p.evaluate(() => ({ open: document.querySelector('.original-dialog')?.open, 해시: location.hash }));
  save('contact-states.json', r);
  await ctx.close();
}

/* ── 5. 자바스크립트 꺼짐 ───────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 });
  await sleep(1500);
  const r = await p.evaluate(() => 0).catch(() => null);
  const text = await p.innerText('body').catch(() => '');
  const info = {
    noscript문구보임: /자바스크립트가 꺼져 있습니다/.test(text),
    문의대체문구: /문의는 메일로 받고 있습니다/.test(text),
    메일주소보임: /jadechoi@eternalbeamapp\.com/.test(text),
    ABOUT본문보임: /함께하는 시간을/.test(text),
    mailto링크수: await p.$$eval('a[href^="mailto:"]', a => a.length).catch(() => 0),
    폼남아있나: await p.$$eval('form', f => f.length).catch(() => 0),
  };
  fs.writeFileSync(path.join(OUT, 'nojs.json'), JSON.stringify(info, null, 1));
  console.log('저장 nojs.json');
  await ctx.close();
}

/* ── 6. WebGL 을 막았을 때 엔딩 대체 화면 ───────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  // three.js 모듈 로드를 막아 렌더러 실패 경로를 태운다
  await p.route('**/ending-scene-r15.js*', route => route.abort());
  await p.goto(BASE + '/#ending', { waitUntil: 'load', timeout: 60000 });
  await sleep(6000);
  const r = await p.evaluate(() => {
    const s = document.querySelector('#ending');
    const f = s.querySelector('.ending-fallback');
    return { renderer: s.dataset.renderer, 대체문구: f?.textContent, 보임: f ? getComputedStyle(f).display : '없음',
      리플레이버튼: s.querySelector('.replay-button')?.textContent };
  });
  save('ending-fallback.json', r);
  await ctx.close();
}

await browser.close();
console.log('완료');
