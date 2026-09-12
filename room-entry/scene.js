const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const smooth = (from, to, value) => {
  const p = clamp((value - from) / Math.max(.0001, to - from));
  return p * p * (3 - 2 * p);
};
const validAperture = aperture => aperture
  && [aperture.left, aperture.top, aperture.width, aperture.height].every(Number.isFinite)
  && aperture.width > 0 && aperture.height > 0;
const validCorners = corners => Array.isArray(corners) && corners.length === 4
  && corners.every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 983;

const rearPose = Object.freeze({
  id: 'room-rear-inward', file: 'assets/room-entry/rear-inward.png',
  width: 1239, height: 1270,
  bounds: { left: 124 / 1239, top: 23 / 1270, right: 1211 / 1239, bottom: 1214 / 1270 },
  bodyAnchor: { x: .504, y: .354 }, footAnchor: { x: .4915, y: .9181 },
  footAnchorKind: 'airborne-alignment',
});
const frontPose = Object.freeze({
  id: 'fall-relief', file: 'assets/mascot/relief.webp',
  width: 1254, height: 1254,
  bounds: { left: .147, top: .058, right: .949, bottom: .936 },
  bodyAnchor: { x: .475, y: .353 }, footAnchor: { x: .553, y: .936 },
  footAnchorKind: 'ground-contact',
});

function portalMatrix(corners, source, width, height, resolve = 0) {
  const viewport = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  const mix = clamp(resolve);
  const points = corners.map((point, index) => ({
    x: point.x + (viewport[index].x - point.x) * mix,
    y: point.y + (viewport[index].y - point.y) * mix,
  }));
  const sourceLeft = source.left * (1 - mix);
  const sourceTop = source.top * (1 - mix);
  const sourceRight = (source.left + source.width) * (1 - mix) + width * mix;
  const sourceBottom = (source.top + source.height) * (1 - mix) + height * mix;
  const x0 = sourceLeft; const y0 = sourceTop;
  const x1 = sourceRight; const y1 = sourceBottom;
  const [p0, p1, p2, p3] = points;
  const dx1 = p1.x - p2.x; const dx2 = p3.x - p2.x; const sx = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y; const dy2 = p3.y - p2.y; const sy = p0.y - p1.y + p2.y - p3.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(denominator) < .000001) return 'none';
  const g = (sx * dy2 - dx2 * sy) / denominator;
  const h = (dx1 * sy - sx * dy1) / denominator;
  const a = p1.x - p0.x + g * p1.x; const b = p3.x - p0.x + h * p3.x; const c = p0.x;
  const d = p1.y - p0.y + g * p1.y; const e = p3.y - p0.y + h * p3.y; const f = p0.y;
  const sw = Math.max(.0001, x1 - x0); const sh = Math.max(.0001, y1 - y0);
  const values = [
    a / sw, d / sw, 0, g / sw,
    b / sh, e / sh, 0, h / sh,
    0, 0, 1, 0,
    c - a * x0 / sw - b * y0 / sh,
    f - d * x0 / sw - e * y0 / sh,
    0, 1 - g * x0 / sw - h * y0 / sh,
  ];
  return values.every(Number.isFinite) ? `matrix3d(${values.map(value => value.toFixed(9)).join(',')})` : 'none';
}

function installStyle(documentRef) {
  if (documentRef.querySelector('link[data-room-entry-style]')) return;
  const link = documentRef.createElement('link');
  link.dataset.roomEntryStyle = '';
  link.rel = 'stylesheet';
  const styleUrl = new URL('./scene.css', import.meta.url);
  styleUrl.search = new URL(import.meta.url).search;
  link.href = styleUrl.href;
  documentRef.head.append(link);
}

function poseLayout(pose, bodyFootDistance, footX, footY) {
  const fullHeight = bodyFootDistance / Math.max(.001, pose.footAnchor.y - pose.bodyAnchor.y);
  const fullWidth = fullHeight * pose.width / pose.height;
  return {
    left: footX - pose.footAnchor.x * fullWidth,
    top: footY - pose.footAnchor.y * fullHeight,
    width: fullWidth,
    height: fullHeight,
    visible: {
      left: footX + (pose.bounds.left - pose.footAnchor.x) * fullWidth,
      top: footY + (pose.bounds.top - pose.footAnchor.y) * fullHeight,
      right: footX + (pose.bounds.right - pose.footAnchor.x) * fullWidth,
      bottom: footY + (pose.bounds.bottom - pose.footAnchor.y) * fullHeight,
    },
  };
}

export function createRoomEntryScene(mount, wake = () => {}) {
  installStyle(mount.ownerDocument);
  mount.classList.add('room-entry');
  mount.innerHTML = `<svg class="room-entry__defs" aria-hidden="true" width="0" height="0"><defs>
    <clipPath id="room-entry-middle" clipPathUnits="userSpaceOnUse"><path class="room-entry__middle-path" fill-rule="evenodd" clip-rule="evenodd"/></clipPath>
  </defs></svg>
  <div class="room-entry__camera" aria-hidden="true">
    <img class="room-entry__plate room-entry__underlay" src="assets/room-entry/room-underlay.png" width="1601" height="983" alt="">
    <img class="room-entry__plate room-entry__middle" src="assets/room-entry/room-clean.png" width="1600" height="983" alt="">
    <i class="room-entry__feature room-entry__feature--window-left"></i><i class="room-entry__feature room-entry__feature--window-right"></i>
    <span class="room-entry__shadow"></span>
    <div class="room-entry__actor"><img class="room-entry__pose room-entry__pose--rear" src="assets/room-entry/rear-inward.png" width="1239" height="1270" alt=""><img class="room-entry__pose room-entry__pose--front" src="assets/mascot/relief.webp" width="1254" height="1254" alt=""><i class="room-entry__marker room-entry__marker--body"></i><i class="room-entry__marker room-entry__marker--foot"></i><i class="room-entry__marker room-entry__marker--tl"></i><i class="room-entry__marker room-entry__marker--tr"></i><i class="room-entry__marker room-entry__marker--br"></i><i class="room-entry__marker room-entry__marker--bl"></i></div>
    <img class="room-entry__plate room-entry__foreground room-entry__foreground--left" src="assets/room-entry/room-clean.png" width="1600" height="983" alt="">
    <img class="room-entry__plate room-entry__foreground room-entry__foreground--right" src="assets/room-entry/room-clean.png" width="1600" height="983" alt="">
  </div>`;
  const camera = mount.querySelector('.room-entry__camera');
  const actor = mount.querySelector('.room-entry__actor');
  const rear = mount.querySelector('.room-entry__pose--rear');
  const front = mount.querySelector('.room-entry__pose--front');
  const shadow = mount.querySelector('.room-entry__shadow');
  const middlePath = mount.querySelector('.room-entry__middle-path');
  const windowFeatures = [...mount.querySelectorAll('.room-entry__feature')];
  const markers = Object.fromEntries(['body', 'foot', 'tl', 'tr', 'br', 'bl'].map(name => [name, mount.querySelector(`.room-entry__marker--${name}`)]));
  const foreground = [...mount.querySelectorAll('.room-entry__foreground')];
  let characterHidden = false;
  let actorVisual = null;
  let handoffProgress = 0;
  let last = null;

  const images = [...mount.querySelectorAll('img')];
  images.forEach(image => {
    if (!image.complete) image.addEventListener('load', wake, { once: true });
  });

  function applyPortal(aperture, bridge, reduced) {
    const projected = aperture?.projected === true && validCorners(aperture.corners) && !reduced && bridge < 1;
    if (projected) {
      const resolve = clamp(aperture.projectionResolve);
      const apertureAspect = aperture.width / aperture.height;
      const viewportAspect = innerWidth / innerHeight;
      const sourceWidth = viewportAspect > apertureAspect ? innerHeight * apertureAspect : innerWidth;
      const sourceHeight = viewportAspect > apertureAspect ? innerHeight : innerWidth / apertureAspect;
      const source = { left: (innerWidth - sourceWidth) * .5, top: (innerHeight - sourceHeight) * .5, width: sourceWidth, height: sourceHeight };
      const clipLeft = source.left * (1 - resolve); const clipTop = source.top * (1 - resolve);
      const clipRight = (innerWidth - source.left - source.width) * (1 - resolve);
      const clipBottom = (innerHeight - source.top - source.height) * (1 - resolve);
      mount.style.transformOrigin = '0 0';
      mount.style.transform = portalMatrix(aperture.corners, source, innerWidth, innerHeight, resolve);
      mount.style.clipPath = `inset(${clipTop.toFixed(2)}px ${clipRight.toFixed(2)}px ${clipBottom.toFixed(2)}px ${clipLeft.toFixed(2)}px round ${(Math.min(sourceWidth, sourceHeight) * .095 * (1 - resolve)).toFixed(2)}px)`;
      mount.style.overflow = 'hidden';
    } else if (validAperture(aperture) && !reduced && bridge < .999) {
      const left = Math.max(0, aperture.left); const top = Math.max(0, aperture.top);
      const right = Math.max(0, innerWidth - aperture.left - aperture.width);
      const bottom = Math.max(0, innerHeight - aperture.top - aperture.height);
      mount.style.transform = 'none';
      mount.style.clipPath = `inset(${top.toFixed(2)}px ${right.toFixed(2)}px ${bottom.toFixed(2)}px ${left.toFixed(2)}px)`;
    } else {
      mount.style.transform = 'none';
      mount.style.clipPath = 'none';
      mount.style.overflow = '';
    }
  }

  function draw({ progress = 0, reduced = false, aperture = null, bridgeProgress = 1 } = {}) {
    const p = reduced ? 1 : clamp(progress);
    const bridge = reduced ? 1 : clamp(bridgeProgress);
    applyPortal(aperture, bridge, reduced);
    const travel = smooth(.02, .76, p);
    const settle = smooth(.62, .76, p);
    const apertureAspect = validAperture(aperture) ? aperture.width / aperture.height : innerWidth / innerHeight;
    const viewportAspect = innerWidth / innerHeight;
    const resolve = aperture?.projected === true ? clamp(aperture.projectionResolve) : 0;
    const apertureWidth = viewportAspect > apertureAspect ? innerHeight * apertureAspect : innerWidth;
    const apertureHeight = viewportAspect > apertureAspect ? innerHeight : innerWidth / apertureAspect;
    const apertureLeft = (innerWidth - apertureWidth) * .5;
    const apertureTop = (innerHeight - apertureHeight) * .5;
    const sourceWidth = apertureWidth * (1 - resolve) + innerWidth * resolve;
    const sourceHeight = apertureHeight * (1 - resolve) + innerHeight * resolve;
    const sourceLeft = apertureLeft * (1 - resolve);
    const sourceTop = apertureTop * (1 - resolve);
    const coverScale = Math.max(sourceWidth / WORLD_WIDTH, sourceHeight / WORLD_HEIGHT);
    const dolly = reduced ? 1 : 1 + travel * .09 + smooth(.72, 1, bridge) * .04;
    const cameraScale = coverScale * dolly;
    const cameraLeft = sourceLeft + (sourceWidth - WORLD_WIDTH * cameraScale) * .5;
    const cameraTop = sourceTop + (sourceHeight - WORLD_HEIGHT * cameraScale) * .5 - travel * sourceHeight * .026;
    const desiredCamera = new DOMMatrix().translate(cameraLeft, cameraTop).scale(cameraScale);
    camera.style.transform = desiredCamera.toString();
    const project = ([x, y]) => [WORLD_WIDTH * x, WORLD_HEIGHT * y];
    const windowPoints = [[.49,.23],[.66,.23]].map(project);
    windowFeatures.forEach((feature, index) => Object.assign(feature.style, { left: `${windowPoints[index][0].toFixed(2)}px`, top: `${windowPoints[index][1].toFixed(2)}px` }));
    const leftSource = [[484 / WORLD_WIDTH,1],[497 / WORLD_WIDTH,954 / WORLD_HEIGHT],[510 / WORLD_WIDTH,925 / WORLD_HEIGHT],[511 / WORLD_WIDTH,914 / WORLD_HEIGHT],[569 / WORLD_WIDTH,914 / WORLD_HEIGHT],[593 / WORLD_WIDTH,901 / WORLD_HEIGHT],[615 / WORLD_WIDTH,890 / WORLD_HEIGHT],[636 / WORLD_WIDTH,889 / WORLD_HEIGHT],[655 / WORLD_WIDTH,896 / WORLD_HEIGHT],[673 / WORLD_WIDTH,912 / WORLD_HEIGHT],[685 / WORLD_WIDTH,930 / WORLD_HEIGHT],[697 / WORLD_WIDTH,948 / WORLD_HEIGHT],[723 / WORLD_WIDTH,966 / WORLD_HEIGHT],[742 / WORLD_WIDTH,1]];
    const rightSource = [[.705,.455],[.755,.432],[.835,.45],[.895,.515],[1,.49],[1,1],[.62,1],[.61,.75],[.66,.69],[.675,.65]];
    const depth = reduced ? 0 : travel;
    const nearScale = 1 + depth * .012;
    const leftBase = leftSource.map(project); const rightBase = rightSource.map(project);
    const path = points => `M${points.map(point => point.map(value => value.toFixed(2)).join(' ')).join('L')}Z`;
    middlePath.setAttribute('d', `M0 0H${WORLD_WIDTH}V${WORLD_HEIGHT}H0Z ${path(leftBase)} ${path(rightBase)}`);
    foreground[0].style.clipPath = `polygon(${leftBase.map(point => `${point[0].toFixed(2)}px ${point[1].toFixed(2)}px`).join(',')})`;
    foreground[1].style.clipPath = `polygon(${rightBase.map(point => `${point[0].toFixed(2)}px ${point[1].toFixed(2)}px`).join(',')})`;
    foreground[0].style.transform = `translate3d(${(-depth * 4).toFixed(2)}px,${(depth * 2).toFixed(2)}px,0) scale(${nearScale.toFixed(4)})`;
    foreground[1].style.transform = `translate3d(${(depth * 4).toFixed(2)}px,${(depth * 2).toFixed(2)}px,0) scale(${nearScale.toFixed(4)})`;

    const entryTurn = smooth(.44, .64, bridge);
    const landingTurn = smooth(.58, .70, p);
    const inward = p > .001 || entryTurn >= .5;
    const frontFacing = reduced || (p > .001 && landingTurn >= .5);
    const activePose = frontFacing || !inward ? frontPose : rearPose;
    const activeImage = activePose === rearPose ? rear : front;
    rear.style.visibility = !characterHidden && activeImage === rear ? 'visible' : 'hidden';
    front.style.visibility = !characterHidden && activeImage === front ? 'visible' : 'hidden';
    actor.dataset.poseId = activePose.id;
    actor.dataset.owner = activeImage === rear ? 'rear' : 'front';

    const startFootX = WORLD_WIDTH * .51;
    const finalFootX = WORLD_WIDTH * .52;
    const floorY = WORLD_HEIGHT * .82;
    const hop = reduced ? 0 : Math.sin(smooth(.08, .62, p) * Math.PI) * WORLD_HEIGHT * .12;
    const advance = smooth(.08, .62, p);
    const footX = startFootX + (finalFootX - startFootX) * advance;
    const footY = floorY - hop;
    const baseHeight = 160;
    const approachScale = 1 - Math.sin(advance * Math.PI) * .16 + settle * .08;
    const compression = reduced ? 1 : 1 - Math.sin(smooth(.62, .74, p) * Math.PI) * .1;
    const layout = poseLayout(activePose, baseHeight * approachScale * compression, footX, footY);
    const turn = p > .001 ? landingTurn : entryTurn;
    const turnScaleX = reduced ? 1 : Math.max(.08, Math.abs(Math.cos(turn * Math.PI)));
    actor.style.transformOrigin = `${(layout.left + activePose.bodyAnchor.x * layout.width).toFixed(2)}px ${(layout.top + activePose.bodyAnchor.y * layout.height).toFixed(2)}px`;
    actor.style.transform = `scaleX(${turnScaleX.toFixed(4)})`;
    Object.assign(activeImage.style, { left: `${layout.left.toFixed(2)}px`, top: `${layout.top.toFixed(2)}px`, width: `${layout.width.toFixed(2)}px`, height: `${layout.height.toFixed(2)}px` });
    const visible = layout.visible;
    const markerPoints = {
      body: [layout.left + activePose.bodyAnchor.x * layout.width, layout.top + activePose.bodyAnchor.y * layout.height],
      foot: [footX, footY], tl: [visible.left, visible.top], tr: [visible.right, visible.top], br: [visible.right, visible.bottom], bl: [visible.left, visible.bottom],
    };
    Object.entries(markerPoints).forEach(([name, point]) => Object.assign(markers[name].style, { left: `${point[0].toFixed(2)}px`, top: `${point[1].toFixed(2)}px` }));
    const projected = Object.fromEntries(Object.entries(markers).map(([name, marker]) => { const rect = marker.getBoundingClientRect(); return [name, { x: rect.left, y: rect.top }]; }));
    const projectedLeft = Math.min(projected.tl.x, projected.tr.x, projected.br.x, projected.bl.x);
    const projectedTop = Math.min(projected.tl.y, projected.tr.y, projected.br.y, projected.bl.y);
    const projectedRight = Math.max(projected.tl.x, projected.tr.x, projected.br.x, projected.bl.x);
    const projectedBottom = Math.max(projected.tl.y, projected.tr.y, projected.br.y, projected.bl.y);
    actorVisual = { left: projectedLeft, top: projectedTop, right: projectedRight, bottom: projectedBottom, width: projectedRight - projectedLeft, height: projectedBottom - projectedTop, bodyX: projected.body.x, bodyY: projected.body.y, footX: projected.foot.x, footY: projected.foot.y, poseId: activePose.id, pose: frontFacing ? p < .76 ? 'contact' : 'guide' : inward ? 'inward-hop' : 'preview', representation: activePose === frontPose ? 'independent-pose-sequence' : 'room-entry-pose', bounds: activePose.bounds, footAnchor: activePose.footAnchor, footAnchorKind: activePose.footAnchorKind, bodyAnchor: activePose.bodyAnchor, intrinsicSize: { width: activePose.width, height: activePose.height } };
    const airborne = clamp(hop / (WORLD_HEIGHT * .12));
    Object.assign(shadow.style, { left: `${footX.toFixed(2)}px`, top: `${(floorY + 4).toFixed(2)}px`, opacity: String(characterHidden ? 0 : .12 + (1 - airborne) * .22), transform: `translate(-50%,-50%) scale(${(.42 + (1 - airborne) * .58).toFixed(3)},${(.65 + (1 - airborne) * .35).toFixed(3)})` });
    const phase = reduced ? 'guide' : p < .08 ? inward ? 'turn-inward' : 'preview' : p < .64 ? 'inward-hop' : p < .76 ? 'land' : 'guide';
    Object.assign(mount.dataset, { roomEntryPhase: phase, progress: p.toFixed(4), bridgeProgress: bridge.toFixed(4), characterOwner: actor.dataset.owner, grounded: String(reduced || p >= .64), layerModel: 'underlay-partitioned-clean-actor-foreground' });
    last = { progress, reduced, aperture, bridgeProgress };
  }

  function setCharacterHidden(hidden) {
    characterHidden = Boolean(hidden);
    actor.style.opacity = characterHidden ? '0' : '1';
    shadow.style.visibility = characterHidden ? 'hidden' : 'visible';
  }
  function canonicalDeparture() {
    const footX = WORLD_WIDTH * .52;
    const footY = WORLD_HEIGHT * .82;
    const layout = poseLayout(frontPose, 160 * 1.08, footX, footY);
    const scale = Math.max(innerWidth / WORLD_WIDTH, innerHeight / WORLD_HEIGHT) * 1.13;
    const left = (innerWidth - WORLD_WIDTH * scale) * .5;
    const top = (innerHeight - WORLD_HEIGHT * scale) * .5 - innerHeight * .026;
    const point = (x, y) => ({ x: left + x * scale, y: top + y * scale });
    const body = point(layout.left + frontPose.bodyAnchor.x * layout.width, layout.top + frontPose.bodyAnchor.y * layout.height);
    const foot = point(footX, footY);
    const topLeft = point(layout.visible.left, layout.visible.top);
    const bottomRight = point(layout.visible.right, layout.visible.bottom);
    return { left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y, bodyX: body.x, bodyY: body.y, footX: foot.x, footY: foot.y, poseId: frontPose.id, pose: 'guide', representation: 'independent-pose-sequence', bounds: frontPose.bounds, footAnchor: frontPose.footAnchor, footAnchorKind: frontPose.footAnchorKind, bodyAnchor: frontPose.bodyAnchor, intrinsicSize: { width: frontPose.width, height: frontPose.height } };
  }
  function setHandoffProgress(progress) {
    handoffProgress = clamp(progress);
    mount.style.setProperty('--room-handoff', handoffProgress.toFixed(4));
  }
  function resize() { if (last) draw(last); }
  function getCharacterRect() {
    const outsideViewport = actorVisual && (actorVisual.footY < 0 || actorVisual.footY > innerHeight);
    return handoffProgress > 0 || outsideViewport ? canonicalDeparture() : actorVisual;
  }
  function drawArrival(progress = 0) { mount.dataset.arrivalProgress = clamp(progress).toFixed(4); }
  function dispose() { mount.classList.remove('room-entry'); mount.replaceChildren(); }
  draw();
  return { draw, drawArrival, resize, getCharacterRect, setCharacterHidden, setHandoffProgress, dispose };
}
