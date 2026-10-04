import { initLang } from './i18n.js?v=eb-20261005k';
import { initNavShelf } from './nav-shelf.js?v=eb-20261004f';
import { initPortfolio } from './portfolio.js?v=eb-20260927-merge-1';
import { initContact } from './contact-letterbox.js?v=eb-20260927-merge-1';
import { initJourney } from './journey.js?v=eb-20260927-merge-1';
import { initStoryKeep } from './story-keep.js?v=eb-20261004c';
import { initHeroOriginal } from './hero-original.js?v=eb-20260927-merge-1';
import { initCharacterDirection } from './character-direction.js?v=eb-20260913';
import { initBeamRail } from './beam-rail.js?v=eb-20260918p';
import { initHeroMelius } from './hero-melius.js?v=eb-20261005k';

initLang();

// 새로고침 위치를 브라우저와 사이트가 서로 다르게 되돌려 어디에 설지 브라우저마다 달랐다.
// 되돌리는 주체를 사이트 하나로 모은다. (index.html 머리에도 같은 줄을 넣어 달라고 요청해 둠)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const root = document.documentElement;
const nav = document.querySelector('.site-nav');
initNavShelf(nav);
const navLinks = [...nav.querySelectorAll('nav a')];
const mediaMotion = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = mediaMotion.matches;
let scene = 'home';
let replaying = false;
let bottomSince = 0;
let lastWheel = 0;
let wheelReplayArmed = false;
let wheelReplayTimer = 0;
let touchStart = null;
let landingIntentAt = 0;
let landingTarget = null;
let landingTimer = 0;
let navigationUntil = 0;
let initialRoute = null;
let initialRouteObserver = null;
let initialRouteTimer = 0;
let sectionWheelLock = null;
let landingFixTimer = 0;
let journeyReady = false;
let routeSettled = false;
let routedHash = null;
let routedAt = 0;
let hashSyncedAt = 0;
// 창 크기가 바뀌기 '전'의 자리를 미리 적어 두는 쪽지. 바뀐 뒤에 읽으면 이미 밀려난 값이라 못 쓴다.
let viewKeep = null;
let viewGuardUntil = 0;
let viewRestoreFrame = 0;
let viewRestoreTimer = 0;
let touchActive = false;
// 감사 [6]: 창 크기가 바뀌는 동안에는 주소를 고치지 않는다. 이 시각이 지나야 다시 쓴다.
let resizeQuietUntil = 0;
let hashRepairTimer = 0;
// 감사 [18]: 마지막 크기 변경에서 화면이 '커졌는가'. 휴대폰 주소창이 다시 펴지는 순간이 이것이다.
let viewGrew = false;
let lastViewHeight = innerHeight;

// 부드러운 이동이 도중에 끊겨 조금 지나쳐 서면 사진 구역이 '제자리 아님'으로 보고 휠을 무시한다.
// 착지 뒤 한 번 더 확인해 정확한 자리에 맞춘다.
function assertLanding(top) {
  clearTimeout(landingFixTimer);
  landingFixTimer = window.setTimeout(() => {
    landingFixTimer = 0;
    const drift = scrollY - top;
    if (Math.abs(drift) > 2 && Math.abs(drift) < 220) {
      window.scrollTo({ top, behavior: 'instant' });
      journey.update();
    }
  }, 540);
}
let homeHoldUntil = 0;

document.querySelector('#year').textContent = new Date().getFullYear();
const letter = initContact(document.querySelector('#contact-mount'));
const heroOriginal = initHeroOriginal({ onNavigate: navigate });
function inquiry(context) {
  navigate('contact', true);
  letter.open(context);
}
const portfolio = initPortfolio(document.querySelector('#portfolio-mount'), {
  onInquiry: inquiry,
  onStoryWheel: event => handleSectionWheel(event, document.querySelector('#portfolio-mount')),
});
initStoryKeep();
// ── 상단바를 켜고 끄는 주인은 applyNav 뿐이다 ───────────────────────────────
// 감사 [56]: 예전에는 같은 바를 app.js·ending.js·nav-shelf.js 세 곳이 따로 켜고 꺼서
// '보이라고 표시해 두었는데 화면에는 없는' 바가 생겼다(눈에는 안 보이는데 Tab·화면낭독기만 닿는 유령 바).
// 이제 판단은 여기서만 한다.

// 스크립트가 옮긴 초점에는 파란 테두리 상자를 그리지 않는다 (2026-09-10 사장님: "박스 안 나오게").
// 구역은 Tab 으로는 닿을 수 없는 자리(tabindex=-1)라 표시를 지워도 키보드 사용자가 잃는 것이 없다.
function scriptFocus(el) {
  el.tabIndex = -1;
  el.style.outline = 'none';
  const clear = () => { el.style.outline = ''; el.removeEventListener('blur', clear); window.removeEventListener('keydown', clear); };
  el.addEventListener('blur', clear);
  window.addEventListener('keydown', clear);
  el.focus({ preventScroll: true });
}

// 감사 [81]: 굴림으로만 내려오면 초점 주인이 없어(body) Tab 한 번에 문서 맨 앞으로 되감기고
// 화면이 1만 px 넘게 거슬러 올라갔다. 지금 보고 있는 구역을 초점 출발점으로 세워 둔다.
// 감사 [51]: 상단바가 접히는 순간 그 안(로고·메뉴)에 초점이 있으면 브라우저가 초점을 body 로 떨어뜨린다.
// 그때는 force 로 불러 도착 구역까지 초점을 이어 준다.
let anchored = null;
function anchorFocus(force = false) {
  // 문서 맨 위(HOME)에서는 손대지 않는다 — 첫 Tab 은 '본문 바로가기'가 받아야 한다.
  if (!force && scene === 'home') return;
  const active = document.activeElement;
  // 사용자가 직접 고른 단추·입력칸에 초점이 있으면 빼앗지 않는다. 비어 있거나 우리가 세워 둔 자리일 때만 옮긴다.
  const idle = !active || active === document.body || active === root || active === anchored;
  if (!force && !idle) return;
  const dest = document.getElementById(scene);
  if (!dest || dest === active) return;
  anchored = dest;
  scriptFocus(dest);
}

let navVisible = null;
function applyNav() {
  const blocked = scene === 'home';
  const visible = !blocked;
  if (visible === navVisible) return visible;   // 값이 바뀔 때만 쓴다 (같은 값 재기록은 상단바 감시자를 깨운다)
  navVisible = visible;
  const rescue = !visible && nav.contains(document.activeElement);
  nav.classList.toggle('is-visible', visible);
  nav.inert = !visible;
  nav.setAttribute('aria-hidden', String(!visible));
  if (rescue) anchorFocus(true);
  return visible;
}

function updateScene(next) {
  scene = next;
  applyNav();
  anchorFocus();
  navLinks.forEach(link => {
    if (link.hash === `#${next}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  const atBottom = next === 'contact' && window.scrollY + innerHeight >= document.documentElement.scrollHeight - 6;
  if (atBottom && !bottomSince) bottomSince = performance.now();
  if (!atBottom) bottomSince = 0;
  captureView();
  syncHash();
}
const journey = initJourney(updateScene, portfolio);
journeyReady = true;
let beamRail = null;
initCharacterDirection();
initHeroMelius(() => reduced);
function applyMotion(preservePosition = false) {
  const anchor = preservePosition && [...document.querySelectorAll('#home,#about,#portfolio,#original,#contact')].find(section => section.getBoundingClientRect().bottom > 80);
  const relativeTop = anchor ? (scrollY - anchor.offsetTop) / anchor.offsetHeight : 0;
  const station = journey.currentStation;
  root.classList.toggle('reduced-motion', reduced);
  letter.setReducedMotion(reduced);
  portfolio?.setReducedMotion?.(reduced);
  journey.setReducedMotion(reduced);
  window.dispatchEvent(new CustomEvent('tva:motion', { detail: { reduced } }));
  // DROP and ABOUT change document height; preserve the reader's scene, not its old absolute Y.
  if (anchor?.id === 'about') journey.gotoStation(station, true);
  else if (anchor) window.scrollTo({ top: Math.max(0, anchor.offsetTop + relativeTop * anchor.offsetHeight), behavior: 'instant' });
}
mediaMotion.addEventListener('change', event => { reduced = event.matches; userReduced = null; applyMotion(true); });
// 사이트 안에서도 움직임을 끌 수 있게 한다. 사용자가 직접 고른 값은 OS 설정보다 우선한다.
let userReduced = null;
const motionToggle = document.querySelector('.motion-toggle');
if (motionToggle) {
  const syncToggle = () => {
    motionToggle.setAttribute('aria-pressed', String(reduced));
    motionToggle.textContent = reduced ? '움직임 켜기' : '움직임 줄이기';
  };
  motionToggle.addEventListener('click', () => {
    userReduced = !reduced;
    reduced = userReduced;
    applyMotion(true);
    syncToggle();
  });
  window.addEventListener('tva:motion', syncToggle);
  syncToggle();
}
applyMotion();

// Keep anchor navigation immediate while visibly acknowledging the click during the opening transition.
document.querySelectorAll('.hero-original__scroll,.eb-melius-foot__scroll').forEach(control => {
  control.addEventListener('click', () => {
    control.classList.add('is-clicked');
    window.setTimeout(() => control.classList.remove('is-clicked'), 320);
  });
});

const aliases = { studio: 'about', work: 'portfolio', lab: 'original', drop: 'about' };
const destinations = new Set(['home', 'about', 'portfolio', 'original', 'contact']);
const landingSections = [...document.querySelectorAll('#portfolio,#original,#contact')];

function sectionOffset(id) {
  return ['home', 'about'].includes(id) ? 0 : nav.offsetHeight || 64;
}

// ── 주소를 화면과 같게 유지한다 ───────────────────────────────────────────────
// 휠로 구역을 옮겨도 주소가 그대로여서 링크 공유·새로고침·뒤로가기가 전부 다른 곳을 가리켰다.
// 뒤로가기 기록은 늘리지 않도록 pushState 가 아니라 replaceState 로 조용히 맞춘다.
// 주소를 실제로 고쳐 쓰는 곳. '지금 써도 되는가'는 부르는 쪽이 판단한다.
function writeHash(id) {
  if (!id) return;
  // 작품 상세는 주소에 '#original/작품이름' 처럼 뒷가지를 달고 다닌다. 앞머리가 같으면 손대지 않는다.
  const base = (location.hash || '').slice(1).split('/')[0];
  if ((aliases[base] || base) === id) return;
  if (id === 'home' && !base) return;                           // 첫 화면은 이미 빈 주소다
  if (base && !destinations.has(aliases[base] || base)) return; // 우리가 모르는 주소는 건드리지 않는다
  if (document.querySelector('dialog[open]')) return;
  hashSyncedAt = performance.now();
  // 첫 화면은 주소를 깨끗이 비운다
  history.replaceState(null, '', id === 'home' ? location.pathname + location.search : `#${id}`);
}

function syncHash() {
  if (!routeSettled || initialRoute || replaying) return;
  const now = performance.now();
  if (now < navigationUntil || now < homeHoldUntil || now - hashSyncedAt < 250) return;
  // 감사 [6]: 창 크기가 바뀌면 화면이 잠깐 밀렸다가 제자리로 돌아온다. 그 '잠깐' 사이의 구역을
  // 주소에 적어 버리면, 화면은 제자리인데 주소만 다른 구역을 가리킨 채 영영 남는다
  // (그 뒤 새로고침·링크 공유·앞으로가기가 전부 엉뚱한 구역으로 간다).
  // 주소는 사용자가 실제로 옮겼을 때만 바뀌어야 하므로, 크기가 바뀌는 동안에는 쓰지 않는다.
  if (now < resizeQuietUntil) return;
  writeHash(scene);
}

// ── 창 크기가 바뀌어도 읽던 구역을 지킨다 ─────────────────────────────────────
// 크기가 바뀐 뒤에 위치를 읽으면 브라우저가 이미 잘라낸 값이라 엉뚱한 구역이 '현재'로 뽑혔다.
// 그래서 평소(스크롤·장면 바뀔 때)에 '어느 구역 · 그 구역 안 몇 px' 을 미리 적어 둔다.
function aboutIsLinear() {
  return !!document.querySelector('#about')?.classList.contains('is-linear');
}

let viewCapturedAt = 0;
function captureView() {
  const now = performance.now();
  if (now < viewGuardUntil) return;
  // 장면이 바뀔 때는 바로, 같은 장면 안에서는 0.12초에 한 번만 적는다 (매 프레임 자리 재기를 피한다)
  if (viewKeep && viewKeep.id === scene && now - viewCapturedAt < 120) return;
  const section = document.getElementById(scene);
  if (!section) return;
  viewCapturedAt = now;
  const room = Math.max(0, section.offsetHeight - innerHeight);
  const off = Math.round(scrollY - Math.max(0, section.offsetTop - sectionOffset(scene)));
  viewKeep = {
    id: scene,
    off,
    ratio: room ? Math.min(1, Math.max(0, off / room)) : 0,
    station: journeyReady ? journey.currentStation : 0,
    width: innerWidth,
    height: innerHeight,
    linear: aboutIsLinear(),
  };
}

function restoreView() {
  // 손가락이 화면에 닿아 있는 동안(주소창이 접히는 순간)에는 되돌리지 않는다 — 끌던 손을 방해하지 않게.
  // 감사 [18]: 다만 '화면이 커지는' 순간(주소창이 다시 펴질 때)만은 예외다.
  // 이때는 다른 곳이 구역을 한 칸 앞으로 잘못 골라 끌고 가버려서, 되돌리지 않으면 읽던 구역을 잃는다.
  // 실측: 접힘(844→784)은 8/8 정상, 펴짐(784→844)만 5/8 실패였다.
  if (touchActive && !viewGrew) { viewGuardUntil = 0; return; }
  if (!viewKeep) { if (touchActive) viewGuardUntil = 0; return; }
  const keep = viewKeep;
  const section = document.getElementById(keep.id);
  if (!section) return;
  viewGuardUntil = performance.now() + 420;
  const linear = aboutIsLinear();
  // 폭이 바뀌거나 가로↔세로 배치가 바뀌면 구역 안 위치는 믿을 수 없으니 구역 머리로 맞춘다
  const reflow = keep.width !== innerWidth || keep.linear !== linear;
  const room = Math.max(0, section.offsetHeight - innerHeight);
  // 손가락이 닿아 있는 동안의 되돌림(주소창이 펴지는 순간)은 '보던 자리 그대로'가 정답이다.
  // 구역 안 비율로 다시 계산하면 손가락이 옮긴 30px 이 371px 로 부풀어 오른다(실측).
  const holdExact = touchActive && !reflow;
  const inner = reflow ? 0
    : holdExact ? keep.off
    : keep.height === innerHeight ? Math.min(keep.off, room)
    : Math.round(keep.ratio * room);
  if (keep.id === 'about' && !linear && !keep.linear) {
    journey.gotoStation(keep.station, true); // 가로 정거장은 좌표가 아니라 정거장 번호로 되돌린다
  } else {
    const limit = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const top = Math.min(limit, Math.max(0, section.offsetTop - sectionOffset(keep.id) + Math.max(0, inner)));
    window.scrollTo({ top, behavior: 'instant' });
  }
  viewKeep = { ...keep, off: Math.max(0, inner), ratio: room ? Math.min(1, Math.max(0, inner / room)) : 0, width: innerWidth, height: innerHeight, linear };
  journey.update();
}

// 크기 변경 직후에 사용자가 스스로 옮기면(메뉴 클릭·휠·터치) 되돌리기를 취소한다.
// 이게 없으면 창을 줄이자마자 누른 메뉴가 0.16초 뒤 원래 자리로 끌려온다.
function cancelViewRestore() {
  cancelAnimationFrame(viewRestoreFrame);
  clearTimeout(viewRestoreTimer);
  viewRestoreFrame = 0;
  viewRestoreTimer = 0;
  viewGuardUntil = 0;
  // 사용자가 스스로 옮겼으면 그 자리가 곧 정답이다. 주소 잠금을 풀고 바로 따라가게 둔다.
  clearTimeout(hashRepairTimer);
  hashRepairTimer = 0;
  resizeQuietUntil = 0;
}

function scheduleViewRestore() {
  const now = performance.now();
  viewGrew = innerHeight > lastViewHeight;   // 커졌는지 작아졌는지는 '지난 크기'와 견줘서만 알 수 있다
  lastViewHeight = innerHeight;
  viewGuardUntil = now + 420;
  // 크기가 바뀌는 동안은 주소를 잠근다. 창을 손으로 끄는 동안에는 이 줄이 계속 다시 불려 잠금이 이어진다.
  resizeQuietUntil = now + 820;
  cancelAnimationFrame(viewRestoreFrame);
  clearTimeout(viewRestoreTimer);
  // journey 의 복원(첫 rAF) 바로 뒤에 한 번, 창을 손으로 끄는 동안을 위해 멈춘 뒤 한 번 더
  viewRestoreFrame = requestAnimationFrame(() => { viewRestoreFrame = 0; restoreView(); });
  viewRestoreTimer = window.setTimeout(() => { viewRestoreTimer = 0; restoreView(); }, 160);
  // 자리가 제자리로 돌아온 뒤에 주소를 '읽던 구역'에 딱 한 번 맞춘다.
  // (읽던 구역 = viewKeep — 크기가 바뀌기 전에 적어 둔 쪽지. 바뀐 뒤에 다시 읽은 값은 못 믿는다)
  clearTimeout(hashRepairTimer);
  hashRepairTimer = window.setTimeout(() => {
    hashRepairTimer = 0;
    resizeQuietUntil = 0;
    if (!routeSettled || initialRoute || replaying) return;
    const t = performance.now();
    if (t < navigationUntil || t < homeHoldUntil) return;
    writeHash(viewKeep?.id || scene);
  }, 760);
}
window.addEventListener('resize', scheduleViewRestore);
window.addEventListener('orientationchange', scheduleViewRestore);

function scrollToSection(id, moveFocus = false, instant = false) {
  const target = document.getElementById(id);
  if (!target) return;
  cancelViewRestore();
  const leftLetter = id !== 'contact' && letter.closeForNavigation();
  updateScene(id);
  navigationUntil = performance.now() + 240;
  if (beamRail?.goTo(id, instant || reduced)) {
    if (leftLetter || moveFocus) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
    requestAnimationFrame(journey.update);
    return;
  }
  window.scrollTo({ top: Math.max(0, target.offsetTop - sectionOffset(id)), behavior: 'instant' });
  if (leftLetter || moveFocus) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
  requestAnimationFrame(journey.update);
}

function releaseInitialRoute() { clearTimeout(initialRouteTimer); initialRouteObserver?.disconnect(); initialRouteObserver = null; initialRoute = null; }
function pinInitialRoute(id) {
  releaseInitialRoute(); const hash = location.hash;
  const pin = () => { const target = document.getElementById(id); if (!target || !initialRoute || location.hash !== hash) return releaseInitialRoute(); const top = Math.max(0, target.offsetTop - sectionOffset(id)); if (Math.abs(scrollY - top) > 1) { navigationUntil = performance.now() + 240; window.scrollTo({ top, behavior: 'instant' }); requestAnimationFrame(journey.update); } };
  initialRoute = id; initialRouteObserver = new ResizeObserver(() => requestAnimationFrame(pin)); initialRouteObserver.observe(document.body);
  requestAnimationFrame(() => requestAnimationFrame(pin)); initialRouteTimer = window.setTimeout(releaseInitialRoute, 650);
}

function navigate(id) {
  releaseInitialRoute();
  clearTimeout(landingTimer);
  landingTimer = 0;
  landingIntentAt = 0;
  landingTarget = null;
  sectionWheelLock = null;
  navigationUntil = 0;
  homeHoldUntil = 0;
  if (location.hash !== `#${id}`) {
    history.pushState(null, '', `#${id}`);
    window.dispatchEvent(new CustomEvent('tva:navigate'));
  }
  scrollToSection(id, true);
}

function routeHash(initial = false) {
  const hash = location.hash.slice(1).split('/')[0] || 'home';
  const id = aliases[hash] || hash;
  if (!destinations.has(id)) return;
  // 해시만 바뀌는 이동에서는 브라우저가 hashchange 와 popstate 를 둘 다 쏜다.
  // 0.15초 안에 들어온 같은 주소는 한 번만 처리한다 (구역마다 동작이 달라지던 것도 함께 없어진다).
  if (!initial && location.hash === routedHash && performance.now() - routedAt < 150) return;
  routedHash = location.hash;
  routedAt = performance.now();
  scrollToSection(id, !initial, initial);
  if (initial && !beamRail) pinInitialRoute(id);
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const id = link.hash.slice(1);
  if (!destinations.has(id)) return;
  event.preventDefault();
  navigate(id);
});
window.addEventListener('hashchange', () => routeHash());
window.addEventListener('popstate', () => routeHash());
beamRail = initBeamRail({
  onPanel(id, meta) {
    if (!meta?.initial) navigationUntil = performance.now() + 1120;
    updateScene(id);
    requestAnimationFrame(journey.update);
  },
  onCardSelect(id) {
    if (location.hash !== `#${id}`) {
      history.pushState(null, '', `#${id}`);
      window.dispatchEvent(new CustomEvent('tva:navigate'));
    }
  },
  introReady() {
    if (reduced || window.__tvaPowerRevealed) return true;
    const home = document.querySelector('#home');
    return home?.dataset.powerState === 'locked' && !home.classList.contains('is-powering');
  },
  panelWheel(id, event) {
    if (id === 'about') return handleAboutStationWheel(event, event.target);
    return false;
  },
  isReduced: () => reduced,
});
if (beamRail) {
  window.addEventListener('scroll', () => {
    if (scrollY !== 0) window.scrollTo({ top: 0, behavior: 'instant' });
  }, { passive: true });
}

// 딥링크 착지가 구글 폰트에 묶여 있어, 폰트가 늦게 오면 10초 뒤 엉뚱한 구역에 내렸다.
// 폰트는 0.6초까지만 기다리고 그 뒤엔 먼저 착지한다 (폰트가 정상일 때의 착지 시각은 그대로).
Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 600))])
  .then(() => requestAnimationFrame(() => {
    routeHash(true);
    routeSettled = true;
  }));

// 감사 [28]: 회사소개 팝업(.company-dialog) 배선은 지웠다.
// 여는 단추 .company-open 은 2026-09-11 사장님 지시로 화면에서 뺐고 되살리지 않는다.
// 열 방법이 없는 팝업을 잡고 있던 코드라 닫을 때 초점이 갈 곳도 없었다(companyButton = null).
// 남은 잔해(index.html 의 <dialog>, about.css 의 .company-open 자리규칙, styles.css 선택자,
// qa/surface.js 검사)는 파일 주인에게 따로 요청해 두었다.

function editableInView() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !(active.matches('input, textarea, select, [contenteditable="true"]'))) return false;
  const rect = active.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
}

function releaseOffscreenEditor() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches('input, textarea, select, [contenteditable="true"]') && !editableInView()) active.blur();
}

function replayAllowed() {
  return !replaying && !document.querySelector('dialog[open]') && !document.querySelector('.is-returning,.is-previewing') && !editableInView();
}

function atPageBottom() {
  return scrollY + innerHeight >= document.documentElement.scrollHeight - 6
    && (scene === 'contact' || document.querySelector('#contact')?.getBoundingClientRect().top <= innerHeight * .55);
}

function resetWheelReplayArm() {
  clearTimeout(wheelReplayTimer);
  wheelReplayTimer = 0;
  wheelReplayArmed = false;
}

function scheduleWheelReplayArm(restart = false) {
  if (restart) resetWheelReplayArm();
  else if (wheelReplayTimer || wheelReplayArmed) return;
  if (!atPageBottom() || replaying) return;
  wheelReplayTimer = window.setTimeout(() => {
    wheelReplayTimer = 0;
    wheelReplayArmed = atPageBottom() && replayAllowed();
  }, 320);
}

function restartProgramme() {
  cancelViewRestore();
  clearTimeout(landingTimer);
  landingTimer = 0;
  landingIntentAt = 0;
  landingTarget = null;
  sectionWheelLock = null;
  window.dispatchEvent(new CustomEvent('tva:restart'));
  history.pushState(null, '', '#home');
  window.dispatchEvent(new CustomEvent('tva:navigate'));
  navigationUntil = performance.now() + 900;
  homeHoldUntil = navigationUntil;
  window.scrollTo({ top: 0, behavior: 'instant' });
  journey.update();
  bottomSince = 0;
  resetWheelReplayArm();
}

async function replay() {
  if (!replayAllowed()) return;
  replaying = true;
  releaseOffscreenEditor();
  try {
    restartProgramme();
    await new Promise(resolve => requestAnimationFrame(resolve));
    heroOriginal.focus();
  } finally { replaying = false; }
}
function bottomReady() { return bottomSince > 0 && performance.now() - bottomSince > 700; }

function canSettleFrom(target) {
  if (!(target instanceof Element) || document.querySelector('dialog[open]') || editableInView() || replaying || performance.now() < navigationUntil) return false;
  for (let element = target; element && element !== document.body; element = element.parentElement) {
    if (element.matches('iframe, [contenteditable="true"], input, textarea, select')) return false;
    const style = getComputedStyle(element);
    if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1) return false;
  }
  return true;
}

function wheelSource(event) {
  if (event.target instanceof Element) return event.target;
  return event.composedPath?.().find(node => node instanceof Element) || document.body;
}

function wheelSourceIsEditable(source) {
  for (let element = source; element && element !== document.body; element = element.parentElement) {
    if (element.matches('iframe, [contenteditable="true"], input, textarea, select')) return true;
  }
  return false;
}

function handleEntryBoundaryWheel(event, source) {
  const drop = document.querySelector('#drop');
  const sofa = document.querySelector('.sofa-journey');
  const about = document.querySelector('#about');
  if (!sofa || !drop?.classList.contains('sofa-journey-ready') || !about
    || event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)
    || !canSettleFrom(source)) return false;
  const sofaEnd = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, drop.offsetTop + drop.offsetHeight - innerHeight));
  const direction = Math.sign(event.deltaY);
  const inGap = scrollY >= sofaEnd - 8 && scrollY <= about.offsetTop + 8;
  const towardAbout = direction > 0 && scrollY < about.offsetTop - 8;
  const towardSofa = direction < 0 && scrollY > sofaEnd + 8;
  if (!inGap || (!towardAbout && !towardSofa)) return false;
  const now = performance.now();
  event.preventDefault();
  releaseInitialRoute();
  clearTimeout(landingTimer);
  landingIntentAt = 0;
  landingTarget = null;
  sectionWheelLock = { direction, lastInput: now, until: now + (towardAbout ? 850 : 650) };
  if (towardAbout) journey.gotoStation(0);
  else window.scrollTo({ top: sofaEnd, behavior: reduced ? 'instant' : 'smooth' });
  return true;
}

function handleAboutStationWheel(event, source) {
  const about = document.querySelector('#about');
  if (about.classList.contains('about-bleib') || about.classList.contains('is-linear') || event.ctrlKey || !event.deltaY
    || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !canSettleFrom(source)) return false;
  if (root.dataset.layout !== 'beam-rail') {
    const aboutRect = about.getBoundingClientRect();
    if (aboutRect.top > (nav.offsetHeight || 64) + 8 || aboutRect.bottom < innerHeight - 8) return false;
  } else if (root.dataset.railPanel !== 'about') return false;
  const direction = Math.sign(event.deltaY);
  const now = performance.now();
  if (Number.isInteger(sectionWheelLock?.aboutTarget)
    && (now >= sectionWheelLock.until && now - sectionWheelLock.lastInput >= 350)) sectionWheelLock = null;
  const current = Number.isInteger(sectionWheelLock?.aboutTarget) ? sectionWheelLock.aboutTarget : journey.currentStation;
  const stationCount = about.querySelectorAll('.studio-station').length;
  const next = current + direction;
  if (next < 0) {
    sectionWheelLock = null;
    return false;
  }
  event.preventDefault();
  releaseInitialRoute();
  clearTimeout(landingTimer);
  landingIntentAt = 0;
  landingTarget = null;
  sectionWheelLock = {
    direction,
    lastInput: now,
    until: now + (reduced ? 0 : 1100),
    aboutTarget: next,
  };
  if (next >= 0 && next < stationCount) {
    window.dispatchEvent(new CustomEvent('tva:studio-station-intent', { detail: { direction, from: current, to: next } }));
    if (root.dataset.layout === 'beam-rail') journey.gotoStation(next, reduced);
  } else if (next >= stationCount) {
    window.dispatchEvent(new CustomEvent('tva:studio-station-intent', { detail: { direction, from: current } }));
    sectionWheelLock = null;
    if (beamRail) {
      beamRail.goTo('portfolio');
      return true;
    }
    const portfolio = document.getElementById('portfolio');
    updateScene('portfolio');
    navigationUntil = performance.now() + 240;
    const landing = Math.max(0, portfolio.offsetTop - sectionOffset('portfolio'));
    window.scrollTo({ top: landing, behavior: reduced ? 'instant' : 'smooth' });
    requestAnimationFrame(journey.update);
    assertLanding(landing);
  }
  return true;
}

function consumeSectionWheelLock(event, now) {
  if (!sectionWheelLock || sectionWheelLock.direction !== Math.sign(event.deltaY)) return false;
  const lock = sectionWheelLock;
  const delta = Math.abs(event.deltaY);
  // 4px 미만의 아주 약한 입력은 관성 먼지다. 잠금이 살아 있는 한 언제 오든 삼킨다 (트랙패드 꼬리가 2초 넘게 이어져도 다음 칸으로 안 넘어가게)
  if (delta < 4) { lock.lastInput = now; event.preventDefault(); return true; }
  if (lock.startedAt === undefined) lock.startedAt = now;
  if (lock.lastDelta === undefined) lock.lastDelta = delta;
  const gap = now - lock.lastInput;
  // 한 제스처 = 한 칸. 트랙패드는 손을 뗀 뒤에도 잘게 줄어드는 관성 꼬리가 1초 넘게 들어온다.
  // 이동 중(until)이거나, 꼬리(간격이 짧고 세기가 줄어드는 중, 아주 약한 입력)면 같은 제스처로 보고 삼킨다. 상한 2.5초.
  const decaying = gap < 350 && (delta <= lock.lastDelta * 1.05 + .5 || delta < 4);
  const stillSame = now < lock.until || (decaying && now - lock.startedAt < 4000);
  if (stillSame) {
    lock.lastInput = now;
    lock.lastDelta = Math.max(delta, lock.lastDelta * .8);
    event.preventDefault();
    return true;
  }
  sectionWheelLock = null;
  return false;
}

let entryFlightFrame = 0;
const entryFlightDuration = 8400;
const ENTRY_AUTOFLIGHT = true; // 2026-09-09: one wheel tick plays the whole fall
function cancelEntryFlight() {
  cancelAnimationFrame(entryFlightFrame);
  entryFlightFrame = 0;
}
function flyToEntryPosition(target, duration = entryFlightDuration) {
  cancelEntryFlight();
  const origin = scrollY;
  const forward = target > origin;
  const started = performance.now();
  const tick = now => {
    const elapsed = Math.max(0, now - started);
    const t = Math.min(1, elapsed / duration);
    const progress = forward ? Math.pow(t, 1.15) : t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const position = origin + (target - origin) * progress;
    window.scrollTo({ top: t >= 1 ? target : position, behavior: 'instant' });
    journey.update();
    entryFlightFrame = t < 1 ? requestAnimationFrame(tick) : 0;
  };
  entryFlightFrame = requestAnimationFrame(tick);
}
for (const type of ['touchstart', 'pointerdown', 'keydown', 'resize', 'tva:navigate']) window.addEventListener(type, cancelEntryFlight, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelEntryFlight(); });

function handleEntryWheel(event, source = wheelSource(event)) {
  if (!ENTRY_AUTOFLIGHT) return false; // 2026-09-09 user direction: wheel scrubs the fall; no automatic flight
  const home = document.querySelector('#home');
  const drop = document.querySelector('#drop');
  const sofa = document.querySelector('.sofa-journey');
  if (!sofa || !drop?.classList.contains('sofa-journey-ready') || home?.dataset.powerState !== 'locked'
    || reduced || event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)
    || replaying || document.querySelector('dialog[open]') || editableInView() || wheelSourceIsEditable(source)
    || !canSettleFrom(source)) return false;
  const sofaEnd = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, drop.offsetTop + drop.offsetHeight - innerHeight));
  const direction = Math.sign(event.deltaY);
  const now = performance.now();
  if (consumeSectionWheelLock(event, now)) return true;
  const target = direction > 0 && scrollY < sofaEnd - 8 ? sofaEnd : direction < 0 && scrollY > 8 && scrollY <= sofaEnd + 8 ? 0 : null;
  if (target === null || Math.abs(target - scrollY) < 2) return false;
  event.preventDefault();
  releaseInitialRoute();
  clearTimeout(landingTimer);
  landingIntentAt = 0;
  landingTarget = null;
  // 소파에서 위로 올리면 낙하 구간을 되감지 않고 첫 화면으로 바로 간다 (2026-09-10 지시)
  if (target === 0) {
    cancelEntryFlight();
    sectionWheelLock = { direction, lastInput: now, until: now + 520 };
    window.scrollTo({ top: 0, behavior: 'instant' });
    journey.update();
    requestAnimationFrame(journey.update);
    return true;
  }
  const duration = Math.max(180, entryFlightDuration * Math.min(1, Math.abs(target - scrollY) / Math.max(1, sofaEnd)));
  sectionWheelLock = { direction, lastInput: now, until: now + duration + 100 };
  flyToEntryPosition(target, duration);
  return true;
}

function handleSectionWheel(event, source = wheelSource(event)) {
  // 4px 미만의 약한 입력(관성 먼지)으로는 구역 이동을 시작하지 않고, 페이지도 밀리지 않게 한다.
  // (사진 구역 안에서는 이 함수의 false 가 곧 '페이지를 그만큼 밀어라'는 뜻이라 true 로 막는다)
  if (Math.abs(event.deltaY) < 4 && event.deltaMode === 0) return false;
  if (event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)
    || replaying
    || document.querySelector('dialog[open]') || editableInView() || wheelSourceIsEditable(source)) return false;
  const now = performance.now();
  // 이동하는 동안에는 남은 관성을 가장 먼저 삼켜야 한다. 이 검사가 뒤에 있으면
  // 화면을 옮기는 중(navigationUntil)에 관성이 새어 나가 착지 지점이 밀린다.
  if (consumeSectionWheelLock(event, now)) return true;
  if (!canSettleFrom(source)) return false;
  if (handleEntryBoundaryWheel(event, source)) return true;
  if (handleAboutStationWheel(event, source)) return true;
  const direction = Math.sign(event.deltaY);
  sectionWheelLock = null;
  const stops = landingSections.map(section => ({
    section,
    top: Math.min(document.documentElement.scrollHeight - innerHeight, Math.max(0, section.offsetTop - sectionOffset(section.id))),
    bottom: Math.min(document.documentElement.scrollHeight - innerHeight, Math.max(0, section.offsetTop + section.offsetHeight - innerHeight)),
  }));
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
  let index = stops.findLastIndex(stop => scrollY >= stop.top - 8);
  if (direction < 0 && stops[index]?.section.id === 'portfolio' && scrollY <= stops[index].top + 20) {
    event.preventDefault();
    releaseInitialRoute();
    clearTimeout(landingTimer);
    landingIntentAt = 0;
    landingTarget = null;
    sectionWheelLock = { direction, lastInput: now, until: now + (reduced ? 0 : 650) };
    journey.gotoStation(document.querySelectorAll('#about .studio-station').length - 1);
    return true;
  }
  let destination = null;
  if (index < 0) {
    if (direction > 0 && scrollY + delta >= stops[0].top - 8) destination = stops[0].top;
  } else {
    const { section, top, bottom } = stops[index];
    // 화면보다 조금만 큰 구역(예: 871px vs 746px)까지 '긴 페이지'로 보면 중간에 한 번 더 멈춰
    // 한 구역에 두 번 움직이는 것처럼 보인다. 확실히 긴 구역만 내부 단계를 둔다.
    const longPage = section.offsetHeight > innerHeight * 1.35;
    if (longPage && direction > 0 && scrollY < bottom - 8) destination = Math.min(bottom, scrollY + innerHeight);
    else if (longPage && direction < 0 && scrollY > top + 8) destination = Math.max(top, scrollY - innerHeight);
    else if (direction > 0) destination = stops[index + 1]?.top ?? null;
    else if (scrollY > top + 20) destination = top;
    else if (index > 0) {
      const previous = stops[index - 1];
      destination = previous.section.offsetHeight > innerHeight * 1.35 ? previous.bottom : previous.top;
    }
    else {
      const previous = document.querySelector('#about');
      destination = Math.max(0, previous.offsetTop + previous.offsetHeight - innerHeight);
    }
  }
  if (destination === null || Math.abs(destination - scrollY) < 2) return false;
  event.preventDefault();
  releaseInitialRoute();
  clearTimeout(landingTimer);
  landingIntentAt = 0;
  landingTarget = null;
  sectionWheelLock = { direction, lastInput: now, until: now + (reduced ? 0 : 650) };
  window.scrollTo({ top: destination, behavior: reduced ? 'instant' : 'smooth' });
  assertLanding(destination);
  return true;
}

function rememberLandingIntent(event) {
  if (event.isTrusted) releaseInitialRoute();
  if (event.isTrusted && canSettleFrom(event.target)) landingIntentAt = performance.now();
  if (landingTarget !== null) {
    window.scrollTo({ top: scrollY, behavior: 'instant' });
    landingTarget = null;
  }
}

function settleSection() {
  clearTimeout(landingTimer);
  if (atPageBottom()) {
    landingTarget = null;
    return;
  }
  if (landingTarget !== null && Math.abs(scrollY - landingTarget) < 3) {
    landingTarget = null;
    return;
  }
  if (landingTarget !== null || performance.now() - landingIntentAt > 520 || !canSettleFrom(document.activeElement)) return;
  const nearest = landingSections.reduce((candidate, section) => {
    const top = Math.max(0, section.offsetTop - sectionOffset(section.id));
    return Math.abs(scrollY - top) < Math.abs(scrollY - candidate.top) ? { section, top } : candidate;
  }, { section: null, top: Infinity });
  const band = Math.min(112, innerHeight * 0.16);
  if (!nearest.section || Math.abs(scrollY - nearest.top) < 3 || Math.abs(scrollY - nearest.top) > band) return;
  landingTarget = nearest.top;
  window.scrollTo({ top: nearest.top, behavior: reduced ? 'instant' : 'smooth' });
}

function scheduleSettle() {
  const atBottom = atPageBottom();
  if (atBottom && !bottomSince) bottomSince = performance.now();
  if (!atBottom) {
    bottomSince = 0;
    resetWheelReplayArm();
  }
  clearTimeout(landingTimer);
  if (landingIntentAt) landingTimer = window.setTimeout(settleSection, 160);
  if (atBottom) scheduleWheelReplayArm();
}

window.addEventListener('scroll', scheduleSettle, { passive: true });
window.addEventListener('scrollend', scheduleSettle);
window.addEventListener('wheel', event => {
  if (event.isTrusted) cancelViewRestore(); // 스스로 굴렸으면 크기변경 되돌리기는 그만둔다
  if (beamRail?.handleWheel(event)) return;
  if (replaying) {
    event.preventDefault();
    return;
  }
  if (homeHoldUntil > performance.now() && event.deltaY && !event.ctrlKey) {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'instant' });
    return;
  }
  // 화면을 옮기는 중이면 어떤 상태보다 먼저 잠금을 본다 (관성이 부드러운 이동을 취소하지 못하게)
  if (consumeSectionWheelLock(event, performance.now())) return;
  if (handleEntryWheel(event)) return;
  if (handleSectionWheel(event)) return;
  rememberLandingIntent(event);
  const now = performance.now();
  const newGesture = now - lastWheel > 240;
  lastWheel = now;
  if (event.deltaY > 5 && newGesture && wheelReplayArmed && bottomReady()) {
    event.preventDefault();
    resetWheelReplayArm();
    replay();
    return;
  }
  if (atPageBottom()) scheduleWheelReplayArm(true);
}, { passive: false });
window.addEventListener('touchstart', event => {
  if (event.isTrusted) cancelViewRestore();
  touchActive = true;
  rememberLandingIntent(event);
  touchStart = bottomReady() ? event.touches[0].clientY : null;
}, { passive: true });
window.addEventListener('touchcancel', () => { touchActive = false; }, { passive: true });
window.addEventListener('touchmove', event => {
  rememberLandingIntent(event);
  if (touchStart !== null) event.preventDefault();
}, { passive: false });
window.addEventListener('touchend', event => {
  touchActive = false;
  if (touchStart !== null && touchStart - event.changedTouches[0].clientY > 64) {
    event.preventDefault();
    replay();
  }
  touchStart = null;
}, { passive: false });
window.addEventListener('keydown', event => {
  if (event.isTrusted) { releaseInitialRoute(); cancelViewRestore(); }
  if (editableInView()) return;
  if (['ArrowDown', 'PageDown', ' '].includes(event.key) && bottomReady() && replayAllowed() && !event.repeat) {
    event.preventDefault();
    replay();
  }
});
