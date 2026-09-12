import { createFallActor, getActorFrames } from './actor.js?v=unified-r1.h0d1594b9';
import { createFallEnvironment } from './environment.js';
import { createFracture } from './fracture.mjs';
import { createGlassFragments } from './glass.js';
import { PHASE, createWelcomeWaveClock } from './timeline.mjs';

const clamp = value => Math.max(0, Math.min(1, value));
const finite01 = (value, fallback = 0) => Number.isFinite(Number(value)) ? clamp(Number(value)) : fallback;
const smooth = (a, b, value) => { const p = clamp((value - a) / Math.max(.0001, b - a)); return p * p * (3 - 2 * p); };
const validAperture = aperture => aperture && [aperture.left, aperture.top, aperture.width, aperture.height].every(Number.isFinite) && aperture.width > 0 && aperture.height > 0;
const validCorners = corners => Array.isArray(corners) && corners.length === 4 && corners.every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
function portalMatrix(corners, source, width, height, resolve = 0) {
  const viewport = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  const mix = finite01(resolve);
  const points = corners.map((point, index) => ({
    x: point.x + (viewport[index].x - point.x) * mix,
    y: point.y + (viewport[index].y - point.y) * mix,
  }));
  const sourceLeft = source.left * (1 - mix);
  const sourceTop = source.top * (1 - mix);
  const sourceWidth = source.width + (width - source.width) * mix;
  const sourceHeight = source.height + (height - source.height) * mix;
  const [p0, p1, p2, p3] = points;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  let g = 0;
  let h = 0;
  if (Math.abs(dx3) + Math.abs(dy3) > .000001 && Math.abs(denominator) > .000001) {
    g = (dx3 * dy2 - dx2 * dy3) / denominator;
    h = (dx1 * dy3 - dx3 * dy1) / denominator;
  }
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const c = p0.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  const f = p0.y;
  const unitA = a / sourceWidth;
  const unitB = b / sourceHeight;
  const unitD = d / sourceWidth;
  const unitE = e / sourceHeight;
  const unitG = g / sourceWidth;
  const unitH = h / sourceHeight;
  const constant = 1 - unitG * sourceLeft - unitH * sourceTop;
  const values = [
    unitA / constant,
    unitD / constant,
    0,
    unitG / constant,
    unitB / constant,
    unitE / constant,
    0,
    unitH / constant,
    0, 0, 1, 0,
    (c - unitA * sourceLeft - unitB * sourceTop) / constant,
    (f - unitD * sourceLeft - unitE * sourceTop) / constant,
    0, 1,
  ];
  return values.every(Number.isFinite) ? `matrix3d(${values.map(value => value.toFixed(9)).join(',')})` : 'none';
}

export function createFallScene(mount, wake = () => {}) {
  const environmentMount = mount.querySelector('.fall-environment');
  const environment = createFallEnvironment(environmentMount, wake);
  const actorMount = mount.querySelector('.fall-actor-mount--rear');
  const actorFrontMount = mount.querySelector('.fall-actor-mount--front');
  const actor = createFallActor(actorMount, wake);
  const actorFront = createFallActor(actorFrontMount, wake);
  const glass = mount.querySelector('.fall-glass-plane');
  const whiteout = mount.querySelector('.fall-whiteout');
  const shardLayer = mount.querySelector('.fall-shards');
  const cta = mount.querySelector('.fall-cta');
  const stickerOrbit = cta.querySelector('.fall-cta__orbit');
  const ctaPrompt = cta.querySelector('.fall-cta__prompt');
  const ctaTitle = cta.querySelector('.fall-cta__title');
  const ctaContinue = cta.querySelector('.fall-cta__continue');
  const fracture = createFracture({ width: 1000, height: 625, count: innerWidth < 760 ? 36 : 68, seed: 'tva-original-glass', impact: { x: 512, y: 292 } });
  glass.innerHTML = `<svg viewBox="0 0 1000 625" preserveAspectRatio="none">${fracture.cells.map(cell => `<path d="${cell.path}"/>`).join('')}</svg>`;
  const fragments = createGlassFragments(shardLayer, fracture.cells);
  const wave = createWelcomeWaveClock({ durationMs: 1900 });
  let lastProgress = -1;
  let sourceAperture = null;
  let sourceViewport = null;
  let actorBounds = { left: .09, top: .06, right: .91, bottom: .96 };
  let actorBodyAnchor = { x: .525, y: .42 };
  let actorFootAnchor = { x: .5, y: .904 };
  let actorIntrinsicSize = { width: 1331, height: 1182 };
  let actorVisual = null;
  let lastActorPresentation = null;
  let characterHidden = false;
  let frontReveal = 0;
  let stickerLayoutKey = '';
  const inflateRect = (rect, amount) => ({
    left: rect.left - amount,
    top: rect.top - amount,
    right: rect.right + amount,
    bottom: rect.bottom + amount,
  });
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  function stickerCandidates(width, height, step) {
    const margin = Math.max(8, step * .55);
    const points = [];
    const seen = new Set();
    const add = point => {
      const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
      if (!seen.has(key)) {
        seen.add(key);
        points.push(point);
      }
    };
    const rings = Math.max(1, Math.ceil(Math.min(width, height) / (step * 2)));
    for (let ring = 0; ring < rings; ring += 1) {
      const left = margin + ring * step;
      const right = width - left;
      const top = margin + ring * step;
      const bottom = height - top;
      if (left > right || top > bottom) break;
      const horizontal = [];
      const vertical = [];
      for (let x = left; x <= right; x += step) horizontal.push(x);
      if (horizontal.at(-1) < right - step * .35) horizontal.push(right);
      for (let y = top; y <= bottom; y += step) vertical.push(y);
      if (vertical.at(-1) < bottom - step * .35) vertical.push(bottom);
      const count = Math.max(horizontal.length, vertical.length);
      for (let index = 0; index < count; index += 1) {
        if (horizontal[index] !== undefined) add({ x: horizontal[index], y: top });
        if (vertical[index] !== undefined) add({ x: right, y: vertical[index] });
        if (horizontal[index] !== undefined) add({ x: horizontal.at(-1 - index), y: bottom });
        if (vertical[index] !== undefined) add({ x: left, y: vertical.at(-1 - index) });
      }
    }
    return points;
  }
  function greetingActorEnvelope(width, height) {
    const portrait = width / Math.max(1, height) < .92;
    const centerX = width * (portrait ? .5 : .73);
    const centerY = height * (portrait ? .72 : .56);
    const safeWidth = portrait ? width - 32 : width * .43;
    const safeHeight = portrait ? height * .46 : height - 40;
    const poses = [...getActorFrames('fall', 'relief'), ...getActorFrames('fall', 'wave')];
    const rects = poses.map(pose => {
      const metrics = actorMetrics(pose.bounds, { width: pose.width, height: pose.height });
      const scale = Math.min(portrait ? 1.38 : 1.72, safeWidth / metrics.width, safeHeight / metrics.height);
      const projectedWidth = metrics.width * scale;
      const projectedHeight = metrics.height * scale;
      return {
        left: centerX - projectedWidth / 2,
        top: centerY - projectedHeight / 2,
        right: centerX + projectedWidth / 2,
        bottom: centerY + projectedHeight / 2,
      };
    });
    if (actorVisual) rects.push(actorVisual);
    if (!rects.length) return actorVisual || { left: centerX, top: centerY, right: centerX, bottom: centerY };
    return inflateRect({
      left: Math.min(...rects.map(rect => rect.left)),
      top: Math.min(...rects.map(rect => rect.top)),
      right: Math.max(...rects.map(rect => rect.right)),
      bottom: Math.max(...rects.map(rect => rect.bottom)),
    }, portrait ? 10 : 16);
  }
  function layoutStickers(width, height) {
    const stickers = [...stickerOrbit.querySelectorAll('.fall-cta__sticker')];
    if (stickers.length !== 20) return;
    const portrait = width / Math.max(1, height) < .92;
    const textRects = [ctaPrompt, ctaTitle, ctaContinue]
      .map(element => element.getBoundingClientRect())
      .filter(rect => rect.width > 0 && rect.height > 0)
      .map(rect => inflateRect(rect, portrait ? 8 : 14));
    const actorEnvelope = greetingActorEnvelope(width, height);
    const reserved = [...textRects, actorEnvelope];
    const sizes = portrait ? [32, 28, 24, 21, 18] : [74, 66, 58, 50, 44];
    let placements = [];
    for (const nominal of sizes) {
      placements = [];
      const candidates = stickerCandidates(width, height, Math.max(18, nominal * .76));
      for (let index = 0; index < stickers.length; index += 1) {
        const image = stickers[index];
        const bounds = {
          left: Number(image.dataset.boundLeft),
          top: Number(image.dataset.boundTop),
          right: Number(image.dataset.boundRight),
          bottom: Number(image.dataset.boundBottom),
        };
        const intrinsicWidth = Number(image.dataset.intrinsicWidth);
        const intrinsicHeight = Number(image.dataset.intrinsicHeight);
        const visibleAspect = (bounds.right - bounds.left) * intrinsicWidth
          / Math.max(1, (bounds.bottom - bounds.top) * intrinsicHeight);
        const size = nominal * (.82 + (index % 5) * .09);
        const visibleWidth = visibleAspect >= 1 ? size : size * visibleAspect;
        const visibleHeight = visibleAspect >= 1 ? size / visibleAspect : size;
        const motion = portrait ? 3 : 5;
        const candidate = candidates.find(point => {
          const rect = inflateRect({
            left: point.x - visibleWidth / 2,
            top: point.y - visibleHeight / 2,
            right: point.x + visibleWidth / 2,
            bottom: point.y + visibleHeight / 2,
          }, motion + 3);
          return rect.left >= 2 && rect.top >= 2 && rect.right <= width - 2 && rect.bottom <= height - 2
            && !reserved.some(area => overlaps(rect, area))
            && !placements.some(placement => overlaps(rect, placement.collision));
        });
        if (!candidate) break;
        const fullWidth = visibleWidth / Math.max(.001, bounds.right - bounds.left);
        const fullHeight = fullWidth * intrinsicHeight / Math.max(1, intrinsicWidth);
        placements.push({
          image,
          collision: inflateRect({
            left: candidate.x - visibleWidth / 2,
            top: candidate.y - visibleHeight / 2,
            right: candidate.x + visibleWidth / 2,
            bottom: candidate.y + visibleHeight / 2,
          }, motion + 3),
          left: candidate.x - (bounds.left * fullWidth + visibleWidth / 2),
          top: candidate.y - (bounds.top * fullHeight + visibleHeight / 2),
          width: fullWidth,
          height: fullHeight,
          motion,
        });
        candidates.splice(candidates.indexOf(candidate), 1);
      }
      if (placements.length === stickers.length) break;
    }
    if (placements.length !== stickers.length) {
      stickerOrbit.dataset.stickerLayout = `incomplete-${placements.length}`;
      stickers.forEach(image => { image.style.opacity = '0'; });
      return;
    }
    placements.forEach(({ image, left, top, width: imageWidth, height: imageHeight, motion }) => {
      Object.assign(image.style, {
        left: `${left.toFixed(2)}px`,
        top: `${top.toFixed(2)}px`,
        width: `${imageWidth.toFixed(2)}px`,
        height: `${imageHeight.toFixed(2)}px`,
      });
      image.dataset.motion = String(motion);
    });
    stickerOrbit.dataset.stickerLayout = 'safe-20';
  }
  function drawStickers(progress, nowMs, reduced, width, height) {
    const stickers = [...stickerOrbit.querySelectorAll('.fall-cta__sticker')];
    const poseCount = getActorFrames('fall', 'relief').length + getActorFrames('fall', 'wave').length;
    const key = `${width}x${height}:${stickers.length}:${poseCount}`;
    if (key !== stickerLayoutKey) {
      layoutStickers(width, height);
      stickerLayoutKey = key;
    }
    const reveal = smooth(.84, .91, progress);
    stickers.forEach((image, index) => {
      const motion = Number(image.dataset.motion) || 0;
      const time = reduced ? 0 : nowMs * .00045;
      const x = Math.sin(time + index * 1.91) * motion * reveal;
      const y = Math.cos(time * .83 + index * 1.37) * motion * .72 * reveal;
      const rotation = ((index % 7) - 3) * 5 + Math.sin(time * .7 + index) * (reduced ? 0 : 3);
      image.style.opacity = reveal.toFixed(3);
      image.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${rotation.toFixed(2)}deg)`;
    });
  }
  function actorMetrics(bounds = actorBounds, intrinsicSize = actorIntrinsicSize) {
    const mountWidth = Math.max(1, actorMount.offsetWidth);
    const mountHeight = Math.max(1, actorMount.offsetHeight);
    const viewAspect = intrinsicSize.width / Math.max(1, intrinsicSize.height);
    let contentWidth = mountWidth;
    let contentHeight = contentWidth / viewAspect;
    if (contentHeight > mountHeight) {
      contentHeight = mountHeight;
      contentWidth = contentHeight * viewAspect;
    }
    const offsetX = (mountWidth - contentWidth) * .5;
    const offsetY = (mountHeight - contentHeight) * .5;
    return {
      mountWidth,
      mountHeight,
      left: offsetX + bounds.left * contentWidth,
      top: offsetY + bounds.top * contentHeight,
      width: Math.max(1, (bounds.right - bounds.left) * contentWidth),
      height: Math.max(1, (bounds.bottom - bounds.top) * contentHeight),
    };
  }
  function placeActor(target, metrics, bodyAnchor, centerX, centerY, scale, roll) {
    const originX = metrics.mountWidth * .5;
    const originY = metrics.mountHeight * .54;
    const contentWidth = metrics.width / Math.max(.0001, actorBounds.right - actorBounds.left);
    const contentHeight = metrics.height / Math.max(.0001, actorBounds.bottom - actorBounds.top);
    const contentLeft = metrics.left - actorBounds.left * contentWidth;
    const contentTop = metrics.top - actorBounds.top * contentHeight;
    const bodyX = contentLeft + bodyAnchor.x * contentWidth;
    const bodyY = contentTop + bodyAnchor.y * contentHeight;
    const angle = roll * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const centerDX = (bodyX - originX) * scale;
    const centerDY = (bodyY - originY) * scale;
    const x = centerX - innerWidth * .5 - (centerDX * cos - centerDY * sin);
    const y = centerY - originY - (centerDX * sin + centerDY * cos);
    target.style.setProperty('--actor-x', `${x.toFixed(2)}px`);
    target.style.setProperty('--actor-y', `${y.toFixed(2)}px`);
    target.style.setProperty('--actor-scale', scale.toFixed(4));
    target.style.setProperty('--actor-roll', `${roll.toFixed(2)}deg`);
    const project = (localX, localY) => {
      const dx = (localX - bodyX) * scale;
      const dy = (localY - bodyY) * scale;
      return { x: centerX + dx * cos - dy * sin, y: centerY + dx * sin + dy * cos };
    };
    const corners = [
      project(metrics.left, metrics.top),
      project(metrics.left + metrics.width, metrics.top),
      project(metrics.left + metrics.width, metrics.top + metrics.height),
      project(metrics.left, metrics.top + metrics.height),
    ];
    const xs = corners.map(point => point.x);
    const ys = corners.map(point => point.y);
    const foot = project(
      contentLeft + actorFootAnchor.x * contentWidth,
      contentTop + actorFootAnchor.y * contentHeight,
    );
    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      bodyX: centerX,
      bodyY: centerY,
      footX: foot.x,
      footY: foot.y,
    };
  }
  function draw({ progress = 0, nowMs = performance.now(), reduced = false, aperture = null, bridgeProgress = 1 } = {}) {
    if (document.hidden) return;
    const p = reduced ? .93 : finite01(progress);
    const bridge = reduced ? 1 : finite01(bridgeProgress);
    if (validAperture(aperture) && bridge < 1 && (!sourceAperture || sourceViewport?.width !== innerWidth || sourceViewport?.height !== innerHeight)) {
      sourceAperture = { left: aperture.left, top: aperture.top, width: aperture.width, height: aperture.height };
      sourceViewport = { width: innerWidth, height: innerHeight };
    }
    const canonicalAperture = sourceAperture || (validAperture(aperture) ? aperture : null);
    const projectedPortal = aperture?.projected === true && validCorners(aperture.corners) && !reduced && bridge < 1;
    if (projectedPortal || (validAperture(aperture) && !reduced && bridge < .999)) {
      if (projectedPortal) {
        const resolve = finite01(aperture.projectionResolve);
        const apertureAspect = aperture.width / aperture.height;
        const viewportAspect = innerWidth / innerHeight;
        const sourceWidth = viewportAspect > apertureAspect ? innerHeight * apertureAspect : innerWidth;
        const sourceHeight = viewportAspect > apertureAspect ? innerHeight : innerWidth / apertureAspect;
        const source = {
          left: (innerWidth - sourceWidth) * .5,
          top: (innerHeight - sourceHeight) * .5,
          width: sourceWidth,
          height: sourceHeight,
        };
        const clipLeft = source.left * (1 - resolve);
        const clipTop = source.top * (1 - resolve);
        const clipRight = (innerWidth - source.left - source.width) * (1 - resolve);
        const clipBottom = (innerHeight - source.top - source.height) * (1 - resolve);
        mount.style.transformOrigin = '0 0';
        mount.style.transform = portalMatrix(aperture.corners, source, innerWidth, innerHeight, resolve);
        mount.style.clipPath = `inset(${clipTop.toFixed(2)}px ${clipRight.toFixed(2)}px ${clipBottom.toFixed(2)}px ${clipLeft.toFixed(2)}px round ${(Math.min(sourceWidth, sourceHeight) * .095 * (1 - resolve)).toFixed(2)}px)`;
        mount.style.overflow = 'hidden';
      } else if (validCorners(aperture.corners)) {
        mount.style.transform = 'none';
        mount.style.clipPath = `polygon(${aperture.corners.map(point => `${point.x.toFixed(2)}px ${point.y.toFixed(2)}px`).join(',')})`;
      } else {
        mount.style.transform = 'none';
        const left = Math.max(0, aperture.left); const top = Math.max(0, aperture.top);
        const right = Math.max(0, innerWidth - aperture.left - aperture.width);
        const bottom = Math.max(0, innerHeight - aperture.top - aperture.height);
        mount.style.clipPath = `inset(${top.toFixed(2)}px ${right.toFixed(2)}px ${bottom.toFixed(2)}px ${left.toFixed(2)}px round ${(aperture.width * .12).toFixed(2)}px / ${(aperture.height * .15).toFixed(2)}px)`;
      }
    } else {
      mount.style.transform = 'none';
      mount.style.clipPath = 'none';
      mount.style.overflow = '';
    }
    const fullyOutside = p >= .74;
    const phase = p < .08 ? 'surprise' : p < .42 ? 'panic' : p < .58 ? 'brace' : p < .74 ? 'cross-glass' : p < .84 ? 'relief' : p < PHASE.welcome ? 'smile' : 'wave';
    const waveState = wave.sample({ progress: p, fullyOutside, nowMs });
    const actorState = { progress: p, nowMs, reduced, phase, waveProgress: waveState.progress };
    const actorPresentation = actor.draw(actorState);
    lastActorPresentation = actorPresentation;
    if (actorPresentation.bounds) actorBounds = actorPresentation.bounds;
    if (actorPresentation.bodyAnchor) actorBodyAnchor = actorPresentation.bodyAnchor;
    if (actorPresentation.footAnchor) actorFootAnchor = actorPresentation.footAnchor;
    if (actorPresentation.intrinsicSize?.width > 0 && actorPresentation.intrinsicSize?.height > 0) actorIntrinsicSize = actorPresentation.intrinsicSize;
    actorFront.draw(actorState);
    const fractureRelease = smooth(.60, .84, p);
    const fractureOnset = smooth(.60, .64, p);
    const breaking = fractureOnset * (.055 + .365 * fractureRelease * fractureRelease);
    const emerge = smooth(.64, .84, p); const width = innerWidth; const height = innerHeight;
    const metrics = actorMetrics();
    const sourceScale = canonicalAperture ? Math.max(.26, Math.min(.72, canonicalAperture.height * .25 / metrics.height)) : .38;
    const sourceCenterX = canonicalAperture ? canonicalAperture.left + canonicalAperture.width * .72 : width * .72;
    const sourceCenterY = canonicalAperture ? canonicalAperture.top + canonicalAperture.height * .54 : height * .48;
    const bridgeEase = smooth(0, 1, bridge);
    const portrait = width / Math.max(1, height) < .92;
    const fallStartScale = portrait ? .82 : .76;
    const bridgeScale = sourceScale + (fallStartScale - sourceScale) * bridgeEase;
    const bridgeCenterX = sourceCenterX + (width * .5 - sourceCenterX) * bridgeEase;
    const bridgeCenterY = sourceCenterY + (height * .46 - sourceCenterY) * bridgeEase;
    const safeWidth = portrait ? width - 32 : width * .43;
    const safeHeight = portrait ? height * .46 : height - 40;
    const finalScale = Math.min(portrait ? 1.38 : 1.72, safeWidth / metrics.width, safeHeight / metrics.height);
    const actorScale = fallStartScale + (finalScale - fallStartScale) * smooth(.36, .84, p);
    const settledCenterX = width * (portrait ? .5 : .73);
    const settledCenterY = height * (portrait ? .72 : .56);
    const fallCenterX = width * .5 + (settledCenterX - width * .5) * emerge + Math.sin(p * Math.PI * 2) * width * .012 * (1 - emerge);
    const airborneCenterY = height * (.46 + .17 * smooth(.04, .58, p));
    const fallCenterY = airborneCenterY + (settledCenterY - airborneCenterY) * smooth(.64, .84, p);
    const roll = -18 * (1 - smooth(.28, .78, p));
    const actorCenterX = projectedPortal && p === 0 ? width * .5 : bridge < 1 && p === 0 ? bridgeCenterX : fallCenterX;
    const actorCenterY = projectedPortal && p === 0 ? height * .46 : bridge < 1 && p === 0 ? bridgeCenterY : fallCenterY;
    const presentedScale = projectedPortal && p === 0 ? fallStartScale : bridge < 1 && p === 0 ? bridgeScale : actorScale;
    actorVisual = placeActor(actorMount, metrics, actorBodyAnchor, actorCenterX, actorCenterY, presentedScale, roll);
    placeActor(actorFrontMount, metrics, actorBodyAnchor, actorCenterX, actorCenterY, presentedScale, roll);
    frontReveal = 0;
    if (p > .5 && p < .58) frontReveal = smooth(.5, .58, p) * .2;
    else if (p >= .58 && p < .66) frontReveal = .2 + smooth(.58, .66, p) * .42;
    else if (p >= .66) frontReveal = .62 + smooth(.66, .74, p) * .38;
    const frontClipBottom = Math.max(0, metrics.mountHeight - metrics.top - metrics.height * frontReveal);
    actorFrontMount.style.clipPath = `inset(0 0 ${frontClipBottom.toFixed(2)}px 0)`;
    actorFrontMount.style.visibility = !characterHidden && frontReveal > .001 ? 'visible' : 'hidden';
    actorMount.style.visibility = !characterHidden && frontReveal < .999 ? 'visible' : 'hidden';
    const crackOpacity = smooth(.5, .57, p) * (1 - smooth(.60, .66, p));
    glass.style.opacity = crackOpacity.toFixed(3);
    glass.style.transform = `scale(${(1 + smooth(.5, .76, p) * .035).toFixed(4)})`;
    const white = smooth(.72, .84, p);
    whiteout.style.opacity = white.toFixed(3);
    environmentMount.style.clipPath = 'none';
    environmentMount.style.opacity = (1 - smooth(.72, .84, p)).toFixed(3);
    environment.draw({ progress: p, reduced });
    fragments.draw({progress: breaking, pane: {left:0,top:0,width,height},opacity:1-smooth(.78,.92,p),backgroundCanvas:environmentMount.querySelector('canvas')});
    const soloReady = p >= .84;
    cta.hidden = !soloReady;
    cta.inert = !soloReady;
    cta.setAttribute('aria-hidden', String(!soloReady));
    if (soloReady) drawStickers(p, nowMs, reduced, width, height);
    else stickerOrbit.querySelectorAll('.fall-cta__sticker').forEach(image => { image.style.opacity = '0'; });
    Object.assign(mount.dataset, { phase, progress: p.toFixed(4), bridgeProgress: bridge.toFixed(4), frontReveal: frontReveal.toFixed(4), tvVisible: 'false', soloReady: String(soloReady), waveComplete: String(waveState.complete) });
    if (waveState.active) wake(); if (p < lastProgress && p < PHASE.welcome) wave.reset(); lastProgress = p;
  }
  function getCharacterRect() {
    const bounds = actorVisual || actorMount.getBoundingClientRect();
    return {
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height,
      footX: Number.isFinite(bounds.footX) ? bounds.footX : bounds.left + bounds.width * .5,
      footY: Number.isFinite(bounds.footY) ? bounds.footY : bounds.bottom,
      bodyX: Number.isFinite(bounds.bodyX) ? bounds.bodyX : bounds.left + bounds.width * .5,
      bodyY: Number.isFinite(bounds.bodyY) ? bounds.bodyY : bounds.top + bounds.height * .42,
      bodyAnchor: actorBodyAnchor,
      footAnchor: actorFootAnchor,
      bounds: actorBounds,
      intrinsicSize: actorIntrinsicSize,
      pose: lastActorPresentation?.phase || mount.dataset.phase,
      poseId: lastActorPresentation?.poseId || null,
      representation: lastActorPresentation?.representation || 'legacy-segmented-fallback',
    };
  }
  function setCharacterHidden(hidden) {
    characterHidden = Boolean(hidden);
    actorFrontMount.style.visibility = !characterHidden && frontReveal > .001 ? 'visible' : 'hidden';
    actorMount.style.visibility = !characterHidden && frontReveal < .999 ? 'visible' : 'hidden';
  }
  return { draw, resize: environment.resize, getCharacterRect, setCharacterHidden, dispose() { environment.dispose(); fragments.dispose(); actor.dispose(); actorFront.dispose(); } };
}
