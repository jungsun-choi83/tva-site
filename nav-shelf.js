// 상단 메뉴 — 현재 구역 표시(is-here)만. (우주복 캐릭터 이동 연출 제거)

export function initNavShelf(nav) {
  if (!nav) return;
  const links = [...nav.querySelectorAll('nav a')];
  if (!links.length) return;
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (sections.length !== links.length) return;
  const linkless = [];

  function currentIndex() {
    const marked = links.findIndex((a) => a.hasAttribute('aria-current'));
    if (marked >= 0) return marked;
    const line = innerHeight * 0.38;
    for (const s of linkless) {
      const r = s.getBoundingClientRect();
      if (r.top <= line && r.bottom > innerHeight * 0.2) return -1;
    }
    let idx = 0;
    sections.forEach((s, i) => {
      if (s.getBoundingClientRect().top <= line) idx = i;
    });
    return idx;
  }

  function syncHere() {
    const idx = currentIndex();
    links.forEach((a, i) => a.classList.toggle('is-here', i === idx));
  }

  addEventListener('scroll', syncHere, { passive: true });
  addEventListener('hashchange', syncHere);
  addEventListener('tva:navigate', syncHere);
  addEventListener('resize', syncHere, { passive: true });
  new MutationObserver(syncHere).observe(nav, { attributes: true, attributeFilter: ['class'] });
  links.forEach((a) => {
    new MutationObserver(syncHere).observe(a, { attributes: true, attributeFilter: ['aria-current'] });
  });
  syncHere();
}
