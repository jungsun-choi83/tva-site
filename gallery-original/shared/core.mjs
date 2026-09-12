export const works = [
  { id: '01', title: 'Sunset Beach', year: '2026', discipline: 'Selfie', file: '01.jpg' },
  { id: '02', title: 'Golden Hour', year: '2026', discipline: 'Selfie', file: '02.jpg' },
  { id: '03', title: 'Park Walk', year: '2026', discipline: 'Selfie', file: '03.jpg' },
  { id: '04', title: 'Sofa Sunday', year: '2026', discipline: 'Selfie', file: '04.jpg' },
  { id: '05', title: 'Rain Window', year: '2026', discipline: 'Selfie', file: '05.jpg' },
  { id: '06', title: 'Night Drive', year: '2026', discipline: 'Selfie', file: '06.jpg' },
  { id: '07', title: 'Kitchen Light', year: '2026', discipline: 'Selfie', file: '07.jpg' },
  { id: '08', title: 'First Snow', year: '2026', discipline: 'Selfie', file: '08.jpg' },
];

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function wrap(value, min, max) {
  const range = max - min;
  if (range === 0) return min;
  return ((((value - min) % range) + range) % range) + min;
}

export function rubberband(value, min, max, resistance = 0.18) {
  if (value < min) return min - (min - value) * resistance;
  if (value > max) return max + (value - max) * resistance;
  return value;
}

export function projectMomentum(velocity, multiplier = 0.18, cap = 2.5) {
  return clamp(velocity * multiplier, -cap, cap);
}

export function projectConcave(offset, {
  stageWidth,
  edgeOffset = 3,
  minScale = 0.5,
  arc = 80,
  depth = 40,
  falloff = 1,
  spread = 0.88,
} = {}) {
  const thetaEdge = 72 * Math.PI / 180;
  const thetaClamp = 95 * Math.PI / 180;
  const rawTheta = offset * thetaEdge / edgeOffset;
  const theta = clamp(rawTheta, -thetaClamp, thetaClamp);
  const halfWidth = stageWidth / 2;
  const x = Math.sin(theta) / Math.sin(thetaEdge) * halfWidth * spread;
  const edgeProgress = clamp(Math.abs(offset) / edgeOffset, 0, 1);
  const scaleProgress = clamp(edgeProgress * falloff, 0, 1);
  const scale = 1 - (1 - minScale) * scaleProgress;
  const normalizedX = x / halfWidth;

  return {
    x,
    y: arc * (0.5 - normalizedX * normalizedX),
    z: -depth * edgeProgress,
    scale,
    rotation: -(theta * 180 / Math.PI) * 0.18,
    opacity: clamp(1 - Math.max(0, edgeProgress - 0.08) * 0.55, 0.18, 1),
    visible: Math.abs(rawTheta) < thetaClamp,
  };
}

export const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

export function createSpring({
  initial = 0,
  stiffness = 0.12,
  damping = 0.78,
  precision = 0.001,
  onUpdate = () => {},
} = {}) {
  let value = initial;
  let target = initial;
  let velocity = 0;
  let frame = 0;

  const tick = () => {
    const force = (target - value) * stiffness;
    velocity = (velocity + force) * damping;
    value += velocity;
    onUpdate(value, velocity);
    if (Math.abs(target - value) < precision && Math.abs(velocity) < precision) {
      value = target;
      velocity = 0;
      onUpdate(value, velocity);
      frame = 0;
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  return {
    get value() { return value; },
    get target() { return target; },
    set(next, { immediate = false } = {}) {
      target = next;
      if (immediate || prefersReducedMotion()) {
        value = target;
        velocity = 0;
        onUpdate(value, velocity);
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        return;
      }
      if (!frame) frame = requestAnimationFrame(tick);
    },
    nudge(amount) {
      velocity += amount;
      if (!frame) frame = requestAnimationFrame(tick);
    },
    stop() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      target = value;
      velocity = 0;
    },
  };
}

export function createDrag({
  element,
  axis = 'x',
  threshold = 6,
  onStart = () => {},
  onMove = () => {},
  onEnd = () => {},
} = {}) {
  if (!element) throw new Error('createDrag requires an element.');
  let active = false;
  let moved = false;
  let pointerId = null;
  let origin = { x: 0, y: 0 };
  let previous = { x: 0, y: 0 };
  let samples = [];

  const coordinate = (point) => (axis === 'y' ? point.y : point.x);
  const pointFrom = (event) => ({ x: event.clientX, y: event.clientY, time: performance.now() });

  const pointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    active = true;
    moved = false;
    pointerId = event.pointerId;
    origin = pointFrom(event);
    previous = origin;
    samples = [origin];
    element.setPointerCapture?.(pointerId);
    element.dataset.dragging = 'true';
    onStart({ event, point: origin });
  };

  const pointerMove = (event) => {
    if (!active || event.pointerId !== pointerId) return;
    const point = pointFrom(event);
    const total = coordinate(point) - coordinate(origin);
    const delta = coordinate(point) - coordinate(previous);
    if (!moved && Math.abs(total) >= threshold) moved = true;
    samples.push(point);
    const cutoff = point.time - 80;
    samples = samples.filter((sample) => sample.time >= cutoff);
    previous = point;
    if (moved) {
      event.preventDefault();
      onMove({ event, point, delta, total });
    }
  };

  const finish = (event, cancelled = false) => {
    if (!active || event.pointerId !== pointerId) return;
    const point = pointFrom(event);
    const first = samples[0] || origin;
    const duration = Math.max(16, point.time - first.time);
    const velocity = (coordinate(point) - coordinate(first)) / duration;
    element.releasePointerCapture?.(pointerId);
    delete element.dataset.dragging;
    active = false;
    pointerId = null;
    onEnd({ event, point, moved, cancelled, velocity });
  };

  element.addEventListener('pointerdown', pointerDown);
  element.addEventListener('pointermove', pointerMove, { passive: false });
  element.addEventListener('pointerup', (event) => finish(event));
  element.addEventListener('pointercancel', (event) => finish(event, true));

  return {
    get active() { return active; },
    destroy() {
      element.removeEventListener('pointerdown', pointerDown);
      element.removeEventListener('pointermove', pointerMove);
    },
  };
}

export function setCurrent(elements, index, { focusable = true } = {}) {
  [...elements].forEach((element, itemIndex) => {
    const current = itemIndex === index;
    element.toggleAttribute('aria-current', current);
    if (focusable) element.tabIndex = current ? 0 : -1;
  });
}

export function announce(message, target = typeof document !== 'undefined' ? document.querySelector('#status') : null) {
  if (!target) return;
  target.textContent = '';
  requestAnimationFrame(() => { target.textContent = message; });
}

export function assetPath(file, depth = 1) {
  return `${'../'.repeat(depth)}assets/photos/${file}`;
}
