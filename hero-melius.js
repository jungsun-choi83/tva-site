import { t } from './i18n.js?v=eb-20261005k';

const GOYA_V = 'eb-20261005e';
const PET_PHOTOS = [
  `assets/hero/goya-orbit/live/goya-01.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/live/goya-02.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/live/goya-03.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/live/goya-04.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/live/goya-05.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/live/goya-06.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/live/goya-07.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/live/goya-08.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/live/goya-09.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/live/goya-10.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/live/goya-11.webp?v=${GOYA_V}`,
  `assets/hero/goya-orbit/live/goya-12.webp?v=${GOYA_V}`,
];

const CARD_FRAMES = [
  [0.9, 1.2],
  [0.84, 1.12],
  [1.02, 1.36],
  [0.88, 1.173],
  [0.96, 1.28],
  [0.86, 1.147],
  [0.94, 1.253],
  [0.82, 1.093],
  [1.0, 1.333],
  [0.9, 1.2],
  [0.98, 1.307],
  [0.92, 1.227],
];

const FACE_FOCUS = [
  '38% 58%',
  '72% 34%',
  '56% 48%',
  '50% 30%',
  '42% 30%',
  '58% 34%',
  '40% 56%',
  '30% 42%',
  '24% 42%',
  '18% 34%',
  '42% 40%',
  '62% 48%',
];

const DEVICE_FALLBACK = 'assets/hero/beam-device-melius-front-cut.png?v=eb-20260919a';

function sampleBeamLetters(w, h) {
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.floor(w));
  off.height = Math.max(2, Math.floor(h));
  const c = off.getContext('2d');
  c.clearRect(0, 0, off.width, off.height);
  const size = Math.min(w * 0.092, h * 0.135, 118);
  c.fillStyle = '#fff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `500 ${size}px "Times New Roman", Georgia, serif`;
  const drawSpaced = (text, y, tracking) => {
    const start = w / 2 - ((text.length - 1) * tracking) / 2;
    for (let i = 0; i < text.length; i += 1) {
      c.fillText(text[i], start + i * tracking, y);
    }
  };
  drawSpaced('ETERNAL', h / 2 - size * 0.82, size * 0.78);
  drawSpaced('BEAM', h / 2 + size * 0.82, size * 0.86);
  const { data } = c.getImageData(0, 0, off.width, off.height);
  const pts = [];
  for (let y = 0; y < off.height; y += 2) {
    for (let x = 0; x < off.width; x += 2) {
      if (data[(y * off.width + x) * 4 + 3] > 160) pts.push({ x, y });
    }
  }
  if (pts.length > 1400) {
    const keep = [];
    const stride = pts.length / 1400;
    for (let i = 0; i < 1400; i += 1) keep.push(pts[Math.floor(i * stride)]);
    return keep;
  }
  return pts.length ? pts : [{ x: w / 2, y: h / 2 }];
}

function initDotGenerator(home) {
  const canvas = home.querySelector('.eb-melius-dots');
  if (!canvas) return { draw() {}, resize() {}, reset() {}, progress: () => 1 };
  const ctx = canvas.getContext('2d', { alpha: true });
  const dots = [];
  let seeded = false;
  let bornAt = 0;
  let letterPts = [];
  let lastW = 0;
  let lastH = 0;

  function resize(forceSeed = false) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = home.clientWidth || 1;
    const h = home.clientHeight || 1;
    if (w < 80 || h < 80) return false;
    const nextW = Math.floor(w * dpr);
    const nextH = Math.floor(h * dpr);
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (forceSeed || !seeded || Math.abs(w - lastW) > 48 || Math.abs(h - lastH) > 48) {
      lastW = w;
      lastH = h;
      seed(w, h);
    }
    return true;
  }

  function seed(w, h) {
    letterPts = sampleBeamLetters(w, h);
    dots.length = 0;
    const fieldCount = 180;
    const total = letterPts.length + fieldCount;
    for (let i = 0; i < total; i += 1) {
      const onGlyph = i < letterPts.length;
      const glyph = letterPts[i % letterPts.length];
      const edge = Math.random();
      let sx;
      let sy;
      if (edge < 0.5) {
        sx = Math.random() * w;
        sy = Math.random() < 0.5 ? -20 : h + 20;
      } else {
        sx = Math.random() < 0.5 ? -20 : w + 20;
        sy = Math.random() * h;
      }
      dots.push({
        glyph: onGlyph,
        sx,
        sy,
        x: sx,
        y: sy,
        lx: glyph.x,
        ly: glyph.y,
        fx: Math.random() * w,
        fy: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.26,
        r: onGlyph ? 0.85 : 0.7,
        a: onGlyph ? 0.96 : 0.42,
        delay: onGlyph ? Math.random() * 0.05 : 0.12 + Math.random() * 0.2,
        tw: Math.random() * Math.PI * 2,
      });
    }
    seeded = true;
  }

  function reset() {
    bornAt = 0;
    seeded = false;
    lastW = 0;
    lastH = 0;
    resize(true);
  }

  function progress(now) {
    if (!bornAt) return 0;
    return Math.min(1, (now - bornAt) / 2400);
  }

  function draw(now) {
    if (!resize()) return;
    if (!bornAt) bornAt = now;
    const w = home.clientWidth || 1;
    const h = home.clientHeight || 1;
    const t = (now - bornAt) / 1000;
    const gather = Math.min(1, Math.max(0, t / 0.95));
    const hold = t >= 0.95 && t < 2.15;
    const toField = Math.min(1, Math.max(0, (t - 2.15) / 0.7));
    const ambient = t >= 2.85;
    home.classList.toggle('is-cipher-intro', t < 2.35);
    ctx.clearRect(0, 0, w, h);

    for (const d of dots) {
      const local = Math.min(1, Math.max(0, (gather - d.delay) / 0.28));
      const ease = 1 - (1 - local) ** 3;
      if (!d.glyph && !ambient && toField < 0.4) continue;
      if (ambient) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < -10) d.x = w + 10;
        else if (d.x > w + 10) d.x = -10;
        if (d.y < -10) d.y = h + 10;
        else if (d.y > h + 10) d.y = -10;
      } else {
        let tx = d.lx;
        let ty = d.ly;
        if (toField > 0) {
          tx = d.lx + (d.fx - d.lx) * toField;
          ty = d.ly + (d.fy - d.ly) * toField;
        }
        const parked = hold || toField > 0;
        d.x = d.sx + (tx - d.sx) * (parked ? 1 : ease);
        d.y = d.sy + (ty - d.sy) * (parked ? 1 : ease);
      }
      const vis = ambient
        ? 0.28 + Math.sin(now * 0.0035 + d.tw) * 0.12
        : d.glyph ? Math.max(local, gather) : toField;
      if (vis <= 0.02) continue;
      ctx.fillStyle = `rgba(244,241,230,${(d.a * vis).toFixed(3)})`;
      ctx.fillRect(d.x, d.y, d.glyph && !ambient ? 1.15 : 1.35, d.glyph && !ambient ? 1.15 : 1.35);
    }
  }

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
  return `<article class="eb-melius-card"><span class="eb-melius-card__shot"><img src="${src}" width="480" height="640" alt="" loading="${load}" decoding="async"${pri}></span></article>`;
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

  function writeHeroExplain() {
    const copy = t('hero.explain');
    document.querySelectorAll('.eb-melius-foot__lead, .hero-vintage__explain').forEach((el) => {
      el.innerHTML = copy;
    });
  }

  home.classList.add('is-cipher-orbit', 'is-cipher-intro');
  const dots = initDotGenerator(home);
  wrapMeliusGoldLines(home);
  writeHeroExplain();
  window.addEventListener('eb:lang', () => {
    wrapMeliusGoldLines(home);
    writeHeroExplain();
  });

  if (hubImg) {
    hubImg.addEventListener(
      'error',
      () => {
        hubImg.src = DEVICE_FALLBACK;
      },
      { once: true },
    );
  }

  rail.innerHTML = PET_PHOTOS.map((src, i) => cardMarkup(src, i < 10)).join('');

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
    const focusing = hoverIndex >= 0 || pinnedIndex >= 0;
    home.classList.toggle('is-orbit-focus', focusing);
    const unit = Math.min(rect.width * (mobile ? 0.16 : 0.11), mobile ? 96 : 148);
    const age = orbitBorn ? (performance.now() - orbitBorn) / 1000 : 0;
    let shown = Math.max(0, Math.min(1, (age - 2.25) / 0.4));
    if (age > 2.8 || (!orbitBorn && hero.dataset.powerState === 'locked')) shown = 1;
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
      card.style.setProperty('--orbit-transform', transform);
      card.style.setProperty('--orbit-opacity', '1');
      card.style.setProperty('--goya-delay', `${(index % 12) * -0.85}s`);
      const img = card.querySelector('img');
      if (img) {
        img.style.objectFit = 'cover';
        img.style.objectPosition = FACE_FOCUS[index % FACE_FOCUS.length];
        img.style.transform = 'none';
      }
    });

    const focusIndex = hoverIndex >= 0 ? hoverIndex : pinnedIndex;
    cards.forEach((card, index) => {
      const live = focusing && index === focusIndex;
      card.classList.toggle('is-dim', focusing && !live);
      card.classList.toggle('is-live', live);
      const img = card.querySelector('img');
      if (!img) return;
      img.style.filter = focusing && !live
        ? 'grayscale(1) brightness(0.32) contrast(1.08)'
        : 'saturate(1.04) contrast(1.02)';
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
    const state = hero.dataset.powerState;
    const on = state === 'locked' || state === 'mark-out' || state === 'ignite' || state === 'tune';
    root.dataset.heroUi = state === 'locked' ? 'melius' : '';
    home.setAttribute('aria-hidden', state === 'locked' ? 'false' : 'true');
    stage.setAttribute('aria-hidden', state === 'locked' ? 'false' : 'true');
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

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      dots.resize();
      measureLoop();
      paintCards();
    }).observe(home);
  }

  if (isReduced?.()) {
    home.classList.add('is-reduced');
    velocity = 0.18;
  }
}
