// Projection contract only. Does not mutate the preserved HOME or own a RAF.
function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

export function toNDC(point, viewport) {
  const width = finite(viewport.width, 'width');
  const height = finite(viewport.height, 'height');
  if (width <= 0 || height <= 0) throw new RangeError('Viewport must be positive');
  return {
    x: 2 * finite(point.x, 'x') / width - 1,
    y: 1 - 2 * finite(point.y, 'y') / height
  };
}

export function measureAperture(element) {
  if (!element || typeof element.getBoundingClientRect !== 'function') {
    throw new TypeError('Screen aperture element required');
  }
  // getBoxQuads retains the four projected corners when supported.
  const quads = element.getBoxQuads?.({ box: 'border' });
  if (quads?.length) {
    const q = quads[0];
    return [q.p1, q.p2, q.p3, q.p4].map(({ x, y }) => ({ x, y }));
  }
  // A bounding rectangle is not a valid substitute for a tilted screen.
  const view = element.ownerDocument?.defaultView;
  if (!view) throw new TypeError('Connected document view required');
  for (let node = element; node; node = node.parentElement) {
    const css = view.getComputedStyle(node);
    const matrix = css.transform;
    if (matrix && matrix !== 'none') {
      const values = matrix.match(/^matrix\(([^)]+)\)$/)?.[1].split(',').map(Number);
      if (!values || values.length !== 6 || values.some(v => !Number.isFinite(v)) ||
          values[1] !== 0 || values[2] !== 0 || values[0] <= 0 || values[3] <= 0) {
        throw new Error('Projected aperture corners required for rotated/perspective HOME');
      }
    }
    if ((css.rotate && css.rotate !== 'none') ||
        (css.perspective && css.perspective !== 'none')) {
      throw new Error('Projected aperture corners required for rotated/perspective HOME');
    }
  }
  const { left, top, right, bottom } = element.getBoundingClientRect();
  return [{ x: left, y: top }, { x: right, y: top },
    { x: right, y: bottom }, { x: left, y: bottom }];
}

export function handoffError(source, target) {
  if (!Array.isArray(source) || !Array.isArray(target) || source.length !== 4 || target.length !== 4) {
    throw new TypeError('Two ordered four-corner apertures required');
  }
  return Math.max(...source.map((point, i) => Math.hypot(
    finite(point.x, 'source.x') - finite(target[i].x, 'target.x'),
    finite(point.y, 'source.y') - finite(target[i].y, 'target.y')
  )));
}

export function canHandoff({ source, target, assetsReady, poseMatched, exposureMatched, tolerance = 2 }) {
  finite(tolerance, 'tolerance');
  if (tolerance < 0) throw new RangeError('Tolerance cannot be negative');
  return assetsReady === true && poseMatched === true && exposureMatched === true &&
    handoffError(source, target) <= tolerance;
}
