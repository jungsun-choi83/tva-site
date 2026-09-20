const PET_V = 'eb-20260914s';
const PET_PHOTOS = [
  ...Array.from({ length: 20 }, (_, i) => `assets/journey/pets/p${String(i + 1).padStart(2, '0')}.webp?v=${PET_V}`),
  `assets/journey/pets/shiba.webp?v=${PET_V}`,
  `assets/journey/pets/retriever.webp?v=${PET_V}`,
  `assets/journey/pets/puppy.webp?v=${PET_V}`,
  `assets/journey/pets/beagle.webp?v=${PET_V}`,
  `assets/journey/pets/husky.webp?v=${PET_V}`,
  `assets/journey/pets/tabby.webp?v=${PET_V}`,
  `assets/journey/pets/black-cat.webp?v=${PET_V}`,
  `assets/journey/pets/grey-cat.webp?v=${PET_V}`,
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
  return `<article class="eb-melius-card"><img src="${src}" width="720" height="960" alt="" loading="${load}" decoding="async"${pri}></article>`;
}

/** Melius-style: flat + small at center hub, large + rotateY at sides */
function coverFlow(norm, spreadMul = 1) {
  const n = norm / spreadMul;
  const t = Math.min(1.18, Math.abs(n));
  const sign = n < 0 ? -1 : 1;
  const scale = 0.34 + t * t * (1.28 * spreadMul);
  const rotateY = -sign * (8 + t * 66);
  const tz = (1 - Math.min(1, t)) * (-320 - spreadMul * 36);
  const opacity = t < 0.06 ? 0.35 + t * 8 : 1;
  return { scale, rotateY, tz, z: Math.round(12 + t * 86), opacity };
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

  const sequence = PET_PHOTOS.slice(0, 16);
  const loop = [...sequence, ...sequence, ...sequence];
  rail.innerHTML = loop.map((src, i) => cardMarkup(src, i < 10)).join('');

  let offset = 0;
  let velocity = 1.62;
  const baseVelocity = 1.62;
  let flowSpread = 1;
  let loopWidth = 0;
  let raf = 0;
  let running = false;
  let last = 0;

  function applyRailTransform() {
    const alignY = hubRailAlignY(hero, stage);
    rail.style.transform = `translate3d(calc(-50% + ${offset.toFixed(2)}px), calc(-50% + ${alignY.toFixed(1)}px), 0)`;
  }

  function measureLoop() {
    const cards = rail.querySelectorAll('.eb-melius-card');
    if (cards.length < 3) return;
    const third = cards.length / 3;
    loopWidth = cards[third * 2].offsetLeft - cards[third].offsetLeft;
    if (loopWidth <= 0) loopWidth = rail.scrollWidth / 3;
  }

  function paintCards() {
    const rect = stage.getBoundingClientRect();
    const hubX = rect.left + rect.width * 0.5;
    const spread = Math.max(rect.width * 0.46, 340);
    const hubHalf = (hero.querySelector('.eb-melius-hub')?.getBoundingClientRect().width || 0) * 0.32;

    rail.querySelectorAll('.eb-melius-card').forEach((card) => {
      const box = card.getBoundingClientRect();
      const cx = box.left + box.width * 0.5;
      const distFromHub = Math.abs(cx - hubX);
      const norm = (cx - hubX) / spread;
      const { scale, rotateY, tz, z, opacity } = coverFlow(norm, flowSpread);
      const arcY = meliusArcLift(norm, rect.height);
      const rotateZ = norm * -5.8;

      let hide = 1;
      if (distFromHub < hubHalf * 1.02) {
        hide = Math.max(0.12, (distFromHub - hubHalf * 0.06) / (hubHalf * 0.72));
      }
      const zCap = distFromHub < hubHalf * 0.95 ? Math.min(z, 36) : Math.min(z, 44);
      card.style.zIndex = String(zCap);
      card.style.opacity = String(Math.min(opacity, hide));
      card.style.transform = [
        `translateY(${arcY.toFixed(1)}px)`,
        `rotateY(${rotateY.toFixed(2)}deg)`,
        `rotateZ(${rotateZ.toFixed(2)}deg)`,
        `translateZ(${tz.toFixed(1)}px)`,
        `scale(${scale.toFixed(3)})`,
      ].join(' ');
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
