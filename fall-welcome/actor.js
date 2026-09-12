import {
  ACTOR_ASSET_KIND,
  getActorFrames,
  getActorPose,
  subscribeActorAssetManifest,
} from './actor-assets.js';

export {
  ACTOR_ASSET_KIND,
  ACTOR_GROUP_CONTRACTS,
  actorAssetReady,
  getActorAssetStatus,
  getActorFrames,
  getActorGroupStatus,
  getActorPose,
  installActorAssetManifest,
  installActorAssetManifestFromURL,
  subscribeActorAssetManifest,
} from './actor-assets.js';

const instances = new WeakMap();
const artInstances = new WeakMap();
let actorSequence = 0;

const idleSource = new URL('../assets/goya/idle.png', import.meta.url).href;
const runSource = new URL('../assets/goya/walk1.png', import.meta.url).href;
const inspectSource = new URL('../assets/character-inspect.webp', import.meta.url).href;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (from, to, amount) => from + (to - from) * amount;
const smooth = value => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const local = (progress, from, to) => smooth((progress - from) / (to - from));

function point(x, y) { return { x, y }; }
function blendPoint(a, b, amount) { return point(mix(a.x, b.x, amount), mix(a.y, b.y, amount)); }

const poses = {
  stumble: {
    leftElbow: point(370, 492), leftWrist: point(286, 430),
    rightElbow: point(996, 415), rightWrist: point(1062, 344),
    leftKnee: point(520, 920), leftAnkle: point(460, 1035),
    rightKnee: point(840, 900), rightAnkle: point(915, 1008),
  },
  panicA: {
    leftElbow: point(380, 362), leftWrist: point(324, 226),
    rightElbow: point(976, 306), rightWrist: point(1022, 174),
    leftKnee: point(500, 895), leftAnkle: point(400, 1015),
    rightKnee: point(860, 930), rightAnkle: point(975, 965),
  },
  panicB: {
    leftElbow: point(354, 378), leftWrist: point(300, 246),
    rightElbow: point(998, 335), rightWrist: point(1058, 216),
    leftKnee: point(535, 940), leftAnkle: point(455, 1000),
    rightKnee: point(830, 875), rightAnkle: point(900, 1030),
  },
  brace: {
    leftElbow: point(398, 432), leftWrist: point(472, 354),
    rightElbow: point(944, 405), rightWrist: point(866, 332),
    leftKnee: point(540, 900), leftAnkle: point(485, 1015),
    rightKnee: point(830, 910), rightAnkle: point(905, 1020),
  },
  emerge: {
    leftElbow: point(374, 510), leftWrist: point(306, 438),
    rightElbow: point(994, 442), rightWrist: point(1056, 362),
    leftKnee: point(520, 900), leftAnkle: point(455, 1030),
    rightKnee: point(845, 895), rightAnkle: point(930, 1010),
  },
  recover: {
    leftElbow: point(372, 538), leftWrist: point(292, 558),
    rightElbow: point(994, 492), rightWrist: point(1058, 544),
    leftKnee: point(565, 915), leftAnkle: point(535, 1040),
    rightKnee: point(805, 915), rightAnkle: point(825, 1040),
  },
  wave: {
    leftElbow: point(374, 526), leftWrist: point(292, 546),
    rightElbow: point(980, 340), rightWrist: point(1032, 214),
    leftKnee: point(570, 915), leftAnkle: point(540, 1040),
    rightKnee: point(805, 915), rightAnkle: point(825, 1040),
  },
};

function interpolatePose(a, b, amount) {
  const result = {};
  Object.keys(a).forEach(key => { result[key] = blendPoint(a[key], b[key], amount); });
  return result;
}

function poseAt(progress, reduced) {
  if (reduced) return progress < .84 ? poses.recover : poses.wave;
  if (progress < .08) return interpolatePose(poses.stumble, poses.panicA, local(progress, 0, .08));
  if (progress < .38) {
    const struggle = Math.sin(local(progress, .08, .38) * Math.PI * 3.4);
    return interpolatePose(poses.panicA, poses.panicB, .5 + struggle * .5);
  }
  if (progress < .58) return interpolatePose(poses.panicB, poses.brace, local(progress, .38, .58));
  if (progress < .73) return interpolatePose(poses.brace, poses.emerge, local(progress, .62, .73));
  if (progress < .9) return interpolatePose(poses.emerge, poses.recover, local(progress, .73, .88));
  const lift = local(progress, .9, .935);
  return interpolatePose(poses.recover, poses.wave, lift);
}

function limbPath(shoulder, elbow, wrist) {
  const tangent = point((wrist.x - shoulder.x) * .16, (wrist.y - shoulder.y) * .16);
  return `M${shoulder.x} ${shoulder.y} C${mix(shoulder.x, elbow.x, .55)} ${mix(shoulder.y, elbow.y, .55)} ${elbow.x - tangent.x} ${elbow.y - tangent.y} ${elbow.x} ${elbow.y} C${elbow.x + tangent.x} ${elbow.y + tangent.y} ${mix(elbow.x, wrist.x, .55)} ${mix(elbow.y, wrist.y, .55)} ${wrist.x} ${wrist.y}`;
}

function rotation(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
}

function installStyle(ownerDocument) {
  if (ownerDocument.querySelector('link[data-fall-actor-style]')) return;
  const link = ownerDocument.createElement('link');
  link.dataset.fallActorStyle = '';
  link.rel = 'stylesheet';
  link.href = new URL('./actor.css', import.meta.url).href;
  ownerDocument.head.append(link);
}

function frameAt(frames, { frameIndex, cycleProgress, reduced }) {
  if (!frames.length) return null;
  if (reduced || frames.length === 1) return frames[0];
  if (Number.isInteger(Number(frameIndex))) {
    const index = ((Number(frameIndex) % frames.length) + frames.length) % frames.length;
    return frames[index];
  }
  const cycle = Number(cycleProgress);
  if (!Number.isFinite(cycle)) return frames[0];
  const wrapped = ((cycle % 1) + 1) % 1;
  return frames[Math.min(frames.length - 1, Math.floor(wrapped * frames.length))];
}

export function createArtActor(mount, { group = 'fall', className = '', onActivate = () => {} } = {}) {
  const existing = artInstances.get(mount);
  if (existing) return existing;
  installStyle(mount.ownerDocument);
  const image = mount.ownerDocument.createElement('img');
  image.className = `art-actor__pose ${className}`.trim();
  image.alt = '';
  image.draggable = false;
  image.decoding = 'async';
  image.setAttribute('aria-hidden', 'true');
  mount.append(image);
  mount.dataset.artActorGroup = group;
  mount.dataset.artActorMotionModel = ACTOR_ASSET_KIND;
  let requestedPose = null;
  let activePose = null;
  let requestVersion = 0;
  let lastInput = {};

  function deactivate() {
    activePose = null;
    image.removeAttribute('src');
    delete mount.dataset.artActorReady;
    delete mount.dataset.artActorPose;
  }

  function activate(pose, version) {
    if (version !== requestVersion || requestedPose !== pose) return;
    if (image.naturalWidth !== pose.width || image.naturalHeight !== pose.height) {
      deactivate();
      mount.dataset.artActorError = 'intrinsic-size-mismatch';
      return;
    }
    activePose = pose;
    image.width = pose.width;
    image.height = pose.height;
    image.style.aspectRatio = `${pose.width} / ${pose.height}`;
    mount.dataset.artActorReady = '';
    mount.dataset.artActorPose = pose.id;
    delete mount.dataset.artActorError;
    onActivate();
  }

  function requestPose(pose) {
    if (!pose) {
      requestedPose = null;
      requestVersion += 1;
      deactivate();
      return;
    }
    if (pose === requestedPose && activePose === pose) return;
    requestedPose = pose;
    const version = ++requestVersion;
    const nextImage = new Image();
    const fail = () => {
      if (version !== requestVersion) return;
      requestedPose = activePose;
      mount.dataset.artActorError = 'load-failed';
    };
    nextImage.onerror = fail;
    nextImage.src = pose.src;
    void nextImage.decode().then(() => {
      if (version !== requestVersion || requestedPose !== pose) return;
      if (nextImage.naturalWidth !== pose.width || nextImage.naturalHeight !== pose.height) {
        requestedPose = activePose;
        mount.dataset.artActorError = 'intrinsic-size-mismatch';
        return;
      }
      image.onload = () => activate(pose, version);
      image.src = pose.src;
      if (image.complete && image.naturalWidth === pose.width && image.naturalHeight === pose.height) {
        activate(pose, version);
      }
    }).catch(fail);
  }

  function draw({ poseId, state, frameIndex, cycleProgress, progress = 0, reduced = false } = {}) {
    lastInput = { poseId, state, frameIndex, cycleProgress, progress, reduced };
    const explicit = poseId ? getActorPose(poseId) : null;
    const frames = state ? getActorFrames(group, state) : [];
    const pose = explicit?.group === group
      ? explicit
      : frameAt(frames, { frameIndex, cycleProgress, reduced: Boolean(reduced) });
    requestPose(pose);
    const shown = activePose;
    return {
      available: Boolean(shown),
      requestedPoseId: pose?.id || null,
      poseId: shown?.id || null,
      group,
      state: shown?.state || null,
      frameIndex: shown?.order ?? null,
      progress: clamp(Number(progress) || 0),
      reduced: Boolean(reduced),
      footAnchor: shown?.footAnchor || null,
      bodyAnchor: shown?.bodyAnchor || null,
      bounds: shown?.bounds || null,
      intrinsicSize: shown ? { width: shown.width, height: shown.height } : null,
      motionModel: ACTOR_ASSET_KIND,
    };
  }

  const unsubscribe = subscribeActorAssetManifest(groups => {
    if (groups.includes(group)) draw(lastInput);
  });

  function dispose() {
    unsubscribe();
    requestVersion += 1;
    image.onload = null;
    image.onerror = null;
    image.remove();
    delete mount.dataset.artActorGroup;
    delete mount.dataset.artActorMotionModel;
    delete mount.dataset.artActorReady;
    delete mount.dataset.artActorPose;
    delete mount.dataset.artActorError;
    artInstances.delete(mount);
  }

  const api = { draw, dispose };
  artInstances.set(mount, api);
  return api;
}

export function createFallActor(mount, wake = () => {}) {
  const existing = instances.get(mount);
  if (existing) return existing;
  installStyle(mount.ownerDocument);
  const id = `fall-actor-${++actorSequence}`;
  mount.insertAdjacentHTML('beforeend', `<svg class="fall-actor fall-actor--legacy" viewBox="0 0 1331 1182" preserveAspectRatio="xMidYMid meet" role="img" aria-label="낙하 후 손을 흔드는 원본 CRT 캐릭터">
    <defs>
      <clipPath id="${id}-torso"><path d="M305 92Q315 70 385 55L715 55Q760 56 800 91L862 144 823 286 796 528 858 687Q861 738 820 768L420 778Q365 771 350 734Z"/></clipPath>
      <clipPath id="${id}-concerned-face"><path d="M558 286Q572 270 606 267L858 267Q895 273 902 304L906 449Q901 501 857 521L620 524Q573 514 561 473Z"/></clipPath>
      <clipPath id="${id}-left-hand"><path d="M58 399H326V629H58Z"/></clipPath>
      <clipPath id="${id}-right-hand"><path d="M922 408Q935 390 972 391L1027 402Q1064 421 1077 459L1068 535Q1048 579 998 584L947 568Q919 540 916 492Z"/></clipPath>
      <clipPath id="${id}-left-shoe"><path d="M188 947H466V1138H188Z"/></clipPath>
      <clipPath id="${id}-right-shoe"><path d="M744 941H1042V1134H744Z"/></clipPath>
      <filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="3" dy="8" stdDeviation="5" flood-color="#0b0c10" flood-opacity=".28"/></filter>
    </defs>
    <g class="fall-actor__root" filter="url(#${id}-shadow)">
      <g class="fall-actor__legs">
        <path class="fall-actor__limb fall-actor__limb--outline" data-limb="left-leg"/><path class="fall-actor__limb fall-actor__limb--fill" data-limb="left-leg-fill"/>
        <path class="fall-actor__limb fall-actor__limb--outline" data-limb="right-leg"/><path class="fall-actor__limb fall-actor__limb--fill" data-limb="right-leg-fill"/>
        <g data-part="left-shoe" clip-path="url(#${id}-left-shoe)"><image href="${inspectSource}" width="1254" height="1254"/></g>
        <g data-part="right-shoe" clip-path="url(#${id}-right-shoe)"><image href="${inspectSource}" width="1254" height="1254"/></g>
      </g>
      <g class="fall-actor__arms fall-actor__arms--behind">
        <path class="fall-actor__limb fall-actor__limb--outline" data-limb="left-arm"/><path class="fall-actor__limb fall-actor__limb--fill" data-limb="left-arm-fill"/>
        <path class="fall-actor__limb fall-actor__limb--outline" data-limb="right-arm"/><path class="fall-actor__limb fall-actor__limb--fill" data-limb="right-arm-fill"/>
      </g>
      <g transform="translate(100 0)"><image class="fall-actor__torso" href="${runSource}" width="1254" height="1254" clip-path="url(#${id}-torso)"/></g>
      <g class="fall-actor__concerned-face">
        <image href="${inspectSource}" width="1254" height="1254" transform="translate(-100 -20)" clip-path="url(#${id}-concerned-face)"/>
      </g>
      <g class="fall-actor__hands">
        <g data-part="left-hand" clip-path="url(#${id}-left-hand)"><image href="${idleSource}" width="1331" height="1182"/></g>
        <g data-part="right-hand" clip-path="url(#${id}-left-hand)"><image href="${idleSource}" width="1331" height="1182"/></g>
        <g data-part="right-wave-hand" clip-path="url(#${id}-left-hand)"><image href="${idleSource}" width="1331" height="1182"/></g>
      </g>
    </g>
  </svg>`);

  const svg = mount.querySelector(':scope > .fall-actor:last-child');
  const root = svg.querySelector('.fall-actor__root');
  const limb = name => svg.querySelector(`[data-limb="${name}"]`);
  const part = name => svg.querySelector(`[data-part="${name}"]`);
  const shoulders = { left: point(446, 514), right: point(930, 418) };
  const hips = { left: point(585, 758), right: point(795, 758) };
  const concernedFace = svg.querySelector('.fall-actor__concerned-face');
  const artActor = createArtActor(mount, { group: 'fall', className: 'fall-actor fall-actor--delivered', onActivate: wake });
  let previousProgress = 0;
  let waveStartedAt = null;

  function draw({ progress = 0, nowMs = 0, reduced = false, phase = '', waveProgress } = {}) {
    const p = clamp(Number(progress) || 0);
    const isReduced = Boolean(reduced);
    const hasExternalWave = Number.isFinite(Number(waveProgress));
    if (p < .9) waveStartedAt = null;
    else if (!hasExternalWave && (waveStartedAt === null || previousProgress < .9)) waveStartedAt = Number(nowMs) || 0;
    const greetingProgress = hasExternalWave
      ? clamp(Number(waveProgress))
      : waveStartedAt === null ? 0 : clamp(((Number(nowMs) || 0) - waveStartedAt) / 1800);
    const liftProgress = smooth(clamp(greetingProgress / .18));
    let pose = poseAt(p, isReduced);
    if (p >= .9) pose = interpolatePose(poses.recover, poses.wave, liftProgress);
    const bodyFall = p < .73 ? Math.sin(local(p, .08, .73) * Math.PI * 2.1) * 4 : 0;
    const recover = local(p, .73, .9);
    const bodyAngle = p < .08 ? mix(-4, 8, local(p, 0, .08)) : mix(bodyFall, 0, recover);
    const bodyY = p < .62 ? Math.sin(p * 35) * (isReduced ? 0 : 5) : mix(8, 0, recover);

    const waveTime = clamp((greetingProgress - .18) / .82);
    const waveEnvelope = Math.sin(waveTime * Math.PI);
    const waveOscillation = Math.sin(waveTime * Math.PI * 5) * waveEnvelope * (isReduced ? 0 : 1);
    const waveCycles = waveOscillation * 70;
    const wristWave = waveOscillation * 18;
    if (p >= .9 && liftProgress > 0) {
      pose.rightWrist = point(1032 + waveCycles, 214 + Math.abs(waveCycles) * .12);
      pose.rightElbow = point(980 + waveCycles * .12, 340);
    }

    const leftArmD = limbPath(shoulders.left, pose.leftElbow, pose.leftWrist);
    const rightArmD = limbPath(shoulders.right, pose.rightElbow, pose.rightWrist);
    const leftLegD = limbPath(hips.left, pose.leftKnee, pose.leftAnkle);
    const rightLegD = limbPath(hips.right, pose.rightKnee, pose.rightAnkle);
    [['left-arm', leftArmD], ['left-arm-fill', leftArmD], ['right-arm', rightArmD], ['right-arm-fill', rightArmD], ['left-leg', leftLegD], ['left-leg-fill', leftLegD], ['right-leg', rightLegD], ['right-leg-fill', rightLegD]].forEach(([name, d]) => limb(name).setAttribute('d', d));

    part('left-hand').setAttribute('transform', `translate(${pose.leftWrist.x} ${pose.leftWrist.y}) rotate(${rotation(pose.leftElbow, pose.leftWrist) - 180}) scale(.82) translate(-289 -520)`);
    part('right-hand').setAttribute('transform', `translate(${pose.rightWrist.x} ${pose.rightWrist.y}) rotate(${rotation(pose.rightElbow, pose.rightWrist) + 8}) scale(-.78 .78) translate(-289 -520)`);
    const useOpenWaveHand = liftProgress >= .45;
    part('right-hand').style.opacity = useOpenWaveHand ? '0' : '1';
    part('right-wave-hand').style.opacity = useOpenWaveHand ? '1' : '0';
    part('right-wave-hand').setAttribute('transform', `translate(${pose.rightWrist.x} ${pose.rightWrist.y}) rotate(${rotation(pose.rightElbow, pose.rightWrist) + 8 + wristWave}) scale(-.82 .82) translate(-289 -520)`);
    part('left-shoe').setAttribute('transform', `translate(${pose.leftAnkle.x} ${pose.leftAnkle.y}) rotate(${rotation(pose.leftKnee, pose.leftAnkle) - 88}) scale(.82) translate(-382 -1000)`);
    part('right-shoe').setAttribute('transform', `translate(${pose.rightAnkle.x} ${pose.rightAnkle.y}) rotate(${rotation(pose.rightKnee, pose.rightAnkle) - 92}) scale(.82) translate(-840 -1000)`);
    root.setAttribute('transform', `translate(0 ${bodyY}) rotate(${bodyAngle} 700 610)`);
    concernedFace.style.opacity = String(1 - local(p, .78, .83));

    mount.dataset.fallActorPhase = phase || (p < .08 ? 'stumble' : p < .52 ? 'panic' : p < .62 ? 'brace' : p < .84 ? 'emerge' : p < .9 ? 'recover' : greetingProgress === 0 ? 'recover' : liftProgress < 1 ? 'greet' : waveTime < 1 ? 'wave' : 'settled');
    mount.style.setProperty('--fall-actor-time', `${Number(nowMs) || 0}ms`);
    let artState = 'relief';
    let artCycle = 0;
    if (p < .08) artState = 'surprise';
    else if (p < .38) {
      artState = 'flail';
      artCycle = local(p, .08, .38) * 3.4;
    } else if (p < .58) {
      artState = 'flail';
      artCycle = local(p, .38, .58) * 2.2 + 3.4;
    } else if (p < .74) artState = 'tuck';
    else if (p < .9 || greetingProgress === 0) artState = 'relief';
    else {
      artState = 'wave';
      artCycle = waveTime * 2.5;
    }
    const delivered = artActor.draw({
      state: artState,
      cycleProgress: artCycle,
      progress: p,
      reduced: isReduced,
    });
    previousProgress = p;
    return {
      progress: p,
      phase: mount.dataset.fallActorPhase,
      footAnchor: delivered.footAnchor || { x: (pose.leftAnkle.x + pose.rightAnkle.x) / 2662, y: Math.max(pose.leftAnkle.y, pose.rightAnkle.y) / 1182 },
      bodyAnchor: delivered.bodyAnchor || { x: .525, y: .42 },
      bounds: delivered.bounds || { left: .09, top: .06, right: .91, bottom: .96 },
      intrinsicSize: delivered.intrinsicSize || { width: 1331, height: 1182 },
      camera: 'front-three-quarter-only',
      poseId: delivered.poseId,
      representation: delivered.available ? ACTOR_ASSET_KIND : 'legacy-segmented-fallback',
    };
  }

  function dispose() {
    artActor.dispose();
    svg.remove();
    delete mount.dataset.fallActorPhase;
    instances.delete(mount);
  }

  const api = { draw, dispose };
  instances.set(mount, api);
  draw();
  return api;
}
