const instances = new WeakMap();
let sequence = 0;
const runUrl = new URL('./assets/goya/walk1.png?v=eternal-beam-r51', import.meta.url);
runUrl.searchParams.set('v', 'eternal-beam-r18');
const idleUrl = new URL('./assets/goya/idle.png?v=eternal-beam-r51', import.meta.url);
idleUrl.searchParams.set('v', 'eternal-beam-r18');
const runSource = runUrl.href;
const idleSource = idleUrl.href;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const poseState = {
  read: { energy: 0, lean: 0 },
  browse: { energy: .08, lean: -6, work: .12 },
  find: { energy: .12, lean: 5, work: .55 },
  present: { energy: .08, lean: 4, work: 1 },
  walk: { energy: .72, lean: 3 },
  fall: { energy: .48, fall: 1 },
  catch: { energy: .32, lean: -8, brace: .72 },
  recover: { energy: .1, lean: 2, brace: .28 },
  flight: { energy: .12, lean: -4, flight: 1 },
  greet: { energy: .04, lean: 0, greet: 1, wave: Math.PI * .45 },
  yield: { energy: .04, lean: -5, work: .3 },
  leave: { energy: .58, lean: 7 },
};

function installGalleryStyle(ownerDocument) {
  if (ownerDocument.querySelector('style[data-crt-rig-style]')) return;
  const style = ownerDocument.createElement('style');
  style.dataset.crtRigStyle = '';
  style.textContent = `
    [data-crt-rig] > .character-rig { pointer-events: none; }
    .g02-puller[data-crt-rig] > .character-rig {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
      opacity: 1;
      filter: drop-shadow(3px 6px 2px rgb(23 25 35 / .18));
    }
  `;
  ownerDocument.head.append(style);
}

// The original PNG remains the art source. SVG clipping exposes its existing
// limbs as joints without redrawing or replacing the established CRT identity.
export function createCharacterRig(mount) {
  const existing = instances.get(mount);
  if (existing) return existing;

  installGalleryStyle(mount.ownerDocument);
  const id = `crt-${++sequence}`;
  mount.insertAdjacentHTML('beforeend', `<svg class="character-rig" viewBox="0 0 1254 1254" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id="${id}-moonwalk-upper"><path d="M0 0H1254V560H900V690L870 708L800 742L775 758L435 799Q416 803 410 783L400 755L350 740H0Z"/></clipPath>
      <clipPath id="${id}-body"><path d="M305 100H795L869 330 895 711 790 761 408 813 356 747Z"/></clipPath>
      <clipPath id="${id}-left-leg"><path d="M397 767 548 741 660 761 604 932 518 1148 205 1148 201 930Z"/></clipPath>
      <clipPath id="${id}-right-leg"><path d="M678 737 785 654 902 620 1168 629 1168 905 773 905Z"/></clipPath>
      <clipPath id="${id}-left-foot"><path d="M565 995Q600 980 655 995L720 1005Q795 1025 797 1110Q690 1140 580 1110L551 1090Q545 1042 565 995Z"/></clipPath>
      <clipPath id="${id}-right-foot"><path d="M565 995Q600 980 655 995L720 1005Q795 1025 797 1110Q690 1140 580 1110L551 1090Q545 1042 565 995Z"/></clipPath>
      <clipPath id="${id}-left-arm"><path d="M117 461 291 459 374 606 342 690 103 691Z"/></clipPath>
      <clipPath id="${id}-right-arm"><path d="M799 350 883 278 1098 310 1122 503 951 532 850 446Z"/></clipPath>
      <clipPath id="${id}-wave-arm"><path d="M54 382 255 382 323 492 375 520 375 610 306 631 233 613 55 613Z"/></clipPath>
      <mask id="${id}-exclude-body" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
        <rect width="1254" height="1254" fill="white"/>
        <path d="M292 82H805L884 316 912 742 801 815 394 832 337 756 292 174Z" fill="black"/>
      </mask>
      <mask id="${id}-left-upper" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
        <rect width="1254" height="1254" fill="white"/>
        <path d="M292 82H805L884 316 912 742 801 815 394 832 337 756 292 174Z" fill="black"/>
        <path d="M145 900H525V1180H145Z" fill="black"/>
      </mask>
      <mask id="${id}-right-upper" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
        <rect width="1254" height="1254" fill="white"/>
        <path d="M292 82H805L884 316 912 742 801 815 394 832 337 756 292 174Z" fill="black"/>
        <path d="M815 560H1205V935H815Z" fill="black"/>
      </mask>
    </defs>
    <g class="rig-facing">
      <g class="rig-left-leg"><path class="rig-joint" d="M541 772Q548 806 526 844" fill="none" stroke="#171923" stroke-width="50" stroke-linecap="round"/><path class="rig-joint" d="M541 772Q548 806 526 844" fill="none" stroke="#60300f" stroke-width="31" stroke-linecap="round"/><image data-rig-limb href="${runSource}" width="1254" height="1254" clip-path="url(#${id}-left-leg)"/></g>
      <g class="rig-right-leg"><path class="rig-joint" d="M733 755Q769 759 800 781" fill="none" stroke="#171923" stroke-width="50" stroke-linecap="round"/><path class="rig-joint" d="M733 755Q769 759 800 781" fill="none" stroke="#60300f" stroke-width="31" stroke-linecap="round"/><image data-rig-limb href="${runSource}" width="1254" height="1254" clip-path="url(#${id}-right-leg)"/></g>
      <g class="rig-left-foot"><g class="rig-left-foot-motion"><image data-rig-foot href="${idleSource}" width="1331" height="1182" clip-path="url(#${id}-left-foot)"/></g></g>
      <g class="rig-right-foot"><g class="rig-right-foot-motion"><image data-rig-foot href="${idleSource}" width="1331" height="1182" clip-path="url(#${id}-right-foot)"/></g></g>
      <g class="rig-moonwalk-connectors"><path class="rig-moonwalk-leg-dark" d="M556 786 330 960" fill="none" stroke="#171923" stroke-width="50" stroke-linecap="round"/><path class="rig-moonwalk-leg-brown" d="M556 786 330 960" fill="none" stroke="#60300f" stroke-width="31" stroke-linecap="round"/><path class="rig-moonwalk-leg-dark" d="M744 757 940 760" fill="none" stroke="#171923" stroke-width="50" stroke-linecap="round"/><path class="rig-moonwalk-leg-brown" d="M744 757 940 760" fill="none" stroke="#60300f" stroke-width="31" stroke-linecap="round"/></g>
      <g class="rig-moonwalk-upper" style="display:none" transform="translate(0 75) rotate(-2 618 780)"><image href="${runSource}" width="1254" height="1254" clip-path="url(#${id}-moonwalk-upper)"/></g>
      <g class="rig-torso">
        <g class="rig-left-arm"><path class="rig-joint" d="M352 613Q327 626 303 647" fill="none" stroke="#171923" stroke-width="43" stroke-linecap="round"/><path class="rig-joint" d="M352 613Q327 626 303 647" fill="none" stroke="#60300f" stroke-width="26" stroke-linecap="round"/><image data-rig-limb href="${runSource}" width="1254" height="1254" clip-path="url(#${id}-left-arm)"/></g>
        <g class="rig-wave-arm" opacity="0"><path d="M352 619Q327 614 304 599" fill="none" stroke="#171923" stroke-width="43" stroke-linecap="round"/><path d="M352 619Q327 614 304 599" fill="none" stroke="#60300f" stroke-width="26" stroke-linecap="round"/><g transform="translate(-42 57)" clip-path="url(#${id}-wave-arm)"><image href="${idleSource}" width="1331" height="1182"/></g></g>
        <g class="rig-right-arm-root rig-joint"><path d="M814 389Q828 362 852 341" fill="none" stroke="#171923" stroke-width="43" stroke-linecap="round"/><path d="M814 389Q828 362 852 341" fill="none" stroke="#60300f" stroke-width="26" stroke-linecap="round"/></g>
        <image href="${runSource}" width="1254" height="1254" clip-path="url(#${id}-body)"/>
        <g class="rig-right-arm"><image data-rig-limb href="${runSource}" width="1254" height="1254" clip-path="url(#${id}-right-arm)"/></g>
        <g class="rig-prop rig-pencil"><path d="m926 235 65-15 111 367-17 72-49-52Z" fill="#f4ff74" stroke="#171923" stroke-width="12"/><path d="m1036 607 49 52 17-72" fill="#c5b397" stroke="#171923" stroke-width="10"/></g>
        <g class="rig-prop rig-ruler"><path d="m914 301 93-25 127 480-94 25Z" fill="#c8a15e" stroke="#171923" stroke-width="10"/><path d="m940 380 42-12m-29 62 27-8m-14 60 43-12m-30 62 27-8m-14 60 43-12m-30 62 27-8m-14 60 43-12" stroke="#fff" stroke-width="9"/></g>
        <g class="rig-prop rig-sample"><path d="m886 375 205-35 27 174-204 33Z" fill="#c5b397" stroke="#171923" stroke-width="10"/><path d="m886 375 67-56 201 6-63 15m27 174 39-57-3-132m-201-6 5 46" fill="#fff" stroke="#171923" stroke-width="10"/></g>
        <g class="rig-prop rig-flag"><path d="m995 545-56-346" stroke="#171923" stroke-width="16"/><path d="m939 199 238-45-33 92 57 60-235 49Z" fill="#c8a15e" stroke="#171923" stroke-width="10"/><path d="m992 260 133-25m-45-25 46 25-32 41" fill="none" stroke="#fff" stroke-width="14"/></g>
      </g>
    </g>
  </svg>`);

  mount.dataset.crtRig = '';
  const svg = mount.querySelector(':scope > .character-rig:last-child');
  const facing = svg.querySelector('.rig-facing');
  const torso = svg.querySelector('.rig-torso');
  const leftLeg = svg.querySelector('.rig-left-leg');
  const rightLeg = svg.querySelector('.rig-right-leg');
  const leftArm = svg.querySelector('.rig-left-arm');
  const leftFoot = svg.querySelector('.rig-left-foot');
  const leftFootMotion = svg.querySelector('.rig-left-foot-motion');
  const waveArm = svg.querySelector('.rig-wave-arm');
  const rightArm = svg.querySelector('.rig-right-arm');
  const rightFoot = svg.querySelector('.rig-right-foot');
  const rightFootMotion = svg.querySelector('.rig-right-foot-motion');
  const moonwalkConnectors = svg.querySelector('.rig-moonwalk-connectors');
  const moonwalkUpper = svg.querySelector('.rig-moonwalk-upper');
  const connectorPaths = [...svg.querySelectorAll('.rig-moonwalk-leg-dark, .rig-moonwalk-leg-brown')];
  const rightArmRoot = svg.querySelector('.rig-right-arm-root');
  const props = [...svg.querySelectorAll('.rig-prop')];
  const limbImages = [...svg.querySelectorAll('[data-rig-limb]')];
  const footImages = [...svg.querySelectorAll('[data-rig-foot]')];
  const jointConnectors = [...svg.querySelectorAll('.rig-joint')];
  const shadow = mount.querySelector('.host-shadow');
  let category = 0;
  let propsVisible = false;
  let poseToken = 0;
  let settleTimer = 0;
  let moonwalkRootSource = 0;

  const reduced = () => mount.ownerDocument.documentElement.classList.contains('reduced-motion')
    || Boolean(mount.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const rotatePoint = (point, degrees, pivot) => {
    const radians = degrees * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const x = point.x - pivot.x;
    const y = point.y - pivot.y;
    return { x: pivot.x + x * cosine - y * sine, y: pivot.y + x * sine + y * cosine };
  };

  function placeMoonwalkFoot(group, imageGroup, source, x, heel, groundY = 1138) {
    const angle = source.angle + heel;
    group.setAttribute('transform', `translate(${x} ${groundY}) rotate(${angle}) translate(${-source.toe.x} ${-source.toe.y})`);
    imageGroup.removeAttribute('transform');
    const ankle = rotatePoint(source.ankle, angle, source.toe);
    return { x: x + ankle.x - source.toe.x, y: groundY + ankle.y - source.toe.y };
  }

  const setConnector = (path, start, end) => {
    const control = { x: (start.x + end.x) * .5 + 35, y: (start.y + end.y) * .5 };
    path.setAttribute('d', `M${start.x.toFixed(2)} ${start.y.toFixed(2)} Q${control.x.toFixed(2)} ${control.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`);
  };

  function renderProps() {
    props.forEach((prop, index) => {
      prop.style.display = propsVisible && index === category ? '' : 'none';
    });
  }

  function draw({ phase = 0, energy = 0, direction = 1, lean = 0, role, work = 0, fall = 0, brace = 0, contact = 0, descent = null, flight = 0, greet = 0, wave = 0, damping = 1, moonwalk = false, moonwalkStride = 200, pose = '' } = {}) {
    if (Number.isInteger(role)) category = clamp(role - 1, 0, 3);
    const motion = reduced() ? 0 : 1;
    const step = Math.sin(phase) * motion;
    const opposite = Math.sin(phase + Math.PI) * motion;
    const activeEnergy = clamp(energy) * motion * clamp(damping, .3, 1);
    const fallAmount = clamp(fall) * motion;
    const braceAmount = clamp(brace) * motion;
    const contactAmount = clamp(contact) * motion;
    const flightAmount = clamp(flight) * motion;
    const greetAmount = clamp(greet) * motion;
    const passagePose = flightAmount > .001 || greetAmount > .001;
    const stride = activeEnergy * 31;
    const bounce = Math.abs(Math.sin(phase * 2)) * activeEnergy * 24;
    const turn = moonwalk ? 1 : direction < 0 ? -1 : 1;

    limbImages.forEach(image => {
      const legSide = image.closest('.rig-left-leg') ? 'left' : image.closest('.rig-right-leg') ? 'right' : '';
      image.style.opacity = moonwalk && legSide ? '0' : '';
      if (moonwalk && legSide) image.setAttribute('mask', `url(#${id}-${legSide}-upper)`);
      else if (passagePose || moonwalk) image.setAttribute('mask', `url(#${id}-exclude-body)`);
      else image.removeAttribute('mask');
    });
    footImages.forEach(image => {
      if (moonwalk) image.setAttribute('mask', `url(#${id}-exclude-body)`);
      else image.removeAttribute('mask');
    });
    leftFoot.style.display = moonwalk ? '' : 'none';
    rightFoot.style.display = moonwalk ? '' : 'none';
    moonwalkConnectors.style.display = moonwalk ? '' : 'none';
    moonwalkUpper.style.display = moonwalk ? '' : 'none';
    torso.style.visibility = moonwalk ? 'hidden' : '';
    jointConnectors.forEach(connector => connector.setAttribute('opacity', passagePose || moonwalk ? '1' : '0'));

    leftArm.setAttribute('opacity', '1');
    waveArm.setAttribute('opacity', '0');

    const boundedMoonwalkPhase = clamp(Number(phase) || 0, 0, Math.PI * 2);
    const moonwalkHalf = moonwalk ? boundedMoonwalkPhase / Math.PI : 0;
    const moonwalkHalfIndex = Math.floor(moonwalkHalf);
    const moonwalkHalfT = ((moonwalkHalf % 1) + 1) % 1;
    const moonwalkGlide = clamp(moonwalkHalfT / .8);
    const moonwalkStrideSource = clamp(Number(moonwalkStride) || 200, 1, 200);
    const bodyBack = moonwalk ? -moonwalkStrideSource * (moonwalkHalfIndex + moonwalkGlide) * motion : 0;
    moonwalkRootSource = bodyBack;
    facing.setAttribute('transform', `translate(${bodyBack + (turn < 0 ? 1254 : 0)} 0) scale(${turn} 1)`);
    leftLeg.setAttribute('transform', `translate(0 ${contactAmount * 20 - Math.max(0, step) * activeEnergy * 28}) rotate(${15 + step * stride + fallAmount * 58 - braceAmount * 58 + contactAmount * 18} 556 786)`);
    rightLeg.setAttribute('transform', `translate(0 ${contactAmount * 20 - Math.max(0, opposite) * activeEnergy * 28}) rotate(${-42 + opposite * stride - fallAmount * 55 + braceAmount * 74 - contactAmount * 12} 744 757)`);
    torso.setAttribute('transform', `translate(0 ${contactAmount * 30 - bounce}) rotate(${lean * turn + work * -7 + fallAmount * step * 5} 618 780)`);
    leftArm.setAttribute('transform', `rotate(${-step * activeEnergy * 20 + work * 18 - fallAmount * 62 + braceAmount * 82 - contactAmount * 18} 343 623)`);
    rightArm.setAttribute('transform', `rotate(${step * activeEnergy * 22 - work * 20 + fallAmount * 74 - braceAmount * 66 + contactAmount * 16} 824 377)`);
    rightArmRoot.setAttribute('transform', rightArm.getAttribute('transform'));
    if (moonwalk) {
      const half = moonwalkHalfIndex % 2 === 0;
      const glide = moonwalkGlide;
      const transfer = clamp((moonwalkHalfT - .8) / .2);
      const blend = transfer * transfer * (3 - 2 * transfer);
      const base = 780 - moonwalkStrideSource / 2;
      const a = base + moonwalkStrideSource * (1 - glide);
      const b = base + moonwalkStrideSource * glide;
      const leftPosition = half ? a : b;
      const rightPosition = half ? b : a;
      const leftHeel = half ? blend * 26 * motion : (1 - blend) * 26 * motion;
      const rightHeel = half ? (1 - blend) * 26 * motion : blend * 26 * motion;
      const leftAnkle = placeMoonwalkFoot(leftFoot, leftFootMotion,
        { toe: { x: 785, y: 1106 }, ankle: { x: 618, y: 1005 }, angle: 0 },
        leftPosition, leftHeel, 1124);
      const rightAnkle = placeMoonwalkFoot(rightFoot, rightFootMotion,
        { toe: { x: 785, y: 1106 }, ankle: { x: 618, y: 1005 }, angle: 0 },
        rightPosition, rightHeel, 1138);
      leftLeg.style.visibility = 'hidden';
      rightLeg.style.visibility = 'hidden';
      const weight = (half ? blend : 1 - blend) * 2 - 1;
      const upperAngle = -2 + weight * 1.8 * motion;
      const upperX = weight * 5 * motion;
      const upperY = 75 - Math.abs(weight) * 2 * motion;
      moonwalkUpper.setAttribute('transform', `translate(${upperX} ${upperY}) rotate(${upperAngle} 618 780)`);
      const leftHip = rotatePoint({ x: 600, y: 786 }, upperAngle, { x: 618, y: 780 });
      const rightHip = rotatePoint({ x: 700, y: 757 }, upperAngle, { x: 618, y: 780 });
      leftHip.x += upperX;
      leftHip.y += upperY;
      rightHip.x += upperX;
      rightHip.y += upperY;
      setConnector(connectorPaths[0], leftHip, leftAnkle);
      setConnector(connectorPaths[1], leftHip, leftAnkle);
      setConnector(connectorPaths[2], rightHip, rightAnkle);
      setConnector(connectorPaths[3], rightHip, rightAnkle);
      torso.setAttribute('transform', 'translate(0 75) rotate(-2 618 780)');
      leftArm.setAttribute('transform', 'rotate(-5 343 623)');
      rightArm.setAttribute('transform', 'rotate(5 824 377)');
      rightArmRoot.setAttribute('transform', rightArm.getAttribute('transform'));
    } else {
      leftLeg.style.visibility = '';
      rightLeg.style.visibility = '';
    }
    if (descent && motion) {
      const progress = clamp(descent.progress);
      const open = clamp(progress / .28);
      const extend = clamp((progress - .08) / .5);
      const weight = clamp(descent.release) * (1 - braceAmount) * (1 - contactAmount);
      const blend = (rest, falling) => rest + (falling - rest) * weight;
      const leftLegAngle = blend(15 + step * stride + fallAmount * 58 - braceAmount * 58 + contactAmount * 18, 20 - extend * 45);
      const rightLegAngle = blend(-42 + opposite * stride - fallAmount * 55 + braceAmount * 74 - contactAmount * 12, -30 + extend * 95);
      const leftArmAngle = blend(-step * activeEnergy * 20 + work * 18 - fallAmount * 62 + braceAmount * 82 - contactAmount * 18, -85 - open * 25 + extend * 15);
      const rightArmAngle = blend(step * activeEnergy * 22 - work * 20 + fallAmount * 74 - braceAmount * 66 + contactAmount * 16, 35 + open * 25 - extend * 15);
      leftLeg.setAttribute('transform', `translate(0 ${(contactAmount * 20 - Math.max(0, step) * activeEnergy * 28) * (1 - weight)}) rotate(${leftLegAngle} 556 786)`);
      rightLeg.setAttribute('transform', `translate(0 ${(contactAmount * 20 - Math.max(0, opposite) * activeEnergy * 28) * (1 - weight)}) rotate(${rightLegAngle} 744 757)`);
      torso.setAttribute('transform', `translate(0 ${contactAmount * 30 - bounce * (1 - weight)}) rotate(${lean * turn + (work * -7 + fallAmount * step * 5) * (1 - weight)} 618 780)`);
      leftArm.setAttribute('transform', `rotate(${leftArmAngle} 343 623)`);
      rightArm.setAttribute('transform', `rotate(${rightArmAngle} 824 377)`);
      rightArmRoot.setAttribute('transform', rightArm.getAttribute('transform'));
    }
    if (flightAmount > 0) {
      const tuckProgress = clamp((flightAmount - .08) / .7);
      const tuck = tuckProgress * tuckProgress * (3 - 2 * tuckProgress);
      const flutter = step * activeEnergy * 20;
      leftLeg.setAttribute('transform', `translate(0 ${-tuck * 12}) rotate(${15 - tuck * 52 + flutter} 556 786)`);
      rightLeg.setAttribute('transform', `translate(0 ${-tuck * 8}) rotate(${-42 + tuck * 88 - flutter * .8} 744 757)`);
      torso.setAttribute('transform', `translate(0 ${-bounce * .35}) rotate(${lean * turn - flightAmount * 5} 618 780)`);
      leftArm.setAttribute('transform', `rotate(${-18 - flightAmount * 34 - flutter * .35 + braceAmount * 70} 343 623)`);
      rightArm.setAttribute('transform', `rotate(${14 + flightAmount * 38 + flutter * .4 - braceAmount * 64} 824 377)`);
      rightArmRoot.setAttribute('transform', rightArm.getAttribute('transform'));
    }
    if (greetAmount > 0) {
      const blend = (from, to) => from + (to - from) * greetAmount;
      const tuckProgress = clamp((flightAmount - .08) / .7);
      const tuck = tuckProgress * tuckProgress * (3 - 2 * tuckProgress);
      const flutter = step * activeEnergy * 20;
      const baseLeftLeg = 15 + step * stride + fallAmount * 58 - braceAmount * 58 + contactAmount * 18;
      const baseRightLeg = -42 + opposite * stride - fallAmount * 55 + braceAmount * 74 - contactAmount * 12;
      const baseLeftArm = -step * activeEnergy * 20 + work * 18 - fallAmount * 62 + braceAmount * 82 - contactAmount * 18;
      const baseRightArm = step * activeEnergy * 22 - work * 20 + fallAmount * 74 - braceAmount * 66 + contactAmount * 16;
      const sourceLeftLeg = flightAmount > 0 ? 15 - tuck * 52 + flutter : baseLeftLeg;
      const sourceRightLeg = flightAmount > 0 ? -42 + tuck * 88 - flutter * .8 : baseRightLeg;
      const sourceLeftArm = flightAmount > 0 ? -18 - flightAmount * 34 - flutter * .35 + braceAmount * 70 : baseLeftArm;
      const sourceRightArm = flightAmount > 0 ? 14 + flightAmount * 38 + flutter * .4 - braceAmount * 64 : baseRightArm;
      const sourceLegY = flightAmount > 0 ? -tuck * 10 : contactAmount * 20;
      const sourceTorsoY = flightAmount > 0 ? -bounce * .35 : contactAmount * 30 - bounce;
      const sourceTorsoAngle = flightAmount > 0 ? lean * turn - flightAmount * 5 : lean * turn + work * -7 + fallAmount * step * 5;
      const waveAngle = Math.sin(Number(wave) || 0) * 17;
      leftLeg.setAttribute('transform', `translate(0 ${blend(sourceLegY, 0)}) rotate(${blend(sourceLeftLeg, -35)} 556 786)`);
      rightLeg.setAttribute('transform', `translate(0 ${blend(sourceLegY, 0)}) rotate(${blend(sourceRightLeg, 70)} 744 757)`);
      torso.setAttribute('transform', `translate(0 ${blend(sourceTorsoY, -6)}) rotate(${blend(sourceTorsoAngle, lean * turn)} 618 780)`);
      leftArm.setAttribute('opacity', String(1 - greetAmount));
      waveArm.setAttribute('opacity', String(greetAmount));
      waveArm.setAttribute('transform', `rotate(${blend(0, 54 + waveAngle)} 343 623)`);
      leftArm.setAttribute('transform', `rotate(${blend(sourceLeftArm, 54 + waveAngle)} 343 623)`);
      rightArm.setAttribute('transform', `rotate(${blend(sourceRightArm, -58)} 824 377)`);
      rightArmRoot.setAttribute('transform', rightArm.getAttribute('transform'));
    }
    if (shadow) shadow.style.transform = `scaleX(${1 - activeEnergy * .15 + contactAmount * .2})`;
    mount.dataset.pose = pose || (moonwalk ? 'moonwalk' : greetAmount > .1 ? 'greet' : flightAmount > .1 ? 'flight' : contactAmount > .15 ? 'contact' : braceAmount > .18 ? 'brace' : fallAmount > .1 ? 'fall' : work > .1 ? 'work' : activeEnergy > .08 ? 'walk' : 'rest');
    renderProps();
  }

  function setCategory(nextCategory) {
    category = clamp(Number(nextCategory) || 0, 0, 3);
    mount.dataset.crtCategory = String(category);
    renderProps();
  }

  function setPropsVisible(visible) {
    propsVisible = Boolean(visible);
    mount.dataset.crtProps = propsVisible ? 'visible' : 'hidden';
    renderProps();
  }

  function setPose(pose = 'read', options = {}) {
    window.clearTimeout(settleTimer);
    const token = ++poseToken;
    const fixedPose = reduced() ? 'read' : pose;
    const preset = poseState[fixedPose] || poseState.read;
    if (Number.isInteger(options.category)) setCategory(options.category);
    draw({
      ...preset,
      phase: Number(options.phase) || Number(options.step) / 18 || 0,
      direction: options.direction ?? 1,
      lean: Number.isFinite(Number(options.lean)) ? Number(options.lean) : preset.lean,
      pose: fixedPose,
    });
    if (!reduced() && options.settle) {
      settleTimer = window.setTimeout(() => {
        if (token === poseToken) setPose(options.settle, { direction: options.direction, category });
      }, options.duration || 240);
    }
  }

  function stop() {
    window.clearTimeout(settleTimer);
    poseToken += 1;
    setPose('read', { category });
  }

  mount.ownerDocument.addEventListener('visibilitychange', () => {
    if (mount.ownerDocument.hidden) stop();
  });
  setCategory(0);
  setPropsVisible(false);
  draw();
  const api = { mount, svg, draw, setCategory, setPropsVisible, setPose, stop, footAnchor: .904,
    getMoonwalkRootOffsetPx: () => moonwalkRootSource * (svg.getBoundingClientRect().width / 1254) };
  instances.set(mount, api);
  return api;
}
