import {
  announce,
  clamp,
  createDrag,
  createSpring,
  prefersReducedMotion,
  projectConcave,
  projectMomentum,
  setCurrent,
  works,
  wrap,
} from './core.mjs';
import { WORKMARK_SVG, WORKMARK_MOBILE_SVG } from './workmark-svg.mjs?v=paper-type-r1.hf44f96b5';

const main = document.querySelector('[data-gallery]');
const stage = document.querySelector('#stage');
const galleryId = main?.dataset.gallery;
const photo = (work) => `../assets/photos/optimized/${work.file.replace('.jpg', '.avif')}`;
const load = (index, priority = 0) => (index === priority ? 'fetchpriority="high"' : 'loading="lazy" fetchpriority="low"');
const signedOffset = (value, center, length) => wrap(value - center + length / 2, 0, length) - length / 2;
const controls = '<div class="controls"><button class="round-control prev" data-prev aria-label="Previous work"></button><button class="round-control" data-next aria-label="Next work"></button></div>';

if (!document.querySelector('meta[name="description"]')) {
  const description = document.createElement('meta');
  description.name = 'description';
  description.content = 'Records of people who have been with Eternal Beam — influencer collaborations, letters, and displays.';
  document.head.append(description);
}

function numberKeyIndex(event) {
  const number = Number(event.key);
  return Number.isInteger(number) && number >= 1 && number <= works.length ? number - 1 : null;
}

function trackImageFallback(image, owner) {
  const setFailed = (failed) => {
    image.classList.toggle('is-error', failed);
    owner.toggleAttribute('data-image-error', failed);
  };
  image.addEventListener('load', () => setFailed(false));
  image.addEventListener('error', () => setFailed(true));
  if (image.complete) setFailed(image.naturalWidth === 0);
}

function createProjectDock({ initial = 0, count = works.length, onOpen = () => {} } = {}) {
  document.body.classList.add('has-project-flow');
  const dock = document.createElement('div');
  dock.className = 'project-dock';
  dock.innerHTML = '<div class="project-dock__meta"><strong></strong><span></span></div><button type="button">Open project</button>';
  document.body.append(dock);
  const button = dock.querySelector('button');
  let index = wrap(initial, 0, count);
  const render = () => {
    const work = works[index];
    dock.querySelector('strong').textContent = work.title || '';
    // 분야·연도 중 있는 것만 이어 붙인다(둘 다 없으면 줄이 비어 사라진다).
    dock.querySelector('span').textContent = [work.discipline, work.year].filter(Boolean).join(' · ');
  };
  const set = (next) => { index = wrap(next, 0, count); render(); };
  button.addEventListener('click', () => onOpen(index, button));
  render();
  return { button, set, get index() { return index; } };
}

function createPortfolioFlow({
  initial = 0,
  count = works.length,
  onNavigate = () => {},
  onOpen = () => {},
  onClose = () => {},
  getWorks = () => works,
  getMediaOrigin = null,
  dismissOnSurfaceClick = false,
  showDock = true,
} = {}) {
  document.body.classList.add('has-project-flow');
  const dock = document.createElement('div');
  dock.className = 'project-dock';
  dock.innerHTML = '<div class="project-dock__meta"><strong></strong><span></span></div><button type="button">Open project</button>';
  const dialog = document.createElement('dialog');
  dialog.className = 'project-sheet';
  dialog.classList.toggle('project-sheet--spatial', Boolean(getMediaOrigin));
  dialog.classList.toggle('project-sheet--click-dismiss', dismissOnSurfaceClick);
  dialog.setAttribute('aria-labelledby', 'project-sheet-title');
  dialog.innerHTML = `<div class="project-sheet__media"><img alt=""></div><article class="project-sheet__copy"><span class="project-sheet__eyebrow"></span><h2 id="project-sheet-title"></h2><dl><div><dt>Discipline</dt><dd data-discipline></dd></div><div><dt>Year</dt><dd data-year></dd></div></dl><div class="project-sheet__actions"><button class="round-control prev" data-project-prev aria-label="Previous project"></button><button class="round-control" data-project-next aria-label="Next project"></button><button class="project-sheet__back" data-project-close>Back to gallery</button></div></article>`;
  if (showDock) document.body.append(dock);
  document.body.append(dialog);
  const openButton = dock.querySelector('button');
  const detailMedia = dialog.querySelector('.project-sheet__media');
  const detailImage = detailMedia.querySelector('img');
  const detailCopy = dialog.querySelector('.project-sheet__copy');
  let index = wrap(initial, 0, count);
  let returnFocus = openButton;
  let openedFromMedia = false;
  let transitioning = false;
  let idle = Promise.resolve();
  let settleIdle = null;
  let hiddenOrigin = null;
  const getWork = () => getWorks()[index];

  // 상세창의 한 줄(dt+dd)을 채운다. 값이 없으면 그 줄을 통째로 감춘다 —
  // 자료가 아직 없는 작품에 빈 'Discipline / Year' 줄이 남지 않게.
  const fillRow = (selector, value) => {
    const cell = dialog.querySelector(selector);
    if (!cell) return Boolean(value);
    cell.textContent = value || '';
    const row = cell.closest('div');
    if (row) row.hidden = !value;
    return Boolean(value);
  };
  const render = () => {
    const work = getWork();
    dock.querySelector('strong').textContent = work.title || '';
    dock.querySelector('span').textContent = [work.discipline, work.year].filter(Boolean).join(' · ');
    detailImage.src = photo(work);
    detailImage.alt = work.title || '';
    dialog.querySelector('.project-sheet__eyebrow').textContent = `Project ${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
    dialog.querySelector('h2').textContent = work.title || '';
    const hasDiscipline = fillRow('[data-discipline]', work.discipline);
    const hasYear = fillRow('[data-year]', work.year);
    const list = dialog.querySelector('dl');
    if (list) list.hidden = !hasDiscipline && !hasYear;
  };
  const set = (next) => { index = wrap(next, 0, count); render(); };

  const revealOrigin = () => {
    if (hiddenOrigin) hiddenOrigin.style.visibility = '';
    hiddenOrigin = null;
  };

  const concealOrigin = (origin) => {
    revealOrigin();
    hiddenOrigin = origin;
    if (hiddenOrigin) hiddenOrigin.style.visibility = 'hidden';
  };

  const flyMedia = async (from, to) => {
    if (!getMediaOrigin || prefersReducedMotion() || !from || !to) return;
    const fromRect = from.getBoundingClientRect();
    const toRect = to.getBoundingClientRect();
    if (!fromRect.width || !fromRect.height || !toRect.width || !toRect.height) return;

    const sourceImage = from.matches('img') ? from : from.querySelector('img');
    const flight = document.createElement('div');
    const flightImage = sourceImage?.cloneNode(false) ?? document.createElement('img');
    flight.className = 'project-flight';
    flightImage.alt = '';
    flightImage.removeAttribute('loading');
    flightImage.removeAttribute('fetchpriority');
    if (!flightImage.getAttribute('src')) flightImage.src = photo(getWork());
    flight.append(flightImage);
    dialog.append(flight);
    Object.assign(flight.style, {
      left: `${fromRect.left}px`,
      top: `${fromRect.top}px`,
      width: `${fromRect.width}px`,
      height: `${fromRect.height}px`,
    });
    const animation = flight.animate([
      {
        left: `${fromRect.left}px`,
        top: `${fromRect.top}px`,
        width: `${fromRect.width}px`,
        height: `${fromRect.height}px`,
        borderRadius: getComputedStyle(from).borderRadius,
      },
      {
        left: `${toRect.left}px`,
        top: `${toRect.top}px`,
        width: `${toRect.width}px`,
        height: `${toRect.height}px`,
        borderRadius: getComputedStyle(to).borderRadius,
      },
    ], {
      duration: 700,
      easing: 'cubic-bezier(.16,1,.3,1)',
      fill: 'both',
    });
    await animation.finished;
    flight.remove();
  };

  const open = async (trigger = openButton) => {
    if (transitioning || dialog.open) return idle;
    returnFocus = trigger;
    openedFromMedia = Boolean(trigger.closest?.('.g02-card'));
    render();
    const origin = getMediaOrigin?.();
    const spatial = Boolean(origin && !prefersReducedMotion());
    transitioning = true;
    idle = new Promise((resolve) => { settleIdle = resolve; });
    try {
      if (spatial) dialog.classList.add('is-entering', 'is-flight');
      dialog.showModal();
      if (origin) concealOrigin(origin);
      if (spatial) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const flight = flyMedia(origin, detailMedia);
        requestAnimationFrame(() => dialog.classList.remove('is-entering'));
        await flight;
        dialog.classList.remove('is-flight');
      } else if (!prefersReducedMotion()) {
        dialog.animate([
          { opacity: 0, transform: 'translateY(16px) scale(.985)' },
          { opacity: 1, transform: 'none' },
        ], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
      dialog.querySelector('[data-project-close]').focus({ preventScroll: true });
      announce(`${getWork().title} project detail opened.`);
      onOpen(index);
    } finally {
      transitioning = false;
      settleIdle?.();
      settleIdle = null;
    }
  };

  const close = async () => {
    if (transitioning) {
      await idle;
      return dialog.open ? close() : undefined;
    }
    if (!dialog.open) return undefined;
    const origin = getMediaOrigin?.();
    const spatial = Boolean(origin && !prefersReducedMotion());
    transitioning = true;
    idle = new Promise((resolve) => { settleIdle = resolve; });
    try {
      if (spatial) {
        concealOrigin(origin);
        dialog.classList.add('is-flight');
        const flight = flyMedia(detailMedia, origin);
        requestAnimationFrame(() => dialog.classList.add('is-leaving'));
        await flight;
      }
      dialog.close();
      dialog.classList.remove('is-flight', 'is-leaving', 'is-entering');
      revealOrigin();
      const focusTarget = openedFromMedia ? getMediaOrigin?.() : returnFocus;
      focusTarget?.focus({ preventScroll: true });
      announce('Returned to the gallery.');
      onClose();
    } finally {
      transitioning = false;
      settleIdle?.();
      settleIdle = null;
    }
  };

  const animateDetailChange = (direction) => {
    if (!getMediaOrigin || prefersReducedMotion()) return;
    const distance = direction * 10;
    for (const element of [detailMedia, detailCopy]) {
      element.animate([
        { opacity: .45, transform: `translateX(${distance}px)` },
        { opacity: 1, transform: 'none' },
      ], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
  };

  const navigate = (direction) => {
    if (transitioning) return;
    revealOrigin();
    set(index + direction);
    onNavigate(index);
    if (getMediaOrigin) concealOrigin(getMediaOrigin());
    animateDetailChange(direction);
    announce(`${getWork().title} project detail.`);
  };

  openButton.addEventListener('click', () => { void open(openButton); });
  dialog.querySelector('[data-project-prev]').addEventListener('click', () => navigate(-1));
  dialog.querySelector('[data-project-next]').addEventListener('click', () => navigate(1));
  dialog.querySelector('[data-project-close]').addEventListener('click', () => { void close(); });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); void close(); });
  dialog.addEventListener('click', (event) => {
    const interactive = event.target.closest?.('button,a,label,input,select,textarea,[contenteditable]:not([contenteditable="false"])');
    if (!interactive && (dismissOnSurfaceClick || event.target === dialog)) void close();
  });
  trackImageFallback(detailImage, detailMedia);
  render();
  return { set, open, close, whenIdle() { return idle; }, get index() { return index; } };
}

function init01() {
  stage.classList.add('g01-stage');
  const selectedWorks = works.slice(0, 5);
  const slots = [-2, -1, 0, 1, 2];
  stage.innerHTML = `<span class="g01-point" aria-hidden="true"></span>${selectedWorks.map((work, index) => {
    const slot = slots[index];
    const distance = Math.abs(slot);
    return `<button class="g01-plane" data-index="${index}" style="--tx:${slot * Math.min(innerWidth * .17, 210)}px;--ty:${distance * 22}px;--rotate:${slot * 7}deg;--scale:${1 - distance * .07};--distance:${distance}" aria-label="Open ${work.title}"><img src="${photo(work)}" ${load(index, 2)} alt=""></button>`;
  }).join('')}<button class="g01-replay" type="button">Replay opening</button>`;
  const planes = [...stage.querySelectorAll('.g01-plane')];
  let overlay = null;
  let selected = 2;
  let timer = 0;
  let portfolio = null;

  const fan = () => requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('is-fanned')));

  const close = ({ restoreFocus = true } = {}) => {
    if (!overlay) return;
    const target = planes[selected].getBoundingClientRect();
    const bounds = stage.getBoundingClientRect();
    overlay.style.left = `${target.left - bounds.left}px`;
    overlay.style.top = `${target.top - bounds.top}px`;
    overlay.style.width = `${target.width}px`;
    overlay.style.height = `${target.height}px`;
    overlay.style.borderRadius = '2px';
    const leaving = overlay;
    overlay = null;
    stage.classList.remove('is-open');
    setTimeout(() => {
      leaving.remove();
      planes[selected].style.visibility = '';
      if (restoreFocus) planes[selected].focus({ preventScroll: true });
    }, prefersReducedMotion() ? 0 : 720);
    announce('Returned to the five image fan.');
  };

  const open = (index) => {
    clearTimeout(timer);
    if (overlay) close({ restoreFocus: false });
    selected = index;
    portfolio?.set(index);
    const plane = planes[index];
    const rect = plane.getBoundingClientRect();
    const bounds = stage.getBoundingClientRect();
    const work = selectedWorks[index];
    overlay = document.createElement('figure');
    overlay.className = 'g01-full';
    overlay.style.left = `${rect.left - bounds.left}px`;
    overlay.style.top = `${rect.top - bounds.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.borderRadius = '2px';
    overlay.innerHTML = `<img src="${photo(work)}" fetchpriority="high" alt="${work.title || 'Sample record ' + (index + 1)}"><figcaption><span>${work.title}</span><span>${work.year}</span></figcaption><button class="round-control close" aria-label="Close full image"></button>`;
    stage.append(overlay);
    stage.classList.add('is-open');
    requestAnimationFrame(() => {
      overlay.style.left = '0px';
      overlay.style.top = '0px';
      overlay.style.width = `${bounds.width}px`;
      overlay.style.height = `${bounds.height}px`;
      overlay.style.borderRadius = '0px';
    });
    setTimeout(() => { plane.style.visibility = 'hidden'; }, prefersReducedMotion() ? 0 : 680);
    overlay.querySelector('button').addEventListener('click', () => close());
    announce(`${work.title} expanded to full bleed.`);
  };

  planes.forEach((plane, index) => plane.addEventListener('click', () => open(index)));
  stage.querySelector('.g01-replay').addEventListener('click', () => {
    clearTimeout(timer);
    close({ restoreFocus: false });
    planes.forEach((plane) => { plane.style.visibility = ''; });
    stage.classList.remove('is-fanned');
    requestAnimationFrame(fan);
    announce('Opening sequence replayed.');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
    const index = numberKeyIndex(event);
    if (index !== null && index < selectedWorks.length) open(index);
  });
  portfolio = createPortfolioFlow({ initial: selected, count: selectedWorks.length, onNavigate: (index) => open(index) });
  fan();
  if (!prefersReducedMotion()) timer = setTimeout(() => open(2), 1550);
}

function init02() {
  // ── 작품 한 장의 자료 ────────────────────────────────────────────────
  // 실제 프로젝트 자료가 오면 아래 categories 목록의 값만 바꾸면 된다.
  //   title      작품 이름            (비면 카드 이름·설명 글자가 사라진다)
  //   discipline 분야                 (비면 상세창 'Discipline' 줄이 통째로 사라진다)
  //   year       연도                 (비면 상세창 'Year' 줄이 통째로 사라진다)
  //   file/crop  사진 파일과 보일 위치
  // (2026-09-12) 개발용 메모 칸(source)을 없앴다. 어느 사진 파일을 어떻게 잘라 쓰는지
  // 적어 둔 작업 메모가 카드마다 속성으로 붙어 공개 화면 코드에 그대로 실려 나갔다.
  const record = (id, title, discipline, year, file, crop) => ({
    id,
    title,
    discipline,
    year,
    file,
    crop,
  });
  const macFolderIcon = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path class="g02-icon-shadow g02-icon-folder-shadow" d="M9 50h46v4H9z"/><path class="g02-icon-folder-back" d="M7 18a4 4 0 0 1 4-4h13l5 6h24a4 4 0 0 1 4 4v17a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4z"/><path class="g02-icon-folder-tab" d="M8 18a3 3 0 0 1 3-3h12l5 5H8z"/><path class="g02-icon-folder-content" d="M17 14h32v28H17z"/><path class="g02-icon-folder-front" d="M7 24h50l-3 18a4 4 0 0 1-4 3H11a4 4 0 0 1-4-4z"/><path class="g02-icon-folder-highlight" d="M9 25h46"/><path class="g02-icon-folder-seam" d="M9 27h45"/><g class="g02-icon-open-folder"><path class="g02-icon-open-folder-body" d="M8 25a3 3 0 0 1 3-3h14l4 4h24a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z"/><path class="g02-icon-open-folder-sheet" d="M17 14h31v27H17z"/><path class="g02-icon-open-folder-flap" d="M8 29h48l-3 12a3 3 0 0 1-3 2H11a3 3 0 0 1-3-3z"/></g></svg>';
  // ── 작품 한 장의 자료 ────────────────────────────────────────────────
  // 지금 걸려 있는 것은 전부 '예시'다. 실제 촬영본과 이름이 오면 아래 값만 바꾸면 된다.
  //   title      작품 이름   (비면 카드 이름·설명 글자가 통째로 사라진다)
  //   discipline 분야        (비면 상세창 'Discipline' 줄이 사라진다)
  //   year       연도        (비면 상세창 'Year' 줄이 사라진다)
  //   file/crop  사진 파일과 보일 위치
  //
  // 2026-09-12: 예전에는 여기에 'Beam with Mina', 'Live letter drop' 같은 이름과
  // 2024~2026 연도가 적혀 있어, 실제로 한 일처럼 보였다. 확인된 실적이 아니므로
  // 이름은 SAMPLE 번호로 돌리고 연도는 비웠다. 잘라내기 위치(crop)는 손으로 맞춘
  // 값이라 그대로 둔다. 실제 자료가 들어오면 #portfolio 의 '예시' 띠도 같이 내린다
  // (index.html 의 .portfolio-sample-note).
  const recordCategories = {
    influencer: {
      key: 'influencer',
      label: 'Influencer',
      blurb: 'Creator stories',
      iconName: 'folder',
      icon: macFolderIcon,
      items: [
        record('brand-01', 'SAMPLE 01', 'Influencer', '', '01.jpg', '50% 42%'),
        record('brand-02', 'SAMPLE 02', 'Influencer', '', '02.jpg', '42% 50%'),
        record('brand-03', 'SAMPLE 03', 'Influencer', '', '03.jpg', '58% 45%'),
        record('brand-04', 'SAMPLE 04', 'Influencer', '', '04.jpg', '48% 38%'),
        record('brand-05', 'SAMPLE 05', 'Influencer', '', '05.jpg', '55% 53%'),
        record('brand-06', 'SAMPLE 06', 'Influencer', '', '06.jpg', '43% 46%'),
        record('brand-07', 'SAMPLE 07', 'Influencer', '', '07.jpg', '62% 50%'),
        record('brand-08', 'SAMPLE 08', 'Influencer', '', '08.jpg', '50% 58%'),
      ],
    },
    together: {
      key: 'together',
      label: 'Together',
      blurb: 'Shared moments',
      iconName: 'folder',
      icon: macFolderIcon,
      items: [
        ...Array.from({ length: 8 }, (_, index) => record(`together-${index + 1}`, `SAMPLE ${String(index + 1).padStart(2, '0')}`, 'Together', '', `together/t${index + 1}.png`, '50% 50%')),
      ],
    },
    letters: {
      key: 'letters',
      label: 'Letters',
      blurb: 'Soul Trace letters',
      iconName: 'folder',
      icon: macFolderIcon,
      items: [
        ...Array.from({ length: 8 }, (_, index) => record(`letter-${index + 1}`, `LETTER ${String(index + 1).padStart(2, '0')}`, 'Soul Trace', '', `letters/l${index + 1}.png`, '50% 50%')),
      ],
    },
    display: {
      key: 'display',
      label: 'Display',
      blurb: 'Eternal Beam memories',
      iconName: 'folder',
      icon: macFolderIcon,
      items: [
        ...Array.from({ length: 4 }, (_, index) => record(`display-${index + 1}`, `DISPLAY ${String(index + 1).padStart(2, '0')}`, 'Eternal Beam', '', `display/d${index + 1}.png`, '50% 50%')),
      ],
    },
  };
  const categoryKeys = Object.keys(recordCategories);
  const categories = categoryKeys.map(key => recordCategories[key]);
  // Keep the original 11-card wheel density; shorter categories reuse only
  // their own records as internal slots for the continuous loop.
  const wheelSlotCount = 11;
  const influencerWheelItems = [
    ...recordCategories.influencer.items,
    record('brand-09', 'SAMPLE 09', 'Influencer', '', '01.jpg', '35% 54%'),
    record('brand-10', 'SAMPLE 10', 'Influencer', '', '04.jpg', '66% 42%'),
    record('brand-11', 'SAMPLE 11', 'Influencer', '', '03.jpg', '40% 62%'),
  ];
  const fillWheelSlots = (items, key) => {
    if (key === 'influencer') return influencerWheelItems;
    return Array.from({ length: Math.max(wheelSlotCount, items.length) }, (_, index) => items[index % items.length]);
  };
  const initialWorks = fillWheelSlots(recordCategories.influencer.items, 'influencer');
  const pullerRig = '<button class="g02-puller" type="button" aria-label="Show the next project" data-gallery-role="archive-guide" data-archive-state="ready" data-phase="rest" data-direction="0" data-position="0"></button>';
  stage.classList.add('g02-stage');
  stage.tabIndex = 0;
  stage.setAttribute('role', 'region');
  stage.setAttribute('aria-roledescription', 'carousel');
  stage.setAttribute('aria-label', 'Records with us. Drag a record card, scroll over a card, or use arrow keys.');
  stage.innerHTML = `<nav class="g02-categories" aria-labelledby="g02-category-title"><h2 class="g02-categories__title" id="g02-category-title">STORIES WE'VE MADE TOGETHER<small>함께 만든 이야기</small></h2><div class="g02-category-list is-positioning" role="group" aria-label="Choose a record category">${categories.map((category, index) => `<button class="g02-category" type="button" data-category="${category.key}" aria-label="${String(index + 1).padStart(2, '0')} ${category.label}. ${category.blurb}" aria-pressed="${index === 0}"><span class="g02-category__icon" data-icon="${category.iconName}" aria-hidden="true">${category.icon}</span><span class="g02-category__label" aria-hidden="true">${category.label}</span><span class="g02-category__blurb">${category.blurb}</span></button>`).join('')}</div></nav><div class="g02-wheel">${initialWorks.map((work, index) => `<button class="g02-card" data-index="${index}" data-logical-id="${work.id}" aria-describedby="g02-caption-${index}" aria-label="${index ? 'Select' : 'Open'} ${work.title || 'record ' + (index + 1)}"><img src="${photo(work)}" style="object-position:${work.crop}" ${load(index)} alt="${work.title}"><span class="g02-card__title" aria-hidden="true"${work.title ? '' : ' hidden'}>${work.title}</span><span class="g02-card__caption" id="g02-caption-${index}"><strong aria-hidden="true"${work.title ? '' : ' hidden'}>${work.title}</strong><small${work.discipline ? '' : ' hidden'}>${work.discipline}</small><em${work.year ? '' : ' hidden'}>${work.year}</em></span></button>`).join('')}</div><button class="g02-nav g02-nav--prev" type="button" aria-label="Previous record">‹</button><button class="g02-nav g02-nav--next" type="button" aria-label="Next record">›</button><div class="g02-progress" role="group" aria-label="Choose a record"></div><h2 class="g02-workmark" aria-label="WITH US">WITH US</h2>${pullerRig}`;
  const workmark = stage.querySelector('.g02-workmark');
  workmark.textContent = 'WITH US';
  const cards = [...stage.querySelectorAll('.g02-card')];
  cards.forEach(card => trackImageFallback(card.querySelector('img'), card));
  const categoryList = stage.querySelector('.g02-category-list');
  const categoryButtons = [...stage.querySelectorAll('.g02-category')];
  const categoriesElement = stage.querySelector('.g02-categories');
  const puller = stage.querySelector('.g02-puller');
  const previousButton = stage.querySelector('.g02-nav--prev');
  const nextButton = stage.querySelector('.g02-nav--next');
  const progress = stage.querySelector('.g02-progress');
  let progressButtons = [];
  const GOYA_V = 'eb-20260914';
  const goyaSrc = file => new URL(`../../assets/goya/${file}?v=${GOYA_V}`, import.meta.url).href;
  const GOYA_BY_POSE = Object.freeze({
    read: 'idle.png',
    find: 'lookup.png',
    present: 'present.png',
    yield: 'sit.png',
    // 2026-09-12: walk1.png 만 긴소매 판이라 read·find·present·yield(전부 반소매)와 섞였다
    leave: 'walk-a.png',
    walk: 'walk-a.png',
  });
  const goyaFace = document.createElement('span');
  goyaFace.className = 'g02-puller__face';
  goyaFace.setAttribute('aria-hidden', 'true');
  const goyaImg = document.createElement('img');
  goyaImg.className = 'g02-puller__goya';
  goyaImg.alt = '';
  goyaImg.decoding = 'async';
  goyaImg.src = goyaSrc('idle.png');
  goyaFace.append(goyaImg);
  puller.append(goyaFace);
  const indexRig = {
    setPose(pose, { direction } = {}) {
      const next = goyaSrc(GOYA_BY_POSE[pose] || 'idle.png');
      if (goyaImg.getAttribute('src') !== next) goyaImg.src = next;
      puller.dataset.facing = Number(direction) < 0 ? '-1' : '1';
    },
    setCategory() {},
    stop() {},
  };
  const archivePoseByState = Object.freeze({
    arriving: 'leave',
    ready: 'read',
    preparing: 'find',
    category: 'find',
    tracking: 'walk',
    aside: 'yield',
    indicating: 'present',
    away: 'read',
  });
  let archiveDrawFrame = 0;
  const drawArchiveState = (state) => {
    cancelAnimationFrame(archiveDrawFrame);
    archiveDrawFrame = requestAnimationFrame(() => {
      archiveDrawFrame = 0;
      indexRig.setPose(archivePoseByState[state] || archivePoseByState.ready, {
        direction: Number(puller.dataset.direction) || 1,
      });
    });
  };
  puller.dataset.archiveAssetStatus = 'ready';
  const categoryPositions = Object.fromEntries(categoryKeys.map(key => [key, 0]));
  let activeCategory = 'influencer';
  let activeWorks = initialWorks;
  let position = 0;
  let current = -1;
  let wheelTimer = 0;
  let wheelGestureOrigin = null;
  let wheelGestureDelta = 0;
  let guideDirection = 0;
  let guideMoving = false;
  let guideSettleTimer = 0;
  let guideState = '';
  let archiveIdleTimer = 0;
  let archiveIdleIndex = 0;
  let rollTimer = 0;
  let rollPaused = false;
  let detailOpen = false;
  let galleryVisible = true;
  let portfolio = null;
  let suppressClick = false;
  let pressedCard = null;
  const iconStorageKey = mobile => `concept-02-category-icon-positions-free-v4-${mobile ? 'mobile' : 'desktop'}`;
  const referenceIconPositions = [
    { x: 75.879, y: 122.461 },
    { x: 233.387, y: 74.586 },
    { x: 173.492, y: 182.516 },
    { x: 90.703, y: 281.121 },
  ];
  let iconPositions = [];
  let iconPositionsAreDefault = true;
  let iconLayoutMobile = stage.clientWidth <= 760;
  let iconLayoutBounds = [];
  let activeIconDrag = null;
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  // 가만히 있을 때도 살아 있게: 쉬는 자세 → 살짝 몸 돌리기 → 쉬는 자세 → 작품 쪽을 가리키기
  const archiveIdleSteps = [
    { pose: 'read', hold: 2100 },
    { pose: 'present', hold: 900 },
    { pose: 'read', hold: 1500 },
    { pose: 'find', hold: 1150 },
    { pose: 'read', hold: 1400 },
    { pose: 'present', hold: 1150 },
  ];
  const archiveIdlePoses = archiveIdleSteps.map((step) => step.pose);
  const archiveIdleAllowed = () => (
    galleryVisible
    && !detailOpen
    && !document.hidden
    && !prefersReducedMotion()
    && !guideMoving
    && (puller.dataset.handoffActive !== 'true' || Number(puller.dataset.handoffProgress) >= .95)
    && guideState === 'ready'
    && puller.dataset.archiveAssetStatus === 'ready'
  );
  const stopArchiveIdle = () => {
    if (archiveIdleTimer) window.clearTimeout(archiveIdleTimer);
    archiveIdleTimer = 0;
  };

  const stopPortfolioRoll = () => {
    if (rollTimer) window.clearTimeout(rollTimer);
    rollTimer = 0;
  };
  const canPortfolioRoll = () => (
    galleryVisible
    && innerWidth > 760
    && !detailOpen
    && !document.hidden
    && !prefersReducedMotion()
    && !rollPaused
    && !stage.contains(document.activeElement)
    && !stage.matches(':hover')
    && puller.dataset.handoffActive !== 'true'
  );
  const schedulePortfolioRoll = () => {
    stopPortfolioRoll();
    if (!canPortfolioRoll()) return;
    rollTimer = window.setTimeout(() => {
      rollTimer = 0;
      if (!canPortfolioRoll()) return;
      select(current + 1, false);
      schedulePortfolioRoll();
    }, 4800);
  };
  const scheduleArchiveIdle = () => {
    stopArchiveIdle();
    if (!archiveIdleAllowed()) return;
    archiveIdleTimer = window.setTimeout(() => {
      archiveIdleTimer = 0;
      if (!archiveIdleAllowed()) return;
      archiveIdleIndex = (archiveIdleIndex + 1) % archiveIdleSteps.length;
      indexRig.setPose(archiveIdleSteps[archiveIdleIndex].pose, {
        direction: Number(puller.dataset.direction) || 1,
      });
      scheduleArchiveIdle();
    }, archiveIdleSteps[archiveIdleIndex].hold);
  };

  const readStoredIconPositions = (mobile) => {
    try {
      const stored = JSON.parse(localStorage.getItem(iconStorageKey(mobile)) || 'null');
      const items = Array.isArray(stored) ? stored : stored?.positions;
      if (!Array.isArray(items) || items.length !== categoryButtons.length) return null;
      const positions = items.map((item, index) => {
        const x = Number(item?.x);
        const y = Number(item?.y);
        if (stored?.normalized !== true) return { x, y };
        const bounds = iconBounds(categoryButtons[index]);
        return {
          x: x * bounds.maxX,
          y: y < 0 ? y * Math.abs(bounds.minY) : y * bounds.maxY,
        };
      });
      if (!positions.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))) return null;
      return { positions, isReference: Array.isArray(stored) && isReferenceIconPositions(positions) };
    } catch {
      return null;
    }
  };
  const isReferenceIconPositions = positions => positions.length === referenceIconPositions.length
    && positions.every((position, index) => (
      Math.abs(position.x - referenceIconPositions[index].x) <= 2
      && Math.abs(position.y - referenceIconPositions[index].y) <= 2
    ));

  const saveIconPositions = () => {
    try {
      const positions = iconPositions.map((point, index) => {
        const bounds = iconBounds(categoryButtons[index]);
        return {
          x: bounds.maxX ? point.x / bounds.maxX : 0,
          y: point.y < 0
            ? (bounds.minY ? point.y / Math.abs(bounds.minY) : 0)
            : (bounds.maxY ? point.y / bounds.maxY : 0),
        };
      });
      localStorage.setItem(iconStorageKey(iconLayoutMobile), JSON.stringify({ normalized: true, positions }));
    } catch {
      // file:// and privacy modes can make local storage unavailable.
    }
  };

  const iconBounds = (button) => {
    const stageRect = stage.getBoundingClientRect();
    const listRect = categoryList.getBoundingClientRect();
    return {
      minY: 8 - (listRect.top - stageRect.top),
      maxX: Math.max(0, categoryList.clientWidth - button.offsetWidth),
      maxY: Math.max(0, categoryList.clientHeight - button.offsetHeight),
    };
  };

  // 끌 때만 쓰는 넓은 범위: 기본 자리는 왼쪽 칸 안에 두되, 손으로는 오른쪽·위아래로 더 옮길 수 있게 (2026-09-10)
  const dragBounds = (button) => {
    const b = iconBounds(button);
    const mobile = stage.clientWidth <= 760;
    return { minY: b.minY - (mobile ? 40 : 70), maxX: b.maxX + (mobile ? 0 : 150), maxY: b.maxY + (mobile ? 40 : 70) };
  };

  const defaultIconPositions = () => {
    const sample = categoryButtons[0];
    const { minY, maxX, maxY } = iconBounds(sample);
    const isMobile = stage.clientWidth <= 760;
    const left = Math.min(16, maxX);
    const second = Math.min(isMobile ? 240 : 104, maxX);
    if (isMobile) {
      const step = maxX / 3;
      return [
        { x: 0, y: maxY },
        { x: step, y: maxY },
        { x: step * 2, y: maxY },
        { x: maxX, y: maxY },
      ];
    }
    return [
      { x: 25.06640625, y: 28.8321533203125 },
      { x: 68.21484375, y: -62.7421875 },
      { x: 86.52734375, y: 234.9277648925781 },
      { x: 85.453125, y: 113.66209411621097 },
    ].map(point => ({
      x: clamp(point.x / 96 * maxX, 0, maxX),
      y: clamp(point.y < 0 ? point.y / 88 * Math.abs(minY) : point.y / 343 * maxY, minY, maxY),
    }));
    /* The desktop rail is intentionally stable and leaves the photo field open. */
    const stageRect = stage.getBoundingClientRect();
    const photoRects = cards.map(card => card.getBoundingClientRect()).filter(rect => rect.width && rect.height);
    const photoLeft = photoRects.length ? Math.min(...photoRects.map(rect => rect.left)) - stageRect.left : 280;
    const photoTop = photoRects.length ? Math.min(...photoRects.map(rect => rect.top)) - stageRect.top : 181;
    const photoRight = photoRects.length ? Math.max(...photoRects.map(rect => rect.right)) - stageRect.left : 1158;
    const photoWidth = Math.max(1, photoRight - photoLeft);
    const referenceWidth = 878.09;
    const scale = photoWidth / referenceWidth;
    const positions = [
      { x: photoLeft - 204.25 * scale, y: photoTop - 58.59 * scale },
      { x: photoLeft - 46.74 * scale, y: photoTop - 106.46 * scale },
      { x: photoLeft - 106.64 * scale, y: photoTop + 1.47 * scale },
      { x: photoLeft - 189.43 * scale, y: photoTop + 100.07 * scale },
    ];
    const forbidden = [
      ...photoRects.map(rect => ({
        left: rect.left - stageRect.left,
        top: rect.top - stageRect.top,
        right: rect.right - stageRect.left,
        bottom: rect.bottom - stageRect.top,
      })),
      (() => {
        const rect = categoriesElement.querySelector('.g02-categories__title').getBoundingClientRect();
        return {
          left: rect.left - stageRect.left - 8,
          top: rect.top - stageRect.top - 8,
          right: rect.right - stageRect.left + 8,
          bottom: rect.bottom - stageRect.top + 8,
        };
      })(),
    ];
    const overlaps = (position, obstacle) => (
      position.x < obstacle.right
      && position.x + sample.offsetWidth > obstacle.left
      && position.y < obstacle.bottom
      && position.y + sample.offsetHeight > obstacle.top
    );
    positions.forEach(position => {
      forbidden.forEach(obstacle => {
        if (!overlaps(position, obstacle)) return;
        const down = obstacle.bottom - position.y + 8;
        if (position.y + down <= maxY) position.y += down;
        else position.x = Math.max(0, position.x - (position.x + sample.offsetWidth - obstacle.left + 8));
      });
    });
    return [
      ...positions.map(({ x, y }) => ({ x: clamp(x, 0, maxX), y: clamp(y, minY, maxY) })),
    ];
  };

  const setIconPosition = (index, next, wide = false) => {
    const button = categoryButtons[index];
    const bounds = wide ? dragBounds(button) : iconBounds(button);
    iconPositions[index] = {
      x: clamp(next.x, 0, bounds.maxX),
      y: clamp(next.y, bounds.minY, bounds.maxY),
    };
    button.style.setProperty('--g02-icon-x', `${iconPositions[index].x}px`);
    button.style.setProperty('--g02-icon-y', `${iconPositions[index].y}px`);
  };

  // 놓은 자리가 다른 아이콘과 겹치면 가장 가까운 빈 자리로 살짝 밀어 준다. 빈 자리가 없으면 마지막 안전 자리로.
  const settleIconPosition = (index, fallback) => {
    const here = iconPositions[index];
    if (!here) return;
    if (isIconPositionAvailable(index, here, true)) return;
    for (let r = 8; r <= 200; r += 8) {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const next = { x: here.x + dx * r, y: here.y + dy * r };
        if (isIconPositionAvailable(index, next, true)) { setIconPosition(index, next, true); return; }
      }
    }
    if (fallback) setIconPosition(index, fallback, true);
  };

  const isIconPositionAvailable = (index, next, wide = false) => {
    const button = categoryButtons[index];
    const bounds = wide ? dragBounds(button) : iconBounds(button);
    const x = clamp(next.x, 0, bounds.maxX);
    const y = clamp(next.y, bounds.minY, bounds.maxY);
    return categoryButtons.every((other, otherIndex) => {
      if (otherIndex === index) return true;
      const position = iconPositions[otherIndex];
      return !position || (
        x + button.offsetWidth <= position.x
        || x >= position.x + other.offsetWidth
        || y + button.offsetHeight <= position.y
        || y >= position.y + other.offsetHeight
      );
    });
  };

  const layoutCategoryIcons = () => {
    if (!categoryList.clientWidth || !categoryList.clientHeight) return;
    const mobile = stage.clientWidth <= 760;
    // On narrow screens the desktop free-positioned folder rail can push its
    // fourth item outside the viewport. Keep the same buttons/handlers, but
    // let CSS grid own their compact four-column layout on mobile.
    if (mobile) {
      categoryList.style.display = 'grid';
      categoryList.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
      categoryList.style.justifyContent = 'stretch';
      categoryList.style.width = '100%';
      categoryList.style.left = '0';
      categoryList.style.right = 'auto';
      categoryButtons.forEach((button) => {
        button.style.position = 'relative';
        button.style.top = 'auto';
        button.style.left = 'auto';
        button.style.width = '100%';
        button.style.minWidth = '0';
        button.style.transform = 'none';
      });
      return;
    }
    const nextBounds = categoryButtons.map(button => iconBounds(button));
    const modeChanged = mobile !== iconLayoutMobile;
    const boundsChanged = iconLayoutBounds.some((bounds, index) => (
      bounds.minY !== nextBounds[index].minY
      || bounds.maxX !== nextBounds[index].maxX
      || bounds.maxY !== nextBounds[index].maxY
    ));
    const reposition = !iconPositions.length || modeChanged || boundsChanged;
    if (reposition) categoryList.classList.add('is-positioning');
    if (!iconPositions.length || modeChanged) {
      const stored = readStoredIconPositions(mobile);
      iconPositions = stored && !stored.isReference ? stored.positions : defaultIconPositions();
      iconPositionsAreDefault = !stored || stored.isReference;
    } else if (boundsChanged) {
      iconPositions = iconPositionsAreDefault ? defaultIconPositions() : iconPositions.map((point, index) => ({
        x: iconLayoutBounds[index]?.maxX ? point.x / iconLayoutBounds[index].maxX * nextBounds[index].maxX : 0,
        y: point.y < 0
          ? (iconLayoutBounds[index]?.minY
            ? point.y / Math.abs(iconLayoutBounds[index].minY) * Math.abs(nextBounds[index].minY)
            : 0)
          : (iconLayoutBounds[index]?.maxY
            ? point.y / iconLayoutBounds[index].maxY * nextBounds[index].maxY
            : 0),
      }));
    }
    iconLayoutMobile = mobile;
    iconLayoutBounds = nextBounds;
    const title = categoriesElement.querySelector('.g02-categories__title');
    if (title) {
      const floor = title.getBoundingClientRect().bottom - categoryList.getBoundingClientRect().top + 12;
      iconPositions = iconPositions.map(point => ({ ...point, y: Math.max(point.y, floor) }));
    }
    categoryButtons.forEach((_, index) => setIconPosition(index, iconPositions[index] || { x: 0, y: 0 }, !iconPositionsAreDefault));
    categoryButtons.forEach((_, index) => settleIconPosition(index, iconPositions[index]));
    if (reposition) {
      void categoryList.offsetWidth;
      requestAnimationFrame(() => categoryList.classList.remove('is-positioning'));
    }
  };

  const finishIconDrag = (event, cancelled = false) => {
    if (!activeIconDrag || event.pointerId !== activeIconDrag.pointerId) return;
    const { button, index, moved, originX, originY } = activeIconDrag;
    button.releasePointerCapture?.(activeIconDrag.pointerId);
    button.classList.remove('is-dragging');
    if (moved && cancelled) {
      setIconPosition(index, { x: originX, y: originY });
      delete button.dataset.dragMoved;
    } else if (moved) {
      settleIconPosition(index, activeIconDrag.lastSafe);
      button.dataset.dragMoved = 'true';
      iconPositionsAreDefault = false;
      saveIconPositions();
    } else {
      delete button.dataset.dragMoved;
    }
    activeIconDrag = null;
  };

  const measure = () => {
    const width = stage.clientWidth;
    if (width <= 600) {
      return { stageWidth: width, edgeOffset: 2.7, minScale: .48, arc: 34, depth: 72, falloff: 1, spread: .94 };
    }
    const railWidth = Number.parseFloat(getComputedStyle(stage).getPropertyValue('--g02-rail-width')) || 0;
    if (width <= 900) {
      return { stageWidth: Math.max(360, width - railWidth), edgeOffset: 2.6, minScale: .56, arc: 34, depth: 96, falloff: 1, spread: .82 };
    }
    return { stageWidth: Math.max(520, width - railWidth), edgeOffset: 2.5, minScale: .62, arc: 28, depth: 112, falloff: 1, spread: .84 };
  };
  let metrics = measure();

  // 값이 있는 칸만 화면에 남긴다. 비어 있으면 그 칸을 감춰서, 자료가 아직 없는
  // 작품에 ' · ' 같은 빈 구분자나 빈 줄이 나타나지 않게 한다.
  const fill = (element, value) => {
    if (!element) return;
    element.textContent = value || '';
    element.hidden = !value;
  };
  const syncCards = () => {
    cards.forEach((card, index) => {
      const work = activeWorks[index];
      card.dataset.logicalId = work.id;
      card.querySelector('img').src = photo(work);
      card.querySelector('img').alt = work.title || '';
      card.querySelector('img').style.objectPosition = work.crop;
      card.setAttribute('aria-label', `${index ? 'Select' : 'Open'} ${work.title || 'project ' + (index + 1)}`);
      fill(card.querySelector('.g02-card__title'), work.title);
      const caption = card.querySelector('.g02-card__caption');
      fill(caption.querySelector('strong'), work.title);
      fill(caption.querySelector('small'), work.discipline);
      fill(caption.querySelector('em'), work.year);
    });
  };

  const syncProgress = (slotIndex) => {
    const uniqueItems = recordCategories[activeCategory].items;
    const activeId = activeWorks[wrap(slotIndex, 0, activeWorks.length)]?.id;
    let activeIndex = uniqueItems.findIndex(item => item.id === activeId);
    if (activeIndex < 0) activeIndex = wrap(slotIndex, 0, uniqueItems.length);
    progressButtons.forEach((button, index) => {
      const selected = index === activeIndex;
      button.setAttribute('aria-current', selected ? 'true' : 'false');
      button.tabIndex = selected ? 0 : -1;
    });
  };

  const rebuildProgress = () => {
    const uniqueItems = recordCategories[activeCategory].items;
    progress.innerHTML = uniqueItems.map((work, index) => `<button type="button" aria-label="Show ${work.title || `record ${index + 1}`}" aria-current="false"></button>`).join('');
    progressButtons = [...progress.querySelectorAll('button')];
    progressButtons.forEach((button, progressIndex) => {
      button.addEventListener('click', () => {
        const targetId = uniqueItems[progressIndex].id;
        const candidates = activeWorks
          .map((work, index) => work.id === targetId ? index : -1)
          .filter(index => index >= 0);
        const target = candidates.reduce((nearest, index) => (
          Math.abs(signedOffset(index, spring.target, activeWorks.length))
            < Math.abs(signedOffset(nearest, spring.target, activeWorks.length)) ? index : nearest
        ), candidates[0] ?? progressIndex);
        select(target);
      });
    });
    syncProgress(Math.round(position));
  };

  const render = (value, velocity = 0) => {
    position = value;
    const nextCurrent = wrap(Math.round(value), 0, activeWorks.length);
    const rearBlur = Number.parseFloat(getComputedStyle(stage).getPropertyValue('--g02-card-rear-blur')) || .72;
    const farBlur = Number.parseFloat(getComputedStyle(stage).getPropertyValue('--g02-card-far-blur')) || 3.6;
    const rearDistance = Math.max(1, Math.floor(activeWorks.length / 2));
    cards.forEach((card, index) => {
      const offset = signedOffset(index, value, activeWorks.length);
      const item = projectConcave(offset, metrics);
      const distance = Math.abs(offset);
      const fanRotation = Math.max(-8, Math.min(8, -offset * 7.5));
      card.style.transform = prefersReducedMotion()
        ? `translate(-50%,-50%) translate(${item.x}px,${item.y}px) rotate(${fanRotation}deg) scale(${item.scale})`
        : `translate(-50%,-50%) translate3d(${item.x}px,${item.y}px,${item.z}px) rotateY(${item.rotation}deg) rotate(${fanRotation}deg) scale(${item.scale})`;
      const depthProgress = clamp(distance / rearDistance, 0, 1);
      const depthBlur = clamp(depthProgress * farBlur, 0, farBlur);
      card.style.opacity = item.visible ? '1' : '0';
      card.style.filter = item.visible && depthBlur > 0 ? `blur(${Math.max(rearBlur * depthProgress, depthBlur).toFixed(2)}px)` : 'none';
      card.style.pointerEvents = item.visible ? '' : 'none';
      card.style.zIndex = String(50 - Math.round(distance * 4));
    });
    if (nextCurrent !== current) {
      current = nextCurrent;
      categoryPositions[activeCategory] = current;
      setCurrent(cards, current);
      cards.forEach((card, index) => {
        // 이름이 아직 없는 작품은 'Open ' 처럼 뒤가 잘린 이름이 되지 않게 자리 번호로 읽어 준다.
        card.setAttribute('aria-label', `${index === current ? 'Open' : 'Select'} ${activeWorks[index].title || 'project ' + (index + 1)}`);
      });
      portfolio?.set(current);
    }
    syncProgress(nextCurrent);
    syncArchiveGuideToCarousel(value, velocity);
  };

  const spring = createSpring({ initial: 0, stiffness: .09, damping: .79, onUpdate: render });
  const guideWorkId = () => activeWorks[current < 0 ? wrap(Math.round(position), 0, activeWorks.length) : current]?.id || '';
  const setArchiveGuideState = (nextState, { direction = guideDirection, settleAfter = null } = {}) => {
    const resolvedState = detailOpen && !['aside', 'away'].includes(nextState) ? 'aside' : nextState;
    const nextDirection = Math.sign(direction);
    const detail = {
      state: resolvedState,
      category: activeCategory,
      workId: guideWorkId(),
      direction: nextDirection,
    };
    const changed = guideState !== resolvedState
      || puller.dataset.archiveCategory !== String(activeCategory)
      || puller.dataset.archiveWork !== detail.workId
      || puller.dataset.direction !== String(nextDirection);
    clearTimeout(guideSettleTimer);
    guideSettleTimer = 0;
    guideState = resolvedState;
    guideDirection = nextDirection;
    stage.dataset.archiveState = resolvedState;
    puller.dataset.archiveState = resolvedState;
    puller.dataset.archiveCategory = String(activeCategory);
    puller.dataset.archiveWork = detail.workId;
    puller.dataset.direction = String(nextDirection);
    puller.dataset.phase = 'rest';
    stage.classList.toggle('has-local-detail', resolvedState === 'aside');
    document.body.classList.toggle('has-local-detail', resolvedState === 'aside');
    if (resolvedState !== 'ready') {
      stopArchiveIdle();
      stopPortfolioRoll();
    } else {
      if (!archiveIdleTimer) scheduleArchiveIdle();
      if (!rollTimer) schedulePortfolioRoll();
    }
    if (changed) {
      const pose = resolvedState === 'preparing' ? 'find'
        : resolvedState === 'category' ? 'find'
        : resolvedState === 'indicating' ? 'present'
          : resolvedState === 'aside' ? 'yield'
            : resolvedState === 'away' ? 'leave'
              : 'read';
      indexRig.setPose(pose, { direction: nextDirection || 1, category: activeCategory });
      if (puller.dataset.archiveAssetStatus === 'ready') {
        drawArchiveState(resolvedState);
      }
      window.dispatchEvent(new CustomEvent('tva:archive-guide-statechange', { detail }));
    }
    if (resolvedState === 'ready' && !archiveIdleTimer) scheduleArchiveIdle();
    if (settleAfter !== null && !detailOpen && resolvedState !== 'away') {
      guideSettleTimer = window.setTimeout(() => setArchiveGuideState('ready'), prefersReducedMotion() ? 0 : settleAfter);
    }
  };

  const resetWheelGesture = ({ settle = false } = {}) => {
    clearTimeout(wheelTimer);
    wheelTimer = 0;
    wheelGestureOrigin = null;
    wheelGestureDelta = 0;
    if (settle) spring.set(Math.round(position), { immediate: prefersReducedMotion() });
    window.dispatchEvent(new CustomEvent('tva:gallery-input-reset'));
  };

  const beginGuideTracking = (direction) => {
    const nextDirection = Math.sign(direction);
    if (!nextDirection) return;
    guideMoving = true;
    setArchiveGuideState('tracking', { direction: nextDirection });
  };

  const settleGuide = () => {
    if (!guideMoving || detailOpen || !galleryVisible) return;
    guideMoving = false;
    setArchiveGuideState('indicating', { direction: guideDirection, settleAfter: 420 });
  };

  const syncArchiveGuideToCarousel = (value, velocity = 0) => {
    puller.dataset.position = Number(value).toFixed(3);
    if (detailOpen || !galleryVisible) return;
    if (!guideMoving && guideState === 'indicating') return;
    const remaining = spring.target - value;
    if (Math.abs(velocity) > .0015 || Math.abs(remaining) > .0015) {
      const direction = Math.sign(remaining || velocity) || guideDirection;
      if (!guideMoving || direction !== guideDirection) beginGuideTracking(direction);
      else setArchiveGuideState('tracking', { direction });
      return;
    }
    settleGuide();
  };

  const stopGuideMotion = ({ state = 'ready' } = {}) => {
    guideMoving = false;
    guideDirection = 0;
    resetWheelGesture();
    setArchiveGuideState(state);
  };

  const select = (index, shouldAnnounce = true, immediate = false) => {
    const nextIndex = wrap(index, 0, activeWorks.length);
    const delta = signedOffset(nextIndex, position, activeWorks.length);
    resetWheelGesture();
    if (immediate) {
      spring.stop();
      guideMoving = false;
    } else beginGuideTracking(Math.sign(delta));
    spring.set(position + delta, { immediate });
    if (shouldAnnounce) announce(`${activeWorks[nextIndex].title} selected.`);
  };
  const step = (direction) => select(wrap(Math.round(spring.target) + direction, 0, activeWorks.length));
  const playCategoryOpen = (index) => {
    categoryButtons.forEach((button) => button.classList.remove('is-opening'));
    if (prefersReducedMotion()) return;
    const button = categoryButtons[index];
    button.classList.remove('is-opening');
    void button.offsetWidth;
    button.classList.add('is-opening');
  };
  const selectCategory = (key, { focus = false } = {}) => {
    const categoryKey = Object.hasOwn(recordCategories, key) ? key : 'influencer';
    const categoryIndex = categoryKeys.indexOf(categoryKey);
    const category = recordCategories[categoryKey];
    if (focus) categoryButtons[categoryIndex].focus({ preventScroll: true });
    resetWheelGesture();
    spring.stop();
    categoryPositions[activeCategory] = Math.round(position);
    activeCategory = categoryKey;
    activeWorks = fillWheelSlots(recordCategories[activeCategory].items, activeCategory);
    rebuildProgress();
    stage.querySelector('.g02-wheel').classList.add('is-changing');
    syncCards();
    requestAnimationFrame(() => stage.querySelector('.g02-wheel').classList.remove('is-changing'));
    categoryList.dataset.current = String(activeCategory);
    categoryButtons.forEach((button, buttonIndex) => {
      button.setAttribute('aria-pressed', String(buttonIndex === categoryIndex));
    });
    playCategoryOpen(categoryIndex);
    current = -1;
    categoryPositions[activeCategory] = Math.round(categoryPositions[activeCategory]);
    spring.set(categoryPositions[activeCategory], { immediate: true });
    indexRig.setCategory(activeCategory);
    setArchiveGuideState('preparing');
    guideSettleTimer = window.setTimeout(() => {
      setArchiveGuideState('category', { settleAfter: 420 });
    }, prefersReducedMotion() ? 0 : 220);
    announce(`${category.label} gallery selected. ${category.items.length} records.`);
  };

  const normalizedWheelDelta = (event) => {
    const dominant = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return dominant / 3;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return dominant * 3;
    return dominant / 140;
  };

  const turnCarouselForWheel = (event) => {
    const normalizedDelta = normalizedWheelDelta(event);
    if (!Number.isFinite(normalizedDelta) || normalizedDelta === 0) return;
    if (wheelGestureOrigin === null) {
      wheelGestureOrigin = spring.target;
      wheelGestureDelta = 0;
    }
    wheelGestureDelta += normalizedDelta;
    beginGuideTracking(Math.sign(normalizedDelta));
    spring.set(wheelGestureOrigin + wheelGestureDelta, { immediate: prefersReducedMotion() });
  };

  const settleCarouselWheel = () => {
    const destination = Math.round(spring.target);
    wheelTimer = 0;
    wheelGestureOrigin = null;
    wheelGestureDelta = 0;
    spring.set(destination, { immediate: prefersReducedMotion() });
    window.dispatchEvent(new CustomEvent('tva:gallery-input-reset'));
  };

  const openProject = (trigger) => {
    if (!portfolio || detailOpen) return portfolio?.whenIdle();
    resetWheelGesture({ settle: true });
    detailOpen = true;
    stopPortfolioRoll();
    setArchiveGuideState('aside');
    return portfolio.open(trigger);
  };

  createDrag({
    element: stage,
    onStart: ({ event }) => {
      spring.stop();
      resetWheelGesture();
      pressedCard = event.target.closest('.g02-card');
    },
    onMove: ({ delta, total }) => {
      const itemDistance = Math.max(96, stage.clientWidth * .17);
      spring.set(position - delta / itemDistance, { immediate: true });
      beginGuideTracking(Math.sign(-delta || -total));
    },
    onEnd: ({ moved, cancelled, velocity }) => {
      const tappedCard = !moved && !cancelled ? pressedCard : null;
      pressedCard = null;
      suppressClick = moved || Boolean(tappedCard);
      spring.set(cancelled ? Math.round(position) : Math.round(position - projectMomentum(velocity * 12)));
      if (tappedCard) {
        const index = Number(tappedCard.dataset.index);
        if (index === current) {
          void openProject(tappedCard);
        }
        else select(index);
      }
      setTimeout(() => { suppressClick = false; }, 0);
    },
  });
  categoriesElement.addEventListener('pointerdown', (event) => event.stopPropagation());
  puller.addEventListener('pointerdown', (event) => event.stopPropagation());
  categoryButtons.forEach((button, index) => {
    button.addEventListener('animationend', (event) => {
      if (event.target === button.querySelector('.g02-category__icon') && event.animationName === 'g02-category-open') button.classList.remove('is-opening');
    });
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.stopPropagation();
      activeIconDrag = {
        button,
        index,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: iconPositions[index]?.x || 0,
        originY: iconPositions[index]?.y || 0,
        lastSafe: { x: iconPositions[index]?.x || 0, y: iconPositions[index]?.y || 0 },
        moved: false,
      };
      button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener('pointermove', (event) => {
      if (!activeIconDrag || event.pointerId !== activeIconDrag.pointerId) return;
      const deltaX = event.clientX - activeIconDrag.startX;
      const deltaY = event.clientY - activeIconDrag.startY;
      if (!activeIconDrag.moved && Math.hypot(deltaX, deltaY) >= Number.parseFloat(getComputedStyle(stage).getPropertyValue('--g02-category-drag-threshold'))) {
        activeIconDrag.moved = true;
        button.classList.add('is-dragging');
      }
      if (!activeIconDrag.moved) return;
      event.preventDefault();
      const next = {
        x: activeIconDrag.originX + deltaX,
        y: activeIconDrag.originY + deltaY,
      };
      // 2026-09-10: 끌 때는 손을 그대로 따라간다 (옆 아이콘과 겹쳐도 되돌리지 않음). 겹침은 놓을 때 정리한다.
      setIconPosition(index, next, true);
      if (isIconPositionAvailable(index, iconPositions[index], true)) activeIconDrag.lastSafe = { ...iconPositions[index] };
    }, { passive: false });
    button.addEventListener('pointerup', (event) => finishIconDrag(event));
    button.addEventListener('pointercancel', (event) => finishIconDrag(event, true));
  });

  portfolio = createPortfolioFlow({
    count: activeWorks.length,
    onNavigate: (index) => {
      select(index, false, true);
      setArchiveGuideState('aside');
      window.dispatchEvent(new CustomEvent('tva:portfolio-routechange', { detail: { id: activeWorks[index].id } }));
    },
    onOpen: (index) => {
      detailOpen = true;
      setArchiveGuideState('aside');
      window.dispatchEvent(new CustomEvent('tva:portfolio-routechange', { detail: { id: activeWorks[index].id } }));
    },
    onClose: () => {
      detailOpen = false;
      setArchiveGuideState('indicating', { settleAfter: 420 });
      window.dispatchEvent(new CustomEvent('tva:portfolio-routechange', { detail: { id: null } }));
    },
    getWorks: () => activeWorks,
    getMediaOrigin: () => cards[current] ?? null,
    dismissOnSurfaceClick: true,
    showDock: false,
  });
  document.addEventListener('tva:portfolio-route', (event) => {
    const id = event.detail?.id;
    if (id === null) {
      event.detail.handled = true;
      event.detail.completion = (async () => {
        await portfolio.whenIdle();
        return portfolio.close();
      })();
      return;
    }
    if (typeof id !== 'string') return;
    const categoryIndex = categories.findIndex((category) => category.items.some((work) => work.id === id));
    if (categoryIndex < 0) return;
    const index = categories[categoryIndex].items.findIndex((work) => work.id === id);
    if (index < 0) return;
    event.detail.handled = true;
    event.detail.completion = (async () => {
      await portfolio.whenIdle();
      const categoryKey = categoryKeys[categoryIndex];
      if (activeCategory !== categoryKey) selectCategory(categoryKey);
      select(index, false, true);
      portfolio.set(index);
      return openProject(cards[index]);
    })();
  });
  categoryButtons.forEach((button, index) => {
    button.addEventListener('click', (event) => {
      if (button.dataset.dragMoved === 'true') {
        delete button.dataset.dragMoved;
        event.preventDefault();
        return;
      }
      selectCategory(button.dataset.category);
    });
    button.addEventListener('keydown', (event) => {
      let next = null;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index - 1;
      else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index + 1;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = categories.length - 1;
      if (next === null) return;
      event.preventDefault();
      event.stopPropagation();
      const nextIndex = wrap(next, 0, categories.length);
      selectCategory(categoryKeys[nextIndex], { focus: true });
    });
  });
  puller.addEventListener('click', () => {
    if (suppressClick) return;
    step(1);
  });
  previousButton.addEventListener('click', () => step(-1));
  nextButton.addEventListener('click', () => step(1));
  rebuildProgress();
  stage.addEventListener('pointerenter', () => {
    rollPaused = true;
    stopPortfolioRoll();
  });
  stage.addEventListener('pointerleave', () => {
    rollPaused = false;
    schedulePortfolioRoll();
  });
  stage.addEventListener('focusin', () => {
    rollPaused = true;
    stopPortfolioRoll();
  });
  stage.addEventListener('focusout', (event) => {
    if (event.relatedTarget && stage.contains(event.relatedTarget)) return;
    rollPaused = false;
    schedulePortfolioRoll();
  });
  cards.forEach((card, index) => card.addEventListener('click', () => {
    if (suppressClick) return;
    if (index === current) {
      void openProject(card);
    }
    else select(index);
  }));
  stage.addEventListener('wheel', (event) => {
    if (!event.__tvaGalleryInput || detailOpen) return;
    event.preventDefault();
    turnCarouselForWheel(event);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(settleCarouselWheel, 140);
  }, { passive: false });
  stage.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      select(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      select(activeWorks.length - 1);
    } else {
      const number = Number(event.key);
      if (Number.isInteger(number) && number >= 1 && number <= 9) select(number - 1);
    }
  });
  new ResizeObserver(() => {
    spring.stop();
    metrics = measure();
    spring.set(Math.round(position), { immediate: true });
    layoutCategoryIcons();
    stopGuideMotion({ state: detailOpen ? 'aside' : 'ready' });
  }).observe(stage);
  categoryList.dataset.current = '0';
  layoutCategoryIcons();
  void categoryList.offsetWidth;
  syncCards();
  render(0);
  setArchiveGuideState('ready');
  const syncVisibility = () => {
    const frameRect = window.frameElement?.getBoundingClientRect();
    const visible = !document.hidden && (!frameRect || (frameRect.bottom > 0 && frameRect.top < window.parent.innerHeight));
    galleryVisible = visible;
    stage.dataset.galleryVisible = String(visible);
    if (!visible) {
      stopArchiveIdle();
      stopPortfolioRoll();
      spring.stop();
      stopGuideMotion({ state: 'away' });
    } else if (detailOpen || document.querySelector('dialog[open]')) setArchiveGuideState('aside');
    else setArchiveGuideState('ready');
  };
  const syncCharacterHandoff = (event) => {
    const active = Boolean(event.detail?.active);
    const progress = clamp(Number(event.detail?.progress) || 0, 0, 1);
    const direction = Math.sign(Number(event.detail?.direction)) || 1;
    stage.dataset.characterHandoff = active ? 'active' : 'idle';
    puller.dataset.handoffActive = String(active);
    puller.dataset.handoffProgress = progress.toFixed(3);
    puller.dataset.handoffDirection = String(direction);
    if (active && !detailOpen) setArchiveGuideState('arriving', { direction });
    else if (!detailOpen && galleryVisible) setArchiveGuideState('ready');
  };
  const syncReducedMotion = () => {
    workmark.dataset.reducedMotion = String(prefersReducedMotion());
    if (prefersReducedMotion()) {
      stopArchiveIdle();
      stopPortfolioRoll();
    } else if (!detailOpen && galleryVisible && !guideMoving && guideState === 'ready') {
      scheduleArchiveIdle();
      schedulePortfolioRoll();
    }
  };
  const syncMotionEvent = (event) => {
    workmark.dataset.reducedMotion = String(Boolean(event.detail?.reduced) || prefersReducedMotion());
    if (event.detail?.reduced) {
      stopPortfolioRoll();
    } else syncReducedMotion();
  };
  reducedMotionQuery.addEventListener?.('change', syncReducedMotion);
  window.parent.addEventListener('scroll', syncVisibility, { passive: true });
  window.addEventListener('tva:portfolio-character-handoff', syncCharacterHandoff);
  window.addEventListener('tva:motion', syncMotionEvent);
  window.addEventListener('pagehide', () => {
    clearTimeout(wheelTimer);
    clearTimeout(guideSettleTimer);
    stopArchiveIdle();
    stopPortfolioRoll();
    reducedMotionQuery.removeEventListener?.('change', syncReducedMotion);
    window.parent.removeEventListener('scroll', syncVisibility);
    window.removeEventListener('tva:portfolio-character-handoff', syncCharacterHandoff);
    window.removeEventListener('tva:motion', syncMotionEvent);
  }, { once: true });
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
  requestAnimationFrame(() => categoryList.classList.remove('is-positioning'));
}

function init03() {
  stage.classList.add('g03-stage');
  stage.tabIndex = 0;
  stage.setAttribute('aria-label', 'Audio stem card deck');
  const wave = () => Array.from({ length: 22 }, (_, index) => `<i style="--h:${18 + ((index * 31) % 72)};--n:${index}"></i>`).join('');
  stage.innerHTML = `<div class="g03-deck">${works.slice(0, 6).map((work, index) => `<article class="g03-card" data-index="${index}" tabindex="${index ? -1 : 0}" aria-label="${work.title} project module"><figure class="g03-art"><img src="${photo(work)}" ${load(index)} alt=""></figure><h2>${work.title}</h2><div class="meta"><span>${work.discipline}</span><span>${String(index + 1).padStart(2, '0')} / 06</span></div><div class="g03-wave" aria-hidden="true">${wave()}</div><button class="g03-play" aria-label="Open ${work.title} project"></button></article>`).join('')}</div>${controls}`;
  const cards = [...stage.querySelectorAll('.g03-card')];
  let position = 0;
  let current = 0;
  let portfolio = null;

  const render = (value) => {
    position = value;
    current = clamp(Math.round(value), 0, cards.length - 1);
    cards.forEach((card, index) => {
      const offset = index - value;
      const x = offset * Math.min(innerWidth * .32, 390);
      const scale = 1 - Math.min(Math.abs(offset), 2) * .12;
      card.style.transform = `translate3d(${x}px,${Math.abs(offset) * 18}px,${-Math.abs(offset) * 100}px) rotateY(${-offset * 7}deg) scale(${scale})`;
      card.style.opacity = String(clamp(1 - Math.abs(offset) * .3, .08, 1));
      card.style.zIndex = String(20 - Math.round(Math.abs(offset)));
    });
    setCurrent(cards, current);
    portfolio?.set(current);
  };
  const spring = createSpring({ onUpdate: render, stiffness: .11, damping: .78 });
  const select = (index) => {
    if (index === current) stage.classList.toggle('is-expanded');
    else stage.classList.remove('is-expanded');
    spring.set(index);
    announce(`${works[index].title} module selected.`);
  };
  const step = (direction) => select(clamp(current + direction, 0, cards.length - 1));

  createDrag({ element: stage, onMove: ({ delta }) => spring.set(clamp(position - delta / 290, 0, cards.length - 1), { immediate: true }), onEnd: ({ velocity }) => spring.set(clamp(Math.round(position - projectMomentum(velocity * 10)), 0, cards.length - 1)) });
  cards.forEach((card, index) => {
    card.addEventListener('click', (event) => { if (!event.target.closest('.g03-play')) select(index); });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(index); }
    });
    const openProject = card.querySelector('.g03-play');
    openProject.setAttribute('aria-label', `Open ${works[index].title} project`);
    openProject.addEventListener('click', (event) => {
      event.stopPropagation();
      portfolio.set(index);
      portfolio.open(openProject);
    });
  });
  portfolio = createPortfolioFlow({ count: cards.length, onNavigate: (index) => select(index) });
  stage.querySelector('[data-prev]').addEventListener('click', () => step(-1));
  stage.querySelector('[data-next]').addEventListener('click', () => step(1));
  stage.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
    const index = numberKeyIndex(event);
    if (index !== null && index < cards.length) select(index);
  });
  render(0);
}

function init04() {
  stage.classList.add('g04-stage');
  const list = (subset, start, side) => `<ul class="index-list index-list--${side}">${subset.map((work, index) => `<li><button data-index="${start + index}" aria-label="Preview ${work.title}"><span>${work.title}</span></button></li>`).join('')}</ul>`;
  stage.innerHTML = `${list(works.slice(0, 4), 0, 'left')}<div class="g04-preview" aria-live="off"><figure><img alt=""></figure><figure><img alt=""></figure><figure><img alt=""><figcaption class="g04-caption"><span></span><span></span></figcaption></figure></div>${list(works.slice(4), 4, 'right')}`;
  const buttons = [...stage.querySelectorAll('.index-list button')];
  const images = [...stage.querySelectorAll('.g04-preview img')];
  const caption = stage.querySelector('.g04-caption');
  let pinned = 0;
  let hovered = null;
  let focused = null;
  let portfolio = null;

  const resolveIndex = () => hovered ?? focused ?? pinned;
  const render = () => {
    const index = resolveIndex();
    const indexes = [wrap(index - 1, 0, works.length), wrap(index + 1, 0, works.length), index];
    images.forEach((image, layer) => { image.src = photo(works[indexes[layer]]); image.alt = layer === 2 ? works[index].title : ''; });
    caption.children[0].textContent = works[index].title;
    caption.children[1].textContent = works[index].year;
    buttons.forEach((button) => button.toggleAttribute('aria-current', Number(button.dataset.index) === index));
    portfolio?.set(index);
  };

  buttons.forEach((button) => {
    const index = Number(button.dataset.index);
    button.addEventListener('pointerenter', () => { hovered = index; render(); });
    button.addEventListener('pointerleave', () => { hovered = null; render(); });
    button.addEventListener('focus', () => { focused = index; render(); });
    button.addEventListener('blur', () => { focused = null; render(); });
    button.addEventListener('click', () => { pinned = index; render(); announce(`${works[index].title} pinned.`); });
    button.addEventListener('keydown', (event) => {
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const direction = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
      pinned = wrap(index + direction, 0, works.length);
      buttons.find((item) => Number(item.dataset.index) === pinned)?.focus();
      render();
    });
  });
  portfolio = createPortfolioFlow({ onNavigate: (index) => { pinned = index; hovered = null; focused = null; render(); } });
  render();
}

function init05() {
  stage.classList.add('g05-stage');
  const spread = Math.min(34, innerWidth <= 760 ? 28 : innerWidth * .05);
  stage.innerHTML = `<div class="g05-stack" role="listbox" tabindex="0" aria-label="Stacked portfolio projects">${works.map((work, index) => `<div class="g05-plane" data-index="${index}" role="option" aria-selected="${index === 0}" aria-label="${work.title}, ${work.discipline}, ${work.year}" style="--x:${(index - 3.5) * spread}px;--y:${Math.abs(index - 3.5) * 3}px;--r:${(index - 3.5) * 1.6}deg;z-index:${index}"><img src="${photo(work)}" ${load(index)} alt=""></div>`).join('')}</div><section class="g05-detail" aria-label="Project detail" hidden><div class="g05-detail-media"></div><div class="g05-detail-info"><p class="meta"></p><h2></h2><span class="g05-summary-label">Case summary</span><p>One selected plane becomes the content surface. Navigation remains linear, and closing returns the same plane to its measured stack position.</p><div class="controls"><button class="round-control prev" data-prev aria-label="Previous work"></button><button class="round-control" data-next aria-label="Next work"></button><button class="round-control close" data-close aria-label="Back to stack"></button></div></div></section>`;
  const stack = stage.querySelector('.g05-stack');
  const detail = stage.querySelector('.g05-detail');
  const media = stage.querySelector('.g05-detail-media');
  const planes = [...stage.querySelectorAll('.g05-plane')];
  let current = 0;
  let movedPlane = null;
  let placeholder = null;
  let returnFocus = null;
  let dock = null;

  const select = (index, { raise = true } = {}) => {
    current = wrap(index, 0, works.length);
    planes.forEach((plane, itemIndex) => {
      plane.classList.toggle('is-probed', raise && itemIndex === current);
      plane.setAttribute('aria-selected', String(itemIndex === current));
    });
    dock?.set(current);
  };

  const putBack = () => {
    if (!movedPlane || !placeholder) return;
    placeholder.replaceWith(movedPlane);
    movedPlane = null;
    placeholder = null;
  };

  const movePlane = (index, animate = true) => {
    putBack();
    current = index;
    const plane = planes[index];
    const first = plane.getBoundingClientRect();
    placeholder = document.createComment(`plane-${index}`);
    plane.replaceWith(placeholder);
    media.append(plane);
    movedPlane = plane;
    detail.querySelector('h2').textContent = works[index].title;
    detail.querySelector('.meta').textContent = `${works[index].discipline} · ${works[index].year}`;
    const last = plane.getBoundingClientRect();
    if (animate && !prefersReducedMotion()) {
      plane.animate([
        { transform: `translate(${first.left - last.left}px,${first.top - last.top}px) scale(${first.width / last.width},${first.height / last.height})`, transformOrigin: 'top left' },
        { transform: 'none', transformOrigin: 'top left' },
      ], { duration: 720, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
  };

  const open = (index, trigger) => {
    returnFocus = trigger;
    select(index);
    document.body.classList.add('has-local-detail');
    detail.hidden = false;
    movePlane(index);
    detail.querySelector('[data-close]').focus({ preventScroll: true });
    announce(`${works[index].title} detail opened.`);
  };
  const close = () => {
    if (detail.hidden) return;
    putBack();
    detail.hidden = true;
    document.body.classList.remove('has-local-detail');
    returnFocus?.focus({ preventScroll: true });
    announce('Returned to the image stack.');
  };
  const step = (direction) => {
    const next = wrap(current + direction, 0, works.length);
    select(next);
    movePlane(next);
    announce(`${works[next].title} detail selected.`);
  };

  const indexAt = (clientX) => planes.reduce((nearest, plane, index) => {
    const rect = plane.getBoundingClientRect();
    const distance = Math.abs(clientX - rect.left - rect.width / 2);
    return distance < nearest.distance ? { index, distance } : nearest;
  }, { index: current, distance: Infinity }).index;
  stack.addEventListener('pointermove', (event) => select(indexAt(event.clientX)));
  stack.addEventListener('click', (event) => open(indexAt(event.clientX), stack));
  stack.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      select(current + (event.key === 'ArrowLeft' ? -1 : 1));
      announce(`${works[current].title} selected.`);
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open(current, stack);
    }
  });
  detail.querySelector('[data-close]').addEventListener('click', close);
  detail.querySelector('[data-prev]').addEventListener('click', () => step(-1));
  detail.querySelector('[data-next]').addEventListener('click', () => step(1));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
    if (!detail.hidden && event.key === 'ArrowLeft') step(-1);
    if (!detail.hidden && event.key === 'ArrowRight') step(1);
  });
  dock = createProjectDock({ onOpen: (index, trigger) => open(index, trigger) });
  select(0, { raise: false });
}

function init06() {
  stage.classList.add('g06-stage');
  stage.innerHTML = `<div class="g06-grid">${works.map((work, index) => `<button class="g06-cell" data-index="${index}" tabindex="${index ? -1 : 0}" aria-label="Focus ${work.title}"><img src="${photo(work)}" ${load(index)} alt=""></button>`).join('')}</div><span class="g06-note">Select the current tile again to release the field.</span>`;
  const grid = stage.querySelector('.g06-grid');
  const cells = [...stage.querySelectorAll('.g06-cell')];
  let active = null;
  let roving = 0;
  let portfolio = null;

  const render = () => {
    grid.classList.toggle('is-focused', active !== null);
    cells.forEach((cell) => { cell.style.transform = ''; });
    const target = active === null ? null : cells[active].getBoundingClientRect();
    cells.forEach((cell, index) => {
      cell.toggleAttribute('aria-current', index === active);
      if (!target) { cell.style.transform = ''; return; }
      const rect = cell.getBoundingClientRect();
      const dx = (target.left + target.width / 2 - rect.left - rect.width / 2) * .18;
      const dy = (target.top + target.height / 2 - rect.top - rect.height / 2) * .18;
      const scale = index === active ? 1.16 : .82;
      cell.style.transform = `translate3d(${dx}px,${dy}px,0) scale(${scale})`;
    });
  };
  const select = (index) => {
    portfolio?.set(index);
    active = active === index ? null : index;
    render();
    announce(active === null ? 'Focus field released.' : `${works[index].title} pulled the field inward.`);
  };
  const moveFocus = (index) => {
    roving = wrap(index, 0, cells.length);
    setCurrent(cells, roving);
    cells[roving].focus();
  };
  cells.forEach((cell, index) => {
    cell.addEventListener('click', () => select(index));
    cell.addEventListener('keydown', (event) => {
      const columns = innerWidth <= 760 ? 2 : 4;
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      moveFocus(index + delta);
    });
  });
  portfolio = createPortfolioFlow({ onNavigate: (index) => { active = index; roving = index; setCurrent(cells, roving); render(); } });
  addEventListener('resize', render);
}

function init07() {
  stage.classList.add('g07-stage');
  const columns = Array.from({ length: 4 }, (_, column) => Array.from({ length: 4 }, (_, row) => works[(column + row * 2) % works.length]));
  stage.innerHTML = `<div class="g07-viewport"><div class="g07-grid">${columns.map((items) => `<div class="g07-column">${items.map((work) => `<button class="g07-item" data-index="${works.indexOf(work)}" aria-label="Open ${work.title}"><img src="${photo(work)}" ${load(works.indexOf(work))} alt=""></button>`).join('')}</div>`).join('')}</div></div><div class="g07-jumps"><button data-jump="0">Start</button><button data-jump=".5">Middle</button><button data-jump="1">End</button></div>`;
  const galleryColumns = [...stage.querySelectorAll('.g07-column')];
  let scheduled = false;

  const render = () => {
    scheduled = false;
    const top = main.offsetTop;
    const distance = Math.max(1, main.offsetHeight - innerHeight);
    const progress = clamp((scrollY - top) / distance, 0, 1);
    galleryColumns.forEach((column, index) => {
      const centerDistance = Math.abs(index - (galleryColumns.length - 1) / 2);
      const lag = 1 + centerDistance * .34;
      column.style.transform = prefersReducedMotion() ? 'none' : `translate3d(0,${(progress - .5) * -180 * lag}px,0)`;
    });
  };
  addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(render);
  }, { passive: true });
  stage.querySelectorAll('[data-jump]').forEach((button) => button.addEventListener('click', () => {
    const progress = Number(button.dataset.jump);
    scrollTo({ top: main.offsetTop + (main.offsetHeight - innerHeight) * progress, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    announce(`${button.textContent} of elastic columns.`);
  }));
  const portfolio = createPortfolioFlow();
  stage.querySelectorAll('.g07-item').forEach((item) => item.addEventListener('click', () => {
    portfolio.set(Number(item.dataset.index));
    portfolio.open(item);
  }));
  render();
}

function init08() {
  stage.classList.add('g08-stage');
  stage.innerHTML = `<div class="g08-grid">${works.map((work, index) => `<button class="g08-cell" data-index="${index}" aria-label="Open ${work.title}"><img src="${photo(work)}" ${load(index)} alt=""></button>`).join('')}</div><section class="g08-detail" aria-label="Selected work" hidden><figure><img src="${photo(works[0])}" loading="lazy" alt=""><figcaption><span></span><span></span></figcaption></figure><article class="g08-copy"><span>Case summary</span><p></p></article><button class="round-control close" data-close aria-label="Back to gallery"></button><div class="controls"><button class="round-control prev" data-prev aria-label="Previous project"></button><button class="round-control" data-next aria-label="Next project"></button></div></section>`;
  const cells = [...stage.querySelectorAll('.g08-cell')];
  const detail = stage.querySelector('.g08-detail');
  let returnFocus = null;
  let current = 0;
  let dock = null;

  const show = (index) => {
    current = wrap(index, 0, works.length);
    dock?.set(current);
    const work = works[current];
    const detailImage = detail.querySelector('img');
    detailImage.src = photo(work);
    detailImage.alt = work.title;
    detail.querySelector('figcaption span:first-child').textContent = work.title;
    detail.querySelector('figcaption span:last-child').textContent = `${work.discipline} · ${work.year}`;
  };

  const removeTrails = () => document.querySelectorAll('.g08-trail').forEach((item) => item.remove());
  const close = () => {
    removeTrails();
    detail.hidden = true;
    document.body.classList.remove('has-local-detail');
    returnFocus?.focus({ preventScroll: true });
    announce('Detail closed.');
  };
  const open = async (index, trigger) => {
    removeTrails();
    returnFocus = trigger;
    document.body.classList.add('has-local-detail');
    const work = works[index];
    current = index;
    const start = cells[index].getBoundingClientRect();
    show(index);
    detail.hidden = false;
    detail.style.visibility = prefersReducedMotion() ? 'visible' : 'hidden';
    const finish = detail.querySelector('figure').getBoundingClientRect();
    if (!prefersReducedMotion()) {
      const trails = Array.from({ length: 7 }, (_, trailIndex) => {
        const clone = document.createElement('figure');
        clone.className = 'g08-trail';
        clone.style.cssText = `left:${start.left}px;top:${start.top}px;width:${start.width}px;height:${start.height}px;`;
        clone.innerHTML = `<img src="${photo(work)}" alt="">`;
        document.body.append(clone);
        const x = finish.left - start.left;
        const y = finish.top - start.top;
        const scaleX = finish.width / start.width;
        const scaleY = finish.height / start.height;
        const drift = (trailIndex - 3) * 9;
        return clone.animate([
          { transform: 'translate3d(0,0,0) scale(1)', opacity: .78 },
          { transform: `translate3d(${x * .52 + drift}px,${y * .52 - Math.abs(drift)}px,0) scale(${1 + (scaleX - 1) * .52},${1 + (scaleY - 1) * .52})`, opacity: .42, offset: .58 },
          { transform: `translate3d(${x}px,${y}px,0) scale(${scaleX},${scaleY})`, opacity: trailIndex === 6 ? 1 : 0 },
        ], { duration: 560 + trailIndex * 34, delay: trailIndex * 34, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }).finished.catch(() => {}).then(() => clone.remove());
      });
      await Promise.all(trails);
      detail.style.visibility = 'visible';
    }
    detail.querySelector('[data-close]').focus({ preventScroll: true });
    announce(`${work.title} opened with a seven-frame trail.`);
  };
  cells.forEach((cell, index) => {
    cell.addEventListener('pointerenter', () => { if (detail.hidden) { current = index; dock?.set(index); } });
    cell.addEventListener('focus', () => { if (detail.hidden) { current = index; dock?.set(index); } });
    cell.addEventListener('click', () => open(index, cell));
  });
  detail.querySelector('[data-close]').addEventListener('click', close);
  detail.querySelector('[data-prev]').addEventListener('click', () => { show(current - 1); announce(`${works[current].title} project.`); });
  detail.querySelector('[data-next]').addEventListener('click', () => { show(current + 1); announce(`${works[current].title} project.`); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  dock = createProjectDock({ onOpen: (index, trigger) => open(index, trigger) });
  dock.set(current);
}

function init09() {
  stage.classList.add('g09-stage');
  const buildList = (kind) => `<ul class="index-list index-list--${kind}">${works.map((work, index) => `<li><button data-index="${index}">${kind === 'left' ? work.title : `${work.discipline} ${work.year}`}</button></li>`).join('')}</ul>`;
  stage.innerHTML = `${buildList('left')}<figure class="g09-preview"><img src="${photo(works[0])}" alt="${works[0].title}"><i class="g09-line" aria-hidden="true"></i><figcaption class="g09-caption"><span>${works[0].title}</span><span>${works[0].year}</span></figcaption></figure>${buildList('right')}`;
  const preview = stage.querySelector('.g09-preview');
  const buttons = [...stage.querySelectorAll('.index-list button')];
  const caption = stage.querySelector('.g09-caption');
  let pinned = 0;
  let transient = null;
  let rendered = 0;
  let portfolio = null;

  const update = (index) => {
    buttons.forEach((button) => button.toggleAttribute('aria-current', Number(button.dataset.index) === index));
    portfolio?.set(index);
    if (index === rendered) return;
    rendered = index;
    const oldImage = preview.querySelector('img:not(.outgoing)');
    const nextImage = document.createElement('img');
    nextImage.src = photo(works[index]);
    nextImage.alt = works[index].title;
    nextImage.style.opacity = '0';
    preview.insertBefore(nextImage, oldImage);
    requestAnimationFrame(() => { nextImage.style.opacity = '1'; oldImage?.classList.add('outgoing'); });
    setTimeout(() => oldImage?.remove(), 320);
    caption.children[0].textContent = works[index].title;
    caption.children[1].textContent = works[index].year;
  };
  const render = () => update(transient ?? pinned);

  buttons.forEach((button) => {
    const index = Number(button.dataset.index);
    button.addEventListener('pointerenter', () => { transient = index; render(); });
    button.addEventListener('pointerleave', () => { transient = null; render(); });
    button.addEventListener('focus', () => { transient = index; render(); });
    button.addEventListener('blur', () => { transient = null; render(); });
    button.addEventListener('click', () => { pinned = index; transient = null; render(); announce(`${works[index].title} locked to both indexes.`); });
    button.addEventListener('keydown', (event) => {
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const direction = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
      pinned = wrap(index + direction, 0, works.length);
      buttons.find((item) => Number(item.dataset.index) === pinned)?.focus();
      render();
    });
  });
  portfolio = createPortfolioFlow({ onNavigate: (index) => { pinned = index; transient = null; update(index); } });
  buttons.forEach((button) => button.toggleAttribute('aria-current', Number(button.dataset.index) === 0));
}

function init10() {
  stage.classList.add('g10-stage');
  stage.innerHTML = `<div class="g10-layout"><div class="g10-copy">${works.map((work, index) => `<article class="g10-chapter" id="chapter-${index}" data-index="${index}"><span>${String(index + 1).padStart(2, '0')} · ${work.discipline}</span><h2>${work.title}</h2></article>`).join('')}</div><div class="g10-media">${works.map((work, index) => `<figure class="${index ? '' : 'is-current'}" data-index="${index}"><img src="${photo(work)}" ${load(index)} alt="${work.title}"></figure>`).join('')}</div></div><div class="g10-nav" aria-label="Jump to chapter">${works.map((work, index) => `<button data-index="${index}" aria-label="${work.title}" ${index ? '' : 'aria-current="true"'}></button>`).join('')}</div><div class="g10-progress" aria-hidden="true"><span></span></div>`;
  const chapters = [...stage.querySelectorAll('.g10-chapter')];
  const figures = [...stage.querySelectorAll('.g10-media figure')];
  const nav = [...stage.querySelectorAll('.g10-nav button')];
  const progressBar = stage.querySelector('.g10-progress span');
  let current = -1;
  let scheduled = false;
  let portfolio = null;

  const setChapter = (index) => {
    if (index === current) return;
    current = index;
    figures.forEach((figure, itemIndex) => figure.classList.toggle('is-current', itemIndex === index));
    setCurrent(nav, index, { focusable: false });
    portfolio?.set(index);
    announce(`${works[index].title} chapter.`);
  };
  const render = () => {
    scheduled = false;
    const center = innerHeight * .52;
    let nearest = 0;
    let best = Infinity;
    chapters.forEach((chapter, index) => {
      const rect = chapter.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - center);
      if (distance < best) { best = distance; nearest = index; }
    });
    setChapter(nearest);
    const start = main.offsetTop;
    const distance = Math.max(1, main.offsetHeight - innerHeight);
    progressBar.style.setProperty('--progress', String(clamp((scrollY - start) / distance, 0, 1)));
  };
  addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(render); } }, { passive: true });
  nav.forEach((button, index) => button.addEventListener('click', () => chapters[index].scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })));
  portfolio = createPortfolioFlow({ onNavigate: (index) => chapters[index].scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' }) });
  render();
}

function init11() {
  stage.classList.add('g11-stage');
  stage.tabIndex = 0;
  stage.setAttribute('aria-label', 'Circular orbit gallery');
  stage.innerHTML = `<div class="g11-orbit">${works.map((work, index) => `<button class="g11-card" data-index="${index}" aria-label="Select ${work.title}"><img src="${photo(work)}" ${load(index)} alt=""></button>`).join('')}</div><div class="g11-center"><strong></strong><span></span></div>${controls}`;
  const cards = [...stage.querySelectorAll('.g11-card')];
  const center = stage.querySelector('.g11-center');
  let position = 0;
  let current = -1;
  let pointer = null;
  let portfolio = null;

  const render = (value) => {
    position = value;
    const selected = wrap(Math.round(value), 0, works.length);
    const rx = Math.min(innerWidth * .32, 430);
    const ry = Math.min(innerHeight * .26, 210);
    cards.forEach((card, index) => {
      const offset = signedOffset(index, value, works.length);
      if (prefersReducedMotion()) {
        const x = offset * Math.min(innerWidth * .3, 150);
        card.style.transform = `translate(-50%,-50%) translate3d(${x}px,0,0) scale(${Math.abs(offset) < .5 ? 1 : .72})`;
        card.style.opacity = String(clamp(1 - Math.abs(offset) * .26, .1, 1));
        return;
      }
      const angle = offset * Math.PI * 2 / works.length - Math.PI / 2;
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry;
      const depth = (Math.sin(angle) + 1) / 2;
      card.style.transform = `translate(-50%,-50%) translate3d(${x}px,${y}px,0) scale(${.68 + depth * .28}) rotate(${Math.cos(angle) * 3}deg)`;
      card.style.opacity = String(.34 + depth * .66);
      card.style.zIndex = String(Math.round(depth * 20));
    });
    if (selected !== current) {
      current = selected;
      setCurrent(cards, current);
      center.querySelector('strong').textContent = works[current].title;
      center.querySelector('span').textContent = `${works[current].discipline} · ${works[current].year}`;
      portfolio?.set(current);
    }
  };
  const spring = createSpring({ onUpdate: render, stiffness: .08, damping: .81 });
  portfolio = createPortfolioFlow({ onNavigate: (index) => spring.set(position + signedOffset(index, position, works.length)) });
  const angleAt = (event) => {
    const rect = stage.getBoundingClientRect();
    return Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2);
  };
  stage.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    spring.stop();
    pointer = { id: event.pointerId, angle: angleAt(event), position, time: performance.now(), lastPosition: position };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    let delta = angleAt(event) - pointer.angle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    const next = pointer.position - delta / (Math.PI * 2 / works.length);
    pointer.lastPosition = position;
    spring.set(next, { immediate: true });
  });
  const release = (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const elapsed = Math.max(16, performance.now() - pointer.time);
    const velocity = (position - pointer.position) / elapsed * 1000;
    pointer = null;
    spring.set(Math.round(position + projectMomentum(velocity, .045, 2)));
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  const step = (direction) => spring.set(Math.round(position) + direction);
  cards.forEach((card, index) => card.addEventListener('click', () => {
    if (index === current) portfolio.open(card);
    else spring.set(position + signedOffset(index, position, works.length));
  }));
  stage.querySelector('[data-prev]').addEventListener('click', () => step(-1));
  stage.querySelector('[data-next]').addEventListener('click', () => step(1));
  stage.addEventListener('keydown', (event) => { if (event.key === 'ArrowLeft') step(-1); if (event.key === 'ArrowRight') step(1); });
  render(0);
}

function init12() {
  stage.classList.add('g12-stage');
  stage.innerHTML = `<div class="g12-frame"><img class="g12-current" alt=""><img class="g12-next" alt=""><div class="g12-slits" aria-hidden="true">${'<i></i>'.repeat(16)}</div><i class="g12-cursor" aria-hidden="true"></i><div class="g12-meta"><span></span><span></span></div></div><div class="g12-range"><button class="round-control prev" data-prev aria-label="Previous pair"></button><input type="range" min="0" max="100" value="50" aria-label="Image reconstruction position"><button class="round-control" data-next aria-label="Next pair"></button></div>`;
  const frame = stage.querySelector('.g12-frame');
  const range = stage.querySelector('input');
  const meta = stage.querySelector('.g12-meta');
  let index = 0;
  let portfolio = null;

  const updatePair = () => {
    const next = wrap(index + 1, 0, works.length);
    stage.querySelector('.g12-current').src = photo(works[index]);
    stage.querySelector('.g12-current').alt = works[index].title;
    stage.querySelector('.g12-next').src = photo(works[next]);
    stage.querySelector('.g12-next').alt = works[next].title;
    meta.children[0].textContent = works[index].title;
    meta.children[1].textContent = works[next].title;
  };
  const setScan = (value) => {
    const scan = clamp(value, 0, 100);
    frame.style.setProperty('--scan', `${scan}%`);
    frame.style.setProperty('--activity', String(1 - Math.abs(scan - 50) / 50));
    range.value = String(scan);
    range.setAttribute('aria-valuetext', `${Math.round(scan)} percent toward ${works[wrap(index + 1, 0, works.length)].title}`);
    portfolio?.set(scan < 50 ? index : wrap(index + 1, 0, works.length));
  };
  const scanEvent = (event) => {
    const rect = frame.getBoundingClientRect();
    setScan((event.clientX - rect.left) / rect.width * 100);
  };
  let scanning = false;
  frame.addEventListener('pointerdown', (event) => { scanning = true; frame.setPointerCapture(event.pointerId); scanEvent(event); });
  frame.addEventListener('pointermove', (event) => { if (scanning || event.pointerType === 'mouse') scanEvent(event); });
  frame.addEventListener('pointerup', () => { scanning = false; announce('Slit position set.'); });
  range.addEventListener('input', () => setScan(Number(range.value)));
  const step = (direction) => { index = wrap(index + direction, 0, works.length); updatePair(); setScan(50); announce(`${works[index].title} and ${works[wrap(index + 1, 0, works.length)].title}.`); };
  stage.querySelector('[data-prev]').addEventListener('click', () => step(-1));
  stage.querySelector('[data-next]').addEventListener('click', () => step(1));
  range.addEventListener('keydown', (event) => { if (event.key === 'PageUp') step(-1); if (event.key === 'PageDown') step(1); });
  portfolio = createPortfolioFlow({ onNavigate: (nextIndex) => { index = nextIndex; updatePair(); setScan(0); } });
  updatePair();
  setScan(50);
}

function init13() {
  stage.classList.add('g13-stage');
  stage.tabIndex = 0;
  stage.setAttribute('aria-label', 'Depth tunnel gallery');
  stage.innerHTML = `<div class="g13-tunnel">${works.map((work, index) => `<button class="g13-plane" data-index="${index}" aria-label="Select ${work.title}"><img src="${photo(work)}" ${load(index)} alt=""></button>`).join('')}</div><div class="g13-readout"><strong></strong><span class="meta"></span></div>${controls}`;
  const planes = [...stage.querySelectorAll('.g13-plane')];
  const readout = stage.querySelector('.g13-readout');
  let position = 0;
  let current = -1;
  let wheelTimer = 0;
  let portfolio = null;

  const render = (value) => {
    position = value;
    const selected = wrap(Math.round(value), 0, works.length);
    planes.forEach((plane, index) => {
      const offset = signedOffset(index, value, works.length);
      const absolute = Math.abs(offset);
      if (prefersReducedMotion()) plane.style.transform = `translate(-50%,-50%) translateX(${offset * Math.min(innerWidth * .32, 190)}px) scale(${absolute < .5 ? 1 : .72})`;
      else plane.style.transform = `translate(-50%,-50%) translate3d(0,${offset * 34}px,${120 - absolute * 260}px) rotateX(${-offset * 2.2}deg) scale(${1 - Math.min(absolute, 3) * .035})`;
      plane.style.opacity = String(clamp(1 - absolute * .22, .08, 1));
      plane.style.zIndex = String(30 - Math.round(absolute));
    });
    if (selected !== current) {
      current = selected;
      setCurrent(planes, current);
      readout.querySelector('strong').textContent = works[current].title;
      readout.querySelector('span').textContent = `${works[current].discipline} · depth ${String(current + 1).padStart(2, '0')}`;
      portfolio?.set(current);
    }
  };
  const spring = createSpring({ onUpdate: render, stiffness: .09, damping: .79 });
  portfolio = createPortfolioFlow({ onNavigate: (index) => spring.set(position + signedOffset(index, position, works.length)) });
  const step = (direction) => spring.set(Math.round(position) + direction);
  createDrag({ element: stage, axis: 'y', onMove: ({ delta }) => spring.set(position + delta / 180, { immediate: true }), onEnd: ({ velocity }) => spring.set(Math.round(position + projectMomentum(velocity * 9))) });
  stage.addEventListener('wheel', (event) => {
    event.preventDefault();
    spring.set(position + event.deltaY * .003, { immediate: true });
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => spring.set(Math.round(position)), 100);
  }, { passive: false });
  planes.forEach((plane, index) => plane.addEventListener('click', () => {
    if (index === current) portfolio.open(plane);
    else spring.set(position + signedOffset(index, position, works.length));
  }));
  stage.querySelector('[data-prev]').addEventListener('click', () => step(-1));
  stage.querySelector('[data-next]').addEventListener('click', () => step(1));
  stage.addEventListener('keydown', (event) => { if (event.key === 'ArrowUp') step(-1); if (event.key === 'ArrowDown') step(1); });
  render(0);
}

function init14() {
  stage.classList.add('g14-stage');
  stage.innerHTML = `<div class="g14-grid">${works.map((work, index) => `<button class="g14-cell" data-index="${index}" tabindex="${index ? -1 : 0}" aria-label="${work.title}"><img src="${photo(work)}" ${load(index)} alt=""></button>`).join('')}</div><i class="g14-reticle" aria-hidden="true"></i><span class="g14-label"></span>`;
  const cells = [...stage.querySelectorAll('.g14-cell')];
  const reticle = stage.querySelector('.g14-reticle');
  const label = stage.querySelector('.g14-label');
  let selected = 0;
  let geometry = [];
  let portfolio = null;

  const measure = () => {
    cells.forEach((cell) => { cell.style.transform = ''; });
    geometry = cells.map((cell) => cell.getBoundingClientRect());
  };

  const applyField = (x, y) => {
    const bounds = stage.getBoundingClientRect();
    reticle.style.left = `${x - bounds.left}px`;
    reticle.style.top = `${y - bounds.top}px`;
    let nearest = 0;
    let best = Infinity;
    cells.forEach((cell, index) => {
      const rect = geometry[index] ?? cell.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.hypot(dx, dy);
      if (distance < best) { best = distance; nearest = index; }
      const influence = clamp(1 - distance / 320, 0, 1);
      const tx = clamp(dx * .12 * influence, -18, 18);
      const ty = clamp(dy * .12 * influence, -18, 18);
      cell.style.transform = prefersReducedMotion() ? 'none' : `translate3d(${tx}px,${ty}px,0) scale(${1 + influence * .075})`;
    });
    cells.forEach((cell, index) => cell.classList.toggle('is-nearest', index === nearest));
    label.textContent = `${works[nearest].title} · ${works[nearest].discipline}`;
    portfolio?.set(nearest);
  };
  const centerOn = (index) => {
    const rect = geometry[index] ?? cells[index].getBoundingClientRect();
    applyField(rect.left + rect.width / 2, rect.top + rect.height / 2);
  };
  stage.addEventListener('pointermove', (event) => applyField(event.clientX, event.clientY));
  cells.forEach((cell, index) => {
    cell.addEventListener('click', () => {
      if (selected === index) { portfolio.open(cell); return; }
      selected = index;
      setCurrent(cells, selected);
      centerOn(selected);
      announce(`${works[selected].title} selected.`);
    });
    cell.addEventListener('focus', () => centerOn(index));
    cell.addEventListener('keydown', (event) => {
      const columns = innerWidth <= 760 ? 2 : 4;
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      selected = wrap(index + delta, 0, cells.length);
      setCurrent(cells, selected);
      cells[selected].focus();
      centerOn(selected);
    });
  });
  portfolio = createPortfolioFlow({ onNavigate: (index) => { selected = index; setCurrent(cells, selected); centerOn(selected); } });
  setCurrent(cells, selected);
  requestAnimationFrame(() => { measure(); centerOn(0); });
  addEventListener('resize', () => { measure(); centerOn(selected); });
}

function init15() {
  stage.classList.add('g15-stage');
  stage.innerHTML = `<div class="g15-frame"><img class="g15-current" alt=""><img class="g15-next" alt=""></div><div class="g15-readout"><strong></strong><span></span></div><div class="g15-timeline"><input type="range" min="0" max="700" step="1" value="0" aria-label="Archive time"><div class="g15-marks">${works.map((work, index) => `<button data-value="${index * 100}" aria-label="Jump to ${work.title}"></button>`).join('')}</div></div>`;
  const frame = stage.querySelector('.g15-frame');
  const currentImage = stage.querySelector('.g15-current');
  const nextImage = stage.querySelector('.g15-next');
  const readout = stage.querySelector('.g15-readout');
  const range = stage.querySelector('input');
  const marks = [...stage.querySelectorAll('.g15-marks button')];
  let value = 0;
  let imageIndex = -1;
  let scrubbing = false;
  let portfolio = null;

  const render = (nextValue) => {
    value = clamp(nextValue, 0, 700);
    const index = Math.min(6, Math.floor(value / 100));
    const next = Math.min(index + 1, 7);
    const mix = value / 100 - index;
    if (index !== imageIndex) {
      imageIndex = index;
      currentImage.src = photo(works[index]);
      currentImage.alt = works[index].title;
      nextImage.src = photo(works[next]);
      nextImage.alt = works[next].title;
    }
    frame.style.setProperty('--mix', String(mix));
    range.value = String(value);
    range.setAttribute('aria-valuetext', `${works[index].title}, ${Math.round(mix * 100)} percent toward ${works[next].title}`);
    readout.querySelector('strong').textContent = mix < .5 ? works[index].title : works[next].title;
    readout.querySelector('span').textContent = `${works[index].year} — ${works[next].year} · ${Math.round(value).toString().padStart(3, '0')}`;
    const nearest = Math.round(value / 100);
    setCurrent(marks, nearest, { focusable: false });
    portfolio?.set(nearest);
  };
  const valueFromPointer = (event) => clamp((event.clientX / innerWidth) * 700, 0, 700);
  stage.addEventListener('pointerdown', (event) => {
    if (event.target.closest('input,button')) return;
    scrubbing = true;
    stage.setPointerCapture(event.pointerId);
    render(valueFromPointer(event));
  });
  stage.addEventListener('pointermove', (event) => { if (scrubbing) render(valueFromPointer(event)); });
  stage.addEventListener('pointerup', () => { scrubbing = false; announce(`Archive stopped at ${readout.querySelector('strong').textContent}.`); });
  range.addEventListener('input', () => render(Number(range.value)));
  marks.forEach((mark) => mark.addEventListener('click', () => { render(Number(mark.dataset.value)); announce(`${works[Number(mark.dataset.value) / 100].title} selected.`); }));
  portfolio = createPortfolioFlow({ onNavigate: (index) => render(index * 100) });
  render(0);
}

const initializers = {
  '01': init01,
  '02': init02,
  '03': init03,
  '04': init04,
  '05': init05,
  '06': init06,
  '07': init07,
  '08': init08,
  '09': init09,
  '10': init10,
  '11': init11,
  '12': init12,
  '13': init13,
  '14': init14,
  '15': init15,
};

if (!initializers[galleryId]) throw new Error(`Unknown gallery: ${galleryId}`);
initializers[galleryId]();
