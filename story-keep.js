import { t } from './i18n.js?v=eb-20261005m';

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
/* Previous graphic UI card set retained here only as design history.
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
]; */

const MELIUS_ARC = [
  { kind: 'letter', id: '01', image: 'gallery-original/assets/photos/optimized/letters/l1.png' },
  { kind: 'deco', image: 'gallery-original/assets/photos/optimized/letters/l2.png' },
  { kind: 'deco', image: 'gallery-original/assets/photos/optimized/letters/l3.png' },
  { kind: 'letter', id: '02', image: 'gallery-original/assets/photos/optimized/letters/l4.png' },
  { kind: 'deco', image: 'gallery-original/assets/photos/optimized/letters/l5.png' },
  { kind: 'deco', image: 'gallery-original/assets/photos/optimized/letters/l6.png' },
  { kind: 'letter', id: '03', image: 'gallery-original/assets/photos/optimized/letters/l7.png' },
  { kind: 'deco', image: 'gallery-original/assets/photos/optimized/letters/l8.png' },
];

const PET_V = 'eb-20260914v';
const PETS = [
  ...Array.from({ length: 16 }, (_, i) => `assets/journey/pets/p${String(i + 1).padStart(2, '0')}.webp?v=${PET_V}`),
];

function motionOff() {
  return document.documentElement.classList.contains('reduced-motion')
    || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initAlbum(section) {
  const album = section.querySelector('.sk-album');
  const card = section.querySelector('.sk-card');
  if (!album) return;
  album.replaceChildren();

  const LANES = [
    { role: 'storage', through: true, x: .5, w: .2 },
    { role: 'incoming', through: false, x: .13, w: .15 },
    { role: 'preserved', through: false, x: .87, w: .15 },
  ];
  const pool = PETS.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let cursor = 0;
  const recent = [];

  function nextSrc() {
    let src;
    let guard = 0;
    do {
      src = pool[cursor % pool.length];
      cursor += 1;
      guard += 1;
    } while (recent.includes(src) && guard < pool.length);
    recent.push(src);
    if (recent.length > 12) recent.shift();
    return src;
  }

  const nodes = LANES.map((lane, index) => {
    const fig = document.createElement('figure');
    fig.className = `sk-float sk-float--${lane.role}`;
    fig.dataset.lane = lane.role;
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    const extraImages = [];
    const caption = document.createElement('figcaption');
    fig.append(...extraImages, img, caption);
    album.append(fig);
    return {
      fig, img, extraImages, caption, lane, index,
      cardFocus: 0, inCard: false, hasDwelled: false, dwellRemaining: 0,
    };
  });

  function spawn(item, first) {
    item.img.src = nextSrc();
    item.caption.textContent = item.lane.role === 'preserved' ? 'KEPT CLOSE' : 'MEMORY';
    item.through = item.lane.through;
    item.x = item.lane.x;
    item.w = item.lane.w;
    item.speed = .00265;
    item.rot = item.through ? 0 : (item.index === 1 ? -5 : 5);
    item.phase = item.index * 1.7;
    item.amp = item.through ? 0 : .006;
    item.spin = 0;
    item.cardFocus = 0;
    item.inCard = false;
    item.hasDwelled = false;
    item.dwellRemaining = 0;
    item.fig.classList.remove('is-in-card');
    item.y = first ? .12 + item.index * .38 : 1.22;
  }

  nodes.forEach((node) => spawn(node, true));

  let raf = 0;
  let last = 0;

  function paint(item, aw, ah, x, w) {
    const focus = item.cardFocus || 0;
    const rotation = item.rot * (1 - focus * .9);
    const scale = 1 + focus * .06;
    item.fig.style.width = `${w}px`;
    item.fig.style.transform = `translate3d(${x * aw - w / 2}px, ${item.y * ah}px, 0) rotate(${rotation.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const aw = album.clientWidth || 1;
    const ah = album.clientHeight || 1;
    if (motionOff()) {
      const reducedCardWidth = card?.getBoundingClientRect().width || aw * .2;
      nodes.forEach((item) => {
        item.y = item.through ? .32 : item.index === 1 ? .18 : .55;
        item.phase = 0;
        item.amp = 0;
        item.cardFocus = item.through ? 1 : 0;
        item.fig.classList.toggle('is-in-card', item.through);
        const w = item.through
          ? Math.max(96, reducedCardWidth * .72)
          : Math.max(112, Math.min(190, reducedCardWidth * .7));
        const edgeInset = item.through ? 0 : (w * .68) / aw;
        const x = item.through ? item.x : Math.max(edgeInset, Math.min(1 - edgeInset, item.x));
        paint(item, aw, ah, x, w);
      });
      return;
    }
    if (section.dataset.act !== '2') return;
    const dt = Math.min(40, now - last || 16) / 16.67;
    last = now;
    const cr = card ? card.getBoundingClientRect() : null;
    const ar = album.getBoundingClientRect();
    const cardMid = cr ? (cr.left + cr.width / 2 - ar.left) / aw : .5;
    const cardTop = cr ? (cr.top - ar.top) / ah : .28;
    const cardBot = cr ? (cr.bottom - ar.top) / ah : .72;
    const slotW = cr ? cr.width * .72 : aw * .2;

    for (const item of nodes) {
      let travelRate = 1;
      if (item.through && item.inCard) travelRate = .48;
      if (item.through && item.dwellRemaining > 0) {
        item.dwellRemaining = Math.max(0, item.dwellRemaining - dt * 16.67);
        travelRate = .06;
      }
      item.y -= item.speed * dt * travelRate;
      item.phase += .008 * dt;
      if (item.y < -.45) spawn(item, false);
      let x = item.x + Math.sin(item.phase) * item.amp;
      let w = item.through
        ? (cr ? slotW : Math.max(96, Math.min(190, item.w * aw)))
        : Math.max(112, Math.min(190, cr ? cr.width * .7 : item.w * aw));
      if (!item.through) {
        const edgeInset = (w * .68) / aw;
        x = Math.max(edgeInset, Math.min(1 - edgeInset, x));
      }
      const photoHeight = (w * 4 / 3) / ah;
      const isInCard = item.through
        && item.y + photoHeight * .72 > cardTop
        && item.y + photoHeight * .28 < cardBot;
      const photoCenter = item.y + photoHeight * .5;
      const cardCenter = (cardTop + cardBot) * .5;
      if (isInCard && !item.hasDwelled && Math.abs(photoCenter - cardCenter) < photoHeight * .14) {
        item.hasDwelled = true;
        item.dwellRemaining = 440;
      }
      item.inCard = isInCard;
      item.cardFocus += ((isInCard ? 1 : 0) - item.cardFocus) * .12;
      item.fig.classList.toggle('is-in-card', isInCard);
      if (isInCard) {
        x += (cardMid - x) * .2;
      }
      paint(item, aw, ah, x, w);
    }
  }

  raf = requestAnimationFrame(frame);
  addEventListener('eb:motion', () => { last = 0; });
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
    if (title) title.textContent = t(row.title);
    if (lead) lead.textContent = t(row.lead);
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

  initAlbum(section);
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
  });
}

function buildLetterCard(image) {
  const card = document.createElement('span');
  card.className = 'sk-letter-card sk-soul-letter-asset';
  const img = document.createElement('img');
  img.src = image;
  img.alt = '';
  img.decoding = 'async';
  card.append(img);
  return card;
}

/** JOURNEY act 1 — cover-flow without hub fade (cards stay visible) */
function coverFlowJourney(norm, spreadMul = 1) {
  const n = norm / spreadMul;
  const t = Math.min(1, Math.abs(n));
  const sign = n < 0 ? -1 : 1;
  const focus = 1 - t;
  const easedFocus = focus * focus * (3 - 2 * focus);
  const scale = 0.68 + easedFocus * 0.5;
  const rotateY = -sign * t * 12;
  const tz = -90 + easedFocus * 150;
  const opacity = 0.28 + easedFocus * 0.72;
  return { scale, rotateY, tz, z: Math.round(10 + easedFocus * 40), opacity, focus: easedFocus };
}

/** JOURNEY act 1 — wavy lying-S across full viewport width */
function journeyWaveLift(waveX, trackHeight) {
  const amp = Math.min(Math.max(trackHeight * 0.07, 14), 30);
  const n = Math.max(-1.05, Math.min(1.05, waveX));
  const progress = (n + 1) * 0.5;
  return Math.sin(progress * Math.PI) * amp;
}

function journeyWaveTilt(waveX) {
  const n = Math.max(-1.05, Math.min(1.05, waveX));
  return Math.sin(n * Math.PI) * 2.4;
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
    tile.append(buildLetterCard(spec.image));
  } else {
    tile = document.createElement('div');
    tile.className = 'sk-melius-flow-card sk-tile sk-tile--deco';
    tile.dataset.id = `arc-deco-${index}`;
    tile.setAttribute('aria-hidden', 'true');
    tile.append(buildLetterCard(spec.image));
  }
  return tile;
}

function initMeliusArc(section) {
  const arc = section.querySelector('.sk-melius-arc');
  if (!arc) return;
  arc.replaceChildren();

  const track = document.createElement('div');
  track.className = 'sk-melius-track';
  const rail = document.createElement('div');
  rail.className = 'sk-melius-rail';

  const loop = [...MELIUS_ARC, ...MELIUS_ARC, ...MELIUS_ARC, ...MELIUS_ARC];
  loop.forEach((spec, index) => {
    rail.append(buildFlowTile(spec, index % MELIUS_ARC.length));
  });

  track.append(rail);
  arc.append(track);

  const block = MELIUS_ARC.length;
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
    if (cards.length < block * 3) return;
    const quarter = block;
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
      let { scale, rotateY, tz, z, opacity, focus } = coverFlowJourney(norm, flowSpread);
      const arcY = journeyWaveLift(waveX, rect.height);
      let rotateZ = journeyWaveTilt(waveX);
      const selected = card.matches(':hover, :focus-visible');
      if (selected) {
        scale *= 1.07;
        rotateY *= 0.25;
        rotateZ *= 0.2;
        tz += 70;
        opacity = 1;
        focus = 1;
        z = 60;
      }
      card.style.setProperty('--sk-depth-blur', `${((1 - focus) * 2.8).toFixed(2)}px`);
      card.style.setProperty('--sk-depth-shadow-y', `${(12 + focus * 12).toFixed(1)}px`);
      card.style.setProperty('--sk-depth-shadow-blur', `${(20 + focus * 16).toFixed(1)}px`);
      card.style.zIndex = String(z);
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
    if (section.dataset.act === '1' && !motionOff()) {
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

  function journeyBleibOpen() {
    return !section.classList.contains('story-keep-bleib')
      || section.classList.contains('is-bleib-open');
  }

  function start() {
    if (running || motionOff() || section.dataset.act !== '1' || !journeyBleibOpen() || section.classList.contains('is-reading')) return;
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

  function syncFlow() {
    if (motionOff()) {
      stop();
      measureLoop();
      if (loopWidth) offset = loopWidth * 0.33;
      rail.style.transform = 'translate3d(-50%,-50%,0)';
      paintCards();
      return;
    }
    if (section.dataset.act === '1' && journeyBleibOpen() && !section.classList.contains('is-reading')) start();
    else stop();
  }

  new MutationObserver(syncFlow).observe(section, { attributes: true, attributeFilter: ['data-act', 'class'] });
  const io = new IntersectionObserver((entries) => {
    if (!journeyBleibOpen()) return;
    if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0.08)) start();
    else stop();
  }, { threshold: [0, 0.08, 0.2] });
  io.observe(section);
  section.addEventListener('eb:bleib-open', syncFlow);
  section.addEventListener('eb:bleib-close', stop);

  window.addEventListener('resize', () => { measureLoop(); paintCards(); }, { passive: true });
  addEventListener('eb:motion', syncFlow);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else syncFlow();
  });

  addEventListener('eb:lang', () => {
    arc.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
  });

  requestAnimationFrame(() => {
    measureLoop();
    syncFlow();
  });
}

function initLetterCollage(section) {
  const view = section.querySelector('.sk-letter-view');
  const desk = section.querySelector('.sk-melius-arc') || section.querySelector('.sk-desk');
  if (!view || !desk) return;
  const letterAssets = Array.from({ length: 8 }, (_, index) => `gallery-original/assets/photos/optimized/letters/l${index + 1}.png`);
  let activeLetterIndex = 0;
  let returnFocus = null;
  let lockedScrollY = null;

  view.innerHTML = `<div class="sk-letter-reader__shade" aria-hidden="true"></div><div class="sk-letter-reader" role="dialog" aria-modal="true" aria-label="Soul Trace letter reader"><button type="button" class="sk-letter-reader__close" aria-label="Close letter reader">CLOSE <span aria-hidden="true">×</span></button><div class="sk-letter-reader__glow" aria-hidden="true"></div><img class="sk-letter-reader__image" alt="Soul Trace letter 1 of 8"><div class="sk-letter-reader__controls"><button type="button" class="sk-letter-reader__nav sk-letter-reader__nav--prev" aria-label="Previous letter"><span aria-hidden="true">←</span><small>Previous</small></button><span class="sk-letter-reader__counter" aria-live="polite">01 / 08</span><button type="button" class="sk-letter-reader__nav sk-letter-reader__nav--next" aria-label="Next letter"><span aria-hidden="true">→</span><small>Next</small></button></div></div>`;
  const reader = view.querySelector('.sk-letter-reader');
  const image = view.querySelector('.sk-letter-reader__image');
  const counter = view.querySelector('.sk-letter-reader__counter');
  const closeButton = view.querySelector('.sk-letter-reader__close');
  const previousButton = view.querySelector('.sk-letter-reader__nav--prev');
  const nextButton = view.querySelector('.sk-letter-reader__nav--next');

  const renderLetter = () => {
    image.src = letterAssets[activeLetterIndex];
    image.alt = `Soul Trace letter ${activeLetterIndex + 1} of ${letterAssets.length}`;
    counter.textContent = `${String(activeLetterIndex + 1).padStart(2, '0')} / ${String(letterAssets.length).padStart(2, '0')}`;
  };
  const move = (direction) => {
    activeLetterIndex = (activeLetterIndex + direction + letterAssets.length) % letterAssets.length;
    renderLetter();
    if (!motionOff()) image.animate([
      { opacity: .45, transform: `translateX(${direction * 14}px) scale(.985)` },
      { opacity: 1, transform: 'none' },
    ], { duration: 240, easing: 'cubic-bezier(.22,.61,.36,1)' });
  };
  const nearestLetterIndex = () => {
    const center = innerWidth / 2;
    const cards = [...desk.querySelectorAll('.sk-melius-flow-card')];
    const nearest = cards.reduce((best, card) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      return !best || distance < best.distance ? { card, distance } : best;
    }, null)?.card;
    const src = nearest?.querySelector('.sk-soul-letter-asset > img')?.getAttribute('src') || '';
    const match = src.match(/\/l([1-8])\.png(?:\?|$)/);
    return match ? Number(match[1]) - 1 : 0;
  };
  const openReader = (index = nearestLetterIndex()) => {
    if (section.dataset.act !== '1' || section.classList.contains('is-reading')) return;
    activeLetterIndex = index;
    returnFocus = document.activeElement;
    lockedScrollY = scrollY;
    renderLetter();
    section.classList.add('is-reading');
    view.hidden = false;
    view.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      view.classList.add('is-visible');
      closeButton.focus({ preventScroll: true });
    });
  };
  const closeReader = () => {
    if (!section.classList.contains('is-reading')) return;
    view.classList.remove('is-visible');
    const finish = () => {
      section.classList.remove('is-reading');
      view.hidden = true;
      view.setAttribute('aria-hidden', 'true');
      if (lockedScrollY !== null) window.scrollTo({ top: lockedScrollY, behavior: 'instant' });
      lockedScrollY = null;
      returnFocus?.focus?.({ preventScroll: true });
      returnFocus = null;
    };
    if (motionOff()) finish();
    else window.setTimeout(finish, 260);
  };

  section.addEventListener('sk:open-letter-reader', () => openReader());
  desk.addEventListener('click', (event) => {
    const card = event.target.closest('.sk-melius-flow-card');
    if (!card || !desk.contains(card)) return;
    const src = card.querySelector('.sk-soul-letter-asset > img')?.getAttribute('src') || '';
    const match = src.match(/\/l([1-8])\.png(?:\?|$)/);
    openReader(match ? Number(match[1]) - 1 : 0);
  });
  previousButton.addEventListener('click', () => move(-1));
  nextButton.addEventListener('click', () => move(1));
  closeButton.addEventListener('click', closeReader);
  view.querySelector('.sk-letter-reader__shade').addEventListener('click', closeReader);
  const lockReadingScroll = (event) => {
    if (!section.classList.contains('is-reading')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  addEventListener('wheel', lockReadingScroll, { capture: true, passive: false });
  addEventListener('touchmove', lockReadingScroll, { capture: true, passive: false });
  addEventListener('scroll', () => {
    if (lockedScrollY !== null && Math.abs(scrollY - lockedScrollY) > 1) {
      window.scrollTo({ top: lockedScrollY, behavior: 'instant' });
    }
  }, { passive: true });
  addEventListener('keydown', (event) => {
    if (!section.classList.contains('is-reading')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    else if (event.key === 'Escape') { event.preventDefault(); closeReader(); }
    else if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) event.preventDefault();
  });
  reader.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [closeButton, previousButton, nextButton];
    const index = controls.indexOf(document.activeElement);
    if (event.shiftKey && index === 0) { event.preventDefault(); controls.at(-1).focus(); }
    else if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); controls[0].focus(); }
  });
}
