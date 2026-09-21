import { t } from './i18n.js?v=eb-20260920f';

const ACTS = [
  { num: '01', en: 'SOULTRACE', verb: 'RECORD', title: 'sk.a1.title', lead: 'sk.a1.lead' },
  { num: '02', en: 'NFC MEMORY CARD', verb: 'KEEP', title: 'sk.a2.title', lead: 'sk.a2.lead' },
  { num: '03', en: 'ETERNAL BEAM', verb: 'EXPERIENCE', title: 'sk.a3.title', lead: 'sk.a3.lead' },
];

const LETTERS = [
  { id: '01', theme: '01', title: 'sk.l1', body: 'sk.letter01.body' },
  { id: '02', theme: '02', title: 'sk.l2', body: 'sk.letter02.body' },
  { id: '03', theme: '03', title: 'sk.l3', body: 'sk.letter03.body' },
];

/** Left→right along Melius-style U arc (decorative + three openable letters). */
const MELIUS_ARC = [
  { kind: 'deco', variant: '04', sticker: '💌', line: 'FOR YOU' },
  { kind: 'deco', variant: '05', sticker: '★', line: 'EB' },
  { kind: 'letter', id: '01', variant: '01' },
  { kind: 'deco', variant: '06', sticker: '✉', line: 'POST' },
  { kind: 'letter', id: '02', variant: '02' },
  { kind: 'deco', variant: '07', sticker: '♥', line: 'KEEP' },
  { kind: 'letter', id: '03', variant: '03' },
  { kind: 'deco', variant: '08', sticker: '☆', line: 'TRACE' },
  { kind: 'deco', variant: '09', sticker: '♡', line: 'always' },
  { kind: 'deco', variant: '10', sticker: '✦', line: 'dear' },
  { kind: 'deco', variant: '11', sticker: '📎', line: 'tape' },
  { kind: 'deco', variant: '12', sticker: '☺', line: 'hi!' },
  { kind: 'deco', variant: '13', sticker: '♪', line: 'hum' },
];

const PET_V = 'eb-20260914v';
const PETS = [
  ...Array.from({ length: 36 }, (_, i) => `assets/journey/pets/p${String(i + 1).padStart(2, '0')}.webp?v=${PET_V}`),
  `assets/journey/pets/shiba.webp?v=eb-20260914s`,
  `assets/journey/pets/beagle.webp?v=eb-20260914s`,
  `assets/journey/pets/husky.webp?v=eb-20260914s`,
  `assets/journey/pets/retriever.webp?v=eb-20260914s`,
  `assets/journey/pets/puppy.webp?v=eb-20260914s`,
  `assets/journey/pets/tabby.webp?v=eb-20260914s`,
  `assets/journey/pets/black-cat.webp?v=eb-20260914s`,
  `assets/journey/pets/grey-cat.webp?v=eb-20260914s`,
];

function motionOff() {
  return document.documentElement.classList.contains('reduced-motion')
    || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function initStoryKeep() {
  const section = document.querySelector('#original.story-keep');
  if (!section) return;

  const num = section.querySelector('[data-sk-num]');
  const en = section.querySelector('[data-sk-en]');
  const verb = section.querySelector('[data-sk-verb]');
  const title = section.querySelector('[data-sk-title]');
  const lead = section.querySelector('[data-sk-lead]');
  const steps = [...section.querySelectorAll('[data-sk-jump]')];
  let act = 1;
  let playToken = 0;
  let seen = false;

  function writeCopy(next) {
    const row = ACTS[next - 1];
    if (!row) return;
    if (num) num.textContent = row.num;
    if (en) en.textContent = row.en;
    if (verb) verb.textContent = row.verb;
    if (title) {
      title.textContent = t(row.title);
      title.style.display = title.textContent.trim() ? '' : 'none';
    }
    if (lead) {
      lead.textContent = t(row.lead);
      lead.hidden = !lead.textContent.trim();
    }
    steps.forEach((btn, i) => {
      if (i === next - 1) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  }

  function play(next, restart = true) {
    act = next;
    section.dataset.act = String(act);
    section.dataset.dark = act === 3 ? 'on' : '';
    section.dataset.space = act === 3 ? 'on' : '';
    writeCopy(act);
    if (!restart) return;
    section.classList.remove('is-playing');
    void section.offsetWidth;
    playToken += 1;
    section.dataset.play = String(playToken);
    section.classList.add('is-playing');
  }

  steps.forEach((btn) => {
    btn.addEventListener('click', () => play(Number(btn.dataset.skJump), true));
  });

  addEventListener('eb:lang', () => writeCopy(act));

  function sectionOnScreen() {
    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    return rect.bottom > vh * 0.08 && rect.top < vh * 0.92;
  }

  function bleibReady() {
    return !section.classList.contains('story-keep-bleib')
      || section.classList.contains('is-bleib-open');
  }

  function startAct1Intro() {
    if (seen || act !== 1 || !sectionOnScreen() || !bleibReady()) return;
    seen = true;
    if (motionOff()) {
      act = 1;
      section.dataset.act = '1';
      writeCopy(1);
      section.classList.add('is-playing');
      return;
    }
    play(1, true);
  }

  const watch = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0.1)) startAct1Intro();
  }, { threshold: [0, 0.1, 0.25, 0.35] });
  watch.observe(section);

  initPhotoFlow(section);
  initMeliusArc(section);
  initLetterCollage(section);
  initRecordCta(section);
  act = 1;
  section.dataset.act = '1';
  writeCopy(1);
  section.addEventListener('eb:bleib-open', () => {
    seen = false;
    startAct1Intro();
  });
  section.addEventListener('eb:bleib-close', () => {
    seen = false;
    section.classList.remove('is-playing');
  });
  requestAnimationFrame(() => startAct1Intro());
  addEventListener('scroll', () => startAct1Intro(), { passive: true });
}

function initRecordCta(section) {
  const btn = section.querySelector('[data-sk-record-cta]');
  if (!btn) return;
  const nudge = () => {
    if (motionOff()) return;
    btn.classList.remove('is-nudged');
    void btn.offsetWidth;
    btn.classList.add('is-nudged');
    btn.addEventListener('animationend', () => btn.classList.remove('is-nudged'), { once: true });
  };
  btn.addEventListener('click', () => {
    nudge();
    if (section.dataset.act !== '1') return;
    const first = section.querySelector('.sk-tile--letter[data-letter="01"]');
    first?.focus({ preventScroll: true });
  });
}

function buildLetterCard(variant, { num, previewKey, sticker, line } = {}) {
  const card = document.createElement('span');
  card.className = `sk-letter-card sk-letter-card--${variant}`;
  if (num) {
    const n = document.createElement('span');
    n.className = 'sk-letter-card__num';
    n.textContent = num;
    card.append(n);
  }
  const mark = document.createElement('span');
  mark.className = 'sk-letter-card__mark';
  mark.setAttribute('aria-hidden', 'true');
  card.append(mark);
  if (sticker) {
    const st = document.createElement('span');
    st.className = 'sk-letter-card__sticker';
    st.textContent = sticker;
    card.append(st);
  }
  if (previewKey) {
    const prev = document.createElement('span');
    prev.className = 'sk-letter-card__preview';
    prev.dataset.i18n = previewKey;
    prev.textContent = t(previewKey);
    card.append(prev);
  } else if (line) {
    const prev = document.createElement('span');
    prev.className = 'sk-letter-card__preview sk-letter-card__preview--deco';
    prev.textContent = line;
    card.append(prev);
  }
  return card;
}

/** JOURNEY act 1 — cover-flow without hub fade (cards stay visible) */
function coverFlowJourney(norm, spreadMul = 1) {
  const n = norm / spreadMul;
  const t = Math.min(1.12, Math.abs(n));
  const sign = n < 0 ? -1 : 1;
  const scale = 0.62 + t * t * (0.78 * spreadMul);
  const rotateY = -sign * t * 16;
  const tz = (1 - Math.min(1, t)) * (-48 - spreadMul * 8);
  return { scale, rotateY, tz, z: Math.round(10 + t * 36), opacity: 1 };
}

/** JOURNEY act 1 — wavy lying-S across full viewport width */
function journeyWaveLift(waveX, trackHeight) {
  const amp = Math.min(Math.max(trackHeight * 0.22, 40), 88);
  const n = Math.max(-1.05, Math.min(1.05, waveX));
  const s = Math.sin(n * Math.PI);
  const ripple = 0.14 * Math.sin(n * Math.PI * 2.05 + 0.38);
  return amp * (s + ripple);
}

function journeyWaveTilt(waveX) {
  const n = Math.max(-1.05, Math.min(1.05, waveX));
  return (Math.cos(n * Math.PI) * 3.2 + n * -1.2);
}

function journeyWaveNorm(cx, trackRect) {
  const t = (cx - trackRect.left) / Math.max(trackRect.width, 1);
  return (t - 0.5) * 2;
}

function buildFlowTile(spec, index) {
  let tile;
  if (spec.kind === 'letter') {
    tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'sk-melius-flow-card sk-tile sk-tile--letter';
    tile.dataset.letter = spec.id;
    tile.dataset.id = `letter${spec.id}`;
    tile.setAttribute('aria-haspopup', 'dialog');
    tile.setAttribute('aria-label', `Letter ${spec.id}`);
    tile.append(buildLetterCard(spec.variant, {
      num: spec.id,
      previewKey: LETTERS.find((row) => row.id === spec.id)?.title,
    }));
  } else {
    tile = document.createElement('div');
    tile.className = 'sk-melius-flow-card sk-tile sk-tile--deco';
    tile.dataset.id = `arc-deco-${index}`;
    tile.setAttribute('aria-hidden', 'true');
    tile.append(buildLetterCard(spec.variant, {
      sticker: spec.sticker,
      line: spec.line,
    }));
  }
  return tile;
}

const PHOTO_FLOW_BLOCK = 14;

function journeyBleibOpen(section) {
  return !section.classList.contains('story-keep-bleib')
    || section.classList.contains('is-bleib-open');
}

function buildPhotoTile(src, index) {
  const tile = document.createElement('div');
  tile.className = 'sk-melius-flow-card sk-tile sk-tile--photo';
  tile.dataset.id = `photo-${index}`;
  tile.setAttribute('aria-hidden', 'true');
  const fig = document.createElement('figure');
  fig.className = 'sk-photo-flow';
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.decoding = 'async';
  fig.append(img);
  tile.append(fig);
  return tile;
}

/** Left→right cover-flow rail (act 1 letters, act 2 photos). */
function initMeliusFlow(section, { root, activeAct, blockSize, populate, onLang }) {
  if (!root) return;
  root.replaceChildren();

  const track = document.createElement('div');
  track.className = 'sk-melius-track';
  const rail = document.createElement('div');
  rail.className = 'sk-melius-rail';
  populate(rail);
  track.append(rail);
  root.append(track);

  let offset = 0;
  let velocity = 1.62;
  const baseVelocity = 1.62;
  let flowSpread = 1;
  let loopWidth = 0;
  let raf = 0;
  let running = false;
  let last = 0;

  function measureLoop() {
    const cards = rail.querySelectorAll('.sk-melius-flow-card');
    if (cards.length < blockSize * 3) return;
    const quarter = blockSize;
    loopWidth = cards[quarter * 2].offsetLeft - cards[quarter].offsetLeft;
    if (loopWidth <= 0) loopWidth = rail.scrollWidth / 4;
  }

  function paintCards() {
    const rect = track.getBoundingClientRect();
    const hubX = rect.left + rect.width * 0.5;
    const spread = Math.max(rect.width * 0.5, 320);
    rail.querySelectorAll('.sk-melius-flow-card').forEach((card) => {
      const box = card.getBoundingClientRect();
      const cx = box.left + box.width * 0.5;
      const waveX = journeyWaveNorm(cx, rect);
      const norm = (cx - hubX) / spread;
      const { scale, rotateY, tz, z, opacity } = coverFlowJourney(norm, flowSpread);
      const arcY = journeyWaveLift(waveX, rect.height);
      const rotateZ = journeyWaveTilt(waveX);
      const stackZ = Math.round(8 + ((cx - rect.left) / Math.max(rect.width, 1)) * 40);
      card.style.zIndex = String(Math.max(stackZ, Math.min(z, 48)));
      card.style.opacity = String(opacity);
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
    if (section.dataset.act === activeAct && !motionOff()) {
      offset += velocity * (dt / 16.67);
      if (loopWidth > 0) {
        while (offset >= loopWidth) offset -= loopWidth;
      }
      velocity += (baseVelocity - velocity) * 0.032;
      flowSpread += (1 - flowSpread) * 0.045;
      rail.style.transform = `translate3d(calc(-50% + ${offset.toFixed(2)}px),-50%,0)`;
      paintCards();
    }
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running || motionOff() || section.dataset.act !== activeAct || !journeyBleibOpen(section)) return;
    running = true;
    last = 0;
    measureLoop();
    if (!offset && loopWidth) offset = loopWidth * 0.33;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    last = 0;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function nudgeMotion(delta) {
    if (!delta || section.dataset.act !== activeAct || motionOff()) return;
    const push = Math.abs(delta);
    velocity = Math.max(0.6, Math.min(6.5, velocity + delta * 0.006));
    flowSpread = Math.min(1.38, flowSpread + push * 0.002);
    offset += delta * 0.3;
    if (loopWidth > 0) {
      while (offset >= loopWidth) offset -= loopWidth;
      while (offset < 0) offset += loopWidth;
    }
    rail.style.transform = `translate3d(calc(-50% + ${offset.toFixed(2)}px),-50%,0)`;
    paintCards();
  }

  function syncFlow() {
    if (motionOff()) {
      stop();
      measureLoop();
      if (loopWidth) offset = loopWidth * 0.33;
      rail.style.transform = 'translate3d(-50%,-50%,0)';
      paintCards();
      return;
    }
    if (section.dataset.act === activeAct && journeyBleibOpen(section)) start();
    else stop();
  }

  new MutationObserver(syncFlow).observe(section, { attributes: true, attributeFilter: ['data-act', 'class'] });
  const io = new IntersectionObserver((entries) => {
    if (!journeyBleibOpen(section)) return;
    if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0.08)) start();
    else stop();
  }, { threshold: [0, 0.08, 0.2] });
  io.observe(section);
  section.addEventListener('eb:bleib-open', syncFlow);
  section.addEventListener('eb:bleib-close', stop);

  track.addEventListener('wheel', (e) => nudgeMotion(e.deltaY + e.deltaX), { passive: true });
  window.addEventListener('resize', () => { measureLoop(); paintCards(); }, { passive: true });
  addEventListener('eb:motion', syncFlow);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else syncFlow();
  });

  if (onLang) addEventListener('eb:lang', onLang);

  requestAnimationFrame(() => {
    measureLoop();
    syncFlow();
  });
}

function initMeliusArc(section) {
  const arc = section.querySelector('.sk-melius-arc');
  if (!arc) return;
  initMeliusFlow(section, {
    root: arc,
    activeAct: '1',
    blockSize: MELIUS_ARC.length,
    populate(rail) {
      const loop = [...MELIUS_ARC, ...MELIUS_ARC, ...MELIUS_ARC, ...MELIUS_ARC];
      loop.forEach((spec, index) => {
        rail.append(buildFlowTile(spec, index % MELIUS_ARC.length));
      });
    },
    onLang() {
      arc.querySelectorAll('[data-i18n]').forEach((node) => {
        node.textContent = t(node.dataset.i18n);
      });
    },
  });
}

function initPhotoFlow(section) {
  const album = section.querySelector('.sk-album');
  if (!album) return;
  album.classList.add('sk-album--flow');
  const pool = PETS.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picks = pool.slice(0, PHOTO_FLOW_BLOCK);
  initMeliusFlow(section, {
    root: album,
    activeAct: '2',
    blockSize: PHOTO_FLOW_BLOCK,
    populate(rail) {
      const loop = [...picks, ...picks, ...picks, ...picks];
      loop.forEach((src, index) => {
        rail.append(buildPhotoTile(src, index % PHOTO_FLOW_BLOCK));
      });
    },
  });
}

function initLetterCollage(section) {
  const view = section.querySelector('.sk-letter-view');
  const desk = section.querySelector('.sk-melius-arc') || section.querySelector('.sk-desk');
  if (!view || !desk) return;

  const dialog = view.querySelector('.sk-letter-view__dialog');
  const backdrop = view.querySelector('.sk-letter-view__backdrop');
  const closeBtn = view.querySelector('.sk-letter-view__close');
  const titleEl = view.querySelector('[data-sk-letter-title]');
  const bodyEl = view.querySelector('[data-sk-letter-body]');
  let openId = '';

  function writeOpen() {
    const row = LETTERS.find((item) => item.id === openId);
    if (!row || !titleEl || !bodyEl) return;
    view.dataset.theme = row.theme;
    titleEl.textContent = t(row.title);
    bodyEl.innerHTML = t(row.body);
  }

  function openLetter(id) {
    if (section.dataset.act !== '1') return;
    openId = id;
    writeOpen();
    section.classList.add('is-letter-open');
    view.hidden = false;
    view.setAttribute('aria-hidden', 'false');
    closeBtn?.focus({ preventScroll: true });
  }

  function closeLetter() {
    openId = '';
    section.classList.remove('is-letter-open');
    view.hidden = true;
    view.setAttribute('aria-hidden', 'true');
    delete view.dataset.theme;
  }

  desk.addEventListener('click', (event) => {
    const btn = event.target.closest('.sk-tile--letter[data-letter]');
    if (!btn || !desk.contains(btn)) return;
    openLetter(btn.dataset.letter);
  });
  closeBtn?.addEventListener('click', closeLetter);
  backdrop?.addEventListener('click', closeLetter);
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && section.classList.contains('is-letter-open')) closeLetter();
  });
  addEventListener('eb:lang', () => {
    if (openId) writeOpen();
  });

  if (dialog) dialog.setAttribute('aria-labelledby', 'sk-letter-dialog-title');
}
