import { initSignalPassage } from './signal-passage.js?v=eb-20260914bp';
import { createCharacterRig } from './character-rig.js?v=eb-20260913';
import { ACTOR_ASSET_KIND, getActorPose } from './fall-welcome/actor.js?v=eb-20260913';
import { measureAperture } from './fall-welcome/home-bridge.mjs';
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (start, end, value) => {
  const progress = clamp((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
};
const lerp = (from, to, value) => from + (to - from) * value;
// 캐릭터 그림(assets/goya/*)의 공통 판 번호. nav-shelf.js·about-walk.js·character-rig.js·
// ending-scene-r15.js·index.html 이 모두 이 값을 써야 같은 그림을 한 번만 내려받는다.
const GOYA_V = 'eb-20260914as';
const GOYA_POSES = {
  'tva-mascot-idle': `assets/goya/goya-photo-idle.png?v=${GOYA_V}`,
  'tva-mascot-sit': `assets/goya/goya-photo-idle.png?v=${GOYA_V}`,
  'character-run': `assets/goya/goya-photo-walk-a.png?v=${GOYA_V}`,
  'character-inspect': `assets/goya/goya-photo-idle.png?v=${GOYA_V}`,
};
const goyaFile = name => GOYA_POSES[name] || `assets/goya/goya-photo-idle.png?v=${GOYA_V}`;
const GOYA_WALK = `assets/goya/goya-photo-walk-a.png?v=${GOYA_V}`;
const GOYA_FOOT = .963;

const noopDropWorld = {
  draw() {},
  drawArrival() {},
  resize() {},
  setPortalActive() {},
  getCharacterRect() { return null; },
  setCharacterHidden() {},
  setHandoffProgress() {},
};

export function initJourney(onScene, portfolio) {
  const hero = document.querySelector('#home');
  const heroStage = hero.querySelector('.hero-original__stage');
  const dropEl = document.querySelector('#drop');
  const skipPassage = !dropEl;
  let drop = dropEl;
  let dropStage;
  let dropActor;
  let dropImage;
  let dropWorld;
  if (skipPassage) {
    dropStage = { style: { setProperty() {}, classList: { toggle() {} } }, classList: { toggle() {} }, addEventListener() {} };
    dropActor = { dataset: {}, style: { setProperty() {}, removeProperty() {} }, offsetWidth: 1 };
    dropImage = { src: '', includes: () => true };
    drop = {
      offsetTop: 0,
      offsetHeight: 0,
      dataset: { stage: '' },
      getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }),
      classList: { toggle() {}, add() {}, remove() {} },
    };
    dropWorld = noopDropWorld;
  } else {
    dropStage = drop.querySelector('.drop-stage');
    dropActor = drop.querySelector('.drop-actor');
    dropImage = dropActor.querySelector('img');
  }
  const heroGuide = hero.querySelector('.hero-original__mascot');
  const heroGuideImage = heroGuide?.querySelector('img');
  const heroScreen = hero.querySelector('.hero-original__broadcast');
  const heroTelevision = hero.querySelector('.hero-original__tv');
  const heroScrollLink = hero.querySelector('.hero-original__scroll');
  const imageHero = hero.dataset.heroVisual === 'keyvisual-v1';
  // Glass corners in the unchanged 1920×1080 photograph: (1226,234),
  // (1598,240), (1574,554), (1200,523). Keep aligned with hero.css.
  const imageApertureShape = [[26 / 398, 0], [1, 6 / 320], [374 / 398, 1], [0, 289 / 320]];
  const portalUnderlay = document.createElement('span');
  portalUnderlay.className = 'hero-original__portal-underlay';
  portalUnderlay.setAttribute('aria-hidden', 'true');
  heroTelevision.insertBefore(portalUnderlay, heroScreen);
  const about = document.querySelector('#about');
  const camera = about.querySelector('.about-camera');
  const track = about.querySelector('.studio-track');
  const ledge = about.querySelector('.studio-ledge');
  const stations = [...track.children];
  const host = about.querySelector('.studio-host');
  const hostImage = host.querySelector('img');
  const stopLabel = about.querySelector('.studio-stop-label');
  const stepButtons = [...about.querySelectorAll('[data-station-step]')];
  const later = ['portfolio', 'original', 'contact'].map(id => document.getElementById(id));
  let reduced = false;
  let frame = 0;
  let travel = 0;
  let current = 0, reportedStation = 0;
  let previousScroll = window.scrollY;
  let lastScrollDirection = 1;
  let restingTimer = 0;
  let lastPose = '';
  let activeUntil = 0;
  let departureAnchor = null;
  let portfolioHandoffActive = false;
  let studioDrag = null;
  const studioDragThreshold = 48;
  let resizeRestoreFrame = 0;
  let resizeRestoreToken = 0;
  let resizeRestoreOverflowAnchor = null;
  let railAboutDistance = 0;
  const railMode = () => document.documentElement.dataset.layout === 'beam-rail';
  const pointer = { x: 0, y: 0, held: false };
  if (!skipPassage) dropWorld = initSignalPassage(dropStage, camera);
  else if (!dropWorld) dropWorld = noopDropWorld;
  const heroRig = { setCategory() {}, setPose() {} };
  if (heroGuide) {
    heroGuide.dataset.characterRole = 'programme-host';
  }
  if (!skipPassage) {
    dropActor.dataset.characterRole = 'signal-traveller';
    dropActor.dataset.guideRig = 'true';
  }
  heroRig.setCategory(0);
  // about-walk(손그림 정거장)이 켜져 있으면 3D 소품 세계는 만들지 않는다. 화면에도 안 나오는데 gltf 파싱이 0.4초씩 메인 스레드를 잡아 캐릭터 걷기가 끊겼다.
  const aboutWalk = Boolean(document.querySelector('script[src^="about-walk.js"]'));
  // 3D 소품 세계는 about-walk 이 꺼져 있을 때만 쓴다. 정적 import 로 두면 안 쓰는데도 three.js 1.2MB 를 첫 화면에서 받는다.
  let studioWorld = { draw() {}, resize() {}, interact() {}, layout() {} };
  if (!aboutWalk) {
    import('./world-scene.js?v=integrated-20260907-r2.h2037775e')
      .then(m => { studioWorld = m.initWorldScene(camera, 'about', schedule); schedule(); })
      .catch(error => console.warn('Eternal Beam: 3D 소품 세계를 불러오지 못했습니다', error));
  }
  const bridge = document.createElement('div');
  bridge.className = 'journey-bridge';
  bridge.dataset.characterRole = 'transition-bridge';
  bridge.setAttribute('aria-hidden', 'true');
  bridge.innerHTML = `<img src="${goyaFile('tva-mascot-idle')}" alt=""><img class="journey-bridge__land" alt="" aria-hidden="true">`;
  document.body.append(bridge);
  const bridgeImage = bridge.querySelector('img');
  const bridgeLand = bridge.querySelector('.journey-bridge__land');
  const bridgeSections = skipPassage ? [hero, about, ...later] : [hero, drop, about, ...later];
  const nativeCharacters = skipPassage
    ? [heroGuide, host, null, document.querySelector('.original-host'), document.querySelector('#ctl-s1char')]
    : [heroGuide, dropActor, host, null, document.querySelector('.original-host'), document.querySelector('#ctl-s1char')];
  const CONTACT_LANDING = { left: .08, top: .04, right: .92, bottom: .96 };
  function contactLanding() {
    const wall = document.querySelector('#ctl-s1char') || document.querySelector('#ctl-s1 img');
    if (!wall) return null;
    const r = wall.getBoundingClientRect();
    if (!r.width) return null;
    const left = r.left + r.width * CONTACT_LANDING.left, top = r.top + r.height * CONTACT_LANDING.top;
    const right = r.left + r.width * CONTACT_LANDING.right, bottom = r.top + r.height * CONTACT_LANDING.bottom;
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }
  function nativeAt(slot) {
    if (slot === 5) return document.querySelector('#ctl-s1char') || nativeCharacters[slot];
    return nativeCharacters[slot];
  }

  function bridgeBounds(element) {
    const poseId = element.dataset.characterArtPose;
    const pose = poseId ? getActorPose(poseId) : null;
    const artImage = pose ? element.querySelector(`.studio-host__art--${pose.group} .art-actor__pose`) : null;
    if (!pose || !artImage || element.dataset.characterArtActive !== 'true') return element.getBoundingClientRect();
    const imageBounds = artImage.getBoundingClientRect();
    const left = imageBounds.left + pose.bounds.left * imageBounds.width;
    const top = imageBounds.top + pose.bounds.top * imageBounds.height;
    const right = imageBounds.left + pose.bounds.right * imageBounds.width;
    const bottom = imageBounds.top + pose.bounds.bottom * imageBounds.height;
    return {
      left, top, right, bottom,
      width: right - left,
      height: bottom - top,
      footY: imageBounds.top + pose.footAnchor.y * imageBounds.height,
      footAnchor: pose.footAnchor,
      bounds: pose.bounds,
      intrinsicSize: { width: pose.width, height: pose.height },
      poseId,
      representation: ACTOR_ASSET_KIND,
    };
  }

  function ledgeTopAt(x) {
    const rect = ledge.getBoundingClientRect();
    const styles = getComputedStyle(ledge);
    const slope = styles.transform === 'none' ? 0 : new DOMMatrix(styles.transform).b;
    const originX = Number.parseFloat(styles.transformOrigin) || 0;
    const leftShift = slope * -originX;
    const rightShift = slope * (ledge.offsetWidth - originX);
    const untransformedTop = rect.top - Math.min(leftShift, rightShift);
    const localX = clamp(x - rect.left, 0, ledge.offsetWidth);
    return untransformedTop + slope * (localX - originX);
  }

  function canonicalDepartureAnchor() {
    const stageTop = heroStage.getBoundingClientRect().top;
    const screenRect = heroScreen.getBoundingClientRect();
    const scaleX = screenRect.width / Math.max(1, heroScreen.offsetWidth);
    const scaleY = screenRect.height / Math.max(1, heroScreen.offsetHeight);
    const size = heroGuide.offsetWidth * scaleX;
    return {
      x: screenRect.left + (heroGuide.offsetLeft + heroGuide.offsetWidth * .5) * scaleX - innerWidth * .5,
      footY: screenRect.top - stageTop + (heroGuide.offsetTop + heroGuide.offsetWidth) * scaleY,
      screenBottom: screenRect.bottom - stageTop,
      size,
      scale: size / Math.max(1, dropActor.offsetWidth),
      turn: 0
    };
  }

  function resetBridge() {
    dropWorld.setCharacterHidden(false);
    nativeCharacters.forEach(element => { if (element) element.style.visibility = ''; });
    document.querySelectorAll('#ctl-s1char').forEach(img => { img.style.visibility = ''; });
    bridge.style.removeProperty('opacity');
    const galleryCharacter = document.querySelector('.portfolio-original-frame')?.contentDocument?.querySelector('.g02-puller');
    if (galleryCharacter) galleryCharacter.style.visibility = '';
    bridge.style.visibility = 'hidden';
    bridge.classList.remove('is-fall-bridge');
    bridge.style.removeProperty('--bridge-rig-opacity');
    bridge.style.removeProperty('--bridge-image-opacity');
    bridgeImage.style.visibility = '';
    return galleryCharacter;
  }

  function connectCharacters(y, viewport, scrollDelta = 0) {
    if (scrollDelta) lastScrollDirection = scrollDelta < 0 ? -1 : 1;
    const galleryCharacter = resetBridge();
    let portfolioHandoff = null;
    if (reduced || document.querySelector('dialog[open]')) {
      if (portfolioHandoffActive) portfolio?.setIncomingCharacterHandoff?.({ active: false, progress: 0, direction: 1 });
      portfolioHandoffActive = false;
      return;
    }
    // 구역이 멈춰 서는 자리는 '구역 시작점에서 상단 바 높이만큼 내려온 곳'이다.
    // 건너오기가 그보다 아래에서 끝나면, 다 도착했는데도 계속 '건너는 중'으로 계산돼
    // 넘어오던 캐릭터가 98% 자세로 화면에 멈춰 선 채 남는다.
    const barHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 64;
    const bridgeStart = skipPassage ? 1 : 2;
    for (let index = bridgeStart; index < bridgeSections.length; index++) {
      const boundary = bridgeSections[index].offsetTop;
      const targetId = bridgeSections[index].id;
      const prevId = bridgeSections[index - 1]?.id;
      const dropHandoff = !skipPassage && targetId === 'about';
      const portfolioDrop = targetId === 'portfolio' && lastScrollDirection > 0;
      if (dropHandoff && host.dataset.characterJourney === 'running') continue;
      const handoffViewport = targetId === 'original' ? viewport * .4 : viewport;
      const handoffStart = boundary - handoffViewport;
      const handoffEnd = boundary + (dropHandoff ? viewport * .2 : -(barHeight + 8));
      const progress = (y - handoffStart) / (handoffEnd - handoffStart);
      if (progress <= 0 || progress >= 1) continue;
      if (targetId === 'portfolio') portfolioHandoff = { active: true, progress: clamp(progress), direction: lastScrollDirection };
      if (dropHandoff) {
        pose('tva-mascot-idle');
        host.style.transform = 'none';
        bridge.classList.add('is-fall-bridge');
      }
      const fromCharacter = prevId === 'portfolio' ? null : nativeAt(index - 1);
      const toCharacter = targetId === 'portfolio' ? null : nativeAt(index);
      let from = dropHandoff ? dropWorld.getCharacterRect() : prevId === 'portfolio' ? portfolio?.getCharacterRect() : prevId === 'contact' ? contactLanding() : fromCharacter && bridgeBounds(fromCharacter);
      // ORIGINAL의 캐릭터는 구역이 멈춘 뒤 위에서 내려앉으므로, 건너오는 비행은 그 '떨어지기 전 자리'(-52%)에서 끝나야 한다.
      // 그러지 않으면 달려와서 사라지고 다른 자세가 위에서 떨어지는 '두 번 도착'이 된다. (3개 페이지 방 작업, 2026-09-10 합침)
      const landOn = targetId === 'original' && toCharacter ? (toCharacter.querySelector(':scope > img') || toCharacter) : toCharacter;
      const to = targetId === 'portfolio' ? portfolio?.getCharacterRect() : targetId === 'contact' ? contactLanding() : landOn && bridgeBounds(landOn);
      if (!from || !to || !from.width || !to.width) continue;
      if (dropHandoff && from.poseId) host.dataset.incomingPoseId = from.poseId;
      const dropTurn = 0;
      if (!bridgeImage.src.includes('goya-photo-walk-a.png')) bridgeImage.src = GOYA_WALK;
      const ease = progress * progress * (3 - 2 * progress);
      const contactAt = .84;
      const landing = dropHandoff ? smoothstep(.68, contactAt, progress) : 0;
      const recovery = dropHandoff ? smoothstep(contactAt, .995, progress) : 0;
      const sizeRecovery = dropHandoff ? smoothstep(.46, contactAt, progress) : 0;
      const approachGrowth = dropHandoff ? 1 + smoothstep(0, .68, progress) * .035 : 1;
      const targetUniformScale = Math.min(to.width / Math.max(1, from.width), to.height / Math.max(1, from.height));
      const handoffUniformScale = approachGrowth + (targetUniformScale - approachGrowth) * sizeRecovery;
      const width = dropHandoff || portfolioDrop ? from.width * (dropHandoff ? handoffUniformScale : 1 + (targetUniformScale - 1) * ease) : from.width + (to.width - from.width) * ease;
      const height = dropHandoff || portfolioDrop ? from.height * (dropHandoff ? handoffUniformScale : 1 + (targetUniformScale - 1) * ease) : from.height + (to.height - from.height) * ease;
      const fromCenter = from.left + from.width * .5;
      const toCenter = to.left + to.width * .5;
      const x = fromCenter + (toCenter - fromCenter) * (dropHandoff ? landing : ease) - width * .5;
      const baseTop = from.top + (to.top - from.top) * ease;
      const compression = dropHandoff ? 1 - Math.sin(recovery * Math.PI) * .16 : 1;
      const landingFloor = dropHandoff ? ledgeTopAt(x + width * .5) : to.bottom;
      const sourceFoot = Number.isFinite(from.footY) ? from.footY : from.bottom;
      const floor = sourceFoot + (landingFloor - sourceFoot) * landing;
      const visibleFootAnchor = GOYA_FOOT;
      const portfolioLiftMax = portfolioDrop ? height * .1 : 0;
      const portfolioAnticipation = portfolioDrop ? clamp(progress / .18) : 0;
      const portfolioLift = portfolioLiftMax * (1 - (1 - portfolioAnticipation) ** 2);
      const portfolioDescent = portfolioDrop ? clamp((progress - .18) / .72) : 0;
      const portfolioGravity = portfolioDescent * portfolioDescent;
      const portfolioSettle = portfolioDrop ? smoothstep(.84, 1, progress) : 0;
      const portfolioRecovery = portfolioDrop ? Math.sin(Math.PI * portfolioSettle) * height * .025 : 0;
      const portfolioTargetOffset = to.bottom - height * GOYA_FOOT - from.top;
      const portfolioTop = from.top + portfolioGravity * (portfolioTargetOffset + portfolioLiftMax) - portfolioLift - portfolioRecovery;
      const top = dropHandoff ? floor - height * visibleFootAnchor : portfolioDrop ? portfolioTop : baseTop - Math.sin(progress * Math.PI) * viewport * .12;
      const rotation = dropHandoff ? dropTurn * (1 - landing) : portfolioDrop ? -8 * (1 - portfolioSettle) : Math.sin(progress * Math.PI) * -10;
      bridgeImage.style.visibility = '';
      // ORIGINAL(4번): 달려와서 서는 그림으로 '뚝' 바뀌지 않도록 마지막 28% 에서 달리는 그림이 옆으로 좁아졌다가 서는 그림이 넓어지며 나온다 (ORIGINAL 방 2026-09-10, _받는칸 합침)
      const settle = targetId === 'original' && landOn && !reduced ? smoothstep(.72, 1, progress) : 0;
      if (settle > 0) {
        const landSrc = landOn.currentSrc || landOn.src;
        if (landSrc && bridgeLand.src !== landSrc) bridgeLand.src = landSrc;
        const turning = settle < .5;
        const runWidth = Math.max(.06, 1 - settle * 2);
        const landWidth = Math.max(.06, settle * 2 - 1);
        bridgeImage.style.opacity = turning ? '1' : '0';
        bridgeImage.style.transform = turning ? `scaleX(${runWidth.toFixed(3)})` : '';
        bridgeLand.style.opacity = turning ? '0' : '1';
        bridgeLand.style.transform = turning ? '' : `scaleX(${landWidth.toFixed(3)})`;
      } else {
        bridgeLand.style.opacity = '0';
        bridgeLand.style.transform = '';
        bridgeImage.style.opacity = '';
        bridgeImage.style.transform = '';
      }
      bridge.style.width = `${width}px`;
      bridge.style.height = `${height}px`;
      bridge.style.transformOrigin = `50% ${(dropHandoff || portfolioDrop ? GOYA_FOOT : .75) * 100}%`;
      bridge.style.transform = `translate3d(${x}px,${top}px,0) rotate(${rotation}deg) scaleY(${compression})`;
      bridge.style.visibility = 'visible';
      if (dropHandoff) dropWorld.setCharacterHidden(true);
      [index - 1, index].forEach(slot => {
        const sectionId = bridgeSections[slot]?.id;
        if (sectionId === 'portfolio' && galleryCharacter) galleryCharacter.style.visibility = 'hidden';
        else if (nativeAt(slot)) nativeAt(slot).style.visibility = 'hidden';
      });
      break;
    }
    const nextPortfolioHandoffActive = Boolean(portfolioHandoff);
    if (portfolioHandoff || portfolioHandoffActive !== nextPortfolioHandoffActive) {
      portfolio?.setIncomingCharacterHandoff?.(portfolioHandoff || { active: false, progress: 0, direction: scrollDelta < 0 ? -1 : 1 });
    }
    portfolioHandoffActive = nextPortfolioHandoffActive;
  }

  function pose(src) {
    if (src === lastPose) return;
    hostImage.src = goyaFile(src);
    lastPose = src;
  }

  function passageBounds(viewport = window.innerHeight) {
    const heroTravel = Math.max(1, hero.offsetHeight - viewport);
    if (skipPassage) {
      return {
        intentStart: hero.offsetTop + heroTravel * .3,
        flightStart: hero.offsetTop + heroTravel,
        end: Math.max(hero.offsetTop + heroTravel, about.offsetTop - viewport * .15),
      };
    }
    return {
      intentStart: hero.offsetTop + heroTravel * .3,
      flightStart: hero.offsetTop + heroTravel,
      end: drop.offsetTop + drop.offsetHeight - viewport,
    };
  }

  function update() {
    frame = 0;
    const now = performance.now();
    const y = window.scrollY;
    const viewport = window.innerHeight;
    const delta = y - previousScroll;
    previousScroll = y;
    const powerReady = reduced || hero.dataset.powerState === 'locked';
    const meliusUi = document.documentElement.dataset.heroUi === 'melius';
    const homeProgress = powerReady && !meliusUi ? clamp((y - hero.offsetTop) / Math.max(1, hero.offsetHeight - viewport)) : 0;
    const tvWidth = Math.max(1, heroTelevision.offsetWidth);
    const tvHeight = Math.max(1, heroTelevision.offsetHeight);
    const screenWidth = Math.max(1, heroScreen.offsetWidth);
    const screenHeight = Math.max(1, heroScreen.offsetHeight);
    const screenCenterOffsetX = heroScreen.offsetLeft + screenWidth * .5 - tvWidth * .5;
    const screenCenterOffsetY = heroScreen.offsetTop + screenHeight * .5 - tvHeight * .5;
    const cover = imageHero
      ? Math.max(innerWidth / (screenWidth * .89), viewport / (screenHeight * .77)) * 1.18
      : Math.max(innerWidth / (tvWidth * .548), viewport / (tvHeight * .687)) * 1.12;
    const dolly = meliusUi ? 0 : smoothstep(0, 1, homeProgress);
    const entryScale = meliusUi ? 1 : 1 / (1 - (1 - 1 / cover) * dolly);
    const entryProgress = meliusUi || reduced || homeProgress >= 1
      ? 1
      : homeProgress <= 0
        ? 0
        : clamp(
          Math.abs(cover - 1) < .0001
            ? dolly
            : (entryScale - 1) / (cover - 1),
        );
    const bridgeProgress = entryProgress;
    const portalOpacity = reduced ? 0 : smoothstep(.62, .94, homeProgress);
    const heroCopyOpacity = meliusUi || reduced ? 1 : 1 - smoothstep(.025, .24, homeProgress);
    const heroFieldOpacity = meliusUi ? 0 : reduced ? 1 : 1 - smoothstep(.04, .4, entryProgress);
    if (reduced) heroStage.style.setProperty('--entry-optics-strength', '0');
    else if (y <= hero.offsetTop + 1) heroStage.style.setProperty('--entry-optics-strength', '1');
    hero.style.setProperty('--hero-copy-opacity', heroCopyOpacity.toFixed(3));
    hero.style.setProperty('--hero-field-opacity', heroFieldOpacity.toFixed(3));
    hero.dataset.heroResting = String(y <= hero.offsetTop + 1 && homeProgress < .008);
    hero.dataset.entryReveal = portalOpacity.toFixed(4);
    const heroCopyVisible = heroCopyOpacity > .02;
    if (heroScrollLink.inert === heroCopyVisible) {
      heroScrollLink.inert = !heroCopyVisible;
      heroScrollLink.setAttribute('aria-hidden', String(!heroCopyVisible));
    }
    const recoil = reduced ? 0 : smoothstep(.12, .22, homeProgress) * (1 - smoothstep(.24, .34, homeProgress));
    const departure = reduced ? 0 : smoothstep(.08, .56, homeProgress);
    const launch = departure;
    const homeZoom = reduced ? 0 : entryProgress;
    const currentEntryScale = 1 + (cover - 1) * homeZoom;
    const centerProgress = smoothstep(.04, .85, homeProgress);
    const desiredScreenCenterX = lerp(heroTelevision.offsetLeft + screenCenterOffsetX, innerWidth * .5, centerProgress);
    const desiredScreenCenterY = lerp(heroTelevision.offsetTop + screenCenterOffsetY, viewport * .5, centerProgress);
    const entryShiftX = desiredScreenCenterX - heroTelevision.offsetLeft - screenCenterOffsetX * currentEntryScale;
    const entryShiftY = desiredScreenCenterY - heroTelevision.offsetTop - screenCenterOffsetY * currentEntryScale;
    hero.style.setProperty('--entry-scale', String(currentEntryScale));
    hero.style.setProperty('--entry-shift-x', `${entryShiftX.toFixed(2)}px`);
    hero.style.setProperty('--entry-shift-y', `${entryShiftY.toFixed(2)}px`);
    hero.style.setProperty('--entry-interior', '0');
    hero.style.setProperty('--entry-program', '1');
    hero.style.setProperty('--entry-shell', '1');
    hero.style.setProperty('--entry-content', '1');
    hero.style.setProperty('--entry-bevel', '0');
    hero.style.setProperty('--entry-glass', '0');
    hero.style.setProperty('--entry-threshold', '0');
    if (portalOpacity > 0) heroScreen.style.opacity = String(1 - portalOpacity);
    else heroScreen.style.removeProperty('opacity');
    hero.style.setProperty('--home-guide-x', `${(launch * 36).toFixed(2)}vw`);
    hero.style.setProperty('--home-guide-y', `${(-launch * 8).toFixed(2)}vh`);
    hero.style.setProperty('--home-guide-scale', (1 - launch * .86).toFixed(3));
    hero.style.setProperty('--home-guide-turn', `${(launch * 8).toFixed(2)}deg`);
    hero.style.setProperty('--home-guide-opacity', launch > .92 ? '0' : String((1 - smoothstep(.72, .92, launch)).toFixed(3)));
    const heroPose = homeProgress < .16 ? 'tva-mascot-sit' : 'character-run';
    const heroPoseFile = goyaFile(heroPose);
    if (heroGuideImage && !heroGuideImage.src.includes(heroPoseFile)) heroGuideImage.src = heroPoseFile;
    const heroPhase = homeProgress < .08 ? 'host' : homeProgress < .24 ? 'anticipate' : 'release';
    if (heroGuide) heroGuide.dataset.characterPhase = heroPhase;
    if (hero.getBoundingClientRect().bottom > 0 && hero.getBoundingClientRect().top < viewport) {
      heroRig.setPose(heroPhase === 'host' ? 'read' : heroPhase === 'anticipate' ? 'browse' : 'present', { category: 0 });
    }
    hero.classList.remove('is-entering');
    if (skipPassage) {
      const arrivalDepth = clamp((y - about.offsetTop) / viewport);
      const handoffProgress = reduced ? 0 : smoothstep(about.offsetTop - viewport, about.offsetTop + viewport * .2, y);
      dropWorld.setHandoffProgress(handoffProgress);
      about.classList.toggle('is-signal-arrived', reduced || y >= about.offsetTop);
      dropWorld.drawArrival(arrivalDepth, reduced);
    } else {
    const dropProgress = clamp((y - drop.offsetTop) / Math.max(1, drop.offsetHeight - viewport));
    const heroTravel = Math.max(1, hero.offsetHeight - viewport);
    const bounds = passageBounds(viewport);
    const passageStart = bounds.intentStart;
    const passageEnd = bounds.end;
    const passage = reduced ? dropProgress : clamp((y - passageStart) / Math.max(1, passageEnd - passageStart));
    const fallProgress = clamp((y - hero.offsetTop - heroTravel) / Math.max(1, passageEnd - hero.offsetTop - heroTravel));
    const portalActive = !reduced && powerReady && portalOpacity > 0 && y < drop.offsetTop;
    const stagePortal = portalActive && imageHero && homeProgress < 1;
    dropWorld.setPortalActive(portalActive, stagePortal ? heroStage : document.body);
    dropStage.classList.toggle('is-tv-exit', portalActive);
    dropStage.style.setProperty('--passage', fallProgress.toFixed(3));
    dropStage.style.setProperty('--arrival', '0');
    const flight = smoothstep(0, .55, fallProgress);
    const level = smoothstep(.12, .5, fallProgress);
    const brace = smoothstep(.56, .7, fallProgress) * (1 - smoothstep(.72, .84, fallProgress));
    const emerge = smoothstep(.69, .84, fallProgress);
    const recovery = smoothstep(.76, .87, fallProgress);
    const greet = smoothstep(.84, .92, fallProgress);
    const wave = smoothstep(.865, .96, fallProgress) * Math.PI * 5;
    if (!departureAnchor) departureAnchor = canonicalDepartureAnchor();
    const source = departureAnchor;
    const route = fallProgress;
    const mobile = innerWidth <= 760 || innerWidth / Math.max(1, viewport) < .92;
    const actorX = source.x * (1 - smoothstep(0, .24, route)) + Math.sin(route * Math.PI * 2.2) * innerWidth * .012 * (1 - recovery);
    const flightFootY = viewport * (mobile ? (innerWidth > 600 ? .595 : .63) : .66);
    const greetingFootY = viewport * (mobile ? .84 : .87);
    const actorY = source.footY + (flightFootY - source.footY) * flight + (greetingFootY - flightFootY) * emerge;
    const flightScale = mobile ? .9 : .94;
    const emergenceScale = mobile ? .46 : .4;
    const greetingSettle = recovery * (mobile ? .12 : .16);
    const actorScale = source.scale + (flightScale - source.scale) * flight + emergenceScale * emerge - greetingSettle;
    const actorTurn = source.turn + (-20 * (1 - level) - source.turn) * smoothstep(.02, .22, route);
    const fallTiltX = (1 - level) * 14;
    const fallTiltY = (1 - level) * -12;
    const fieldReveal = reduced ? 1 : clamp((y - hero.offsetTop - heroTravel) / viewport);
    dropStage.style.setProperty('--signal-reveal', fieldReveal.toFixed(3));
    dropStage.style.setProperty('--signal-world-edge', `${((1 - fieldReveal) * viewport).toFixed(2)}px`);
    const corridor = reduced ? 0 : smoothstep(.7, 1, departure) * (1 - fieldReveal);
    const corridorY = Math.max(source.screenBottom - Math.max(0, y - hero.offsetTop - heroTravel) + viewport * .44, actorY + viewport * .18);
    dropStage.style.setProperty('--signal-corridor-alpha', corridor.toFixed(3));
    dropStage.style.setProperty('--signal-corridor-x', `${(innerWidth * .5 + actorX).toFixed(2)}px`);
    dropStage.style.setProperty('--signal-corridor-y', `${corridorY.toFixed(2)}px`);
    const dropStageName = route < .18 ? 'approach' : route < .55 ? 'flight' : route < .7 ? 'glass' : route < .84 ? 'emerge' : 'greet';
    if (drop.dataset.stage !== dropStageName) drop.dataset.stage = dropStageName;
    dropActor.dataset.characterPhase = dropStageName;
    if (!reduced) {
      dropActor.style.setProperty('--guide-x', `${actorX.toFixed(2)}px`);
      dropActor.style.setProperty('--guide-y', `${actorY.toFixed(2)}px`);
      dropActor.style.setProperty('--guide-scale', actorScale.toFixed(3));
      dropActor.style.setProperty('--guide-turn', `${actorTurn.toFixed(2)}deg`);
      dropActor.style.setProperty('--guide-tilt-x', `${(fallTiltX * departure).toFixed(2)}deg`);
      dropActor.style.setProperty('--guide-tilt-y', `${(fallTiltY * departure).toFixed(2)}deg`);
      dropActor.style.setProperty('--guide-contact', '0');
      dropActor.style.setProperty('--drop-guide-opacity', '1');
    } else {
      drop.dataset.stage = 'guide';
      dropActor.style.removeProperty('--guide-x');
      dropActor.style.removeProperty('--guide-y');
      dropActor.style.removeProperty('--guide-scale');
      dropActor.style.removeProperty('--guide-turn');
      dropActor.style.removeProperty('--guide-tilt-x');
      dropActor.style.removeProperty('--guide-tilt-y');
      dropActor.style.removeProperty('--guide-contact');
      dropActor.style.removeProperty('--drop-guide-opacity');
      if (!dropImage.src.includes('goya-photo-idle.png')) dropImage.src = `assets/goya/goya-photo-idle.png?v=${GOYA_V}`;
    }
    const arrivalDepth = clamp((y - about.offsetTop) / viewport);
    const handoffProgress = reduced ? 0 : smoothstep(about.offsetTop - viewport, about.offsetTop + viewport * .2, y);
    dropWorld.setHandoffProgress(handoffProgress);
    const continuumActive = !reduced && y >= about.offsetTop && y < about.offsetTop + viewport * .2;
    dropStage.style.setProperty('--continuum-photo-opacity', (1 - smoothstep(0, .2, arrivalDepth)).toFixed(3));
    dropStage.classList.toggle('is-arrival-continuum', continuumActive);
    about.classList.toggle('is-signal-continuum', continuumActive);
    about.classList.toggle('is-signal-arrived', reduced || y >= about.offsetTop);
    dropWorld.drawArrival(arrivalDepth, reduced);
    if (portalActive || (drop.getBoundingClientRect().bottom > 0 && drop.getBoundingClientRect().top < viewport)) {
      const measuredScreen = heroScreen.getBoundingClientRect();
      const stageOrigin = stagePortal ? heroStage.getBoundingClientRect() : { left: 0, top: 0 };
      const apertureRect = {
        left: measuredScreen.left - stageOrigin.left,
        top: measuredScreen.top - stageOrigin.top,
        width: measuredScreen.width,
        height: measuredScreen.height,
      };
      let aperture = apertureRect;
      try {
        const corners = imageHero
          ? imageApertureShape.map(([x, y]) => ({ x: apertureRect.left + apertureRect.width * x, y: apertureRect.top + apertureRect.height * y }))
          : measureAperture(heroScreen);
        const xs = corners.map(point => point.x); const ys = corners.map(point => point.y);
        const [topLeft, topRight, bottomRight, bottomLeft] = corners;
        const coverageMargin = imageHero ? Math.min(
          -topLeft.x, -topLeft.y,
          topRight.x - innerWidth, -topRight.y,
          bottomRight.x - innerWidth, bottomRight.y - viewport,
          -bottomLeft.x, bottomLeft.y - viewport,
        ) : -1;
        const projectionResolve = imageHero ? smoothstep(0, Math.min(innerWidth, viewport) * .035, coverageMargin) : 0;
        aperture = {
          left: Math.min(...xs),
          top: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
          corners,
          projected: imageHero,
          projectionResolve,
        };
        heroStage.style.setProperty('--entry-optics-strength', String(reduced ? 0 : 1 - projectionResolve));
      } catch { /* The photographed screen is axis-aligned in supported layouts. */ }
      dropWorld.draw(fallProgress, pointer, reduced, aperture, bridgeProgress);
      document.querySelector('.signal-passage')?.style?.setProperty?.('opacity', String(reduced ? 1 : portalOpacity));
    }
    }
    const distance = railMode() && document.documentElement.dataset.railPanel === 'about'
      ? clamp(railAboutDistance, 0, travel)
      : reduced ? 0 : clamp(y - about.offsetTop, 0, travel);
    const progress = travel ? distance / travel : 0;
    if (!about.classList.contains('is-linear') && about.getBoundingClientRect().bottom > 0 && about.getBoundingClientRect().top < viewport) studioWorld.draw(progress, pointer, 0, reduced);
    about.style.setProperty('--about', progress.toFixed(4));
    if (!reduced && !about.classList.contains('about-bleib')) track.style.transform = `translate3d(${-distance}px,0,0)`;
    const probe = distance + camera.clientWidth * .4;
    const nextStop = reduced ? stations.findLastIndex(station => station.getBoundingClientRect().top <= viewport * .5) : stations.findLastIndex(station => station.offsetLeft <= probe);
    current = !reduced && travel && distance >= travel - 2 ? stations.length - 1 : Math.max(0, nextStop);
    stopLabel.textContent = stations[current].dataset.station;
    if (current !== reportedStation) {
      const direction = current > reportedStation ? 1 : -1;
      reportedStation = current;
      window.dispatchEvent(new CustomEvent('tva:studio-station', { detail: { index: current, station: stations[current].dataset.station, direction } }));
    }
    stations.forEach((station, index) => { station.inert = !about.classList.contains('is-linear') && index !== current; });
    stepButtons[0].disabled = current === 0;
    stepButtons[1].disabled = current === stations.length - 1;
    if (!reduced && !host.hasAttribute('data-character-direction') && about.getBoundingClientRect().top <= 0 && about.getBoundingClientRect().bottom >= viewport) {
      host.style.transform = `translateX(${Math.sin(progress * Math.PI * 2) * 32}px) rotate(${clamp(delta, -6, 6) * .35}deg)`;
      if (Math.abs(delta) > 1) {
        pose('character-run');
        clearTimeout(restingTimer);
        restingTimer = setTimeout(() => pose(current === 0 || current === 5 ? 'tva-mascot-idle' : 'character-inspect'), 140);
      }
    }
    let scene = railMode()
      ? (document.documentElement.dataset.railPanel || 'home')
      : y >= about.offsetTop - 2 ? 'about' : (!skipPassage && y >= drop.offsetTop - viewport * .25 ? 'drop' : 'home');
    if (!railMode()) for (const section of later) if (section.getBoundingClientRect().top <= viewport * .5) scene = section.id;
    onScene(scene);
    connectCharacters(y, viewport, delta);
    if (!reduced && performance.now() < activeUntil) schedule();
  }

  function schedule() { if (!document.hidden && !frame) frame = requestAnimationFrame(update); }

  function stopJourneyActors() {
    cancelAnimationFrame(frame);
    frame = 0;
    clearTimeout(restingTimer);
    pointer.held = false;
    resetBridge();
  }

  function resize() {
    const aboutRect = about.getBoundingClientRect();
    const navHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 64;
    const preserveAboutStation = aboutRect.top <= navHeight + 8 && aboutRect.bottom >= window.innerHeight * .5;
    const preservedStation = current;
    const laterRoute = !preserveAboutStation && later.find(section => {
      const rect = section.getBoundingClientRect();
      return rect.top <= window.innerHeight * .5 && rect.bottom > 0;
    });
    departureAnchor = null;
    dropWorld.resize();
    const stackAbout = about.classList.contains('about-bleib');
    const linear = reduced || stackAbout || window.innerHeight < 560;
    about.classList.toggle('is-linear', linear);
    travel = linear ? 0 : Math.max(0, track.scrollWidth - camera.clientWidth);
    studioWorld.layout(stations.map(station => station.offsetLeft), travel, camera.clientWidth);
    about.style.height = railMode() ? '100svh' : linear ? 'auto' : `${travel + camera.clientHeight}px`;
    resizeRestoreOverflowAnchor = document.documentElement.style.overflowAnchor;
    document.documentElement.style.overflowAnchor = 'none';
    const token = ++resizeRestoreToken;
    cancelAnimationFrame(resizeRestoreFrame);
    resizeRestoreFrame = requestAnimationFrame(() => {
      resizeRestoreFrame = 0;
      if (token === resizeRestoreToken) {
        if (preserveAboutStation) gotoStation(preservedStation, true);
        else if (laterRoute) {
          onScene(laterRoute.id);
          const routeOffset = Math.max(64, document.querySelector('.site-nav')?.offsetHeight || navHeight);
          window.scrollTo({ top: Math.max(0, laterRoute.offsetTop - routeOffset), behavior: 'instant' });
        }
        document.documentElement.style.overflowAnchor = resizeRestoreOverflowAnchor;
        resizeRestoreOverflowAnchor = null;
      }
    });
    schedule();
  }

  function gotoStation(index, instant = false) {
    const target = clamp(index, 0, stations.length - 1);
    if (railMode()) {
      railAboutDistance = Math.min(travel, stations[target].offsetLeft);
      current = target;
      reportedStation = target;
      track.style.transition = instant || reduced ? 'none' : 'transform .85s cubic-bezier(.76,0,.24,1)';
      track.style.transform = `translate3d(${-railAboutDistance}px,0,0)`;
      about.style.setProperty('--about', travel ? (railAboutDistance / travel).toFixed(4) : '0');
      stopLabel.textContent = stations[target].dataset.station;
      stations.forEach((station, i) => { station.inert = i !== target; });
      stepButtons[0].disabled = target === 0;
      stepButtons[1].disabled = target === stations.length - 1;
      window.dispatchEvent(new CustomEvent('tva:studio-station', { detail: { index: target, station: stations[target].dataset.station, direction: 0 } }));
      schedule();
      return;
    }
    const top = about.classList.contains('is-linear')
      ? window.scrollY + stations[target].getBoundingClientRect().top - 80
      : about.offsetTop + Math.min(travel, stations[target].offsetLeft);
    window.scrollTo({ top, behavior: instant || reduced ? 'instant' : 'smooth' });
  }

  function studioDragTarget(target) {
    return target instanceof Element && target.closest('button,a,input,textarea,select,[contenteditable="true"]');
  }

  function clearStudioSelection() {
    window.getSelection()?.removeAllRanges();
  }

  function cancelStudioDrag() {
    if (!studioDrag) return;
    if (studioDrag.captured && camera.hasPointerCapture?.(studioDrag.pointerId)) camera.releasePointerCapture(studioDrag.pointerId);
    window.scrollTo({ top: studioDrag.startScrollY, behavior: 'instant' });
    studioDrag = null;
    schedule();
  }

  function finishStudioDrag(event) {
    if (!studioDrag || event.pointerId !== studioDrag.pointerId) return;
    const drag = studioDrag;
    const cancelled = event.type === 'pointercancel';
    if (drag.captured && camera.hasPointerCapture?.(drag.pointerId)) camera.releasePointerCapture(drag.pointerId);
    studioDrag = null;
    if (cancelled || !drag.intent) {
      window.scrollTo({ top: drag.startScrollY, behavior: 'instant' });
      schedule();
      return;
    }
    const direction = drag.dx < 0 ? 1 : -1;
    const target = clamp(drag.startStation + direction, 0, stations.length - 1);
    if (target !== drag.startStation) {
      window.dispatchEvent(new CustomEvent('tva:studio-station-intent', { detail: { direction, from: drag.startStation, to: target } }));
    }
    schedule();
  }

  stepButtons.forEach(button => button.addEventListener('click', () => {
    const dir = Number(button.dataset.stationStep);
    if (!dir) return;
    window.dispatchEvent(new CustomEvent('tva:studio-station-intent', { detail: { direction: dir, from: current, to: clamp(current + dir, 0, stations.length - 1) } }));
  }));
  stations.forEach((station, index) => station.addEventListener('focusin', event => {
    if (about.classList.contains('is-linear')) return;
    if (event.target.closest('button,a') && index !== current) gotoStation(index, true);
  }));
  about.querySelectorAll('[data-object]').forEach((button, index) => button.addEventListener('click', () => {
    button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
    studioWorld.interact(index, button.getAttribute('aria-pressed') === 'true');
    activeUntil = performance.now() + 1000;
    schedule();
    if (!host.hasAttribute('data-character-direction')) { host.classList.add('is-working'); pose('character-inspect'); window.setTimeout(() => host.classList.remove('is-working'), 600); }
  }));
  window.addEventListener('scroll', () => {
    if (resizeRestoreFrame) {
      cancelAnimationFrame(resizeRestoreFrame);
      resizeRestoreFrame = 0;
      resizeRestoreToken += 1;
      if (resizeRestoreOverflowAnchor !== null) {
        document.documentElement.style.overflowAnchor = resizeRestoreOverflowAnchor;
        resizeRestoreOverflowAnchor = null;
      }
    }
    schedule();
  }, { passive: true });
  window.addEventListener('resize', resize);
  window.addEventListener('pointerdown', event => {
    if (!event.isTrusted || !event.isPrimary) return;
    if (resizeRestoreFrame) {
      resizeRestoreToken += 1;
      cancelAnimationFrame(resizeRestoreFrame);
      resizeRestoreFrame = 0;
      if (resizeRestoreOverflowAnchor !== null) {
        document.documentElement.style.overflowAnchor = resizeRestoreOverflowAnchor;
        resizeRestoreOverflowAnchor = null;
      }
    }
    pointer.held = true;
    schedule();
  }, { passive: true });
  camera.addEventListener('pointerdown', event => {
    if (!event.isTrusted || !event.isPrimary || event.pointerType !== 'mouse' || reduced || about.classList.contains('is-linear') || studioDragTarget(event.target)) return;
    studioDrag = { pointerId: event.pointerId, pointerType: event.pointerType, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, startScrollY: window.scrollY, startStation: current, intent: false, captured: false };
  }, { passive: true });
  camera.addEventListener('pointermove', event => {
    if (!studioDrag || event.pointerId !== studioDrag.pointerId) return;
    studioDrag.dx = event.clientX - studioDrag.startX;
    studioDrag.dy = event.clientY - studioDrag.startY;
    const horizontal = Math.abs(studioDrag.dx) >= studioDragThreshold && Math.abs(studioDrag.dx) > Math.abs(studioDrag.dy) * 1.25;
    if (!studioDrag.intent && horizontal) {
      studioDrag.intent = true;
      event.preventDefault();
      clearStudioSelection();
      if (!reduced && !about.classList.contains('is-linear') && camera.setPointerCapture) {
        camera.setPointerCapture(event.pointerId);
        studioDrag.captured = true;
      }
    }
    if (studioDrag.intent) event.preventDefault();
  }, { passive: false });
  camera.addEventListener('selectstart', event => {
    if (studioDrag?.intent && studioDrag.pointerType === 'mouse') event.preventDefault();
  }, { passive: false });
  window.addEventListener('pointerup', event => {
    finishStudioDrag(event);
    pointer.held = false;
    schedule();
  }, { passive: false });
  window.addEventListener('pointercancel', event => {
    finishStudioDrag(event);
    pointer.held = false;
    schedule();
  }, { passive: false });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      cancelStudioDrag();
      pointer.held = false;
      return;
    }
    if (event.target instanceof HTMLElement && event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
  });
  window.addEventListener('tva:restart', () => {
    stopJourneyActors();
    current = 0;
    reportedStation = 0;
    previousScroll = 0;
    if (heroGuide) heroGuide.dataset.characterPhase = 'host';
    if (!skipPassage) dropActor.dataset.characterPhase = 'fall';
    delete host.dataset.incomingPoseId;
    heroRig.setPose('read', { category: 0 });
  });
  window.addEventListener('tva:navigate', () => {
    resizeRestoreToken += 1;
    cancelAnimationFrame(resizeRestoreFrame);
    resizeRestoreFrame = 0;
    pointer.held = false;
    resetBridge();
    requestAnimationFrame(() => {
      previousScroll = window.scrollY;
      schedule();
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopJourneyActors();
    else {
      previousScroll = window.scrollY;
      schedule();
    }
  });
  [dropStage, camera].forEach(surface => surface.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || reduced) return;
    pointer.x = event.clientX / innerWidth * 2 - 1;
    pointer.y = event.clientY / innerHeight * 2 - 1;
    schedule();
  }, { passive: true }));
  document.fonts.ready.then(resize);
  resize();
  return {
    update,
    setReducedMotion(value) {
      reduced = value;
      resize();
      dropWorld.draw(reduced ? .9 : 0, pointer, reduced, heroScreen.getBoundingClientRect());
    },
    gotoStation,
    get currentStation() { return current; }
  };
}
