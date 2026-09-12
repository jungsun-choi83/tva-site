// 상단 선반 바: 마스코트가 지금 보고 있는 구역의 메뉴 아래에 서 있고, 스크롤하면 걸어서 따라간다.
// 포즈와 발 위치 값은 assets/mascot/manifest.json 원본을 그대로 옮긴 것이다.
const BASE = 'assets/goya/';
const POSES = {
  run1: { f: 'walk1.png?v=eternal-beam-r18', fx: .52, fy: .92, top: .06, bot: .94 },
  run2: { f: 'walk2.png?v=eternal-beam-r18', fx: .50, fy: .92, top: .06, bot: .94 },
  run3: { f: 'walk1.png?v=eternal-beam-r18', fx: .52, fy: .92, top: .06, bot: .94 },
  run4: { f: 'walk2.png?v=eternal-beam-r18', fx: .50, fy: .92, top: .06, bot: .94 },
  run5: { f: 'walk1.png?v=eternal-beam-r18', fx: .52, fy: .92, top: .06, bot: .94 },
  run6: { f: 'walk2.png?v=eternal-beam-r18', fx: .50, fy: .92, top: .06, bot: .94 },
  brake1: { f: 'idle.png?v=eternal-beam-r18', fx: .50, fy: .94, top: .05, bot: .96 },
  brake2: { f: 'sit.png?v=eternal-beam-r18', fx: .50, fy: .94, top: .05, bot: .96 },
  idle: { f: 'idle.png?v=eternal-beam-r18', fx: .50, fy: .94, top: .05, bot: .96 },
  wave: { f: 'idle.png?v=eternal-beam-r18', fx: .50, fy: .94, top: .05, bot: .96 },
};
const RUN = ['run1', 'run2', 'run3', 'run4', 'run5', 'run6'];
// 감사 #7·#102: 멈춘 뒤 브레이크·인사 동작을 보여 주는 시간(ms). 이 시간이 지나면 루프를 재운다.
const IDLE_HOLD = 2600;

export function initNavShelf(nav) {
  if (!nav) return;
  const links = [...nav.querySelectorAll('nav a')];
  if (!links.length) return;
  const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (sections.length !== links.length) return;
  // 감사 #55·#99: 메뉴에 대응 링크가 없는 구역(ONLY TVA·ENDING). 여기 있는 동안은 어떤 메뉴도 '현재'로 표시하지 않는다.
  const linkless = ['only-tva', 'ending'].map(id => document.getElementById(id)).filter(Boolean);
  const iLeftRest = Math.max(0, links.findIndex(a => (a.getAttribute('href') || '') === '#original'));
  const iRightRest = links.findIndex(a => (a.getAttribute('href') || '') === '#contact') >= 0
    ? links.findIndex(a => (a.getAttribute('href') || '') === '#contact') : links.length - 1;

  // 2026-09-10 사장님 지시: 파란 진행선은 뺀다 (캐릭터 위치만으로 충분)
  const puffs = [0, 1].map(() => {
    const p = document.createElement('span');
    p.className = 'nav-puff';
    p.setAttribute('aria-hidden', 'true');
    nav.appendChild(p);
    return p;
  });
  const mascot = new Image();
  mascot.className = 'nav-mascot';
  mascot.alt = '';
  mascot.setAttribute('aria-hidden', 'true');
  // 감사 #119: 그림이 끊기면 깨진-이미지 흰 상자 대신 자리를 비운다 (장식용이라 없어도 뜻이 사라지지 않는다)
  // 클래스는 값이 바뀔 때만 건드린다 (classList 를 그냥 호출하면 값이 같아도 속성이 다시 쓰여 루프가 깨어난다)
  const markBroken = on => { if (nav.classList.contains('has-broken-mascot') !== on) nav.classList.toggle('has-broken-mascot', on); };
  mascot.addEventListener('error', () => { mascot.style.visibility = 'hidden'; markBroken(true); });
  mascot.addEventListener('load', () => { mascot.style.visibility = ''; markBroken(false); });
  nav.append(mascot);
  Object.values(POSES).forEach(p => { const i = new Image(); i.src = BASE + p.f; });

  // ── 한 번 깨어날 때 한 번만 재는 값들 (예전에는 매 프레임 getComputedStyle·getBoundingClientRect 를 읽었다)
  let bodyH = 0, navLeft = 0, navW = 0, centers = null, edges = null;
  function measure() {
    bodyH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--shelf-body')) || (innerWidth <= 760 ? 38 : 48);
    const nr = nav.getBoundingClientRect();
    navLeft = nr.left; navW = nr.width;
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
  // 서 있는 포즈일 때 캐릭터가 가로로 차지하는 폭
  const restWidth = () => (bodyH || (innerWidth <= 760 ? 48 : 60)) / (POSES.idle.bot - POSES.idle.top);
  function place(pose, x, dir, lift, squash) {
    const p = POSES[pose] || POSES.idle;
    if (!Number.isFinite(x)) return;
    if (!bodyH) measure();
    const size = bodyH / (p.bot - p.top);
    if (mascot.dataset.pose !== pose) { mascot.src = BASE + p.f; mascot.dataset.pose = pose; }
    mascot.style.width = mascot.style.height = size + 'px';
    mascot.style.left = (x - p.fx * size) + 'px';
    mascot.style.bottom = (2 - (1 - p.fy) * size - lift) + 'px';
    mascot.style.transformOrigin = `${p.fx * 100}% ${p.fy * 100}%`;
    mascot.style.setProperty('--nav-dir', dir);   // 서 있을 때 CSS 숨쉬기가 좌우 반전을 이어받는다
    mascot.style.transform = `scaleX(${dir}) scale(${1 + squash * .5},${1 - squash})`;
  }
  function puff(px) {
    const el = puffs[(Math.random() * 2) | 0];
    el.style.left = px + 'px';
    el.animate([{ opacity: .45, transform: 'scale(.6) translateY(0)' }, { opacity: 0, transform: 'scale(1.9) translateY(-7px)' }], { duration: 420, easing: 'ease-out' });
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
  function targetX(i) {
    if (!centers) measure();
    return Number.isFinite(centers[i]) ? centers[i] : 0;
  }
  // 메뉴에 없는 구역에서 캐릭터가 서는 자리 = ORIGINAL 과 CONTACT 글자 사이 빈칸
  // 감사 [17]: 휴대폰 세로에서는 그 빈칸이 11px 뿐이라 캐릭터(57px)가 두 메뉴 이름을 한꺼번에 덮었다.
  //            빈칸이 캐릭터보다 좁으면 선반 오른쪽 밖으로 걸어 나가 이름을 비켜 준다(바가 overflow:hidden 이라 잘린다).
  const restX = () => {
    if (!centers) measure();
    const a = edges && edges[iLeftRest], b = edges && edges[iRightRest];
    if (!a || !b) return (targetX(iLeftRest) + targetX(iRightRest)) / 2;
    const w = restWidth();
    const l = Math.min(a.tr, b.tl), r = Math.max(a.tr, b.tl);
    if (r - l >= w) return (l + r) / 2 + (POSES.idle.fx - .5) * w;   // 빈칸 한가운데에 캐릭터 상자를 맞춘다
    return navW + w;                                                  // 좁으면 선반 밖에서 기다린다
  };

  // 감사 [56]: 마지막 'See you again' 구역에서 바를 접는 판단은 app.js 로 옮겼다.
  // 같은 바를 세 파일이 따로 켜고 꺼서 서로 어긋나던 것을 주인 하나(app.js applyNav)로 모은 것이다.
  // 여기서는 접힘 여부를 '읽기만' 한다.
  let x = null, dir = 1, phase = 0, stopped = 0, waveAt = 0, current = -2, last = performance.now();
  let running = false, parked = false, needIndex = true, lastY = -1, awakeUntil = 0;
  const rmq = matchMedia('(prefers-reduced-motion:reduce)');
  const reduced = () => document.documentElement.classList.contains('reduced-motion') || rmq.matches;
  // 바가 실제로 눈에 보이는 상태인가 — 클래스만 보므로 레이아웃을 건드리지 않는다
  // is-away 는 이제 아무도 붙이지 않는다(감사 [56], 접힘 판단은 app.js applyNav 소관). 혹시 다시 붙는 날을 대비해 읽기만 남겨 둔다.
  const navShown = () => !document.hidden && nav.classList.contains('is-visible') && !nav.classList.contains('is-away') && !reduced();

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
    if (!navShown()) {
      // 바가 안 보이는 동안은 그림을 그리지 않는다. 자리만 맞춰 두어 다시 나타날 때 제자리에 서 있게 한다.
      x = t;
      return awake;
    }
    if (x === null) x = t;
    const dx = t - x, speed = Math.abs(dx);
    x += dx * Math.min(1, dt / 1000 * 5.5);
    if (speed > 2) {
      dir = dx > 0 ? 1 : -1;
      const stride = Math.min(.028, .006 + speed * .00022);
      const before = Math.floor(phase);
      phase = (Number.isFinite(phase) ? phase : 0) + dt * stride;
      const fi = ((Math.floor(phase) % RUN.length) + RUN.length) % RUN.length;
      place(RUN[fi], x, dir, Math.abs(Math.sin(phase * Math.PI)) * 2.5, 0);
      if (Math.floor(phase) !== before && speed > 14) puff(x - 6);
      stopped = 0;
      awake = true;
    } else {
      stopped += dt;
      if (stopped < 150) place('brake1', x, dir, 0, .06);
      else if (stopped < 300) place('brake2', x, dir, 0, 0);
      else {
        // 가만히 있어도 살아 있게: 숨쉬기 + 발끝 까딱 + 5초마다 두 컷짜리 손 흔들기
        if (now - waveAt > 5200) waveAt = now;
        const w = now - waveAt;
        if (w < 1600) place(Math.floor(w / 170) % 2 ? 'wave' : 'idle', x, dir, 1.6 + Math.sin(w / 120) * 1.4, 0);
        else {
          const ts = (now - waveAt - 1600) / 1000;
          const tap = ts % 2.6 < .34 ? Math.abs(Math.sin((ts % 2.6) / .34 * Math.PI)) * 2.2 : 0;
          place('idle', x, dir, Math.sin(now / 700) * 1.6 + tap, 0);
        }
      }
      if (stopped < IDLE_HOLD) awake = true;   // 인사까지 마치면 잠든다
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
    if (x !== null) place('idle', x, dir, 0, 0);   // 어정쩡한 중간 포즈로 굳지 않게 한 번 정리한다
    // 숨쉬기는 CSS 가 이어받는다. 다만 바가 안 보일 때는 그것조차 걸지 않는다(안 보이는 화면에서 60fps 스타일 재계산이 붙는다).
    // 감사 [17]: 선반 밖에 서 있을 때도 마찬가지다(보이지 않는데 숨쉬기만 돈다).
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
  function greet() { stopped = 400; waveAt = performance.now(); poke(2400); }

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
