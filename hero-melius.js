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

const CARD_COUNT = 16;
const TWO_PI = Math.PI * 2;
const PERIOD_MS = 40000;
const SCALE_BACK = 0.78;
const SCALE_FRONT = 1.12;
const OPACITY_BACK = 0.56;
const OPACITY_FRONT = 1;
const BLUR_BACK = 1.4;
const TILT_MIN = 2;
const TILT_MAX = 4;

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

function cardTilt(index) {
  const span = TILT_MAX - TILT_MIN;
  const mag = TILT_MIN + ((index * 5) % 7) * (span / 6);
  return (index % 2 === 0 ? -1 : 1) * mag;
}

function wrapAngle(angle) {
  const wrapped = angle % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}

export function initHeroMelius(isReduced) {
  const hero = document.querySelector('#home');
  const root = document.documentElement;
  const home = hero?.querySelector('.eb-melius-home');
  const stage = hero?.querySelector('.eb-melius-stage');
  const rail = hero?.querySelector('.eb-melius-rail');
  const hub = hero?.querySelector('.eb-melius-hub');
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

  const sequence = PET_PHOTOS.slice(0, CARD_COUNT);
  const phases = sequence.map((_, i) => (i / CARD_COUNT) * TWO_PI);
  const tilts = sequence.map((_, i) => cardTilt(i));
  const radiusMul = sequence.map((_, i) => 0.9 + (i % 4) * 0.045);
  rail.innerHTML = sequence.map((src, i) => cardMarkup(src, i < 8)).join('');
  const cards = [...rail.querySelectorAll('.eb-melius-card')];

  let raf = 0;
  let running = false;
  let origin = 0;
  let pausedAt = 0;

  function ellipseMetrics() {
    const homeR = home.getBoundingClientRect();
    const hubR = hub?.getBoundingClientRect();
    const mobile = innerWidth <= 720;
    const hubW = hubR?.width || (mobile ? 130 : 180);
    const hubH = hubR?.height || hubW * 1.12;
    const keep = Math.max(hubW, hubH) * 0.58 + (mobile ? 36 : 52);
    const maxRx = Math.max(96, homeR.width * 0.5 - (mobile ? 42 : 64));
    const maxRy = Math.max(72, homeR.height * 0.5 - (mobile ? 88 : 72));
    const rx = Math.min(Math.max(homeR.width * (mobile ? 0.36 : 0.4), keep + 20), maxRx);
    const ry = Math.min(Math.max(homeR.height * (mobile ? 0.2 : 0.28), keep * 0.72), maxRy);
    return { rx, ry, keep };
  }

  function paint(angle) {
    const { rx, ry, keep } = ellipseMetrics();
    const keepSq = keep * keep;
    cards.forEach((card, i) => {
      const theta = wrapAngle(angle + phases[i]);
      const r = radiusMul[i];
      const x = rx * r * Math.cos(theta);
      const y = ry * r * Math.sin(theta);
      const depth = (Math.sin(theta) + 1) / 2;
      const scale = SCALE_BACK + (SCALE_FRONT - SCALE_BACK) * depth;
      const opacity = OPACITY_BACK + (OPACITY_FRONT - OPACITY_BACK) * depth;
      const blur = (1 - depth) * BLUR_BACK;
      const nearHub = x * x + y * y < keepSq;
      const z = nearHub ? Math.round(8 + depth * 24) : Math.round(14 + depth * 32);
      card.style.zIndex = String(z);
      card.style.opacity = opacity.toFixed(3);
      card.style.filter = blur > 0.18 ? `blur(${blur.toFixed(2)}px)` : 'none';
      card.style.transform = [
        'translate(-50%, -50%)',
        `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`,
        `rotate(${tilts[i].toFixed(2)}deg)`,
        `scale(${scale.toFixed(3)})`,
      ].join(' ');
    });
  }

  function tick(now) {
    if (!running) return;
    paint(((now - origin) / PERIOD_MS) * TWO_PI);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    origin = performance.now() - pausedAt;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    if (running && origin) pausedAt = performance.now() - origin;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function reduced() {
    return home.classList.contains('is-reduced') || Boolean(isReduced?.());
  }

  function freeze() {
    stop();
    paint(0);
  }

  const syncUi = () => {
    const on = hero.dataset.powerState === 'locked';
    root.dataset.heroUi = on ? 'melius' : '';
    home.setAttribute('aria-hidden', on ? 'false' : 'true');
    stage.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (!on) {
      stop();
      return;
    }
    if (reduced()) freeze();
    else start();
  };

  syncUi();
  new MutationObserver(syncUi).observe(hero, { attributes: true, attributeFilter: ['data-power-state'] });
  window.addEventListener('resize', () => {
    if (hero.dataset.powerState !== 'locked') return;
    if (running) return;
    paint(pausedAt ? (pausedAt / PERIOD_MS) * TWO_PI : 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (hero.dataset.powerState === 'locked' && !reduced()) start();
  });
  window.addEventListener('tva:motion', (event) => {
    if (event.detail?.reduced) {
      home.classList.add('is-reduced');
      freeze();
      return;
    }
    home.classList.remove('is-reduced');
    if (hero.dataset.powerState === 'locked') start();
  });

  if (reduced()) {
    home.classList.add('is-reduced');
    freeze();
  }
}
