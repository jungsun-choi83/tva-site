/**
 * Native-scroll input helpers. This module installs no wheel, touch or key
 * handlers and owns no RAF. The scene owner reads its rail and calls `step`.
 */

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function positive(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and greater than zero`);
  }
  return value;
}

/** Map one native rail distance to HOME bridge b followed by fall p. */
export function mapRailDistance(distance, bridgeDistance, fallDistance) {
  if (!Number.isFinite(distance)) throw new TypeError('distance must be finite');
  const bridge = positive(bridgeDistance, 'bridgeDistance');
  const fall = positive(fallDistance, 'fallDistance');
  const totalDistance = bridge + fall;
  const traveled = Math.max(0, Math.min(totalDistance, distance));
  return Object.freeze({
    distance: traveled,
    totalProgress: traveled / totalDistance,
    bridgeProgress: clamp01(traveled / bridge),
    progress: clamp01((traveled - bridge) / fall),
  });
}

/**
 * Read traveled pixels from a sticky rail's viewport-relative top edge.
 * `railTopAtStart` is the rail top when b=0; usually 0 or a measured anchor.
 */
export function sampleNativeRail({ railTop, railTopAtStart = 0, bridgeDistance, fallDistance }) {
  if (!Number.isFinite(railTop) || !Number.isFinite(railTopAtStart)) {
    throw new TypeError('rail positions must be finite');
  }
  return mapRailDistance(railTopAtStart - railTop, bridgeDistance, fallDistance);
}

/** Frame-rate-independent exponential presentation smoothing. */
export function smoothProgress(current, target, deltaMs, { tauMs = 100, maxDeltaMs = 64, epsilon = 1e-4 } = {}) {
  if (![current, target, deltaMs, tauMs, maxDeltaMs, epsilon].every(Number.isFinite)) {
    throw new TypeError('smoothing values must be finite');
  }
  if (tauMs <= 0 || maxDeltaMs <= 0 || epsilon < 0 || deltaMs < 0) {
    throw new RangeError('invalid smoothing configuration');
  }
  const from = clamp01(current);
  const to = clamp01(target);
  const dt = Math.min(deltaMs, maxDeltaMs);
  const next = to + (from - to) * Math.exp(-dt / tauMs);
  return Math.abs(next - to) <= epsilon ? to : next;
}

/**
 * Stateful adapter for a render loop. Smooths the single combined rail value,
 * then derives b and p from that same distance so the HOME/fall boundary cannot
 * drift. Distances are fixed for the adapter lifetime. On resize, retain its
 * `totalProgress`, create an adapter with the new distances, then call `seek`.
 */
export function createRailProgress({ bridgeDistance, fallDistance, tauMs = 100 } = {}) {
  const bridge = positive(bridgeDistance, 'bridgeDistance');
  const fall = positive(fallDistance, 'fallDistance');
  const total = bridge + fall;
  let presented = 0;

  return Object.freeze({
    step(distance, deltaMs) {
      const target = mapRailDistance(distance, bridge, fall);
      presented = smoothProgress(presented, target.totalProgress, deltaMs, { tauMs });
      const state = mapRailDistance(presented * total, bridge, fall);
      return Object.freeze({ ...state, targetTotalProgress: target.totalProgress });
    },
    seek(totalProgress) {
      if (!Number.isFinite(totalProgress)) throw new TypeError('totalProgress must be finite');
      presented = clamp01(totalProgress);
      return mapRailDistance(presented * total, bridge, fall);
    },
    get totalProgress() {
      return presented;
    },
  });
}
