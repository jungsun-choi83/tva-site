import { initHomeCarousel } from './hero-carousel.js?v=eb-20260918m';

const PANELS = ['home', 'about', 'portfolio', 'original', 'contact'];
const PANEL_LABELS = {
  home: 'INDEX',
  about: 'ABOUT',
  portfolio: 'RECORDS',
  original: 'JOURNEY',
  contact: 'CONTACT',
};

export function initBeamRail({
  onPanel,
  onCardSelect,
  introReady,
  panelWheel,
  isReduced,
} = {}) {
  const root = document.documentElement;
  if (root.dataset.layout !== 'beam-rail') return null;

  const main = document.querySelector('main');
  if (!main) return null;

  let index = 0;
  let lockUntil = 0;
  let drag = null;
  let pos = 0;
  let target = 0;
  let railRaf = 0;
  const carousel = initHomeCarousel(isReduced);

  const progress = document.createElement('div');
  progress.className = 'eb-rail-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<span class="eb-rail-progress__bar"></span><span class="eb-rail-progress__label"></span>';
  document.body.append(progress);
  const bar = progress.querySelector('.eb-rail-progress__bar');
  const label = progress.querySelector('.eb-rail-progress__label');

  function panelId(i) {
    return PANELS[Math.max(0, Math.min(PANELS.length - 1, i))];
  }

  function panelOffset(id) {
    const el = document.getElementById(id);
    return el ? el.offsetLeft : 0;
  }

  function writeProgress(id) {
    const i = PANELS.indexOf(id);
    const num = String(Math.max(0, i) + 1).padStart(2, '0');
    const total = String(PANELS.length).padStart(2, '0');
    label.textContent = `${num} / ${total} — ${PANEL_LABELS[id] || id.toUpperCase()}`;
    bar.style.setProperty('--eb-rail-progress', String(i / Math.max(1, PANELS.length - 1)));
  }

  function paintTransform(x) {
    main.style.transform = `translate3d(${x}px,0,0)`;
    root.style.setProperty('--eb-rail-x', `${x}px`);
  }

  function stopRailRaf() {
    if (railRaf) cancelAnimationFrame(railRaf);
    railRaf = 0;
  }

  function tick() {
    const diff = target - pos;
    if (Math.abs(diff) < 0.6 || isReduced?.()) {
      pos = target;
      paintTransform(pos);
      stopRailRaf();
      root.classList.remove('is-rail-transition');
      return;
    }
    pos += diff * 0.085;
    paintTransform(pos);
    railRaf = requestAnimationFrame(tick);
  }

  function moveTo(id, instant = false) {
    target = -panelOffset(id);
    root.dataset.railPanel = id;
    writeProgress(id);
    if (id === 'home') carousel?.reset();
    if (instant || isReduced?.()) {
      stopRailRaf();
      pos = target;
      paintTransform(pos);
      root.classList.remove('is-rail-transition');
      return;
    }
    root.classList.add('is-rail-transition');
    stopRailRaf();
    railRaf = requestAnimationFrame(tick);
  }

  function setIndex(next, { instant = false, fromUser = false } = {}) {
    const clamped = Math.max(0, Math.min(PANELS.length - 1, next));
    if (clamped === index && !instant) return;
    index = clamped;
    const id = panelId(index);
    moveTo(id, instant);
    onPanel?.(id, { fromUser });
    if (!instant && !isReduced?.()) lockUntil = performance.now() + 1100;
  }

  function goTo(id, instant = false) {
    const i = PANELS.indexOf(id);
    if (i < 0) return false;
    setIndex(i, { instant, fromUser: true });
    return true;
  }

  function canNavigate() {
    if (isReduced?.()) return true;
    if (performance.now() < lockUntil) return false;
    if (railRaf || carousel?.isAnimating?.()) return false;
    if (document.querySelector('.story-keep.is-letter-open')) return false;
    if (document.querySelector('dialog[open]')) return false;
    return introReady?.() ?? true;
  }

  function step(direction) {
    if (!canNavigate()) return false;
    if (direction > 0 && index < PANELS.length - 1) {
      setIndex(index + 1, { fromUser: true });
      return true;
    }
    if (direction < 0 && index > 0) {
      setIndex(index - 1, { fromUser: true });
      return true;
    }
    return false;
  }

  function handleWheel(event) {
    if (event.ctrlKey) return false;
    const dominant = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!dominant) return false;
    if (!introReady?.()) {
      event.preventDefault();
      return true;
    }
    const id = panelId(index);
    if (id === 'home' && carousel?.handleWheel(event)) return true;
    if (panelWheel?.(id, event)) return true;
    if (Math.abs(dominant) < 4 && event.deltaMode === 0) {
      event.preventDefault();
      return true;
    }
    if (!canNavigate()) {
      event.preventDefault();
      return true;
    }
    const direction = Math.sign(dominant);
    if (step(direction)) {
      event.preventDefault();
      return true;
    }
    event.preventDefault();
    return true;
  }

  function onPointerDown(event) {
    if (!introReady?.() || event.button !== 0) return;
    if (event.target.closest('button, a, input, textarea, select, label, [data-letter], .sk-letter-view, .jl-card, [data-rail-target]')) return;
    if (panelId(index) === 'home') return;
    drag = {
      x: event.clientX,
      y: event.clientY,
      moved: false,
      pointerId: event.pointerId,
    };
  }

  function onPointerMove(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 10) return;
    drag.moved = true;
    if (Math.abs(dy) > Math.abs(dx) * 1.2) return;
    if (Math.abs(dx) > 56 && canNavigate()) {
      step(dx < 0 ? 1 : -1);
      drag = null;
    }
  }

  function onPointerUp(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
  }

  function onKeyDown(event) {
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      if (step(1)) event.preventDefault();
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      if (step(-1)) event.preventDefault();
    }
  }

  function syncFromHash() {
    const id = (location.hash || '#home').slice(1).split('/')[0] || 'home';
    const mapped = { studio: 'about', work: 'portfolio', lab: 'original' }[id] || id;
    if (PANELS.includes(mapped)) goTo(mapped, true);
  }

  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', () => moveTo(panelId(index), true));

  document.querySelector('#home')?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-rail-target]');
    if (!card) return;
    event.preventDefault();
    if (!canNavigate()) return;
    const id = card.dataset.railTarget;
    if (!PANELS.includes(id)) return;
    onCardSelect?.(id);
    goTo(id, false);
  });

  const watchIntro = () => {
    if (introReady?.()) {
      root.dataset.railReady = 'true';
      return;
    }
    requestAnimationFrame(watchIntro);
  };
  watchIntro();

  syncFromHash();
  moveTo(panelId(index), true);
  onPanel?.(panelId(index), { initial: true });

  return {
    panels: PANELS,
    handleWheel,
    goTo,
    getPanel: () => panelId(index),
    getIndex: () => index,
    syncFromHash,
  };
}
