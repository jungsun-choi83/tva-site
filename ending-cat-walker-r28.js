// ending-cat-walker-r28.js
//
// Fix for the "cat walks backwards" bug in ending-scene-r15.js: the primitive cat's root.rotation.y
// was a hand-picked constant that didn't actually point the cat's head (local +X, see makeCat() in
// ending-scene-r15.js) along its direction of travel. Also upgrades the passing human ("walker") from
// a position slide to a natural stroll: a real path tangent for heading, and a Walk-clip phase driven
// by distance instead of raw progress, so the feet plant instead of sliding.
//
// This module is read-only with respect to ending-scene-r15.js (another worker owns that file). It only
// *reads* the per-frame cat/walker block described in the task brief to match conventions:
//   - scene: OrthographicCamera(-7.5,7.5,5,-5) at z=10, room plate 15x10 at z=-4
//   - actors: root.rotation.x = ISO_TILT (30deg) is applied first, then root.rotation.y carries heading
//   - makeCat(): head at local x=+.34 (i.e. the cat's "forward" is local +X), tail at local x=-.3
//   - createHuman() rigs (ending-humans-r13.js): body/head/left+rightArm/left+rightLeg bones, Walk clip,
//     phase driven into poseHumanWalk(human, phase, weight) via mixer.setTime(phase*duration)
//
// ---- Derivation of catHeading (verified by rendering, see runtime/ending-cat-walker-r28/derive-heading.mjs
// and the screenshots in runtime/ending-cat-walker-r28/) ----
//
// A THREE.Object3D's default Euler order is 'XYZ'. For a root with rotation.x = ISO_TILT set once and
// rotation.y = rotY set per frame (rotation.z left at 0, exactly how the cat/walker roots are driven in
// ending-scene-r15.js), sampling the resulting world direction of a local unit vector at many rotY values
// (see derive-heading.mjs) gives closed forms:
//
//   local +X (the cat's forward): worldDir = (cos(rotY), sin(rotY)*sin(ISO_TILT), -sin(rotY)*cos(ISO_TILT))
//   local +Z (the human rig's forward, verified in diag-facing.png: rotation.y=0 faces the camera):
//             worldDir = (sin(rotY), -cos(rotY)*sin(ISO_TILT), cos(rotY)*cos(ISO_TILT))
//
// The camera is an orthographic camera looking straight down -Z, so only the worldDir.xy matters for what
// reads on screen; z only affects depth sort. So for a desired 2D travel direction (tx,ty) we solve for the
// rotY that makes worldDir.xy proportional (same direction, any positive scale) to (tx,ty):
//
//   local +X forward:  rotY = atan2(ty / sin(ISO_TILT), tx)
//   local +Z forward:  rotY = atan2(tx, -ty / sin(ISO_TILT))
//
// The old code used a constant `rotation.y = -Math.PI/2 + .35` for the cat while it travelled from x=3.0 to
// x=-2.3 (i.e. -X, leftward). Plugging that constant into the +X formula above gives a world head direction
// of roughly (0.34, -0.47, 0.81) — pointing mostly +X/away from the travel direction. That confirms the
// "walks backwards" bug: the head was aimed almost opposite the direction of travel. The correct heading for
// that same leftward travel, per the formula, is ~180 degrees (rotY = Math.PI), which points the head at
// world dir (-1, ~0, ~0): straight along the direction of travel. See derive-heading.mjs's printed sweep
// table and runtime/ending-cat-walker-r28/*.png for the rendered proof.

import { poseHumanWalk } from './ending-humans-r13.js';

const ISO_TILT = Math.PI / 6; // matches ending-scene-r15.js's ISO_TILT (30deg elevation)

const clamp01 = v => Math.max(0, Math.min(1, v));
const defaultLerp = (a, b, t) => a + (b - a) * t;
const defaultSmooth = v => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const defaultSegment = (v, a, b) => defaultSmooth((v - a) / (b - a));

function resolveHelpers(helpers) {
  return {
    lerp: (helpers && helpers.lerp) || defaultLerp,
    segment: (helpers && helpers.segment) || defaultSegment,
    smooth: (helpers && helpers.smooth) || defaultSmooth,
  };
}

/**
 * catHeading(THREE, from, to)
 *
 * Returns the root.rotation.y that makes the primitive cat's head (local +X, see makeCat()) point along
 * the screen-space direction from `from` to `to` (each {x,y}, world/room-plate coordinates), given the
 * cat's root.rotation.x is already set to ISO_TILT and rotation.z is 0 (exactly how ending-scene-r15.js
 * drives cat.root). See the module-header derivation above; verified against rendered screenshots in
 * runtime/ending-cat-walker-r28/.
 */
export function catHeading(THREE, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return 0;
  return Math.atan2(dy / Math.sin(ISO_TILT), dx);
}

// Same derivation as catHeading, but for a rig whose forward axis is local +Z (the createHuman() rig —
// verified in runtime/ending-cat-walker-r28/diag-facing.png: at rotation.y=0 the model faces the camera,
// i.e. its forward is +Z, not +X like the cat).
function humanHeading(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return 0;
  return Math.atan2(dx, -dy / Math.sin(ISO_TILT));
}

// ---- cat walk ----
//
// Path: (3.0,-2.45) -> (-2.3,-2.0) across p .34-.60, with a pause .44-.53 where the cat sits and looks
// around (tail sways, "head" [whole-body yaw, the primitive cat has no separate head bone] turns toward
// the camera) instead of continuing to slide across the rug.
const CAT_START = { x: 3.0, y: -2.45 };
const CAT_END = { x: -2.3, y: -2.0 };
const CAT_PATH_START = .34, CAT_PATH_END = .60;
const CAT_PAUSE_IN_START = .44, CAT_PAUSE_IN_END = .47;
const CAT_PAUSE_OUT_START = .50, CAT_PAUSE_OUT_END = .53;
// fraction of the total distance covered by the time the pause begins (p=.44) vs after it ends (p=.53) —
// split proportionally to how much of the .34-.60 travel window sits before/after the pause, so the cat's
// walking speed doesn't jump discontinuously when it resumes.
// r58: pause spot moved east to x~1.9 (frac .21, was time-proportional .36 -> x~1.09). The walker now
// stops at (.55,-2.28) and walks through x~1.09 at p~.45, i.e. straight through the old pause spot; at
// x~1.9 the walker has already passed (p~.36) before the cat gets there (p~.44), and the scene bows the
// post-pause leg toward the camera around the walker's feet (see ending-scene-r15.js catDetour).
const CAT_PRE_PAUSE_DIST_FRAC = .21;

// distance the cat travels, in world units, per full walk() cycle (phase advancing by 1). Tuned from the
// original hand-authored ratio in ending-scene-r15.js (`cat.walk(catRun*9, ...)` over the ~5.32-unit
// crossing => ~0.59 world units/cycle) and confirmed by rendering (paws plant, no visible slide) — see
// runtime/ending-cat-walker-r28/ crop screenshots at p=.36/.40/.46/.50/.56.
const CAT_STRIDE_WORLD = 0.591;

const TOTAL_CAT_DISTANCE = Math.hypot(CAT_END.x - CAT_START.x, CAT_END.y - CAT_START.y);

/**
 * updateCat(THREE, cat, p, helpers)
 *
 * Drives the primitive cat (from makeCat()) across the rug. Moves it right-to-left with a mid-path pause
 * to sit and look around, always facing its direction of travel (fixing the "walks backwards" bug), and
 * advances its leg/tail cycle by DISTANCE travelled (not by p directly) so the paws plant instead of
 * sliding.
 *
 * Sets cat.root.position/rotation.y/visible and calls cat.walk(...) directly. Returns the current
 * {x,y,visible,heading} so the caller (ending-scene-r15.js) can keep its own catShadow in sync, since the
 * shadow mesh isn't passed into this module.
 */
export function updateCat(THREE, cat, p, helpers) {
  const { segment, smooth, lerp } = resolveHelpers(helpers);

  const visible = p > .32 && p < .62;

  // travel: 0..1 fraction of the CAT_START->CAT_END distance covered, smoothstep-eased into and out of a
  // flat plateau during the pause window (instead of the old code's single smoothstep across the whole
  // .34-.60 span, which kept moving fastest exactly during the pause).
  let travel;
  if (p <= CAT_PATH_START) travel = 0;
  else if (p < CAT_PAUSE_IN_START) {
    travel = CAT_PRE_PAUSE_DIST_FRAC * smooth(segment(p, CAT_PATH_START, CAT_PAUSE_IN_START));
  } else if (p < CAT_PAUSE_OUT_END) {
    travel = CAT_PRE_PAUSE_DIST_FRAC;
  } else if (p < CAT_PATH_END) {
    travel = CAT_PRE_PAUSE_DIST_FRAC + (1 - CAT_PRE_PAUSE_DIST_FRAC) * smooth(segment(p, CAT_PAUSE_OUT_END, CAT_PATH_END));
  } else travel = 1;

  const x = lerp(CAT_START.x, CAT_END.x, travel);
  const y = lerp(CAT_START.y, CAT_END.y, travel);

  // triangular pulse across the pause window: 0 -> 1 (.44-.47) -> 1 (.47-.50) -> 0 (.50-.53), same shape
  // as the original authored `catPause=segment(p,.44,.47)*(1-segment(p,.5,.53))`.
  const pause = segment(p, CAT_PAUSE_IN_START, CAT_PAUSE_IN_END) * (1 - segment(p, CAT_PAUSE_OUT_START, CAT_PAUSE_OUT_END));

  const heading = catHeading(THREE, CAT_START, CAT_END);
  // while paused, turn further toward the camera to sell "sitting and looking around" (same +.9rad turn
  // amount the original authored code used for this beat — it read fine, the bug was only the base
  // heading being wrong) — see module header derivation: this pushes the head's world Z component from
  // slightly negative (away from camera) to clearly positive (toward camera).
  cat.root.rotation.y = heading + pause * .9;
  cat.root.position.set(x, y, .25);
  cat.root.visible = visible;

  // distance-driven gait: phase = distance travelled / stride length, so a paw takes one full step for
  // every CAT_STRIDE_WORLD world units actually covered (no drift with the pause plateau, since distance
  // stops advancing while travel is frozen at CAT_PRE_PAUSE_DIST_FRAC).
  const distanceTravelled = travel * TOTAL_CAT_DISTANCE;
  const walkPhase = distanceTravelled / CAT_STRIDE_WORLD;
  // legs freeze (speed factor -> 0) during the pause; the tail keeps swaying regardless (see makeCat's
  // walk(): the tail's rotation only depends on phase, not the speed factor) — driven here by `p` itself
  // (not distance, since distance is frozen) so it keeps moving while sitting.
  const legSpeed = 1 - pause;
  const tailPhase = pause > 0 ? p * 14 : walkPhase;
  cat.walk(tailPhase, legSpeed);

  return { x, y, visible, heading: cat.root.rotation.y };
}

// ---- walker (passing human) ----
//
// Path: (2.8,-3.2) -> (1.25,-2.68) across p .18-.52, eased (smoothstep, via `segment`) instead of a raw
// lerp so the stroll accelerates/decelerates naturally. Heading comes from the path tangent (constant here
// since the path is a straight line) fed through humanHeading() (forward = local +Z, verified by
// rendering — see diag-facing.png). The Walk clip's phase is driven by distance travelled divided by the
// clip's own stride length (measured by sampling both shoes' world Z across the clip, the same
// foot-trace approach ending-scene-r15.js's mascot walk cycle uses) so the feet plant instead of sliding.
const WALKER_START = { x: 2.8, y: -3.2 };
const WALKER_END = { x: 1.25, y: -2.68 };
const WALKER_PATH_START = .18, WALKER_PATH_END = .52;
const WALKER_STOP_START = .48, WALKER_STOP_END = .53;
const WALKER_HEAD_TURN_START = .49, WALKER_HEAD_TURN_END = .56;

const TOTAL_WALKER_DISTANCE = Math.hypot(WALKER_END.x - WALKER_START.x, WALKER_END.y - WALKER_START.y);

// Measured with runtime/ending-cat-walker-r28/diag-walker.mjs: driving the Walk clip alone (weight 1) and
// sampling leftLeg.shoe/rightLeg.shoe world-Z (root at identity, no scale) across the full clip gives a
// peak-to-peak Z range of 1.212 model-local units per full gait cycle (both feet: -0.6197..0.5923). The
// walker's root is scaled by .88 in the scene (see the `h.root.scale.setScalar(.88)` loop in
// ending-scene-r15.js), so in world/scene units one full Walk-clip cycle covers:
const WALKER_STRIDE_LOCAL = 1.212;
const WALKER_ROOT_SCALE = .88; // must match ending-scene-r15.js's `h.root.scale.setScalar(.88)` for the humans
const WALKER_STRIDE_WORLD = WALKER_STRIDE_LOCAL * WALKER_ROOT_SCALE;

/**
 * updateWalker(THREE, walker, p, helpers)
 *
 * Moves the passing human along a straight stroll instead of a slide: eased position, a heading computed
 * from the actual path tangent (not a hand-picked constant), a Walk-clip phase driven by distance so the
 * feet plant, a blend down to Idle_Neutral as it arrives, and a small head turn toward the talkers group
 * at the end.
 */
export function updateWalker(THREE, walker, p, helpers) {
  const { segment, smooth, lerp } = resolveHelpers(helpers);

  const pass = segment(p, WALKER_PATH_START, WALKER_PATH_END);
  const x = lerp(WALKER_START.x, WALKER_END.x, pass);
  const y = lerp(WALKER_START.y, WALKER_END.y, pass);

  // path tangent -> heading. The path is a straight line so the tangent (WALKER_END - WALKER_START) is
  // constant along the whole stroll; computed via the analytic derivative of lerp(), i.e. just the
  // endpoint delta, rather than a finite difference, since it's exact here and avoids a div-by-zero at
  // the very start/end of the eased segment (where d(pass)/dp -> 0).
  const heading = humanHeading(WALKER_START, WALKER_END);
  walker.root.rotation.y = heading;
  walker.root.position.set(x, y, .2);

  const distanceTravelled = pass * TOTAL_WALKER_DISTANCE;
  const walkPhase = distanceTravelled / WALKER_STRIDE_WORLD;
  const stopWeight = 1 - segment(p, WALKER_STOP_START, WALKER_STOP_END); // 1 = full Walk, 0 = full Idle_Neutral
  poseHumanWalk(walker, walkPhase, stopWeight);

  // small head turn toward the talkers (chatA/chatB, both to this walker's -X side near the end of the
  // path) as the walker arrives and settles — applied after the mixer/pose update so it stacks on top of
  // the Walk/Idle clip's own head bone animation (same pattern as poseReaderSeated's post-clip head nod
  // in ending-scene-r15.js).
  const headTurn = segment(p, WALKER_HEAD_TURN_START, WALKER_HEAD_TURN_END) * .32;
  if (walker.head) walker.head.rotateY(headTurn);

  return { x, y, heading, walkPhase, stopWeight };
}
