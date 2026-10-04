const GOYA_V = 'eb-20261004s';
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

const CARD_FRAMES = [
  [1.34, 0.86],
  [0.82, 1.18],
  [1.5, 1.06],
  [0.9, 1.32],
  [1.18, 0.74],
  [1.06, 1.4],
  [0.72, 0.72],
  [1.36, 0.9],
  [1.56, 1.12],
  [0.86, 1.22],
  [1.12, 1.48],
  [1.22, 0.82],
];

const DEVICE_FALLBACK = 'assets/hero/beam-device-melius-front-cut.png?v=eb-20260919a';

function initDotGenerator(home, getSlots) {
  const canvas = home.querySelector('.eb-melius-dots');
  if (!canvas) return { draw() {}, resize() {}, reset() {}, progress: () => 1 };
  const ctx = canvas.getContext('2d', { alpha: true });
  const dots = [];
  let seeded = false;
  let bornAt = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = home.clientWidth || 1;
    const h = home.clientHeight || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed(w, h);
  }

  function seed(w, h) {
    dots.length = 0;
    const count = Math.round(Math.min(1600, Math.max(720, (w * h) / 1400)));
    for (let i = 0; i < count; i += 1) {
      const edge = Math.random();
      let sx;
      let sy;
      if (edge < 0.28) {
        sx = Math.random() * w;
        sy = Math.random() < 0.5 ? -20 : h + 20;
      } else if (edge < 0.56) {
        sx = Math.random() < 0.5 ? -20 : w + 20;
        sy = Math.random() * h;
      } else {
        sx = Math.random() * w;
        sy = Math.random() * h;
      }
      dots.push({
        sx,
        sy,
        x: sx,
        y: sy,
        slot: i % 12,
        ox: (Math.random() - 0.5) * 0.86,
        oy: (Math.random() - 0.5) * 0.86,
        r: 0.6 + Math.random() * 1.7,
        a: 0.35 + Math.random() * 0.5,
        delay: Math.random() * 0.28,
        tw: Math.random() * Math.PI * 2,
      });
    }
    seeded = true;
  }

  function reset() {
    bornAt = 0;
    seeded = false;
    resize();
  }

  function progress(now) {
    if (!bornAt) return 0;
    return Math.min(1, (now - bornAt) / 2100);
  }

  function draw(now) {
    if (!seeded) resize();
    if (!bornAt) bornAt = now;
    const w = home.clientWidth || 1;
    const h = home.clientHeight || 1;
    const grow = progress(now);
    const slots = getSlots();
    const photoIn = Math.max(0, (grow - 0.58) / 0.42);
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      const local = Math.max(0, Math.min(1, (grow - d.delay) / 0.5));
      if (local <= 0) continue;
      const ease = 1 - (1 - local) ** 3;
      const slot = slots[d.slot] || { cx: w * 0.5, cy: h * 0.5, w: 80, h: 110 };
      const tx = slot.cx + d.ox * slot.w;
      const ty = slot.cy + d.oy * slot.h;
      d.x = d.sx + (tx - d.sx) * ease;
      d.y = d.sy + (ty - d.sy) * ease;
      const fade = 1 - photoIn * 0.92;
      const pulse = 0.82 + Math.sin(now * 0.003 + d.tw) * 0.18;
      ctx.fillStyle = `rgba(236,237,230,${(d.a * local * fade * pulse).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * (1.15 - ease * 0.25), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  resize();
  return { draw, resize, reset, progress };
}

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

  home.classList.add('is-cipher-orbit');
  const photoSlots = [];
  const dots = initDotGenerator(home, () => photoSlots);
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
  let velocity = 0.42;
  const baseVelocity = 0.42;
  let flowSpread = 1;
  let loopWidth = 0;
  let raf = 0;
  let running = false;
  let last = 0;
  let focusUntil = 0;
  let pinnedIndex = -1;

  let hoverIndex = -1;

  let orbitBorn = 0;

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
    const count = Math.max(1, cards.length);
    const radiusX = rect.width * (mobile ? 0.36 : 0.34);
    const radiusY = rect.height * (mobile ? 0.3 : 0.27);
    const tilt = -22 * Math.PI / 180;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const phase = (offset / loopWidth) * Math.PI * 2;
    const focusing = hoverIndex >= 0 || pinnedIndex >= 0 || performance.now() < focusUntil;
    home.classList.toggle('is-orbit-focus', focusing);
    const unit = Math.min(rect.width * (mobile ? 0.16 : 0.11), mobile ? 96 : 148);
    const assemble = dots.progress(performance.now());
    const shown = Math.max(0, Math.min(1, (assemble - 0.52) / 0.34));
    const homeR = home.getBoundingClientRect();
    const originX = rect.left - homeR.left + rect.width / 2;
    const originY = rect.top - homeR.top + rect.height / 2;
    photoSlots.length = 0;
    let frontIndex = 0;
    let focusDepth = -2;

    cards.forEach((card, index) => {
      card.style.display = '';
      const frame = CARD_FRAMES[index % CARD_FRAMES.length];
      const cw = unit * frame[0];
      const ch = unit * frame[1];
      card.style.width = `${cw.toFixed(1)}px`;
      card.style.height = `${ch.toFixed(1)}px`;
      const angle = (index / count) * Math.PI * 2 + phase - Math.PI / 2;
      const radial = 1.02 + (index % 4) * 0.03;
      const lx = Math.cos(angle) * radiusX * radial;
      const ly = Math.sin(angle) * radiusY * radial;
      const x = lx * cosT - ly * sinT;
      const y = lx * sinT + ly * cosT;
      const depth = Math.sin(angle + tilt);
      if (depth > focusDepth) {
        focusDepth = depth;
        frontIndex = index;
      }
      const z = Math.round(12 + depth * 28 + (index % 3));
      const transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      card.style.zIndex = String(z);
      const stagger = Math.max(0, Math.min(1, (shown - index * 0.035) / 0.55));
      card.style.opacity = String(stagger);
      card.style.transform = transform;
      photoSlots[index] = { cx: originX + x, cy: originY + y, w: cw, h: ch };
      card.style.setProperty('--orbit-transform', transform);
      card.style.setProperty('--orbit-opacity', '1');
      card.style.setProperty('--goya-delay', `${(index % 12) * -0.85}s`);
    });

    const focusIndex = hoverIndex >= 0 ? hoverIndex : pinnedIndex >= 0 ? pinnedIndex : frontIndex;
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
    dots.draw(now);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    orbitBorn = performance.now();
    dots.reset();
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
    pinnedIndex = -1;
    focusUntil = performance.now() + 900;
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
    dots.resize();
  });
  window.addEventListener('wheel', onWheel, { passive: true });

  rail.addEventListener('pointerover', (event) => {
    const card = event.target.closest('.eb-melius-card');
    if (!card) return;
    hoverIndex = [...rail.querySelectorAll('.eb-melius-card')].indexOf(card);
    paintCards();
  });
  rail.addEventListener('pointerout', (event) => {
    if (event.relatedTarget && rail.contains(event.relatedTarget)) return;
    hoverIndex = -1;
    paintCards();
  });

  stage.addEventListener('click', (event) => {
    if (hero.dataset.powerState !== 'locked') return;
    const card = event.target.closest('.eb-melius-card');
    if (!card) {
      pinnedIndex = -1;
      focusUntil = 0;
      home.classList.remove('is-orbit-focus');
      paintCards();
      return;
    }
    const cards = [...rail.querySelectorAll('.eb-melius-card')];
    const index = cards.indexOf(card);
    if (index < 0) return;
    pinnedIndex = pinnedIndex === index ? -1 : index;
    focusUntil = pinnedIndex >= 0 ? performance.now() + 120000 : 0;
    paintCards();
  });

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
