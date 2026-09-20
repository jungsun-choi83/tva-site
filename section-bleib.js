const GATE_CFG = [
  {
    section: '#about.about-bleib',
    board: '.about-bleib-board',
    panel: '.about-bleib-grid',
    back: '[data-bleib-back]',
    openClass: 'is-grid-open',
    dataKey: 'aboutGrid',
    dataOpen: 'open',
    dataOff: 'off',
  },
  {
    section: '#portfolio.portfolio-bleib',
    board: '[data-bleib-board]',
    panel: '[data-bleib-panel]',
    back: '[data-bleib-back]',
    openClass: 'is-bleib-open',
    dataKey: 'portfolioBleib',
    dataOpen: 'open',
    dataOff: 'off',
  },
  {
    section: '#original.story-keep-bleib',
    board: '[data-bleib-board]',
    panel: '[data-bleib-panel]',
    back: '[data-bleib-back]',
    openClass: 'is-bleib-open',
    dataKey: 'journeyBleib',
    dataOpen: 'open',
    dataOff: 'off',
  },
  {
    section: '#contact.contact-bleib',
    board: '[data-bleib-board]',
    panel: '[data-bleib-panel]',
    back: '[data-bleib-back]',
    openClass: 'is-bleib-open',
    dataKey: 'contactBleib',
    dataOpen: 'open',
    dataOff: 'off',
  },
];

function initGate(cfg) {
  const section = document.querySelector(cfg.section);
  if (!section) return;

  const board = section.querySelector(cfg.board);
  const panel = section.querySelector(cfg.panel);
  const back = section.querySelector(cfg.back);
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    || root.classList.contains('reduced-motion');

  function setOpen(open) {
    section.classList.toggle(cfg.openClass, open);
    if (cfg.dataKey) root.dataset[cfg.dataKey] = open ? cfg.dataOpen : cfg.dataOff;
    if (board) board.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (back) back.hidden = !open;
    if (open) {
      section.dispatchEvent(new CustomEvent('eb:bleib-open', { bubbles: true }));
      requestAnimationFrame(() => panel?.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' }));
    } else {
      section.dispatchEvent(new CustomEvent('eb:bleib-close', { bubbles: true }));
      requestAnimationFrame(() => board?.focus({ preventScroll: true }));
    }
  }

  function open() {
    if (section.classList.contains(cfg.openClass)) return;
    setOpen(true);
  }

  function close() {
    if (!section.classList.contains(cfg.openClass)) return;
    setOpen(false);
  }

  board?.addEventListener('click', open);
  back?.addEventListener('click', close);

  section._ebBleibOpen = open;
  section._ebBleibClose = close;
}

export function initBleibGates() {
  GATE_CFG.forEach(initGate);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBleibGates, { once: true });
} else initBleibGates();
