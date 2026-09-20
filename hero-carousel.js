export function initHomeCarousel(isReduced) {
  const track = document.querySelector('.jl-track');
  const viewport = document.querySelector('.jl-carousel');
  if (!track || !viewport) return null;

  let x = 0;
  let target = 0;
  let raf = 0;

  function maxScroll() {
    return Math.max(0, track.scrollWidth - viewport.clientWidth + 1);
  }

  function paint() {
    track.style.transform = `translate3d(${-x}px,0,0)`;
  }

  function tick() {
    const diff = target - x;
    if (Math.abs(diff) < 0.6 || isReduced?.()) {
      x = target;
      paint();
      raf = 0;
      return;
    }
    x += diff * 0.09;
    paint();
    raf = requestAnimationFrame(tick);
  }

  function nudge(delta) {
    const max = maxScroll();
    const next = Math.max(0, Math.min(max, target + delta));
    if (next === target) return { atStart: target <= 0, atEnd: target >= max - 1 };
    target = next;
    if (!raf) raf = requestAnimationFrame(tick);
    return { atStart: target <= 0, atEnd: target >= max - 1 };
  }

  function handleWheel(event) {
    const delta = (event.deltaY || event.deltaX) * (event.deltaMode === 1 ? 16 : 1);
    if (!delta) return false;
    if (Math.abs(delta) < 2 && event.deltaMode === 0) {
      event.preventDefault();
      return true;
    }
    const before = target;
    const edge = nudge(delta * 0.95);
    const moved = target !== before;
    if (moved) {
      event.preventDefault();
      return true;
    }
    if (delta > 0 && edge.atEnd) return false;
    if (delta < 0 && edge.atStart) return false;
    event.preventDefault();
    return true;
  }

  let drag = null;

  function onPointerDown(event) {
    if (event.button !== 0) return;
    if (!event.target.closest('.jl-carousel')) return;
    if (event.target.closest('[data-rail-target]')) return;
    drag = { x: event.clientX, start: target, pointerId: event.pointerId };
  }

  function onPointerMove(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = drag.x - event.clientX;
    target = Math.max(0, Math.min(maxScroll(), drag.start + dx));
    x = target;
    paint();
  }

  function onPointerUp(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  window.addEventListener('resize', () => {
    target = Math.min(target, maxScroll());
    x = target;
    paint();
  });

  return {
    handleWheel,
    reset() {
      target = 0;
      x = 0;
      paint();
    },
    isAnimating: () => Boolean(raf),
  };
}
