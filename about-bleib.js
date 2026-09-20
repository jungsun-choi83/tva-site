import { applyI18n } from './i18n.js?v=eb-20260920r';

function initAboutBleib() {
  const about = document.querySelector('#about.about-bleib');
  if (!about) return;

  const track = about.querySelector('.studio-track');
  const stations = about.querySelectorAll('.studio-station');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.classList.contains('reduced-motion');

  track?.classList.add('about-bleib-type');

  function syncFlippedState() {
    const any = [...stations].some((s) => s.classList.contains('is-flipped'));
    about.classList.toggle('has-flipped-card', any);
  }

  function restoreGoldPanel(panel) {
    const drawer = panel.querySelector('.beam-gold__drawer');
    if (drawer) {
      const inner = drawer.querySelector('.beam-gold__drawer-inner') || drawer;
      [...inner.children].forEach((node) => panel.insertBefore(node, drawer));
      drawer.remove();
    }
    const head = panel.querySelector('.beam-gold__head');
    if (head) {
      [...head.children].forEach((node) => panel.insertBefore(node, head));
      head.remove();
    }
    panel.classList.remove('is-open');
  }

  function ensureGoldBars(panel) {
    let bars = panel.querySelector('.beam-gold__bars');
    if (!bars) {
      bars = document.createElement('button');
      bars.type = 'button';
      bars.className = 'beam-gold__bars';
      bars.setAttribute('aria-expanded', 'true');
      bars.innerHTML = '<span aria-hidden="true"><i></i><i></i></span>';
      panel.append(bars);
    }
    const label = panel.querySelector('.beam-gold__kicker-ko')?.textContent
      || panel.querySelector('.beam-gold__kicker')?.textContent
      || 'detail';
    bars.setAttribute('aria-label', label);
    bars.tabIndex = -1;
    bars.setAttribute('aria-hidden', 'true');
  }

  function nudgeGold(panel) {
    if (reduced) return;
    panel.classList.remove('is-nudged');
    void panel.offsetWidth;
    panel.classList.add('is-nudged');
    panel.addEventListener('animationend', () => panel.classList.remove('is-nudged'), { once: true });
  }

  function setupFlipCards() {
    stations.forEach((station, index) => {
      if (station.querySelector('.about-bleib-flip')) return;

      station.dataset.typeSlot = String(index);

      const title = station.querySelector('.beam-gold__kicker')?.textContent?.trim()
        || station.dataset.station
        || 'Section';

      const flip = document.createElement('div');
      flip.className = 'about-bleib-flip';

      const inner = document.createElement('div');
      inner.className = 'about-bleib-flip__inner';

      const front = document.createElement('button');
      front.type = 'button';
      front.className = 'about-bleib-flip__face about-bleib-flip__face--front';
      front.setAttribute('aria-expanded', 'false');
      front.innerHTML = `<span class="about-bleib-type__title">${title}</span>`;

      const back = document.createElement('div');
      back.className = 'about-bleib-flip__face about-bleib-flip__face--back';
      back.setAttribute('aria-hidden', 'true');

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'about-bleib-flip__close';
      close.setAttribute('data-i18n', 'about.bleib.cardClose');
      close.textContent = '닫기';

      while (station.firstChild) back.append(station.firstChild);
      back.prepend(close);

      inner.append(front, back);
      flip.append(inner);
      station.append(flip);

      function setOpen(open) {
        const lockY = window.scrollY;
        station.classList.toggle('is-flipped', open);
        front.setAttribute('aria-expanded', open ? 'true' : 'false');
        back.setAttribute('aria-hidden', open ? 'false' : 'true');
        syncFlippedState();
        if (open) {
          requestAnimationFrame(() => {
            window.scrollTo({ top: lockY, left: 0, behavior: 'instant' });
          });
        }
      }

      front.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      });
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(false);
        front.focus({ preventScroll: true });
      });
    });
  }

  function setupGoldPanels() {
    about.querySelectorAll('.beam-gold').forEach((panel) => {
      restoreGoldPanel(panel);
      ensureGoldBars(panel);
      if (panel.dataset.goldReady === '1') return;
      panel.dataset.goldReady = '1';
      panel.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!about.classList.contains('is-grid-open')) about._ebBleibOpen?.();
        nudgeGold(panel);
      });
    });
  }

  setupFlipCards();
  setupGoldPanels();
  applyI18n(about);

  function resetFlips() {
    stations.forEach((station) => {
      station.classList.remove('is-flipped');
      const front = station.querySelector('.about-bleib-flip__face--front');
      const back = station.querySelector('.about-bleib-flip__face--back');
      front?.setAttribute('aria-expanded', 'false');
      back?.setAttribute('aria-hidden', 'true');
    });
    about.classList.remove('has-flipped-card');
  }

  function revealStations() {
    stations.forEach((station) => {
      station.inert = false;
      station.classList.add('is-inview');
    });
  }

  about.addEventListener('eb:bleib-open', () => {
    revealStations();
    resetFlips();
    about.querySelectorAll('.beam-gold.is-open').forEach((panel) => panel.classList.remove('is-open'));
  });

  about.addEventListener('eb:bleib-close', () => {
    resetFlips();
    stations.forEach((station) => station.classList.remove('is-inview'));
    about.querySelectorAll('.beam-gold.is-nudged').forEach((panel) => panel.classList.remove('is-nudged'));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAboutBleib, { once: true });
} else initAboutBleib();
