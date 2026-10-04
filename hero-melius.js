const GOYA_V = 'eb-20261004j';
const PET_PHOTOS = [
  `assets/hero/goya-orbit/goya-01.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/goya-02.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/goya-03.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/goya-04.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/goya-05.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/goya-06.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/goya-07.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/goya-08.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/goya-09.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/goya-10.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/goya-11.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/goya-12.webp?v=${GOYA_V}`,
];

const DEVICE_FALLBACK = 'assets/hero/beam-device-melius-front-cut.png?v=eb-20260919a';

function wrapMeliusGoldLines(home) {
  home?.querySelectorAll('[data-melius-gold-line]').forEach((gold) => {
    const raw = gold.textContent || '';
    gold.textContent = '';
    [...raw].forEach((ch) => {
      const span = document.createElement('span');
      span.className = 'eb-melius-gold-char';
      if (ch === ' ') span.classList.add('is-space');
      if (ch === '\n') return;
      span.textContent = ch;
      gold.appendChild(span);
    });
  });
}

function cardMarkup(src, eager) {
  const load = eager ? 'eager' : 'lazy';
  const pri = eager ? ' fetchpriority="high"' : '';
  return `<article class="eb-melius-card"><span class="eb-melius-card__shot"><img src="${src}" width="720" height="960" alt="" loading="${load}" decoding="async"${pri}></span></article>`;
}

/** Existing Melius depth character, adapted to an elliptical path. */
function coverFlow(norm, spreadMul = 1, depth = 0, mobile = false) {
  const n = norm / spreadMul;
  const t = Math.min(1, Math.abs(n));
  const sign = n < 0 ? -1 : 1;
  const front = (depth + 1) * 0.5;
  const scale = (mobile ? 0.82 : 0.86) + front * (mobile ? 0.16 : 0.2);
  const rotateY = -sign * (mobile ? 4 + t * 16 : 5 + t * 22);
  const tz = (front - 0.5) * (mobile ? 48 : 90);
  const opacity = 0.78 + front * 0.22;
  return { scale, rotateY, tz, z: Math.round(10 + front * 70), opacity };
}

/** Center on hub line; edges dip slightly (not a bowl under the device). */
function meliusArcLift(norm, trackHeight) {
  const t = Math.min(1.12, Math.abs(norm));
  const amp = Math.min(Math.max(trackHeight * 0.12, 24), 56);
  return amp * t * t;
}

function hubRailAlignY(heroEl, stageEl) {
  const dev = heroEl.querySelector('.eb-melius-hub__device');
  const stageR = stageEl.getBoundingClientRect();
  if (!dev || stageR.height < 48) return 0;
  const devR = dev.getBoundingClientRect();
  const targetY = devR.top + devR.height * 0.36;
  const railAnchorY = stageR.top + stageR.height * 0.5;
  return targetY - railAnchorY;
}

export function initHeroMelius(isReduced) {
  const hero = document.querySelector('#home');
  const root = document.documentElement;
  const home = hero?.querySelector('.eb-melius-home');
  const stage = hero?.querySelector('.eb-melius-stage');
  const rail = hero?.querySelector('.eb-melius-rail');
  const hubImg = hero?.querySelector('.eb-melius-hub__device');
  if (!hero || !home || !stage || !rail) return;

  wrapMeliusGoldLines(home);
  window.addEventListener('eb:lang', () => wrapMeliusGoldLines(home));

  if (hubImg) {
    hubImg.addEventListener(
      'error',
      () => {
        hubImg.src = DEVICE_FALLBACK;
      },
      { once: true },
    );
  }

  const sequence = PET_PHOTOS;
  rail.innerHTML = sequence.map((src, i) => cardMarkup(src, i < 10)).join('');

  let offset = 0;
  let velocity = 1.62;
  const baseVelocity = 1.62;
  let flowSpread = 1;
  let loopWidth = 0;
  let raf = 0;
  let running = false;
  let last = 0;
  let focusUntil = 0;

  function applyRailTransform() {
    rail.style.transform = 'none';
  }

  function measureLoop() {
    const cards = rail.querySelectorAll('.eb-melius-card');
    loopWidth = Math.max(1, cards.length * 116);
  }

  function paintCards() {
    const rect = stage.getBoundingClientRect();
    const cards = [...rail.querySelectorAll('.eb-melius-card')];
    const mobile = rect.width <= 720;
    const visibleCount = cards.length;
    const radiusX = rect.width * (mobile ? 0.46 : 0.49);
    const radiusY = rect.height * (mobile ? 0.44 : 0.47);
    const phase = (offset / loopWidth) * Math.PI * 2;
    const focusing = performance.now() < focusUntil;
    home.classList.toggle('is-orbit-focus', focusing);
    let focusIndex = 0;
    let focusDepth = -2;

    cards.forEach((card, index) => {
      card.style.display = '';
      const angle = (index / visibleCount) * Math.PI * 2 + phase - Math.PI / 2;
      const x = Math.cos(angle) * radiusX;
      const y = Math.sin(angle) * radiusY;
      const depth = Math.sin(angle);
      const norm = Math.cos(angle);
      if (depth > focusDepth) {
        focusDepth = depth;
        focusIndex = index;
      }
      const { scale, rotateY, tz, z, opacity } = coverFlow(norm, flowSpread, depth, mobile);
      const rotateZ = norm * (mobile ? -2.2 : -3.5);
      const transform = [
        `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${tz.toFixed(1)}px)`,
        `rotateY(${rotateY.toFixed(2)}deg)`,
        `rotateZ(${rotateZ.toFixed(2)}deg)`,
        `scale(${scale.toFixed(3)})`,
      ].join(' ');
      card.style.zIndex = String(z);
      card.style.opacity = String(opacity);
      card.style.transform = transform;
      card.style.setProperty('--orbit-transform', transform);
      card.style.setProperty('--orbit-opacity', String(opacity));
      card.style.setProperty('--goya-delay', `${(index % 12) * -0.85}s`);
    });

    cards.forEach((card, index) => {
      const live = focusing && index === focusIndex;
      card.classList.toggle('is-dim', focusing && !live);
      card.classList.toggle('is-live', live);
    });
  }

  function tick(now) {
    if (!running) return;
    if (!last) last = now;
    const dt = Math.min(32, now - last);
    last = now;
    offset += velocity * (dt / 16.67);
    if (loopWidth > 0) {
      while (offset >= loopWidth) offset -= loopWidth;
    }
    velocity += (baseVelocity - velocity) * 0.032;
    flowSpread += (1 - flowSpread) * 0.045;
    applyRailTransform();
    paintCards();
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    measureLoop();
    offset = loopWidth * 0.33;
    applyRailTransform();
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    last = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function nudgeMotion(delta) {
    if (!delta) return;
    const push = Math.abs(delta);
    focusUntil = performance.now() + 780;
    velocity = Math.max(0.65, Math.min(6.8, velocity + delta * 0.0062));
    flowSpread = Math.min(1.42, flowSpread + push * 0.0021);
    offset += delta * 0.32;
    if (loopWidth > 0) {
      while (offset >= loopWidth) offset -= loopWidth;
      while (offset < 0) offset += loopWidth;
    }
  }

  function onWheel(event) {
    if (hero.dataset.powerState !== 'locked') return;
    const rect = hero.getBoundingClientRect();
    if (rect.bottom < innerHeight * 0.15 || rect.top > innerHeight * 0.4) return;
    nudgeMotion(event.deltaY || event.deltaX);
  }

  const syncUi = () => {
    const on = hero.dataset.powerState === 'locked';
    root.dataset.heroUi = on ? 'melius' : '';
    home.setAttribute('aria-hidden', on ? 'false' : 'true');
    stage.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (on) {
      measureLoop();
      start();
    } else stop();
  };

  syncUi();
  new MutationObserver(syncUi).observe(hero, { attributes: true, attributeFilter: ['data-power-state'] });
  window.addEventListener('resize', () => {
    measureLoop();
    applyRailTransform();
    paintCards();
  });
  window.addEventListener('wheel', onWheel, { passive: true });

  let lastScrollY = window.scrollY;
  window.addEventListener(
    'scroll',
    () => {
      if (hero.dataset.powerState !== 'locked') return;
      const dy = window.scrollY - lastScrollY;
      lastScrollY = window.scrollY;
      nudgeMotion(dy);
    },
    { passive: true },
  );

  if (isReduced?.()) {
    home.classList.add('is-reduced');
    velocity = 0;
    stop();
    measureLoop();
    applyRailTransform();
    paintCards();
  }
}
