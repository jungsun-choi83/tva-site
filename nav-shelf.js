// 상단 선반 바: 우주복 고야가 유영하며, 스크롤하면 옆으로 미끄러진다.
const BASE = 'assets/goya/';
const FACE = {
  f: 'eb-astro-goya.png?v=eb-20260914bb',
  fx: .50, fy: .98, top: 0, bot: 1,
};
const IDLE_HOLD = 400;

export function initNavShelf(nav) {
  if (!nav) return;
  const links = [...nav.querySelectorAll('nav a')];
  if (!links.length) return;
  const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (sections.length !== links.length) return;
  const linkless = [];
  const iLeftRest = Math.max(0, links.findIndex(a => (a.getAttribute('href') || '') === '#original'));
  const iRightRest = links.findIndex(a => (a.getAttribute('href') || '') === '#contact') >= 0
    ? links.findIndex(a => (a.getAttribute('href') || '') === '#contact') : links.length - 1;

  const mascot = new Image();
  mascot.className = 'nav-mascot';
  mascot.alt = '';
  mascot.setAttribute('aria-hidden', 'true');
  mascot.decoding = 'async';
  mascot.src = BASE + FACE.f;
  mascot.addEventListener('error', () => { mascot.style.visibility = 'hidden'; });
  mascot.addEventListener('load', () => { mascot.style.visibility = ''; centers = null; poke(400); });
  nav.append(mascot);

  // ── 한 번 깨어날 때 한 번만 재는 값들 (예전에는 매 프레임 getComputedStyle·getBoundingClientRect 를 읽었다)
  let bodyH = 0, navLeft = 0, navW = 0, centers = null, edges = null, listLeft = 0, langLeft = 0;
  const list = nav.querySelector('nav');
  const lang = nav.querySelector('.lang-switch');
  function measure() {
    bodyH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--shelf-face')) || (innerWidth <= 760 ? 40 : 58);
    const nr = nav.getBoundingClientRect();
    navLeft = nr.left; navW = nr.width;
    // 메뉴 목록이 시작하는 자리. 첫 메뉴 왼쪽의 '빈칸'은 여기까지다 — 그 앞은 로고 자리다.
    listLeft = (list ? list.getBoundingClientRect().left : nr.left) - navLeft;
    langLeft = lang ? Math.max(0, lang.getBoundingClientRect().left - navLeft - 10) : navW;
    // 감사 [17]: 상자 끝(l·r)뿐 아니라 글자 끝(tl·tr = 좌우 여백을 뺀 자리)도 같이 잰다. 쉬는 자리를 정할 때 쓴다.
    edges = links.map(a => {
      const r = a.getBoundingClientRect(), cs = getComputedStyle(a);
      return {
        l: r.left - navLeft, r: r.right - navLeft,
        tl: r.left - navLeft + (parseFloat(cs.paddingLeft) || 0),
        tr: r.right - navLeft - (parseFloat(cs.paddingRight) || 0),
      };
    });
    centers = edges.map(e => (e.l + e.r) / 2);
  }
  const restWidth = () => {
    const h = bodyH || (innerWidth <= 760 ? 40 : 58);
    const aspect = mascot.naturalWidth && mascot.naturalHeight ? mascot.naturalWidth / mascot.naturalHeight : .78;
    return h * aspect / (FACE.bot - FACE.top);
  };
  // 빈칸이 캐릭터보다 좁으면 그 칸에 맞게 줄여서 세운다. 이 배율보다 더 줄여야 하면 서지 않는다.
  const MIN_FIT = .58;
  let fit = 1;
  // 선반에 캐릭터가 설 빈칸이 아예 없는 상태(휴대폰 세로). 예전에는 선반 밖으로 걸어 나가
  // '보이지 않는 채로' 계속 그려졌다 — 그림(1MB)을 받고 프레임도 돌면서 화면에는 없었다.
  let noRoom = false;
  const slotFit = (gap, w) => (gap >= w ? 1 : (gap / w >= MIN_FIT ? gap / w : 0));
  function place(x, lift = 0, now = performance.now(), heading = 0) {
    if (!Number.isFinite(x)) return;
    if (!bodyH) measure();
    const h = bodyH * fit / (FACE.bot - FACE.top);
    const aspect = mascot.naturalWidth && mascot.naturalHeight ? mascot.naturalWidth / mascot.naturalHeight : .78;
    const w = h * aspect;
    const drift = Math.sin(now / 430) * 2;
    const roll = (heading === 0 ? 0 : heading > 0 ? 10 : -10) + Math.sin(now / 620) * 8;
    const flip = heading < 0 ? ' scaleX(-1)' : '';
    mascot.style.height = h + 'px';
    mascot.style.width = w + 'px';
    mascot.style.left = (x - FACE.fx * w) + 'px';
    mascot.style.bottom = (2 + lift) + 'px';
    mascot.style.transformOrigin = `${FACE.fx * 100}% ${FACE.fy * 100}%`;
    mascot.style.transform = `translateY(${(-5 - drift).toFixed(1)}px) rotate(${roll.toFixed(1)}deg)${flip}`;
  }
  function currentIndex() {
    // 사이트가 알려주는 현재 구역(aria-current)이 있으면 그것을 따른다.
    // 이 사이트는 구역을 건너뛰며 이동하므로 화면 위치만으로는 못 따라간다.
    const marked = links.findIndex(a => a.hasAttribute('aria-current'));
    if (marked >= 0) return marked;
    const line = innerHeight * .38;
    // 감사 #55·#99: 메뉴에 없는 구역이 화면을 차지하면 -1 (직전 메뉴를 그대로 켜 두지 않는다)
    for (const s of linkless) {
      const r = s.getBoundingClientRect();
      if (r.top <= line && r.bottom > innerHeight * .2) return -1;
    }
    let idx = 0;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) idx = i; });
    return idx;
  }
  // 캐릭터가 설 자리 = 지금 보고 있는 메뉴 '옆'의 빈칸.
  // 예전에는 메뉴 글자 한가운데(centers[i])에 세우고 그 글자를 color:transparent 로 지웠다.
  // 그 결과 지금 보고 있는 칸의 이름이 화면에서 통째로 사라져, 메뉴가 세 개로 보였다.
  // 이제 글자는 그대로 두고, 글자 끝(tl·tr)에서 시작하는 빈칸에 캐릭터를 세운다.
  // 오른쪽 빈칸을 먼저 보고, 좁으면 왼쪽 빈칸, 둘 다 좁으면 선반 밖에서 기다린다(휴대폰).
  function targetX(i) {
    if (!centers) measure();
    const here = edges && edges[i];
    if (!here) { fit = 1; return Number.isFinite(centers[i]) ? centers[i] : 0; }
    const w = restWidth();
    const next = edges[i + 1], prev = edges[i - 1];
    const rightEdge = next ? next.tl : langLeft;
    // CONTACT 오른쪽은 한영 버튼이다. 그 칸에 세우지 않고, 메뉴 사이(왼쪽)를 먼저 쓴다.
    const slots = i === links.length - 1
      ? [[prev ? prev.tr : listLeft, here.tl], [here.tr, rightEdge]]
      : [[here.tr, rightEdge], [prev ? prev.tr : listLeft, here.tl]];
    for (const [l, r] of slots) {
      const f = slotFit(r - l, w);
      if (f) { fit = f; noRoom = false; return (l + r) / 2 + (FACE.fx - .5) * w * f; }
    }
    fit = 1;
    noRoom = true;
    return navW + w;
  }
  // 메뉴에 없는 구역에서 캐릭터가 서는 자리 = ORIGINAL 과 CONTACT 글자 사이 빈칸
  // 감사 [17]: 휴대폰 세로에서는 그 빈칸이 11px 뿐이라 캐릭터(57px)가 두 메뉴 이름을 한꺼번에 덮었다.
  //            빈칸이 캐릭터보다 좁으면 선반 오른쪽 밖으로 걸어 나가 이름을 비켜 준다(바가 overflow:hidden 이라 잘린다).
  const restX = () => {
    fit = 1;
    if (!centers) measure();
    const a = edges && edges[iLeftRest], b = edges && edges[iRightRest];
    if (!a || !b) return (targetX(iLeftRest) + targetX(iRightRest)) / 2;
    const w = restWidth();
    const l = Math.min(a.tr, b.tl), r = Math.max(a.tr, b.tl);
    if (r - l >= w) { noRoom = false; return (l + r) / 2 + (FACE.fx - .5) * w; }
    noRoom = true;
    return navW + w;                                                  // 좁으면 선반 밖에서 기다린다
  };

  // 감사 [56]: 마지막 'See you again' 구역에서 바를 접는 판단은 app.js 로 옮겼다.
  // 같은 바를 세 파일이 따로 켜고 꺼서 서로 어긋나던 것을 주인 하나(app.js applyNav)로 모은 것이다.
  // 여기서는 접힘 여부를 '읽기만' 한다.
  let x = null, stopped = 0, current = -2, last = performance.now();
  let running = false, parked = false, needIndex = true, lastY = -1, awakeUntil = 0;
  const rmq = matchMedia('(prefers-reduced-motion:reduce)');
  const reduced = () => document.documentElement.classList.contains('reduced-motion') || rmq.matches;
  // 바가 실제로 눈에 보이는 상태인가 — 클래스만 보므로 레이아웃을 건드리지 않는다
  // is-away 는 이제 아무도 붙이지 않는다(감사 [56], 접힘 판단은 app.js applyNav 소관). 혹시 다시 붙는 날을 대비해 읽기만 남겨 둔다.
  const navShown = () => !document.hidden && nav.classList.contains('is-visible') && !nav.classList.contains('is-away') && !reduced() && !noRoom;

  function step(now) {
    const dt = Math.max(0, Math.min(64, now - last)); last = now;
    const y = scrollY;
    if (y !== lastY || needIndex) {      // 스크롤이 없으면 구역 판정·바 접힘 판정을 다시 하지 않는다
      lastY = y; needIndex = false;
      const idx = currentIndex();
      if (idx !== current) { current = idx; links.forEach((a, i) => a.classList.toggle('is-here', i === idx)); }
    }
    let awake = now < awakeUntil;
    const t = current < 0 ? restX() : targetX(current);
    // targetX·restX 가 noRoom 을 갱신한 뒤에 판단한다
    if (mascot.classList.contains('is-noroom') !== noRoom) mascot.classList.toggle('is-noroom', noRoom);
    if (!navShown()) {
      // 바가 안 보이는 동안은 그림을 그리지 않는다. 자리만 맞춰 두어 다시 나타날 때 제자리에 서 있게 한다.
      x = t;
      return awake;
    }
    if (x === null) x = t;
    const dx = t - x, speed = Math.abs(dx);
    x += dx * Math.min(1, dt / 1000 * 4.2);
    if (speed > 2) {
      place(x, Math.abs(Math.sin(now / 180)) * 2.4, now, dx > 0 ? 1 : -1);
      stopped = 0;
      awake = true;
    } else {
      stopped += dt;
      place(x, 0, now, 0);
      if (stopped < IDLE_HOLD) awake = true;
    }
    return awake;
  }
  function frame(now) {
    let awake = false;
    try { awake = step(now); } catch (e) { console.warn('[nav-shelf]', e && e.message); }
    if (awake && !document.hidden) { requestAnimationFrame(frame); return; }
    running = false;
    park();
  }
  function park() {
    if (parked) return;
    parked = true;
    if (x !== null) place(x, 0);
    mascot.style.transform = '';
    if (navShown() && x !== null && x - restWidth() < navW) mascot.classList.add('is-parked');
  }
  function start() {
    needIndex = true;
    if (parked) { parked = false; mascot.classList.remove('is-parked'); }
    if (running) return;
    running = true;
    measure();
    last = performance.now();
    requestAnimationFrame(frame);
  }
  // ms 만큼 더 깨어 있게 하고 루프를 돌린다
  function poke(ms) { awakeUntil = Math.max(awakeUntil, performance.now() + ms); start(); }
  // 바에 마우스를 올리거나 키보드 초점이 들어오면 캐릭터가 다시 인사한다
  function greet() { poke(1200); }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) poke(600); });
  addEventListener('scroll', () => poke(300), { passive: true });
  addEventListener('resize', () => { x = null; centers = null; bodyH = 0; poke(600); }, { passive: true });
  new MutationObserver(() => poke(600)).observe(nav, { attributes: true, attributeFilter: ['class'] });
  const linkWatch = new MutationObserver(() => poke(900));
  links.forEach(a => linkWatch.observe(a, { attributes: true, attributeFilter: ['aria-current'] }));
  addEventListener('hashchange', () => poke(900));
  addEventListener('tva:navigate', () => poke(900));
  addEventListener('tva:motion', () => { centers = null; bodyH = 0; poke(900); });
  rmq.addEventListener('change', () => { centers = null; bodyH = 0; poke(900); });
  nav.addEventListener('pointermove', () => poke(1200), { passive: true });
  nav.addEventListener('pointerenter', greet);
  nav.addEventListener('focusin', greet);
  addEventListener('load', () => { centers = null; poke(600); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { centers = null; poke(600); });
  poke(1200);
}
