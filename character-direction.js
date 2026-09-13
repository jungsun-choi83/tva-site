import { createCharacterRig } from './character-rig.js?v=eb-20260913';
import { createArtActor } from './fall-welcome/actor.js?v=eb-20260913';

const ACTS = {
  plan: { role: 1, label: 'planning', direction: 1 },
  space: { role: 2, label: 'spatial-design', direction: 1 },
  product: { role: 3, label: 'product-making', direction: 1 },
  event: { role: 4, label: 'event-operations', direction: 1 },
};

const STATION_ACTIONS = [
  { phase: 'attentive', role: 0, work: .08, propsVisible: false },
  { phase: 'planning', role: 1, work: .58, propsVisible: true, poseId: 'service-01' },
  { phase: 'space', role: 2, work: .7, propsVisible: true, poseId: 'service-02' },
  { phase: 'product', role: 3, work: .82, propsVisible: false, poseId: 'brake-02', artGroup: 'brake' },
  { phase: 'events', role: 4, work: .68, propsVisible: true, poseId: 'service-04' },
  { phase: 'handoff', role: 0, work: .34, propsVisible: false, poseId: 'archive-04', artGroup: 'archive' },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function loadStylesheet() {
  if (document.querySelector('link[data-character-direction-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./character-direction.css?v=eternal-beam-r51', import.meta.url).href;
  link.dataset.characterDirectionStyle = '';
  document.head.append(link);
}

function makeActor(mount, role, artGroups = []) {
  mount.dataset.characterDirection = '';
  mount.dataset.characterRole = role;
  mount.dataset.characterPhase = 'rest';
  const rig = createCharacterRig(mount);
  const actor = { mount, rig, art: {}, animation: null, stepFrame: 0, artFrame: 0, token: 0, lastFrame: null };
  artGroups.forEach(group => {
    const artMount = mount.ownerDocument.createElement('span');
    artMount.className = `studio-host__art studio-host__art--${group}`;
    artMount.setAttribute('aria-hidden', 'true');
    mount.append(artMount);
    actor.art[group] = { mount: artMount, actor: createArtActor(artMount, { group }) };
    artMount.querySelector('.art-actor__pose')?.addEventListener('load', () => {
      cancelAnimationFrame(actor.artFrame);
      actor.artFrame = requestAnimationFrame(() => {
        actor.artFrame = 0;
        if (actor.lastFrame && !document.hidden) frame(actor, actor.lastFrame.phase, actor.lastFrame.state);
      });
    });
  });
  return actor;
}

function stop(actor) {
  actor.token += 1;
  actor.animation?.cancel();
  cancelAnimationFrame(actor.stepFrame);
  cancelAnimationFrame(actor.artFrame);
  actor.stepFrame = 0;
  actor.artFrame = 0;
  actor.animation = null;
}

function frame(actor, phase, state = {}) {
  actor.lastFrame = { phase, state: { ...state } };
  actor.mount.dataset.characterPhase = phase;
  const isAboutActor = actor.mount.dataset.characterRole === 'service-demonstrator';
  const pose = {
    rest: 'read',
    attentive: 'read',
    planning: 'find',
    space: 'find',
    product: 'present',
    events: 'present',
    handoff: 'present',
    indicate: 'present',
    anticipate: 'browse',
    contact: 'find',
    present: 'present',
    settle: 'recover',
    travel: state.direction < 0 ? 'moonwalk' : 'walk',
  }[phase] || 'read';
  const moonwalk = isAboutActor && phase === 'travel' && state.direction < 0;
  const rigElement = actor.rig.svg;
  if (rigElement) {
    if (moonwalk) {
      const rigVisibleHeight = .775;
      const rigFoot = .932;
      const rigHeight = actor.mount.offsetHeight / rigVisibleHeight;
      Object.assign(rigElement.style, {
        width: `${rigHeight.toFixed(2)}px`,
        height: `${rigHeight.toFixed(2)}px`,
        left: `${((actor.mount.offsetWidth - rigHeight) * .5).toFixed(2)}px`,
        top: `${(actor.mount.offsetHeight - rigHeight * rigFoot).toFixed(2)}px`,
        right: 'auto',
        bottom: 'auto',
      });
    } else if (rigElement.style.width) {
      rigElement.removeAttribute('style');
    }
  }
  if (Number.isInteger(state.role)) actor.rig.setCategory(Math.max(0, Math.min(3, state.role - 1)));
  actor.rig.setPropsVisible(isAboutActor && phase === 'travel' ? false : Boolean(state.propsVisible));
  actor.rig.draw({
    direction: state.direction ?? 1,
    lean: state.lean ?? 0,
    role: state.role ?? 0,
    work: state.work ?? 0,
    phase: state.stepPhase ?? 0,
    energy: state.stepEnergy ?? 0,
    moonwalk,
    moonwalkStride: innerWidth < 760 ? 90 : 160,
    pose,
  });
  let descriptor = null;
  if (state.poseId) descriptor = { group: state.artGroup || 'service', poseId: state.poseId };
  else if (phase === 'travel' && !moonwalk) descriptor = { group: 'run', state: 'cycle', cycleProgress: (state.stepPhase || 0) / (Math.PI * 2) };
  else if (phase === 'brake') descriptor = { group: 'brake', state: 'sequence', frameIndex: state.frameIndex || 0 };
  else if (phase === 'attentive' && actor.mount.dataset.incomingPoseId) descriptor = { group: 'fall', poseId: actor.mount.dataset.incomingPoseId };
  let activeArt = null;
  if (descriptor && actor.art?.[descriptor.group]) {
    const entry = actor.art[descriptor.group];
    const presentation = entry.actor.draw({ ...descriptor, reduced: document.documentElement.classList.contains('reduced-motion') });
    if (presentation.available) {
      const image = entry.mount.querySelector('.art-actor__pose');
      const bounds = presentation.bounds;
      const intrinsic = presentation.intrinsicSize;
      if (image && bounds && intrinsic) {
        const visibleWidth = Math.max(.0001, bounds.right - bounds.left);
        const visibleHeight = Math.max(.0001, bounds.bottom - bounds.top);
        const widthScale = actor.mount.offsetWidth / visibleWidth;
        const fullHeight = isAboutActor
          ? actor.mount.offsetHeight / visibleHeight
          : widthScale * intrinsic.height / Math.max(1, intrinsic.width);
        const fullWidth = isAboutActor
          ? fullHeight * intrinsic.width / Math.max(1, intrinsic.height)
          : widthScale;
        const visiblePixelWidth = visibleWidth * fullWidth;
        const centeredLeft = (actor.mount.offsetWidth - visiblePixelWidth) * .5 - bounds.left * fullWidth;
        Object.assign(image.style, {
          inset: 'auto',
          left: `${(isAboutActor ? centeredLeft : -bounds.left * fullWidth).toFixed(2)}px`,
          top: `${(actor.mount.offsetHeight - presentation.footAnchor.y * fullHeight).toFixed(2)}px`,
          width: `${fullWidth.toFixed(2)}px`,
          height: `${fullHeight.toFixed(2)}px`,
          maxWidth: 'none',
        });
      }
      activeArt = descriptor.group;
      actor.mount.dataset.characterArt = presentation.motionModel;
      actor.mount.dataset.characterArtPose = presentation.poseId;
    }
  }
  Object.entries(actor.art || {}).forEach(([group, entry]) => { entry.mount.hidden = group !== activeArt; });
  actor.mount.dataset.characterArtActive = String(Boolean(activeArt));
  if (!activeArt) {
    delete actor.mount.dataset.characterArt;
    delete actor.mount.dataset.characterArtPose;
  }
}

async function play(actor, keyframes, options, state, stepping = false) {
  if (state.phase === 'travel' && state.direction < 0 && actor.mount.dataset.characterRole === 'service-demonstrator') {
    state = { ...state, stepPhase: state.stepPhase ?? actor.lastFrame?.state.stepPhase ?? 0 };
  }
  const token = ++actor.token;
  actor.animation?.cancel();
  cancelAnimationFrame(actor.stepFrame);
  actor.stepFrame = 0;
  frame(actor, state.phase, state);
  if (!options.duration) {
    actor.mount.style.transform = keyframes.at(-1).transform || '';
    return token === actor.token;
  }
  const startedAt = performance.now();
  const step = () => {
    if (token !== actor.token) return;
    const stepPhase = state.phase === 'travel' && state.direction < 0 && actor.mount.dataset.characterRole === 'service-demonstrator'
      ? (actor.lastFrame?.state.stepPhase || 0)
      : (performance.now() - startedAt) / 68;
    frame(actor, 'travel', { ...state, stepPhase, stepEnergy: .9 });
    actor.stepFrame = requestAnimationFrame(step);
  };
  if (stepping) step();
  actor.animation = actor.mount.animate(keyframes, options);
  try {
    await actor.animation.finished;
  } catch {
    cancelAnimationFrame(actor.stepFrame);
    actor.stepFrame = 0;
    return false;
  }
  cancelAnimationFrame(actor.stepFrame);
  actor.stepFrame = 0;
  if (token !== actor.token) return false;
  actor.mount.style.transform = keyframes.at(-1).transform || '';
  actor.animation.cancel();
  actor.animation = null;
  frame(actor, state.phase, state);
  return true;
}

function actorShift(actor, target, limit) {
  const from = actor.mount.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  return clamp(to.left - from.right + from.width * .32, -limit, limit);
}

function initAbout(reduced) {
  const section = document.querySelector('#about');
  const mount = section?.querySelector('.studio-host');
  if (!section || !mount) return null;
  const actor = makeActor(mount, 'service-demonstrator', ['fall', 'run', 'brake', 'service', 'archive']);
  actor.art.run.actor.draw({ state: 'cycle', cycleProgress: 0, reduced: reduced() });
  const replaying = new WeakSet();
  let activeObject = '';
  let activeButton = null;
  let stationIndex = -1;
  let stationFrame = 0;
  let movementTimer = 0;
  let lastScrollY = window.scrollY;
  let changingStation = false;
  let stationChangeVersion = 0;
  let intentTravel = false;
  let travelDirection = 1;
  let moonwalkDistance = 0;
  let moonwalkStationDistance = 480;
  let previousTravelDirection = 1;

  function setMoonwalkStationDistance(index) {
    const stations = [...section.querySelectorAll('[data-station]')];
    const from = Math.max(1, Math.min(stations.length - 1, index));
    const gap = Math.abs(stations[from].offsetLeft - stations[from - 1].offsetLeft);
    moonwalkStationDistance = Math.max(1, gap);
  }

  function travelPhase(direction, delta = 0) {
    if (direction < 0) {
      if (previousTravelDirection >= 0) moonwalkDistance = 0;
      moonwalkDistance += Math.abs(delta);
    } else {
      moonwalkDistance = 0;
    }
    previousTravelDirection = direction;
    return direction < 0 ? moonwalkDistance / moonwalkStationDistance * Math.PI * 2 : performance.now() / 70;
  }

  function stationArtState() {
    const action = STATION_ACTIONS[stationIndex] || STATION_ACTIONS[0];
    const incomingPoseId = stationIndex === 0 ? mount.dataset.incomingPoseId : '';
    return {
      poseId: action.poseId || incomingPoseId || undefined,
      artGroup: action.artGroup || (action.poseId ? 'service' : incomingPoseId ? 'fall' : undefined),
    };
  }

  function settleAtStation(direction = 1) {
    const action = STATION_ACTIONS[stationIndex] || STATION_ACTIONS[0];
    mount.dataset.characterStop = String(Math.max(0, stationIndex));
    frame(actor, action.phase, {
      ...action,
      direction,
      ...stationArtState(),
    });
  }

  async function finishMoonwalkSettle(direction, capturedRootPx = null) {
    const rootPx = capturedRootPx ?? (actor.rig.getMoonwalkRootOffsetPx?.() || 0);
    moonwalkDistance = 0;
    previousTravelDirection = 1;
    if (reduced() || Math.abs(rootPx) < .25) {
      mount.style.transform = '';
      settleAtStation(direction);
      return true;
    }
    mount.style.transform = `translate3d(${rootPx.toFixed(2)}px,0,0)`;
    const action = STATION_ACTIONS[stationIndex] || STATION_ACTIONS[0];
    const settled = await play(actor, [
      { transform: `translate3d(${rootPx.toFixed(2)}px,0,0)` },
      { transform: 'translate3d(0,0,0)' },
    ], { duration: 240, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' },
    { ...action, phase: action.phase, direction, ...stationArtState() });
    if (!settled) return false;
    mount.style.transform = '';
    settleAtStation(direction);
    return true;
  }

  async function finishExitArrival(direction, index) {
    const stillCurrent = () => stationIndex === index && !activeButton;
    const stopped = await play(actor, [
      { transform: 'translate3d(0,0,0) rotate(0deg)' },
      { transform: 'translate3d(0,0,0) rotate(0deg)' },
    ], { duration: 85, easing: 'linear', fill: 'forwards' },
    { phase: 'brake', direction, role: 0, frameIndex: 0 });
    if (!stopped || !stillCurrent()) return false;
    const settled = await play(actor, [
      { transform: 'translate3d(0,0,0) rotate(0deg)' },
      { transform: 'translate3d(0,0,0) rotate(0deg)' },
    ], { duration: 85, easing: 'linear', fill: 'forwards' },
    { phase: 'brake', direction, role: 0, frameIndex: 1 });
    if (!settled || !stillCurrent()) return false;
    return play(actor, [
      { transform: 'translate3d(0,0,0) rotate(0deg)' },
      { transform: 'translate3d(0,0,0) rotate(0deg)' },
    ], { duration: 180, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' },
    { phase: 'indicate', direction, role: 0, poseId: 'archive-04', artGroup: 'archive' });
  }

  async function changeStation(index, requestedDirection = 0) {
    if (index < 0) return;
    if (index === stationIndex) {
      if (intentTravel) return;
      if (index === 0 && mount.dataset.incomingPoseId && mount.dataset.characterArtPose !== mount.dataset.incomingPoseId) {
        settleAtStation(requestedDirection || 1);
      }
      return;
    }
    const previousStation = stationIndex;
    stationIndex = index;
    if (intentTravel) return;
    if (index > 0) delete mount.dataset.incomingPoseId;
    activeObject = '';
    activeButton?.removeAttribute('aria-busy');
    activeButton = null;
    delete mount.dataset.characterObject;
    delete mount.dataset.characterService;
    stop(actor);
    mount.style.transform = '';
    if (reduced() || previousStation < 0 || section.getBoundingClientRect().bottom <= 0 || section.getBoundingClientRect().top >= innerHeight) {
      settleAtStation(requestedDirection || 1);
      intentTravel = false;
      return;
    }
    const direction = requestedDirection || (index > previousStation ? 1 : -1);
    const changeVersion = ++stationChangeVersion;
    changingStation = true;
    try {
      const arrived = await play(actor, [
        { transform: `translate3d(${-direction * 12}px,0,0) rotate(${-direction * 3}deg)` },
        { transform: 'translate3d(0,0,0) rotate(0deg)' },
      ], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' },
      { phase: 'travel', direction, lean: direction * 3, role: 0 }, true);
      if (!arrived || stationIndex !== index || activeButton) return;
      if (index === STATION_ACTIONS.length - 1) {
        const indicated = await finishExitArrival(direction, index);
        if (!indicated || stationIndex !== index || activeButton) return;
      }
      if (direction < 0) await finishMoonwalkSettle(direction);
      else settleAtStation(direction);
    } finally {
      if (changeVersion === stationChangeVersion) {
        changingStation = false;
        intentTravel = false;
      }
    }
  }

  function startIntentTravel(direction) {
    if (reduced() || activeButton) return;
    travelDirection = direction || travelDirection;
    if (travelDirection < 0) {
      setMoonwalkStationDistance(stationIndex);
      moonwalkDistance = 0;
      previousTravelDirection = 1;
    }
    intentTravel = true;
    clearTimeout(movementTimer);
    mount.dataset.characterJourney = 'running';
    frame(actor, 'travel', { direction: direction || 1, role: 0, stepPhase: travelPhase(direction || 1), stepEnergy: .9 });
  }

  async function finishIntentTravel(direction) {
    if (!intentTravel || activeButton) return;
    intentTravel = false;
    if (direction < 0) {
      const rootPx = actor.rig.getMoonwalkRootOffsetPx?.() || 0;
      stop(actor);
      delete mount.dataset.characterJourney;
      await finishMoonwalkSettle(direction, rootPx);
      return;
    }
    changingStation = true;
    const finishVersion = ++stationChangeVersion;
    try {
      const braked = await play(actor, [
        { transform: 'translate3d(0,0,0) rotate(0deg)' },
        { transform: 'translate3d(0,0,0) rotate(0deg)' },
      ], { duration: reduced() ? 0 : 85, easing: 'linear', fill: 'forwards' },
      { phase: direction < 0 ? 'settle' : 'brake', direction: direction < 0 ? 1 : direction, role: 0, frameIndex: 0 });
      if (!braked || finishVersion !== stationChangeVersion) return;
      settleAtStation(direction);
    } finally {
      if (finishVersion === stationChangeVersion) {
        changingStation = false;
        delete mount.dataset.characterJourney;
      }
    }
  }

  function readStation() {
    stationFrame = 0;
    const delta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    const stations = [...section.querySelectorAll('[data-station]')];
    const active = section.classList.contains('is-linear')
      ? stations.findLastIndex(station => station.getBoundingClientRect().top <= innerHeight * .5)
      : stations.findIndex(station => !station.inert);
    if (delta !== 0) {
      travelDirection = delta < 0 ? -1 : 1;
      if (travelDirection < 0 && previousTravelDirection >= 0) setMoonwalkStationDistance(stationIndex >= 1 ? stationIndex : active);
    }
    const direction = travelDirection;
    if (intentTravel) {
      if (active >= 0) stationIndex = active;
      clearTimeout(movementTimer);
      mount.dataset.characterJourney = 'running';
      frame(actor, 'travel', { direction, role: 0, stepPhase: travelPhase(direction, delta), stepEnergy: .9 });
      movementTimer = window.setTimeout(() => { void finishIntentTravel(direction); }, 180);
      return;
    }
    changeStation(active, direction);
    const sectionRect = section.getBoundingClientRect();
    const retainsIncomingPose = stationIndex === 0 && Boolean(mount.dataset.incomingPoseId);
    if (!reduced() && !activeButton && !changingStation && !retainsIncomingPose && Math.abs(delta) > 1 && sectionRect.top < innerHeight && sectionRect.bottom > 0) {
      clearTimeout(movementTimer);
      mount.dataset.characterJourney = 'running';
      frame(actor, 'travel', { direction, role: 0, stepPhase: travelPhase(direction, delta), stepEnergy: Math.min(1, .55 + Math.abs(delta) / 18) });
      movementTimer = window.setTimeout(() => {
      if (direction < 0) {
        delete mount.dataset.characterJourney;
        if (!activeButton) void finishMoonwalkSettle(direction);
        return;
        }
        frame(actor, 'brake', { direction, role: 0, frameIndex: 0 });
        movementTimer = window.setTimeout(() => {
          frame(actor, 'brake', { direction, role: 0, frameIndex: 1 });
          movementTimer = window.setTimeout(() => {
            delete mount.dataset.characterJourney;
            if (!activeButton) settleAtStation(direction);
          }, 85);
        }, 85);
      }, 110);
    }
  }

  async function demonstrate(button) {
    const act = ACTS[button.dataset.object];
    if (!act || activeButton || !section.matches(':not([inert])')) return;
    activeButton = button;
    button.setAttribute('aria-busy', 'true');
    activeObject = button.dataset.object;
    mount.dataset.characterObject = activeObject;
    mount.dataset.characterService = act.label;
    const duration = reduced() ? 0 : 1;
    const shift = actorShift(actor, button, Math.min(420, innerWidth * .38));
    const direction = shift < 0 ? -1 : act.direction;
    const serviceArt = stationArtState();
    try {
      if (reduced()) {
        replaying.add(button);
        button.click();
        const pressed = button.getAttribute('aria-pressed') === 'true';
        frame(actor, pressed ? 'present' : 'rest', {
          ...serviceArt,
          direction,
          role: pressed ? act.role : 0,
          work: pressed ? 1 : 0,
          propsVisible: pressed,
        });
        return;
      }
      const anticipated = await play(actor, [
        { transform: 'translate3d(0,0,0) rotate(0deg)' },
        { transform: `translate3d(${shift * -.08}px,0,0) rotate(${-direction * 5}deg)` },
      ], { duration: 120 * duration, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' },
      { ...serviceArt, phase: 'anticipate', direction, lean: -5, role: act.role });
      if (!anticipated || activeButton !== button) return;
      const contacted = await play(actor, [
        { transform: `translate3d(${shift * -.08}px,0,0) rotate(${-direction * 5}deg)` },
        { transform: `translate3d(${shift}px,0,0) rotate(${direction * 3}deg)` },
      ], { duration: 300 * duration, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' },
      { ...serviceArt, phase: 'contact', direction, lean: 4, role: act.role, work: .65, propsVisible: true }, true);
      if (!contacted || activeButton !== button) return;
      replaying.add(button);
      button.click();
      const pressed = button.getAttribute('aria-pressed') === 'true';
      frame(actor, 'contact', { ...serviceArt, direction, lean: 4, role: act.role, work: pressed ? 1 : .65, propsVisible: true });
      const held = await play(actor, [
        { transform: `translate3d(${shift}px,0,0) rotate(${direction * 3}deg)` },
        { transform: `translate3d(${shift}px,0,0) rotate(${direction * 3}deg)` },
      ], { duration: 120 * duration, easing: 'linear', fill: 'forwards' },
      { ...serviceArt, phase: 'contact', direction, lean: 4, role: act.role, work: pressed ? 1 : .65, propsVisible: true });
      if (!held || activeButton !== button) return;
      const recovered = await play(actor, [
        { transform: `translate3d(${shift}px,0,0) rotate(${direction * 3}deg)` },
        { transform: 'translate3d(0,0,0) rotate(0deg)' },
      ], { duration: 260 * duration, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' },
      { ...serviceArt, phase: 'settle', direction, role: pressed ? act.role : 0, work: pressed ? .18 : 0, propsVisible: pressed }, true);
      if (recovered && activeButton === button && actor.mount.dataset.characterObject === activeObject) {
        frame(actor, pressed ? 'present' : 'rest', {
          ...serviceArt,
          direction,
          role: pressed ? act.role : 0,
          work: pressed ? .35 : 0,
          propsVisible: pressed,
        });
      }
    } finally {
      if (activeButton === button) {
        button.removeAttribute('aria-busy');
        activeButton = null;
        mount.style.transform = '';
        settleAtStation(direction);
      }
    }
  }

  section.addEventListener('click', event => {
    const button = event.target.closest('[data-object]');
    if (!button || replaying.delete(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    demonstrate(button);
  }, { capture: true });
  window.addEventListener('tva:studio-station', event => {
    void changeStation(Number(event.detail?.index), Number(event.detail?.direction) || 0);
  });
  window.addEventListener('tva:studio-station-intent', event => {
    startIntentTravel(Number(event.detail?.direction) || 1);
  });
  window.addEventListener('scroll', () => {
    if (!stationFrame) stationFrame = requestAnimationFrame(readStation);
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (actor.lastFrame) frame(actor, actor.lastFrame.phase, actor.lastFrame.state);
  });
  readStation();
  actor.reset = () => {
    stationIndex = -1;
    activeObject = '';
    activeButton?.removeAttribute('aria-busy');
    activeButton = null;
    delete mount.dataset.characterObject;
    delete mount.dataset.characterService;
    stop(actor);
    stationChangeVersion += 1;
    changingStation = false;
    intentTravel = false;
    moonwalkDistance = 0;
    moonwalkStationDistance = 480;
    previousTravelDirection = 1;
    clearTimeout(movementTimer);
    delete mount.dataset.characterJourney;
    delete mount.dataset.characterStop;
    mount.style.transform = '';
    frame(actor, 'rest', { role: 0 });
  };
  return actor;
}

function initOriginal(reduced) {
  const section = document.querySelector('#original');
  const mount = section?.querySelector('.original-host');
  if (!section || !mount) return null;
  const actor = makeActor(mount, 'curator');
  const dialog = document.querySelector('.original-dialog');
  const home = mount.parentElement;
  const returnBefore = mount.nextSibling;
  let selected = null;

  async function present(folio) {
    selected = folio;
    mount.dataset.characterWork = folio.dataset.workId;
    const duration = reduced() ? 0 : 1;
    if (dialog?.open) dialog.append(mount);
    const shift = dialog?.open ? 0 : actorShift(actor, folio, Math.min(360, innerWidth * .55));
    const direction = dialog?.open ? -1 : shift < 0 ? -1 : 1;
    const ready = await play(actor, [
      { transform: 'translate3d(0,0,0) rotate(0deg)' },
      { transform: `translate3d(${shift * -.04}px,0,0) rotate(${-direction * 5}deg)` },
    ], { duration: 140 * duration, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' },
    { phase: 'anticipate', direction, lean: -4, role: 3 });
    if (!ready || selected !== folio) return;
    await play(actor, [
      { transform: `translate3d(${shift * -.04}px,0,0) rotate(${-direction * 5}deg)` },
      { transform: `translate3d(${shift}px,0,0) rotate(${direction * 2}deg)` },
    ], { duration: 380 * duration, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' },
    { phase: 'present', direction, lean: 3, role: 3, work: 1, propsVisible: true });
  }

  async function returnCollection() {
    if (!selected) return;
    home.insertBefore(mount, returnBefore);
    const duration = reduced() ? 0 : 1;
    const transform = getComputedStyle(mount).transform;
    await play(actor, [
      { transform: transform === 'none' ? 'translate3d(0,0,0)' : transform },
      { transform: 'translate3d(0,0,0) rotate(0deg)' },
    ], { duration: 260 * duration, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' },
    { phase: 'settle', direction: 1, role: 3, work: .15 });
    selected = null;
    delete mount.dataset.characterWork;
    frame(actor, 'rest', { role: 3 });
  }

  section.addEventListener('click', event => {
    const folio = event.target.closest('.original-folio[data-work-id]');
    if (folio) present(folio);
  });
  dialog?.addEventListener('close', returnCollection);
  function syncSelection() {
    const id = location.hash.slice('#original/'.length);
    const folio = section.querySelector(`[data-work-id="${CSS.escape(id)}"]`);
    if (folio) present(folio);
  }
  window.addEventListener('hashchange', syncSelection);
  syncSelection();
  actor.reset = () => {
    stop(actor);
    if (!home.contains(mount)) home.insertBefore(mount, returnBefore);
    selected = null;
    delete mount.dataset.characterWork;
    mount.style.transform = '';
    frame(actor, 'rest', { role: 3 });
  };
  return actor;
}

let initialized = false;

export function initCharacterDirection() {
  if (initialized) return;
  initialized = true;
  loadStylesheet();
  let reduced = document.documentElement.classList.contains('reduced-motion');
  // about-walk.js 가 ABOUT 캐릭터를 맡으면(정거장 걷기), 옛 ABOUT 배우는 만들지 않는다.
  const aboutWalk = Boolean(document.querySelector('#about[data-walk-strip]')) || Boolean(document.querySelector('script[src^="about-walk.js"]'));
  const actors = [aboutWalk ? null : initAbout(() => reduced), initOriginal(() => reduced)].filter(Boolean);
  const resetActors = () => actors.forEach(actor => {
    if (actor.reset) actor.reset();
    else {
      stop(actor);
      actor.mount.style.transform = '';
      frame(actor, 'rest');
    }
  });
  window.addEventListener('tva:motion', event => {
    reduced = Boolean(event.detail?.reduced);
    resetActors();
  });
  window.addEventListener('tva:restart', resetActors);
  window.addEventListener('tva:navigate', resetActors);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) actors.forEach(actor => {
      stop(actor);
      actor.rig.stop();
    });
  });
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) return;
    const actor = actors.find(item => entry.target.contains(item.mount));
    if (!actor) return;
    if (actor.reset) actor.reset();
    else {
      stop(actor);
      actor.mount.style.transform = '';
      frame(actor, 'rest');
    }
  }), { threshold: 0 });
  ['about', 'original'].forEach(id => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
}
