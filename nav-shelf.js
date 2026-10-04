export function initNavShelf(nav) {
  if (!nav) return;
  const links = [...nav.querySelectorAll('nav a')];
  if (!links.length) return;
  const menuToggle = nav.querySelector('.nav-menu-toggle');
  const mobileMenu = nav.querySelector('#site-mobile-menu');
  const closeMobileMenu = () => {
    nav.classList.remove('is-mobile-menu-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Open menu');
  };
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      const open = !nav.classList.contains('is-mobile-menu-open');
      nav.classList.toggle('is-mobile-menu-open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    links.forEach(link => link.addEventListener('click', closeMobileMenu));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMobileMenu();
    });
  }

  nav.querySelectorAll('.nav-mascot').forEach((el) => el.remove());

  const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (sections.length !== links.length) return;

  let current = -2;
  function markHere() {
    const marked = links.findIndex(a => a.hasAttribute('aria-current'));
    let idx = marked;
    if (idx < 0) {
      const line = innerHeight * .38;
      idx = 0;
      sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) idx = i; });
    }
    if (idx === current) return;
    current = idx;
    links.forEach((a, i) => a.classList.toggle('is-here', i === idx));
  }

  addEventListener('scroll', markHere, { passive: true });
  addEventListener('resize', markHere, { passive: true });
  addEventListener('hashchange', markHere);
  addEventListener('tva:navigate', markHere);
  new MutationObserver(markHere).observe(nav, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
  markHere();
}
