const originalGalleryPath = './gallery-original/galleries/02-concave-wheel.html?v=eternal-beam-r51';
const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';

export function initPortfolio(root, { onStoryWheel } = {}) {
  if (!root) throw new Error('initPortfolio requires a mount root.');

  root.innerHTML = `<iframe class="portfolio-original-frame" loading="lazy" src="${originalGalleryPath}" title="Records with us" scrolling="no" tabindex="0"></iframe>`;

  const frame = root.querySelector('.portfolio-original-frame');
  let reduced = root.classList.contains('reduced-motion');
  const galleryInputSelector = '.g02-card';
  let incomingCharacterHandoff = { active: false, progress: 0, direction: 1 };
  let cleanupBridge = () => {};
  const portfolioSection = root.closest('section') || root;
  const navHeight = () => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 0;

  const portfolioRoute = () => {
    if (location.hash === '#portfolio') return { id: null, invalid: false };
    if (!location.hash.startsWith('#portfolio/')) return null;
    const id = location.hash.slice('#portfolio/'.length);
    return { id: /^[a-z0-9-]+$/i.test(id) ? id : null, invalid: !/^[a-z0-9-]+$/i.test(id) };
  };

  const syncMotion = () => {
    const document = frame.contentDocument;
    if (!document) return;
    document.documentElement.classList.toggle('reduced-motion', reduced);
    frame.contentWindow?.dispatchEvent(new CustomEvent('tva:motion', { detail: { reduced } }));
  };

  const syncIncomingCharacterHandoff = () => {
    frame.contentWindow?.dispatchEvent(new CustomEvent('tva:portfolio-character-handoff', {
      detail: { ...incomingCharacterHandoff },
    }));
  };

  const moveFocusOutsideFrame = (direction) => {
    const candidates = [...document.querySelectorAll(focusableSelector)].filter((element) => (
      !element.closest('[inert]') && element.getClientRects().length
    ));
    const currentIndex = candidates.indexOf(frame);
    candidates[currentIndex + direction]?.focus();
  };

  // ── 키보드로 갤러리 안에 들어가는 길 ────────────────────────────────────────
  // (2026-09-12) [4] Tab 만으로 내려오면 PORTFOLIO 갤러리가 통째로 건너뛰어졌다.
  // iframe 은 loading=lazy 라 화면 밖에서는 아직 문서가 비어 있고, tabindex=0 인 껍데기만
  // 포커스를 한 칸 먹었다(실측: Tab 4회째, 화면 아래로 9087px 밖, 포커스 표시 없음).
  // 들어갈 내용이 없으니 다음 Tab 은 ORIGINAL 로 건너뛰어, 갤러리 조작요소 9개
  // (무대·분류 4개·현재 작품·이전/다음·손잡이)에 한 번도 닿지 못했다.
  // 나가는 길(아래 keydown)은 이미 있었고, 들어오는 길만 없었다.
  // → Tab 으로 iframe 에 닿으면 (1) 갤러리 구역을 화면 자리에 맞추고 (2) lazy 를 풀어
  //   지금 불러온 뒤 (3) 문서 안 첫(Shift+Tab 이면 마지막) 조작요소로 포커스를 들여보낸다.
  const galleryFocusables = () => {
    const galleryDocument = frame.contentDocument;
    if (!galleryDocument) return [];
    return [...galleryDocument.querySelectorAll(focusableSelector)]
      .filter((element) => element.tabIndex >= 0 && element.getClientRects().length);
  };

  // 사이트가 스스로 착지하는 자리와 같은 계산(구역 위끝을 머리띠 아래에 맞춘다)
  const alignGalleryToViewport = () => {
    const bounds = portfolioSection.getBoundingClientRect();
    const target = Math.max(0, Math.round(scrollY + bounds.top - navHeight()));
    if (Math.abs(target - scrollY) > 2) window.scrollTo({ top: target, behavior: 'instant' });
  };

  let tabPressedAt = 0;
  let tabPressedBackwards = false;
  let frameEntryTimer = 0;
  const rememberTabPress = (event) => {
    if (event.key !== 'Tab') return;
    tabPressedAt = performance.now();
    tabPressedBackwards = event.shiftKey;
  };

  const focusIntoGallery = (backwards, attempt = 0) => {
    frameEntryTimer = 0;
    if (document.activeElement !== frame) return; // 그 사이 사용자가 다른 곳으로 갔으면 그만둔다
    const focusables = galleryFocusables();
    if (focusables.length) {
      alignGalleryToViewport();
      // 앞으로 들어오면 첫 칸, 뒤로(Shift+Tab) 들어오면 마지막 칸 — 방향대로 늘 같은 자리
      (backwards ? focusables.at(-1) : focusables[0])?.focus({ preventScroll: true });
      return;
    }
    if (attempt >= 20) return; // 3초를 기다려도 갤러리가 안 오면 껍데기에 둔 채 그만둔다
    frameEntryTimer = window.setTimeout(() => focusIntoGallery(backwards, attempt + 1), 150);
  };

  // iframe 은 포커스를 받아도 자기 자신에게 focus 이벤트를 내지 않는다(실측). 포커스가
  // 안쪽 창으로 들어가므로, 껍데기가 아니라 '안쪽 창'의 focus 를 듣는다.
  const enterFrameFromTab = () => {
    // 갤러리 안을 마우스로 눌러도 안쪽 창이 포커스를 받는다. Tab 직후에만 들여보낸다.
    if (performance.now() - tabPressedAt > 500) return;
    alignGalleryToViewport();
    // 화면 밖이라 아직 안 불러왔으면 지금 불러온다 (첫 로드 무게는 그대로 두고, 키보드로 닿았을 때만 푼다)
    if (frame.getAttribute('loading') === 'lazy') frame.setAttribute('loading', 'eager');
    clearTimeout(frameEntryTimer);
    focusIntoGallery(tabPressedBackwards);
  };
  document.addEventListener('keydown', rememberTabPress, true);
  // 아직 안 불러온 iframe 의 빈 창에 먼저 붙인다. 갤러리가 실제로 들어오면 창이 새로
  // 만들어지므로 installBridge 에서 한 번 더 붙인다.
  frame.contentWindow?.addEventListener('focus', enterFrameFromTab);

  const installBridge = () => {
    cleanupBridge();
    const galleryDocument = frame.contentDocument;
    const galleryWindow = frame.contentWindow;
    if (!galleryDocument || !galleryWindow) return;

    const nativeMatchMedia = galleryWindow.matchMedia.bind(galleryWindow);
    galleryWindow.matchMedia = (query) => {
      const media = nativeMatchMedia(query);
      if (query !== '(prefers-reduced-motion: reduce)') return media;
      return new Proxy(media, {
        get(target, property) {
          if (property === 'matches') return reduced;
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    };

    // (2026-09-12) 프로젝트 상세창 'CASE SUMMARY' 자리에 개발용 템플릿 안내문
    // ("Project detail template. This surface is ready for the final overview…")
    // 이 방문자에게 그대로 보였다. 원고가 준비되기 전에는 빈 자리가 거짓 문구보다 낫다.
    // 문구는 gallery-original/shared/galleries.mjs 90행에 있어 이 방에서 고칠 수 없으므로,
    // '아직 템플릿 문장 그대로일 때만' 그 블록을 감춘다 — 실제 원고가 들어오면 문장이
    // 달라지므로 이 숨김은 저절로 풀린다(감춘 것을 남겨 두는 사고 방지).
    const PLACEHOLDER_SUMMARY = /^project detail template\b/i;
    const hidePlaceholderSummary = () => {
      galleryDocument.querySelectorAll('.project-sheet__summary').forEach((block) => {
        const copy = block.querySelector('p');
        const isPlaceholder = PLACEHOLDER_SUMMARY.test((copy?.textContent || '').trim());
        if (isPlaceholder) block.hidden = true;
        else if (block.hidden) block.hidden = false;
      });
    };

    const motionStyle = galleryDocument.createElement('style');
    motionStyle.textContent = `html.reduced-motion *,html.reduced-motion *::before,html.reduced-motion *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
      @media(max-width:600px){.g02-stage{--g02-puller-drive-velocity-max:1.4}}`;
    galleryDocument.head.append(motionStyle);

    const gestures = new Map();
    const stageFor = (event) => event.target.closest?.('.g02-stage');
    const galleryInputFor = (event) => event.target.closest?.(galleryInputSelector);
    const isModalInput = (event) => Boolean(event.target.closest?.('dialog[open]'));
    const galleryIsAligned = () => {
      const bounds = portfolioSection.getBoundingClientRect();
      return Math.abs(bounds.top - navHeight()) <= 8 && bounds.bottom >= innerHeight - 8;
    };
    const wheelPixels = (event) => {
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * innerHeight;
      return event.deltaY;
    };
    let wheelOwner = null;
    let wheelOwnerTimer = 0;
    // 작품 위에 커서를 둔 채 굴리면 수레바퀴가 돈다. 그런데 작품이 고리처럼 이어져 있어
    // 그대로 두면 아무리 굴려도 다음 화면으로 못 간다(실측: 16번 굴려도 제자리).
    // 작품을 한 바퀴 다 본 뒤에는 굴림을 페이지에 넘겨, 갇히지 않게 한다.
    let spinCount = 0;
    let spinDirection = 0;
    const spinLimit = () => Math.max(3, galleryDocument.querySelectorAll(galleryInputSelector).length);
    const resetSpin = () => { spinCount = 0; spinDirection = 0; };
    const resetWheelOwner = () => {
      clearTimeout(wheelOwnerTimer);
      wheelOwnerTimer = 0;
      wheelOwner = null;
    };
    const cancelOriginalDrag = (stage, event) => {
      stage.dispatchEvent(new galleryWindow.PointerEvent('pointercancel', {
        bubbles: true,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        clientX: event.clientX,
        clientY: event.clientY,
      }));
    };

    galleryDocument.addEventListener('pointerdown', (event) => {
      const stage = stageFor(event);
      if (!stage || isModalInput(event) || event.target.closest?.('.g02-category,.g02-puller,.g02-nav')) return;
      const galleryInput = Boolean(galleryInputFor(event));
      gestures.set(event.pointerId, {
        stage,
        galleryInput,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        lastY: event.clientY,
        mode: galleryInput ? null : 'story',
        cancelledOriginal: false,
      });
      if (!galleryInput) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, { capture: true });

    galleryDocument.addEventListener('pointermove', (event) => {
      const gesture = gestures.get(event.pointerId);
      if (!gesture) return;
      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;
      if (!gesture.mode && Math.hypot(deltaX, deltaY) >= 8) {
        if (gesture.pointerType === 'touch' && Math.abs(deltaY) > Math.abs(deltaX)) gesture.mode = 'story';
        else gesture.mode = 'gallery';
      }
      if (gesture.mode === 'story') {
        if (!gesture.cancelledOriginal) {
          gesture.cancelledOriginal = true;
          cancelOriginalDrag(gesture.stage, event);
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        window.scrollBy({ top: gesture.lastY - event.clientY, behavior: 'auto' });
        gesture.lastY = event.clientY;
      }
    }, { capture: true, passive: false });

    // 손을 뗐을 때 옆 구역으로 붙여 준다. 다른 구역은 app.js 가 해 주지만, 갤러리는 iframe 안에서
    // 직접 굴리기 때문에 그 길을 타지 않아 구역 중간에 멈춰 버렸다(실측: 첫 쓸기 190px 뒤로는 안 움직임).
    const sectionTop = (section) => {
      const nav = ['home', 'drop', 'about', 'ending'].includes(section.id)
        ? 0 : (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 0);
      return Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, section.offsetTop - nav));
    };
    const settleAfterSwipe = (direction) => {
      const here = document.getElementById('portfolio');
      const next = document.getElementById(direction > 0 ? 'original' : 'about');
      if (!here) return;
      const hereTop = sectionTop(here);
      const moved = scrollY - hereTop;
      // 화면 높이의 12% 넘게 밀었으면 넘어가고, 아니면 제자리로 되돌린다
      const enough = Math.abs(moved) > innerHeight * .12 && Math.sign(moved) === direction;
      const target = enough && next ? sectionTop(next) : hereTop;
      if (Math.abs(target - scrollY) < 2) return;
      window.scrollTo({ top: target, behavior: reduced ? 'instant' : 'smooth' });
    };

    const finishGesture = (event) => {
      const gesture = gestures.get(event.pointerId);
      gestures.delete(event.pointerId);
      if (!gesture || gesture.mode !== 'story') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!gesture.cancelledOriginal) cancelOriginalDrag(gesture.stage, event);
      if (gesture.pointerType === 'touch') {
        const direction = Math.sign(gesture.startY - gesture.lastY) || 1;
        settleAfterSwipe(direction);
      }
    };
    galleryDocument.addEventListener('pointerup', finishGesture, { capture: true, passive: false });
    galleryDocument.addEventListener('pointercancel', (event) => {
      // 갤러리 드래그를 멈추려고 우리가 직접 쏜 가짜 pointercancel(isTrusted=false) 은
      // 지금 손가락으로 하고 있는 제스처까지 지워 버린다. 휴대폰에서 506px 을 쓸어도 19px 만
      // 움직이던 원인이 이것이었다(검증 2바퀴 실측: 가짜만 막으면 19px → 249px).
      if (!event.isTrusted) return;
      gestures.delete(event.pointerId);
    }, { capture: true });

    galleryDocument.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab' || galleryDocument.querySelector('dialog[open]')) return;
      const focusables = [...galleryDocument.querySelectorAll(focusableSelector)].filter((element) => element.tabIndex >= 0 && element.getClientRects().length);
      const first = focusables[0];
      const last = focusables.at(-1);
      if ((!event.shiftKey && event.target === last) || (event.shiftKey && event.target === first)) {
        event.preventDefault();
        moveFocusOutsideFrame(event.shiftKey ? -1 : 1);
      }
    }, { capture: true });

    syncMotion();
    syncIncomingCharacterHandoff();
    galleryDocument.addEventListener('wheel', (event) => {
      if (event.defaultPrevented || event.ctrlKey || (!event.deltaX && !event.deltaY) || isModalInput(event)) return;
      // 위로 올라갈 때는 작품을 돌리지 않고 바로 앞 구역으로 보낸다.
      // 되돌아가는 사람은 작품을 다시 보려는 게 아니라 나가려는 것이고,
      // 여기서 수레바퀴를 돌리면 '휠이 안 먹는다'로 느껴진다(사장님 지적).
      const overWork = galleryIsAligned() && galleryInputFor(event) && Math.sign(event.deltaY) > 0;
      const direction = Math.sign(event.deltaY);
      if (!overWork || direction !== spinDirection) resetSpin();
      // 한 바퀴를 다 돌았으면 이 굴림부터는 페이지 몫이다
      const spun = overWork && spinCount >= spinLimit();
      const nextOwner = overWork && !spun ? 'gallery' : 'story';
      if (wheelOwner && wheelOwner !== nextOwner) resetWheelOwner();
      if (!wheelOwner) wheelOwner = nextOwner;
      clearTimeout(wheelOwnerTimer);
      wheelOwnerTimer = setTimeout(resetWheelOwner, 180);
      if (wheelOwner === 'gallery') {
        if (direction !== spinDirection) { spinDirection = direction; spinCount = 0; }
        spinCount += 1;
        Object.defineProperty(event, '__tvaGalleryInput', { value: true });
        return;
      }
      if (spun) resetSpin();   // 넘겨 준 뒤에는 다시 처음부터 셀 수 있게
      if (!event.deltaY) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (onStoryWheel?.(event)) return;
      window.scrollBy({ top: wheelPixels(event), behavior: 'instant' });
    }, { capture: true, passive: false });
    galleryWindow.addEventListener('tva:gallery-input-reset', resetWheelOwner);
    // 갤러리가 들어오면 창이 새로 만들어져 앞서 붙인 것이 사라진다. 다시 붙인다.
    galleryWindow.addEventListener('focus', enterFrameFromTab);

    let desiredProjectRoute = null;
    let appliedProjectRoute = 0;
    let nextProjectRoute = 0;
    let drainingProjectRoute = false;
    let applyingProjectRoute = false;
    const requestProjectRoute = (id) => {
      const detail = { id, handled: false, completion: Promise.resolve() };
      galleryDocument.dispatchEvent(new galleryWindow.CustomEvent('tva:portfolio-route', { detail }));
      return detail;
    };
    const drainProjectRoute = async () => {
      if (drainingProjectRoute) return;
      drainingProjectRoute = true;
      try {
        while (desiredProjectRoute && desiredProjectRoute.version !== appliedProjectRoute) {
          const request = desiredProjectRoute;
          applyingProjectRoute = true;
          let response = requestProjectRoute(request.id);
          if (request.route?.invalid || (request.id && !response.handled)) {
            response = requestProjectRoute(null);
            if (desiredProjectRoute.version === request.version) history.replaceState(null, '', '#portfolio');
          }
          await response.completion;
          applyingProjectRoute = false;
          appliedProjectRoute = request.version;
        }
      } finally {
        applyingProjectRoute = false;
        drainingProjectRoute = false;
      }
    };
    const syncProjectRoute = () => {
      const route = portfolioRoute();
      desiredProjectRoute = { route, id: route?.id ?? null, version: ++nextProjectRoute };
      void drainProjectRoute();
    };

    const onProjectRouteChange = (event) => {
      const id = typeof event.detail?.id === 'string' ? event.detail.id : null;
      if (applyingProjectRoute || (desiredProjectRoute && desiredProjectRoute.version > appliedProjectRoute)) return;
      if (id === null && !portfolioRoute()) return;
      const nextHash = id ? `#portfolio/${encodeURIComponent(id)}` : '#portfolio';
      if (location.hash !== nextHash) history.pushState(null, '', nextHash);
    };
    galleryWindow.addEventListener('tva:portfolio-routechange', onProjectRouteChange);
    // 상세창은 갤러리가 처음 켜질 때 한 번 만들어지지만, 만들어지는 시점이 iframe load
    // 보다 늦을 수 있어 프로젝트가 열릴 때마다 한 번 더 확인한다.
    galleryWindow.addEventListener('tva:portfolio-routechange', hidePlaceholderSummary);
    window.addEventListener('hashchange', syncProjectRoute);
    window.addEventListener('popstate', syncProjectRoute);
    window.addEventListener('tva:navigate', syncProjectRoute);
    cleanupBridge = () => {
      clearTimeout(wheelOwnerTimer);
      galleryWindow.removeEventListener('tva:gallery-input-reset', resetWheelOwner);
      galleryWindow.removeEventListener('focus', enterFrameFromTab);
      galleryWindow.removeEventListener('tva:portfolio-routechange', onProjectRouteChange);
      galleryWindow.removeEventListener('tva:portfolio-routechange', hidePlaceholderSummary);
      window.removeEventListener('hashchange', syncProjectRoute);
      window.removeEventListener('popstate', syncProjectRoute);
      window.removeEventListener('tva:navigate', syncProjectRoute);
    };
    syncProjectRoute();
    hidePlaceholderSummary();
  };

  frame.addEventListener('load', installBridge);

  return {
    setReducedMotion(value) {
      reduced = Boolean(value);
      syncMotion();
    },
    setIncomingCharacterHandoff({ active = false, progress = 0, direction = 1 } = {}) {
      incomingCharacterHandoff = {
        active: Boolean(active),
        progress: Math.max(0, Math.min(1, Number.isFinite(Number(progress)) ? Number(progress) : 0)),
        direction: Math.sign(Number(direction)) || 1,
      };
      syncIncomingCharacterHandoff();
    },
    getCharacterRect() {
      const character = frame.contentDocument?.querySelector('.g02-puller');
      if (!character) return null;
      const characterRect = character.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      return {
        left: frameRect.left + characterRect.left,
        top: frameRect.top + characterRect.top,
        right: frameRect.left + characterRect.right,
        bottom: frameRect.top + characterRect.bottom,
        width: characterRect.width,
        height: characterRect.height,
      };
    },
  };
}
