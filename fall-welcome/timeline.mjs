/**
 * Deterministic structural timeline for HOME -> fall -> welcome.
 *
 * `sampleTimeline(progress, fullyOutside)` is the renderer-facing contract. It
 * has no clock or DOM dependency: seeking or reversing to the same inputs
 * always returns the same structural state. The optional welcome wave is
 * intentionally separate (`createWelcomeWaveClock`) because it may finish on
 * local time after its scroll trigger while all structural motion is paused.
 */

export const AUTHORED_DURATION_SECONDS = 20;

export const PHASE = Object.freeze({
  loss: 0,
  fall: 0.08,
  approach: 0.38,
  brace: 0.52,
  impact: 0.58,
  emergence: 0.62,
  retreat: 0.73,
  solo: 0.84,
  welcome: 0.9,
  end: 1,
});

const PHASE_RANGES = Object.freeze([
  ['loss', PHASE.loss, PHASE.fall],
  ['fall', PHASE.fall, PHASE.approach],
  ['approach', PHASE.approach, PHASE.brace],
  ['brace', PHASE.brace, PHASE.impact],
  ['impact', PHASE.impact, PHASE.emergence],
  ['emergence', PHASE.emergence, PHASE.retreat],
  ['retreat', PHASE.retreat, PHASE.solo],
  ['solo', PHASE.solo, PHASE.welcome],
  ['welcome', PHASE.welcome, PHASE.end],
]);

function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

export function clamp01(value) {
  return Math.max(0, Math.min(1, finite(value, 'progress')));
}

export function segment(progress, start, end) {
  if (!(end > start)) throw new RangeError('segment end must be greater than start');
  return clamp01((finite(progress, 'progress') - start) / (end - start));
}

function phaseAt(progress) {
  if (progress === PHASE.end) return PHASE_RANGES.at(-1);
  return PHASE_RANGES.find(([, start, end]) => progress >= start && progress < end);
}

/** Return all structural scene state for a normalized fall progress. */
export function sampleTimeline(progress, fullyOutside) {
  if (typeof fullyOutside !== 'boolean') {
    throw new TypeError('fullyOutside must be a boolean');
  }

  const p = clamp01(progress);
  const [phase, phaseStart, phaseEnd] = phaseAt(p);
  const phaseProgress = segment(p, phaseStart, phaseEnd);
  const tvRetreat = fullyOutside ? segment(p, PHASE.retreat, PHASE.solo) : 0;
  const soloReady = fullyOutside && p >= PHASE.solo && tvRetreat === 1;

  return Object.freeze({
    progress: p,
    phase,
    phaseProgress,
    phaseLocalTime: (p - phaseStart) * AUTHORED_DURATION_SECONDS,
    actorPoseTime: p * AUTHORED_DURATION_SECONDS,
    fullyOutside,
    tvRetreat,
    tvVisible: tvRetreat < 1,
    soloReady,
    welcomeProgress: soloReady ? segment(p, PHASE.welcome, PHASE.end) : 0,
  });
}

/**
 * Conservative plane/box clearance test.
 *
 * Plane: `{ normal: {x,y,z}, offset }`, where dot(normal, point)+offset is
 * positive toward the audience. Each box supplies `center`, `halfSize`, and
 * optionally three unit `axes` for an oriented box (world XYZ is the default).
 * The whole box must be more than epsilon in front of the fixed source plane.
 */
export function areBoxesFullyOutside(boxes, plane, epsilon = 1e-4) {
  if (!Array.isArray(boxes) || boxes.length === 0) return false;
  finite(epsilon, 'epsilon');
  if (epsilon < 0) throw new RangeError('epsilon must not be negative');

  const n = vector(plane?.normal, 'plane.normal');
  const offset = finite(plane?.offset, 'plane.offset');
  const length = Math.hypot(n.x, n.y, n.z);
  if (length === 0) throw new RangeError('plane.normal must not be zero');
  const normal = { x: n.x / length, y: n.y / length, z: n.z / length };
  const normalizedOffset = offset / length;

  return boxes.every((box) => {
    const center = vector(box?.center, 'box.center');
    const half = vector(box?.halfSize, 'box.halfSize');
    if (half.x < 0 || half.y < 0 || half.z < 0) {
      throw new RangeError('box.halfSize components must not be negative');
    }
    const axes = box.axes ?? [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ];
    if (!Array.isArray(axes) || axes.length !== 3) {
      throw new TypeError('box.axes must contain three vectors');
    }
    const unitAxes = axes.map((axis) => normalized(vector(axis, 'box.axis')));
    const radius = Math.abs(dot(normal, unitAxes[0])) * half.x
      + Math.abs(dot(normal, unitAxes[1])) * half.y
      + Math.abs(dot(normal, unitAxes[2])) * half.z;
    const nearestDistance = dot(normal, center) + normalizedOffset - radius;
    return nearestDistance > epsilon;
  });
}

function vector(value, label) {
  return {
    x: finite(value?.x, `${label}.x`),
    y: finite(value?.y, `${label}.y`),
    z: finite(value?.z, `${label}.z`),
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalized(value) {
  const length = Math.hypot(value.x, value.y, value.z);
  if (length === 0) throw new RangeError('box axis must not be zero');
  return { x: value.x / length, y: value.y / length, z: value.z / length };
}

/**
 * A single finite local-time wave. Call `sample({progress, fullyOutside,
 * nowMs})` from the owner's render loop. Crossing into welcome starts it;
 * staying there lets it finish without scroll. Reversing below the trigger or
 * losing clearance cancels immediately, so no timers or queued waves survive.
 */
export function createWelcomeWaveClock({ durationMs = 1800 } = {}) {
  finite(durationMs, 'durationMs');
  if (durationMs <= 0) throw new RangeError('durationMs must be greater than zero');
  let startedAt = null;
  let lastNow = null;
  let lastProgress = null;
  let active = false;
  let complete = false;
  let armed = true;

  return Object.freeze({
    sample({ progress, fullyOutside, nowMs }) {
      const p = clamp01(progress);
      const now = finite(nowMs, 'nowMs');
      if (lastNow !== null && now < lastNow) throw new RangeError('nowMs must be monotonic');
      lastNow = now;
      const eligible = fullyOutside === true && p >= PHASE.welcome;
      const reversing = lastProgress !== null && p < lastProgress;
      lastProgress = p;

      if (!eligible) {
        startedAt = null;
        active = false;
        complete = false;
        armed = p < PHASE.welcome;
        return Object.freeze({ progress: 0, active: false, complete: false });
      }
      if (reversing) {
        startedAt = null;
        active = false;
        complete = false;
        armed = false;
        return Object.freeze({ progress: 0, active: false, complete: false });
      }
      if (!armed) {
        return Object.freeze({ progress: 0, active: false, complete: false });
      }
      if (startedAt === null && !complete) {
        startedAt = now;
        active = true;
      }
      if (complete) {
        return Object.freeze({ progress: 1, active: false, complete: true });
      }
      const waveProgress = Math.min(1, (now - startedAt) / durationMs);
      if (waveProgress === 1) {
        active = false;
        complete = true;
      }
      return Object.freeze({
        progress: waveProgress,
        active,
        complete,
      });
    },
    reset() {
      startedAt = null;
      lastNow = null;
      lastProgress = null;
      active = false;
      complete = false;
      armed = true;
    },
  });
}
