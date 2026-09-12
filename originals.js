import { originalWorks } from './original-works.js?v=eb-20260912';
import { populateOriginalSlot, preserveOriginalForeground, observeOriginalSlotSize } from './original-slots.js?v=eb-20260912';

export function initOriginals(onInquiry) {
  const root = document.querySelector('#original-folios');
  const works = originalWorks;
  ensureMobileOriginalScene(root);
  const dialog = document.createElement('dialog');
  dialog.className = 'original-dialog';
  dialog.setAttribute('aria-labelledby', 'original-detail-title');
  // (2026-09-12) 상세창에 있던 'Official title, creator and artwork await the collection
  // materials.' 는 아직 자료가 없다는 고백이라 화면에서 뺀다. 대신 작품별 실제 정보
  // (원작자·연도·출처)를 담을 칸을 두고, 그 값이 들어오기 전에는 칸 자체를 렌더하지
  // 않는다 — 빈 자리가 미완성 문구보다 낫다.
  dialog.innerHTML = `<button class="dialog-close" type="button" aria-label="닫기 Close">Close ×</button><p class="eyebrow">BEAM ARCHIVE / CONTENTS</p><h2 id="original-detail-title"></h2><img class="original-detail-image" hidden alt=""><p>Eternal Beam 아카이브를 이루는 네 갈래 가운데 하나입니다.</p><dl class="original-metadata"><div><dt>BEAM’S ROLE</dt><dd>Contents archive</dd></div><div class="original-metadata__provenance" hidden><dt>ORIGINAL WORK</dt><dd></dd></div></dl><p>기기는 그릇이고, 이 자리에 남는 것은 그 안의 콘텐츠입니다.</p><button class="link-button original-inquiry" type="button">Ask about this archive <span aria-hidden="true">↗</span></button>`;
  document.body.append(dialog);
  let selected = works[0];
  let opener;
  let localEntry = false;

  function open(work, trigger) {
    selected = work;
    opener = trigger;
    dialog.querySelector('h2').textContent = work.title;
    // 원작자·연도·출처가 실제로 들어온 작품만 그 줄을 보여 준다(original-works.js 의
    // creator / year / source 값). 없으면 줄 자체가 사라진다.
    const provenance = dialog.querySelector('.original-metadata__provenance');
    const credit = [work.creator, work.year, work.source].filter(Boolean).join(' · ');
    provenance.hidden = !credit;
    provenance.querySelector('dd').textContent = credit;
    const detailImage = dialog.querySelector('.original-detail-image');
    detailImage.hidden = !work.image;
    if (work.image) { detailImage.src = work.image; detailImage.alt = work.alt || work.title; }
    else detailImage.removeAttribute('src');
    if (!dialog.open) dialog.showModal();
  }
  works.forEach((work, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'original-table__work';
    button.style.setProperty('--work-index', index);
    button.setAttribute('aria-label', `${work.title} 자세히 보기`);
    button.setAttribute('aria-haspopup', 'dialog');
    button.dataset.workId = work.id;
    button.innerHTML = `<span class="original-table__accessible">${work.title} 자세히 보기</span>`;
    button.addEventListener('click', () => {
      // Natural scrolling does not change the URL; Back must return to this collection.
      if (location.hash !== '#original') history.replaceState(null, '', '#original');
      history.pushState(null, '', `#original/${work.id}`);
      localEntry = true;
      open(work, button);
    });
    root.append(button);
  });
  const mobileNavigation = initMobileOriginalNavigation(root, works);
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    works.forEach((work, index) => populateOriginalSlot(root.children[index], work, index));
    populateMobileFallbackArt(root, works);
    preserveOriginalForeground(root);
    observeOriginalSlotSize(root);
    mobileNavigation.refresh();
  }, { rootMargin: '300px' });
  observer.observe(root);
  watchOriginalArrival();

  function close() {
    dialog.close();
    if (location.hash.startsWith('#original/')) {
      if (localEntry) history.back();
      else history.replaceState(null, '', '#original');
    }
    localEntry = false;
  }
  dialog.querySelector('.dialog-close').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.addEventListener('close', () => {
    // close() also queues a back-navigation, and when that lands after this it
    // drops focus to <body> — measured, one run in four. Re-assert focus once the
    // navigation has settled, but only if nothing else has taken it.
    const target = opener;
    target?.focus({ preventScroll: true });
    const reassert = () => {
      if (target && document.activeElement === document.body) target.focus({ preventScroll: true });
    };
    requestAnimationFrame(reassert);
    setTimeout(reassert, 160);
  });
  dialog.querySelector('.original-inquiry').addEventListener('click', () => {
    localEntry = false;
    dialog.close();
    history.replaceState(null, '', '#original');
    onInquiry({ id: selected.id, title: selected.title, kind: 'imported' });
  });
  function syncHash() {
    const id = location.hash.slice('#original/'.length);
    const work = works.find(item => item.id === id);
    if (location.hash.startsWith('#original/') && work) {
      mobileNavigation.select(works.indexOf(work), false);
      open(work, root.querySelector(`[data-work-id="${work.id}"]`));
    }
    else if (dialog.open) dialog.close();
  }
  window.addEventListener('hashchange', syncHash);
  syncHash();
}

function ensureMobileOriginalScene(root) {
  const scene = root.closest('.original-table__scene');
  if (!scene || scene.querySelector('.original-table__mobile-plate')) return;
  const plate = document.createElement('img');
  plate.className = 'original-table__mobile-plate';
  plate.src = 'assets/original-table/table-empty-clean.webp?v=eternal-beam-r3';
  plate.width = 1671;
  plate.height = 941;
  plate.alt = '';
  plate.setAttribute('aria-hidden', 'true');
  plate.loading = 'lazy';
  plate.decoding = 'async';
  scene.prepend(plate);

  // (2026-09-12) 휴대폰 제목은 원래 탁자 그림의 오른쪽 위에 그려져 있던 'TVA ORIGINAL' 마크를
  // SVG 로 오려 내 보여 주었다. 그 마크는 Eternal Beam 그림(table-clean r3)에서 사라졌고,
  // 남은 것은 빈 베이지 상자뿐이라 제목 자리에 정체 모를 네모가 떠 있었다(진짜 글자는 숨긴 채).
  // 이제 오려 내기를 그만두고 heading 안의 'BEAM ARCHIVE' 글자를 그대로 보여 준다.
}

function populateMobileFallbackArt(root, works) {
  // Phones now show the painted table with its painted sheets and pan to each
  // one, exactly like the desktop; the flat card with a projected scrap of the
  // plate is gone, so there is nothing to fall back to.
  if (matchMedia('(max-width: 700px)').matches) return;
  const planes = [
    [[71, 327], [363, 270], [425, 662], [130, 717]],
    [[377, 297], [659, 228], [750, 617], [464, 682]],
    [[670, 253], [947, 203], [1050, 585], [754, 645]],
    [[955, 205], [1247, 171], [1324, 570], [1059, 589]],
  ];
  works.forEach((work, index) => {
    const card = root.children[index];
    if (work.image || card.querySelector('.original-table__mobile-art-frame')) return;
    const [a, b, c, d] = planes[index];
    const dx1 = b[0] - c[0], dx2 = d[0] - c[0], dx3 = a[0] - b[0] + c[0] - d[0];
    const dy1 = b[1] - c[1], dy2 = d[1] - c[1], dy3 = a[1] - b[1] + c[1] - d[1];
    const determinant = dx1 * dy2 - dx2 * dy1;
    const g = (dx3 * dy2 - dx2 * dy3) / determinant;
    const h = (dx1 * dy3 - dx3 * dy1) / determinant;
    const forward = [
      (b[0] - a[0] + g * b[0]) / 420, (b[1] - a[1] + g * b[1]) / 420, 0, g / 420,
      (d[0] - a[0] + h * d[0]) / 594, (d[1] - a[1] + h * d[1]) / 594, 0, h / 594,
      0, 0, 1, 0, a[0], a[1], 0, 1,
    ];
    const frame = document.createElement('span');
    frame.className = 'original-table__mobile-art-frame';
    frame.setAttribute('aria-hidden', 'true');
    const image = document.createElement('img');
    image.src = 'assets/original-table/table-clean-1671.webp?v=eternal-beam-r3';
    image.alt = '';
    image.width = 1671;
    image.height = 941;
    image.style.transform = new DOMMatrix(forward).inverse().toString();
    frame.append(image);
    card.classList.add('has-mobile-fallback');
    card.prepend(frame);
  });
  const resize = () => [...root.querySelectorAll('.original-table__mobile-art-frame')].forEach(frame => {
    frame.style.setProperty('--mobile-art-scale', frame.parentElement.getBoundingClientRect().width / 420);
  });
  new ResizeObserver(resize).observe(root);
  resize();
}

function initMobileOriginalNavigation(root, works) {
  const viewport = document.querySelector('.original-table__viewport');
  const pages = document.querySelector('.original-table__pages');
  const mobile = matchMedia('(max-width: 700px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let activeIndex = 0;
  let dragged = false;
  let pointer = null;
  pages.replaceChildren();
  pages.setAttribute('aria-label', '작품 슬라이드 선택');
  works.forEach((work, index) => {
    const page = document.createElement('button');
    page.type = 'button';
    page.dataset.index = String(index);
    page.setAttribute('aria-label', `${work.title} 보기`);
    page.addEventListener('click', () => setActive(index));
    pages.append(page);
  });

  const live = document.createElement('span');
  live.className = 'original-table__accessible';
  live.setAttribute('aria-live', 'polite');
  pages.append(live);

  function setActive(next, announce = true) {
    activeIndex = Math.max(0, Math.min(works.length - 1, next));
    const cards = [...root.querySelectorAll('.original-table__work')];
    cards.forEach((card, index) => {
      // Phones used to pile the four sheets into one deck and swap which was on
      // top. That read as the pictures lying on each other. They now run down
      // the page one after another, so nothing is stacked, hidden or rotated:
      // every sheet is in the flow, and "active" only marks the one in view.
      const depth = (index - activeIndex + works.length) % works.length;
      if (mobile.matches) {
        ['--stack-depth', '--stack-x', '--stack-y', '--stack-rotate'].forEach(name => card.style.removeProperty(name));
        card.style.zIndex = depth === 0 ? '5' : '4';
        card.style.setProperty('--sheet-order', String(index < activeIndex ? -1 : index > activeIndex ? 1 : 0));
      } else {
        card.style.setProperty('--stack-depth', depth);
        card.style.setProperty('--stack-x', `${[0, 10, -8, 5][depth]}px`);
        card.style.setProperty('--stack-y', `${[0, -9, -17, -25][depth]}px`);
        card.style.setProperty('--stack-rotate', `${[-2, 2.5, -3.5, 1.5][depth]}deg`);
        card.style.zIndex = String([1, 2, 4, 3][index]);
      }
      card.classList.toggle('is-active', depth === 0);
      if (mobile.matches) {
        card.tabIndex = depth === 0 ? 0 : -1;
        card.setAttribute('aria-hidden', String(depth !== 0));
        card.inert = depth !== 0;   // 접힌 카드는 키보드·보조기기에서 완전히 뺀다
      } else {
        card.tabIndex = 0;
        card.removeAttribute('aria-hidden');
        card.inert = false;
      }
    });
    [...pages.children].forEach((page, index) => {
      if (!(page instanceof HTMLButtonElement)) return;
      if (index === activeIndex) page.setAttribute('aria-current', 'true');
      else page.removeAttribute('aria-current');
    });
    if (announce && mobile.matches) live.textContent = `${works[activeIndex].title}, ${activeIndex + 1} / ${works.length}`;
  }

  viewport.addEventListener('pointerdown', event => {
    if (!mobile.matches || event.pointerType === 'mouse' && event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, captured: false };
    dragged = false;
  });
  viewport.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (Math.abs(event.clientX - pointer.x) > 8) {
      dragged = true;
      if (!pointer.captured) {
        viewport.setPointerCapture?.(event.pointerId);
        pointer.captured = true;
      }
    }
  });
  viewport.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.15) { setActive(activeIndex + (dx < 0 ? 1 : -1)); scrollToCard(activeIndex); }
    if (pointer.captured && viewport.hasPointerCapture?.(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    pointer = null;
    if (dragged) requestAnimationFrame(() => { dragged = false; });
  });
  viewport.addEventListener('pointercancel', () => { pointer = null; dragged = false; });
  root.addEventListener('click', event => {
    if (!dragged) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  root.addEventListener('keydown', event => {
    if (!mobile.matches || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    setActive(activeIndex + (event.key === 'ArrowRight' ? 1 : -1));
    root.querySelector('.original-table__work.is-active')?.focus({ preventScroll: true });
  });
  // On phones the table stays put (sticky) and the sheets change ON it as the
  // page scrolls: the section is four screens tall, and how far you have
  // scrolled into it picks the sheet. Tapping a dot scrolls to that sheet's
  // screen, so the same motion drives both.
  const section = document.querySelector('#original');
  const scene = document.querySelector('.original-table__scene');
  let hold = 0;
  let step = 0;                       // 0 = 책상 전체, 1..4 = 그 장으로 확대
  const STEPS = works.length + 1;
  // On phones the first screen is the whole painted table — four sheets lying
  // over each other at their angles, the character with his hand on the
  // paperweight — and each further screen of scrolling zooms in on one sheet.
  // The scene is scaled and slid as one picture, so nothing is re-laid out.
  const PLANES = [
    [[71, 327], [363, 270], [425, 662], [130, 717]],
    [[377, 297], [659, 228], [750, 617], [464, 682]],
    [[670, 253], [947, 203], [1050, 585], [754, 645]],
    [[955, 205], [1247, 171], [1324, 570], [1059, 589]],
  ];
  // Camera keyframes in the scene: 0 = the whole table, 1..4 = each sheet.
  // The scroll drives a CONTINUOUS glide between them (measured earlier: with
  // hard steps a whole screen of scrolling moved nothing, then the picture
  // jumped — which is what read as broken on a phone).
  function keyframe(k) {
    const sceneW = 1100, kk = sceneW / 1671, sceneH = sceneW * 871 / 1671;
    const vw = innerWidth, vh = Math.min(400, Math.round(innerWidth * 1.07));
    if (k === 0) {
      const z = vw / (sceneW * 0.965);
      // (2026-09-12 감사 #96) 예전에는 '책상 전체' 화면에서만 상자 높이를 그림 높이에 맞췄다
      // (390px 폰에서 210px). 그래서 착지 첫 화면의 상자가 다른 장(400px)보다 190px 낮았고,
      // 그만큼이 점 아래 흰 여백으로 더해졌으며(실측 414px), 조금만 굴려도 상자가 커지며 화면이 튀었다.
      // 상자 높이를 처음부터 다른 장과 같게 두고, 작은 전체 그림은 그 상자 안에서 세로 가운데에 둔다.
      return { z, px: 0, py: Math.round((vh - sceneH * z) / 2), box: vh };
    }
    const q = PLANES[k - 1];
    const xs = q.map(p => p[0]), ys = q.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2 * kk;
    const cy = ((Math.min(...ys) + Math.max(...ys)) / 2 - 70) * kk;
    const w = (Math.max(...xs) - Math.min(...xs)) * kk;
    const z = Math.min(1.9, vw * 0.74 / w);
    return {
      z,
      px: Math.max(vw - sceneW * z, Math.min(0, vw / 2 - cx * z)),
      py: Math.max(vh - sceneH * z, Math.min(0, vh / 2 - cy * z)),
      box: vh,
    };
  }
  let t = 0;                          // 0..STEPS-1, continuous
  function view() {
    if (!scene) return;
    if (!mobile.matches) { ['--zoom', '--pan-x', '--pan-y'].forEach(n => scene.style.removeProperty(n)); section.style.removeProperty('--box-h'); return; }
    const k = Math.min(STEPS - 2, Math.floor(t));
    const f = t - k;
    const e = f * f * (3 - 2 * f);                    // ease within each segment
    const A = keyframe(k), B = keyframe(k + 1);
    const L = (x, y) => x + (y - x) * e;
    scene.style.setProperty('--zoom', L(A.z, B.z).toFixed(4));
    scene.style.setProperty('--pan-x', `${Math.round(L(A.px, B.px))}px`);
    scene.style.setProperty('--pan-y', `${Math.round(L(A.py, B.py))}px`);
    section.style.setProperty('--box-h', `${Math.round(L(A.box, B.box))}px`);
  }
  function stepTop(index) {
    const nav = document.querySelector('.site-nav');
    const navH = nav && getComputedStyle(nav).visibility !== 'hidden' ? nav.getBoundingClientRect().height : 0;
    const usable = section.offsetHeight - (innerHeight - navH);
    return section.offsetTop + usable * (index / Math.max(1, STEPS - 1)) * 0.999;
  }
  function goStep(next, announce = false) {
    step = Math.max(0, Math.min(STEPS - 1, next));
    if (step > 0) setActive(step - 1, announce);
    else {
      // (2026-09-12) 0단계(책상 전체)에서 네 점의 aria-current 를 모두 지우면 점이 전부
      // 같은 모양이라 '지금 어디인지'를 알 수 없었다. 첫 점을 현재로 두어 언제나 점
      // 하나는 표시되게 한다. 같은 이유로 첫 장에 is-active 를 맞춰 둔다(폰에서
      // is-active 는 그 장을 누를 수 있게 하는 표시다).
      const dots = [...pages.children].filter(page => page instanceof HTMLButtonElement);
      dots.forEach((page, index) => {
        if (index === 0) page.setAttribute('aria-current', 'true');
        else page.removeAttribute('aria-current');
      });
      root.querySelectorAll('.original-table__work').forEach((card, index) => card.classList.toggle('is-active', index === 0));
    }
  }
  function scrollToCard(index, smooth = true) {
    if (!mobile.matches) return;
    goStep(index + 1);
    window.scrollTo({ top: stepTop(index + 1), behavior: smooth && !reduced.matches ? 'smooth' : 'auto' });
    if (!smooth || reduced.matches) { t = index + 1; view(); }
  }
  function fromScroll() {
    if (!mobile.matches) return;
    const nav = document.querySelector('.site-nav');
    const navH = nav && getComputedStyle(nav).visibility !== 'hidden' ? nav.getBoundingClientRect().height : 0;
    const usable = section.offsetHeight - (innerHeight - navH);
    if (usable <= 0) return;
    const progress = Math.max(0, Math.min(1, (scrollY - section.offsetTop) / usable));
    t = progress * (STEPS - 1);
    view();
    const next = Math.round(t);
    if (next !== step) goStep(next);
  }
  addEventListener('resize', view, { passive: true });
  addEventListener('scroll', fromScroll, { passive: true });
  [...pages.children].forEach((page, index) => {
    if (page instanceof HTMLButtonElement) page.addEventListener('click', () => scrollToCard(index));
  });

  // (2026-09-12 감사 #9) 휴대폰에서 Shift+Tab 으로 거꾸로 오면 ORIGINAL 의 장 단추(점)가
  // 상단 고정 내비(높이 64px, 불투명, z-index 30) 뒤에 100% 가려 포커스 테두리가 전혀 안 보였다.
  // 고치기 전 실측(qa/fall-strip/v2-kbd-navlap.mjs 390 844 3 14):
  //   'Collection 03 보기'·'Collection 01 보기' 가 rect top=8 에 놓여 44px 중 44px(100%) 가림, 3/3회 재현.
  //   정방향 Tab 은 0건. WCAG 2.2 2.4.11(Focus Not Obscured, Minimum) 불합격.
  // 원인 — 추측이 아니라 직접 잰 것(qa/fall-strip/zo-probe-snapback.mjs):
  //   돌아가는 자리 scrollY 12846 은 옆 구역(ONLY TVA)의 착지점이다. 그 자리에서 ORIGINAL 구역은
  //   화면상 bottom=64 까지 밀려나 마지막 64px 만 남고, sticky 인 이 점 줄이 바로 그 64px 에
  //   주차되며 내비 밑에 깔린다(실측: 구역 offsetTop=10210 height=2701, 점줄 top규칙 668px, 실제 top 0).
  //   크롬은 sticky 요소를 '원래 자리'로 따져 이미 보인다고 보고 스크롤을 아예 하지 않는다.
  //   styles.css 의 html{scroll-padding-top} 도, 단추에 준 scroll-margin-top 도 그래서 안 듣는다
  //   (scroll-margin-top 만으로 재측정했더니 가림이 2개 → 3~4개로 오히려 늘어 되돌렸다).
  //   겹친 만큼만 살짝 올리는 보정도 안 된다 — only-tva-walk.js 의 alignIfClose 가 0.5초 뒤 도로 끌고 온다
  //   (실측: 손으로 90px 올렸더니 1.6초 뒤 12846 복귀).
  // 고침: 점·작품 단추에 키보드 포커스가 들어오면 그 장의 자리로 페이지를 옮긴다 — 점을 눌렀을 때와
  //   똑같은 동작이라 새 UI 도, 새 규칙도 아니다. 그 자리는 가장 멀어야 12129 이고 거기서는
  //   ONLY TVA 가 화면의 7% 만 보여 alignIfClose 의 기준(터치 35%)에 안 걸리므로 도로 끌려가지 않는다.
  //   이미 내비 아래에 온전히 보이는 포커스는 건드리지 않는다 — 정방향 Tab 0건을 그대로 지키기 위해서다.
  const navBottom = () => {
    const nav = document.querySelector('.site-nav');
    if (!nav) return 0;
    const style = getComputedStyle(nav);
    const rect = nav.getBoundingClientRect();
    if (+style.opacity <= 0.05 || style.visibility === 'hidden' || rect.height <= 2) return 0;
    return Math.max(0, rect.bottom);
  };
  // 내비 아래에, 그리고 화면 안에 온전히 들어와 있는가
  const isClear = element => {
    const rect = element.getBoundingClientRect();
    return rect.height > 0 && rect.top >= navBottom() - 0.5 && rect.bottom <= innerHeight + 0.5;
  };
  // 이 요소가 몇 번째 장에 해당하는지 (0 = 해당 없음)
  const focusStep = target => {
    const dot = [...pages.children].filter(page => page instanceof HTMLButtonElement).indexOf(target);
    if (dot >= 0) return dot + 1;
    const card = [...root.querySelectorAll('.original-table__work')].indexOf(target);
    return card >= 0 ? card + 1 : 0;
  };
  section.addEventListener('focusin', event => {
    const target = event.target;
    if (!mobile.matches || !(target instanceof HTMLElement)) return;
    if (!target.matches(':focus-visible')) return;   // 손가락·마우스로 누른 포커스는 화면을 옮기지 않는다
    if (isClear(target)) return;                     // 이미 다 보이면 그대로 둔다
    const next = focusStep(target);
    if (!next) return;
    goStep(next);
    // html{scroll-behavior:smooth} 가 걸려 있어 부드럽게 옮기면 다음 Tab 과 엉킨다. 즉시 옮긴다.
    scrollTo({ top: stepTop(next), behavior: 'instant' });
    t = next;
    view();
  });
  mobile.addEventListener('change', () => { setActive(activeIndex, false); view(); });
  reduced.addEventListener('change', () => root.classList.toggle('is-reduced-motion', reduced.matches));
  root.classList.toggle('is-reduced-motion', reduced.matches);
  setActive(0, false);
  goStep(0);
  view();
  addEventListener('resize', view, { passive: true });
  return {
    refresh: () => { if (mobile.matches) { goStep(step); view(); } else setActive(activeIndex, false); },
    select: (index, announce = true) => { setActive(index, announce); scrollToCard(index, false); },
  };
}

// The character has to ARRIVE, not already be standing there.
// Scrolling down, the section slides into view well before journey.js starts the
// PORTFOLIO→ORIGINAL run, so the resting character was on screen for a beat
// before the running one set off — which read as "he was here all along".
// It is now held back until the section has actually settled, which is the same
// moment the running copy finishes and disappears, so one hands over to the other.
function watchOriginalArrival() {
  const section = document.querySelector('#original');
  const host = section?.querySelector('.original-host');
  if (!section || !host) return;
  const nav = document.querySelector('.site-nav');
  let frame = 0;

  const settle = () => {
    frame = 0;
    if (document.documentElement.classList.contains('reduced-motion')
      || section.classList.contains('is-linear')) {
      host.dataset.arrived = 'true';
      return;
    }
    const navBottom = nav && getComputedStyle(nav).visibility !== 'hidden' ? nav.getBoundingClientRect().height : 0;
    const rect = section.getBoundingClientRect();
    const room = Math.max(1, window.innerHeight - navBottom);
    const covered = (Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, navBottom)) / room;
    // Settled = its top has reached the nav line. journey.js ends the running
    // copy's flight at exactly that line, so this must not fire before it: a
    // ±60 px window fired 56 px early and put both on screen for three frames
    // (measured at 20 px scroll steps). Past the line he simply stays. The
    // coverage test is only a fallback for short sections that never sit
    // exactly at the line.
    const arrived = rect.top <= navBottom + 6 || covered > .99;
    host.dataset.arrived = arrived ? 'true' : 'false';
  };

  const schedule = () => { if (!frame) frame = requestAnimationFrame(settle); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  settle();
}
