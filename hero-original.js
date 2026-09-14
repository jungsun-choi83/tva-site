const programs = {
  intro: { kicker: 'SOUL TRACE / 01', title: 'YOUR PET.<br>THEIR STORY.<br>KEPT CLOSE.', body: 'For the moments that deserve to last forever.', index: 'LETTER / IDENTITY / HOLOGRAM', station: 'STATION 01 / INTRO', number: '01' },
  about: { kicker: 'ARCHIVE FIRST / 02', title: 'THE STORY<br>IS ALREADY<br>INSIDE.', body: 'The archive begins before the Beam arrives. Hardware holds the letter, identity and breath.', index: 'SOUL TRACE / DEVICE / ARCHIVE', station: 'STATION 02 / WHO WE ARE', number: '02' },
  work: { kicker: 'ONE STORY / 03', title: 'ONE STORY.<br>THREE WAYS<br>TO KEEP IT.', body: 'Record. Keep. Experience — from Soul Trace to the card to the Beam.', index: 'SOUL TRACE / CARD / DEVICE', station: 'STATION 03 / JOURNEY', number: '03' },
  contact: { kicker: 'OPEN CHANNEL / 04', title: 'START A<br>NEW<br>ARCHIVE.', body: 'Write to us. When your Beam arrives, their story is already there.', index: 'SOUL TRACE / SEOUL / KOREA', station: 'STATION 04 / CONTACT', number: '04' }
};

function fillStmtLetters(el) {
  if (!el || el.dataset.beamed) return;
  const text = el.textContent;
  el.dataset.beamed = '1';
  el.replaceChildren();
  let i = 0;
  for (const ch of text) {
    if (ch === '\n') {
      el.append(document.createElement('br'));
      continue;
    }
    const span = document.createElement('span');
    span.className = 'hero-ch';
    span.style.setProperty('--i', String(i++));
    span.textContent = ch === ' ' ? '\u00a0' : ch;
    el.append(span);
  }
}

export function initHeroOriginal({ onNavigate } = {}) {
  const hero = document.querySelector('#home');
  const root = document.documentElement;
  const buttons = [...hero.querySelectorAll('[data-hero-channel]')];
  const title = hero.querySelector('[data-hero-title]');
  const kicker = hero.querySelector('[data-hero-kicker]');
  const body = hero.querySelector('[data-hero-body]');
  const index = hero.querySelector('[data-hero-program-index]');
  const station = hero.querySelector('[data-hero-station]');
  const stationIndex = hero.querySelector('[data-hero-index]');
  const replay = hero.querySelector('.hero-original__replay');
  const scrollGuide = hero.querySelector('.hero-original__scroll');
  const stage = hero.querySelector('.hero-original__stage');
  const copyPlane = hero.querySelector('.hero-vintage__copy');
  fillStmtLetters(hero.querySelector('[data-hero-stmt]'));
  const noise = hero.querySelector('.hero-original__power-noise');
  const context = noise.getContext('2d', { alpha: true });
  const timing = { off: 0, ignite: 240, tune: 620, locked: 1500 };
  let powerFrame = 0;
  let powerTimer = 0;
  let powerStartedAt = 0;
  let noiseDrawnAt = 0;
  let active = 'intro';
  let focusEntryAfterPower = false;
  let pointerFrame = 0;
  const pointerTarget = { x: 0, y: 0, tiltX: 0, tiltY: 0, chroma: 0 };
  const pointerCurrent = { ...pointerTarget };

  function writePointerState() {
    copyPlane.style.setProperty('--hero-pointer-x', `${pointerCurrent.x.toFixed(3)}px`);
    copyPlane.style.setProperty('--hero-pointer-y', `${pointerCurrent.y.toFixed(3)}px`);
    copyPlane.style.setProperty('--hero-pointer-tilt-x', `${pointerCurrent.tiltX.toFixed(3)}deg`);
    copyPlane.style.setProperty('--hero-pointer-tilt-y', `${pointerCurrent.tiltY.toFixed(3)}deg`);
    copyPlane.style.setProperty('--hero-pointer-chroma', `${pointerCurrent.chroma.toFixed(3)}px`);
  }

  function animatePointer() {
    pointerFrame = 0;
    let unsettled = false;
    for (const key of Object.keys(pointerCurrent)) {
      const delta = pointerTarget[key] - pointerCurrent[key];
      pointerCurrent[key] += delta * .16;
      if (Math.abs(delta) > .008) unsettled = true;
      else pointerCurrent[key] = pointerTarget[key];
    }
    writePointerState();
    if (unsettled && !document.hidden) pointerFrame = requestAnimationFrame(animatePointer);
  }

  function schedulePointer() {
    if (!pointerFrame) pointerFrame = requestAnimationFrame(animatePointer);
  }

  function resetPointer(immediate = false) {
    Object.keys(pointerTarget).forEach(key => { pointerTarget[key] = 0; });
    if (!immediate) return schedulePointer();
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    Object.keys(pointerCurrent).forEach(key => { pointerCurrent[key] = 0; });
    writePointerState();
  }

  function pointerEnabled() {
    return hero.dataset.powerState === 'locked'
      && hero.dataset.heroResting === 'true'
      && hero.dataset.heroInView === 'true'
      && hero.dataset.heroDocumentVisible === 'true'
      && !root.classList.contains('reduced-motion')
      && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function movePointer(event) {
    if (!pointerEnabled() || !matchMedia('(pointer:fine)').matches) return resetPointer(true);
    const bounds = stage.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height) * 2 - 1));
    pointerTarget.x = x * 5;
    pointerTarget.y = y * 3;
    pointerTarget.tiltX = y * -.32;
    pointerTarget.tiltY = x * .42;
    pointerTarget.chroma = x * .55;
    schedulePointer();
  }

  function syncDocumentVisibility() {
    hero.dataset.heroDocumentVisible = String(!document.hidden);
    if (document.hidden) resetPointer(true);
  }

  function focusHeroControl() {
    const target = hero.dataset.heroVisual === 'keyvisual-v1'
      ? scrollGuide
      : buttons.find(button => button.dataset.heroChannel === active);
    if (!target) return;
    // r59 (2026-09-10 user: "박스 안 나오게"): this focus is programmatic (after the ending returns to
    // home) — keyboard users still get the ring when they Tab, but a script-driven focus must not paint
    // the outline box around SCROLL TO ENTER. The class is dropped on blur or the next key press.
    target.classList.add('is-script-focus');
    const clear = () => { target.classList.remove('is-script-focus'); target.removeEventListener('blur', clear); window.removeEventListener('keydown', clear); };
    target.addEventListener('blur', clear);
    window.addEventListener('keydown', clear);
    target.focus({ preventScroll: true });
  }

  hero.dataset.powerTiming = 'off:0,ignite:240,tune:620,locked:1500';
  hero.dataset.powerDuration = String(timing.locked);

  function setPowerState(state) {
    hero.dataset.powerState = state;
    hero.dataset.powerReady = String(state === 'locked');
    root.dataset.powerState = state;
  }

  function sizeNoise() {
    const rect = noise.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(rect.width * scale * .5));
    const height = Math.max(1, Math.round(rect.height * scale * .5));
    if (noise.width !== width || noise.height !== height) {
      noise.width = width;
      noise.height = height;
    }
  }

  // 2026-09-12 감사: 키비주얼 화면에서는 방송(CRT) 층이 opacity:0 이라 이 잡음 캔버스가 화면에 전혀 보이지 않는다.
  // 안 보이는 캔버스에 켜짐 연출 0.9초 동안 매 프레임 난수 픽셀(약 8만 8천 바이트)을 채우는 것은 순수한 낭비다.
  // 켜짐 단계(off→ignite→tune→locked) 자체는 그대로 두고 픽셀 작업만 건너뛴다.
  let noiseShows = null;
  function noiseIsVisible() {
    if (noiseShows === null) {
      const shell = noise.closest('.hero-original__broadcast');
      const hidden = hero.dataset.heroVisual === 'keyvisual-v1'
        && shell
        && parseFloat(getComputedStyle(shell).opacity) === 0;
      noiseShows = !hidden;
    }
    return noiseShows;
  }

  function drawNoise(now) {
    if (hero.dataset.powerState !== 'tune' || document.hidden) return;
    if (!noiseIsVisible()) return;
    if (now - noiseDrawnAt > 48) {
      noiseDrawnAt = now;
      sizeNoise();
      const frame = context.createImageData(noise.width, noise.height);
      const pixels = frame.data;
      for (let i = 0; i < pixels.length; i += 4) {
        const value = 38 + Math.random() * 190;
        pixels[i] = value;
        pixels[i + 1] = value;
        pixels[i + 2] = value;
        pixels[i + 3] = 255;
      }
      context.putImageData(frame, 0, 0);
    }
    powerFrame = requestAnimationFrame(drawNoise);
  }

  function clearPowerWork() {
    clearTimeout(powerTimer);
    cancelAnimationFrame(powerFrame);
    powerTimer = 0;
    powerFrame = 0;
  }

  function settlePower(immediate = false) {
    clearPowerWork();
    unbindOpeningSkip();
    if (!immediate && hero.classList.contains('is-powering') && window.scrollY !== hero.offsetTop) {
      window.scrollTo({ top: hero.offsetTop, behavior: 'instant' });
    }
    setPowerState('locked');
    hero.dataset.powerElapsed = powerStartedAt ? String(Math.round(performance.now() - powerStartedAt)) : '0';
    context.clearRect(0, 0, noise.width, noise.height);
    if (focusEntryAfterPower) {
      focusEntryAfterPower = false;
      focusHeroControl();
    }
    if (immediate) hero.classList.remove('is-powering');
    else powerTimer = window.setTimeout(() => hero.classList.remove('is-powering'), 340);
  }

  function queueState(state, delay) {
    powerTimer = window.setTimeout(() => {
      if (state === 'locked') return settlePower();
      setPowerState(state);
      if (state === 'tune') powerFrame = requestAnimationFrame(drawNoise);
      queueState('locked', timing.locked - delay);
    }, delay);
  }

  function startPower() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('reduced-motion') || document.hidden) {
      settlePower(true);
      return;
    }
    clearPowerWork();
    bindOpeningSkip();
    context.clearRect(0, 0, noise.width, noise.height);
    powerStartedAt = performance.now();
    hero.dataset.powerStartedAt = String(Math.round(powerStartedAt));
    hero.classList.add('is-powering');
    setPowerState('off');
    powerTimer = window.setTimeout(() => {
      setPowerState('ignite');
      powerTimer = window.setTimeout(() => {
        setPowerState('tune');
        powerFrame = requestAnimationFrame(drawNoise);
        queueState('locked', timing.locked - timing.tune);
      }, timing.tune - timing.ignite);
    }, timing.ignite);
  }

  function shouldPlayOpening() {
    // 느린 회선에서 비상해제가 먼저 글자를 보여줬다면 연출을 다시 재생하지 않는다.
    // 재생하면 이미 읽고 있던 글자가 1.5초쯤 도로 사라진다(검증 2바퀴 실측).
    if (window.__tvaPowerRevealed) return false;
    return !matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden && ['', '#home'].includes(location.hash);
  }
  function render(channel) { const program = programs[channel]; if (!program) return; active = channel; buttons.forEach(button => { const selected = button.dataset.heroChannel === channel; button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected)); }); kicker.textContent = program.kicker; title.innerHTML = program.title; body.textContent = program.body; index.textContent = program.index; station.textContent = program.station; stationIndex.textContent = program.number; }
  function reset() { render('intro'); }
  function go(target) {
    if (onNavigate) { onNavigate(target); return; }
    location.hash = target;
  }
  buttons.forEach(button => button.addEventListener('click', () => { const channel = button.dataset.heroChannel; render(channel); go(button.dataset.heroTarget); }));
  replay.addEventListener('click', () => { reset(); go('home'); focusEntryAfterPower = true; startPower(); });
  const scrollKeys = new Set([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End']);
  const holdOpening = event => {
    if (event.type === 'scroll' && window.scrollY > hero.offsetTop + 1) resetPointer(true);
    if (hero.dataset.powerState === 'locked' || !hero.classList.contains('is-powering')) return;
    if (event.type === 'keydown' && !scrollKeys.has(event.key)) return;
    // User input during the power-on opening skips the opening instead of freezing the page (2026-09-09 user direction).
    settlePower(true);
  };
  let openingSkipBound = false;
  function bindOpeningSkip() {
    if (openingSkipBound) return;
    openingSkipBound = true;
    window.addEventListener('wheel', holdOpening, { passive: true });
    window.addEventListener('touchmove', holdOpening, { passive: true });
    window.addEventListener('keydown', holdOpening);
  }
  function unbindOpeningSkip() {
    if (!openingSkipBound) return;
    openingSkipBound = false;
    window.removeEventListener('wheel', holdOpening);
    window.removeEventListener('touchmove', holdOpening);
    window.removeEventListener('keydown', holdOpening);
  }
  // 2026-09-12 감사 [12]: holdOpening 은 preventDefault 를 한 번도 쓰지 않는데 passive:false 로 걸려 있어
  // 브라우저가 굴림마다 "막을지도 모른다"고 기다렸다. passive:true 로 바꿔도 하는 일은 같다.
  // 또 켜짐 연출이 끝나면 떼어 세션 내내 남지 않게 한다(다시 켜면 startPower 가 다시 붙인다).
  // scroll 은 켜짐과 무관하게 resetPointer 를 위해 계속 필요하므로 그대로 둔다.
  window.addEventListener('scroll', holdOpening, { passive: true });
  bindOpeningSkip();
  window.addEventListener('tva:navigate', () => { if (hero.classList.contains('is-powering')) settlePower(true); });
  window.addEventListener('tva:restart', () => { reset(); settlePower(true); });
  window.addEventListener('tva:motion', event => { if (event.detail.reduced) { resetPointer(true); settlePower(true); } });
  document.addEventListener('visibilitychange', () => { syncDocumentVisibility(); if (document.hidden) settlePower(true); });
  stage.addEventListener('pointermove', movePointer, { passive: true });
  stage.addEventListener('pointerleave', () => resetPointer());
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    hero.dataset.heroInView = String(entry.isIntersecting);
    if (!entry.isIntersecting) resetPointer(true);
  }, { threshold: .01 });
  visibilityObserver.observe(stage);
  hero.dataset.heroInView = String(stage.getBoundingClientRect().bottom > 0 && stage.getBoundingClientRect().top < innerHeight);
  writePointerState();
  syncDocumentVisibility();
  if (shouldPlayOpening()) startPower();
  else settlePower(true);
  clearTimeout(window.__tvaPowerFailOpen);
  delete window.__tvaPowerFailOpen;
  return { reset, startPower, settlePower, focus: focusHeroControl };
}
