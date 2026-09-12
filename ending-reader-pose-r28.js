// ending-reader-pose-r28.js
// Standalone V2 sofa-reader pose. Does NOT touch ending-scene-r15.js or ending-humans-r13.js (another worker owns
// ending-scene-r15.js right now). Reuses only the bones ending-humans-r13.js's createHuman exposes:
// human.body, human.head, human.leftArm/rightArm {upper, fore, hand}, human.leftLeg/rightLeg {upper, lower, shoe}.
//
// The aim-bone technique (aimBoneLocal) is copied verbatim from ending-scene-r15.js's local poseReaderSeated /
// aimBoneLocal (search those names in that file) — same math, reimplemented here rather than imported, since the
// scene file doesn't export it and is off-limits to edit. THREE is passed in by the caller (not imported locally)
// so this module always operates on the caller's THREE.Quaternion/THREE.Vector3 instances — never a second
// three.js module instance, which would break `instanceof` checks used inside three's own math classes.
//
// Bone-axis findings (measured by test-rotating each bone and comparing screenshots against the reference frame,
// not assumed from the rig name):
//   - aimBoneLocal(bone, dir) reorients `bone` so its local +Y axis points along `dir`, where `dir` is first
//     rotated into the character MODEL's world orientation, then re-expressed in the bone's own PARENT's local
//     space. So `dir` is effectively "a direction in the model's own front-facing frame" for any bone whose
//     parent chain has not itself been re-aimed (true for both leg-upper and both arm-upper here).
//   - For a leg's upper bone, dir=(0,-1,0) = leg hanging straight down (standing). Increasing the +Z component
//     (dir.z toward 1) swings the thigh FORWARD (toward the model's front, i.e. away from the seat back) while
//     keeping the shin roughly vertical when the lower-leg bone is re-aimed too — this is what produces the
//     horizontal, seated thigh. A small dir.x (±) fans the knees apart/together (± = left/right leg sides).
//   - For a leg's lower bone (shin), dir=(0,-1,0) keeps the shin hanging straight down from the knee; a small
//     negative dir.z (~-.05) pulls the ankle back very slightly under the knee instead of the foot sliding
//     forward, which reads as "foot flat on the floor" rather than "leg kicked out."
//   - CORRECTED r47 (an earlier comment here had the Body-bone sign backwards, which is why the pose kept
//     looking unchanged across revisions). Directly measured by reading the posed rig's actual world-space bone
//     quaternions (not by eyeballing a comment): human.body.rotateX(+x) with x>0 actually tips the torso MORE
//     FORWARD; human.body.rotateX(-x) is what tips it BACK into the sofa. So this file applies rotateX(-recline)
//     with a POSITIVE recline default, keeping the opts name/sign intuitive ("bigger recline = leans back more")
//     while matching the bone's actual rotation sign.
//   - human.head.rotateX(+) tips the head DOWN toward the book (positive headTilt = more forward/down pitch,
//     confirmed by direct measurement).
//   - Foot placement keeps using the same placeFootAtCalfLocal approach as ending-scene-r15.js: recompute the
//     foot's position from the (now re-aimed) lower-leg bone's own local "sole" offset, then apply a stored
//     idle-pose foot orientation so shoes stay flat on the floor instead of inheriting the shin's new tilt.
//
// ---- r48 REWRITE: book-first 2-bone arm IK (previous r28-r47 approach posed both arms with aimBoneLocal
// "guessed" directions toward a book that was itself placed AFTER the hands, at their midpoint). That chain
// looked fine in the standalone test harness (test.html has its OWN, WRONG book geometry — different width,
// height and page-rotation than the real book ending-scene-r15.js actually builds — so the harness's "hands
// near book" measurement was measuring against a book shape that doesn't exist in the real scene) but in the
// real scene the aimed hands landed on the thighs while the real book (bigger, flatter pages, tilted 30° each
// way, see ending-scene-r15.js's `leftPage`/`rightPage`) floated at the chest, untouched.
//
// The fix inverts the dependency: the book's pose is now decided FIRST, in the reader's own chest/shoulder
// frame, independent of where the hands happen to end up; the two book corners the hands must reach are derived
// from that pose using the REAL book geometry (read from ending-scene-r15.js, not the stale test-harness copy);
// then each arm is solved as a proper 2-bone IK chain (shoulder -> elbow -> wrist) onto its own corner, using
// this rig's ACTUAL bone lengths measured at runtime from the bones' own world positions (translation-only
// offsets, so their length is correct regardless of the bone's current rotation — no hardcoded "mascot" bone
// lengths carried over from ending-scene-r15.js's separate hand-authored rig).
//
// Book geometry read from ending-scene-r15.js (createEndingScene, ~line 549 at the time of writing): bookRoot's
// two pages are BoxGeometry(.26,.20,.03) at local x=∓.12, rotated leftPage.rotation.z=-PI/6, rightPage.rotation.z
// =+PI/6. The grip corner is each page's OUTER-BOTTOM corner (away from the spine, at the bottom edge): in the
// page's own local frame that's (∓.13,-.10), rotated by the page's own z-rotation about its local origin, then
// offset by the page's local x position. Worked out by hand (and cross-checked with a throwaway page.evaluate
// probe against three.js's own Vector3, not just algebra on paper):
//   leftPage corner  = rotateZ(-PI/6, (-.13,-.10)) + (-.12,0)  ≈ (-.2826, -.0216)
//   rightPage corner = rotateZ(+PI/6, ( .13,-.10)) + ( .12,0)  ≈ ( .2826, -.0216)
// These are exposed below as bookCornerX/bookCornerY so a future book-geometry change only needs updating two
// numbers here (or passing opts overrides) rather than re-deriving the rotation by hand again.
//
// Screen/world-side mapping (measured, not assumed): with reader.root.rotation.y=0 (no yaw flip) and bookRoot's
// quaternion copied straight from human.model's world quaternion (no mirroring), the book's local -X side sits
// on the SAME world/screen side as the character's own local -X side, which a runtime probe
// (human.leftArm.upper vs human.rightArm.upper world x, both in idle and seated pose) showed is the RIGHT arm's
// side (leftArm sits at the more-positive x). So: book's +X corner -> LEFT hand, book's -X corner -> RIGHT hand.
//
// The 2-bone solve itself is the same law-of-cosines shape ending-scene-r15.js's mascot desk IK uses
// (`deskHandTargets`/the per-arm loop that builds `elbowDirection` from `along`/`height` and a pole-vector
// bias) — read there for the derivation — but reimplemented from scratch here in WORLD space (not
// "rig-local-happens-to-equal-world" space like the mascot's simple hand-built rig): this human rig is a real
// loaded skeleton, so `arm.upper`'s parent is a shoulder/clavicle bone, not the top-level model, and a
// direction has to be explicitly reprojected into each bone's own parent's current world orientation
// (`aimBoneWorld` below, the same reprojection `aimBoneLocal` already does, just skipping the "assume the input
// is expressed in the model's own front-facing frame" step since IK targets are already real world positions).
//
// TARGET (measured off the Sims-1 reference /Volumes/교육자료/AI_Hub/QA_Evidence/tva-claude-20260909/
// sims-reference/balloon_02_speech_conversation_and_sofa.jpg, seated reader on the blue sofa):
//   torso axis vs vertical:        leaning BACK ~10-15deg into the backrest (NOT forward)
//   head pitch:                    ~level to ~10deg down (a modest down-nod toward the book, not a big droop)
//   book centre height:            ~chin/upper-chest, held up in front of the face
//   arms:                          upper arms/elbows stay near the ribs; forearms fold UP so both hands land on
//                                   the book's own two lower corners, not floating above or hanging at the hips
//   legs:                          thighs ~horizontal on the cushion, shins ~vertical, feet flat, knees ~hip-width
// Torso/head/leg defaults are unchanged from r47 (already verified against this target — see the measured
// numbers that used to live in this comment block, still true: recline=.24 -> ~13.6deg back-lean; headTilt=.30
// -> ~3-4deg down-nod off the neutral baseline). Only the arms/book section below changed for r48.

function aimBoneLocal(THREE, human, bone, direction) {
  human.model.updateMatrixWorld(true);
  const worldDirection = direction.clone().normalize();
  worldDirection.applyQuaternion(human.model.getWorldQuaternion(new THREE.Quaternion()));
  const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  worldDirection.applyQuaternion(parentWorld).normalize();
  bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), worldDirection);
  bone.updateMatrixWorld(true);
}

// Same reprojection as aimBoneLocal, minus the "direction is expressed in the model's own front-facing frame"
// step — used when the direction is already a real WORLD-space vector (as IK targets are).
function aimBoneWorld(THREE, bone, worldDirection) {
  const dir = worldDirection.clone().normalize();
  const parentInverse = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  dir.applyQuaternion(parentInverse).normalize();
  bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  bone.updateMatrixWorld(true);
}

function placeFootAtCalfLocal(THREE, leg, footQuaternion) {
  const endpoint = leg.lower.localToWorld(new THREE.Vector3(0, .43, 0));
  leg.shoe.position.copy(leg.shoe.parent.worldToLocal(endpoint));
  leg.shoe.quaternion.copy(footQuaternion);
  leg.shoe.updateMatrixWorld(true);
}

// Standard 2-bone (shoulder->elbow->wrist) analytic IK, solved in WORLD space. `upperLen`/`foreLen` are this
// rig's OWN measured bone lengths (see the runtime measurement in poseReaderSeatedV2 below), not borrowed
// constants from another rig. `poleHint` is a world-space direction that only decides which way the elbow bows
// out — it never moves the hand off-target (the law-of-cosines triangle below already fixes that), so it's free
// to bias for "elbow near the ribs" without any accuracy cost. Returns the residual hand->target distance
// (0 when in reach; the leftover gap once the target is clamped to the arm's max reach).
function solveArmIK(THREE, human, arm, targetWorld, upperLen, foreLen, poleHint) {
  human.model.updateMatrixWorld(true);
  const shoulder = arm.upper.getWorldPosition(new THREE.Vector3());
  const toTarget = targetWorld.clone().sub(shoulder);
  const rawDistance = toTarget.length();
  const maxReach = Math.max(.05, upperLen + foreLen - .002);
  const distance = Math.min(maxReach, Math.max(.02, rawDistance));
  const direction = toTarget.normalize();
  const along = (upperLen * upperLen - foreLen * foreLen + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLen * upperLen - along * along));
  let perpendicular = poleHint.clone().sub(direction.clone().multiplyScalar(poleHint.dot(direction)));
  if (perpendicular.lengthSq() < 1e-6) perpendicular = new THREE.Vector3(0, 0, 1).cross(direction);
  perpendicular.normalize().multiplyScalar(height);
  const elbowDirection = direction.clone().multiplyScalar(along).add(perpendicular).normalize();
  aimBoneWorld(THREE, arm.upper, elbowDirection);
  const elbowWorld = shoulder.clone().addScaledVector(elbowDirection, upperLen);
  const reachedWorld = shoulder.clone().addScaledVector(direction, distance);
  const handDirection = reachedWorld.clone().sub(elbowWorld).normalize();
  aimBoneWorld(THREE, arm.fore, handDirection);
  human.model.updateMatrixWorld(true);
  const handWorld = arm.hand.getWorldPosition(new THREE.Vector3());
  return handWorld.distanceTo(targetWorld);
}

/**
 * poseReaderSeatedV2 — Sims-1-style natural sofa-reading pose.
 *
 * @param {typeof import('./vendor/three.module.js')} THREE  the caller's three.js module namespace
 * @param {object} human   a human created by ending-humans-r13.js's createHuman()
 * @param {number} t       progress (seconds-like, monotonically increasing) driving breathing + page-turn
 * @param {object|null} bookRoot  optional THREE.Object3D to place/orient in front of the chest, gripped by both hands
 * @param {object} opts    tunable overrides (all optional; defaults are the final calibrated values)
 */
export function poseReaderSeatedV2(THREE, human, t = 0, bookRoot = null, opts = {}) {
  const {
    seatDrop = .30,         // how far the hips sink onto the cushion vs. the idle standing pose
    recline = .24,          // body pitch BACK into the sofa's backrest (applied as rotateX(-recline), see the
                             // corrected sign note above) — measured to land ~13.6deg back-lean off the neutral
                             // baseline, inside the 10-15deg target
    bodyBack = .14,         // nestles the torso back toward the backrest along the model's own -Z
    kneeSplit = .04,        // small outward fan at the knees (thighs not glued together)
    thighForward = .97,     // +Z pull on the thigh so it lies ~horizontal along the seat
    shinBack = -.045,       // small -Z pull on the shin so the ankle tucks under the knee (feet flat, not kicked out)
    headTilt = .30,         // head-down nod toward the book. NOTE: the head is a child of the Body bone, so once
                             // the torso reclines BACK, the head's own world angle-from-vertical drops well below
                             // its neutral "looking straight ahead" baseline — it visually reads as tipped UP
                             // unless headTilt actively pitches it back down. Measured: at this file's
                             // recline=.24, headTilt=.30 lands ~3-4deg down off "level" — inside the "level to
                             // 10deg down" target without burying the chin into the chest.
    pageTurnPeriod = 4,     // seconds per page-turn gesture cycle (progress `t` drives this)
    breatheAmplitude = .012,
    breathePeriod = 3.9,
    bookForwardOffset = .22,  // book centre, +this far in front of the chest along the model's own forward axis
    bookChestUp = .09,        // book centre, +this far above the shoulder line — lands it at upper-chest/chin
                               // height rather than resting down at the shoulder itself
    bookCornerX = .2826,      // half the distance between the book's two lower grip corners (see the file-header
    bookCornerY = -.0216,     // derivation from the real book geometry in ending-scene-r15.js) — local to bookRoot
    bookTilt = .61,           // ~35deg tilt of the book's face toward the reader's own face
    elbowIn = .30,            // how far the elbow's bend-plane bows OUT to the body's own side (pole-vector bias,
                               // model-frame X) — kept small so the elbow stays tucked near the ribs, not winged out
    elbowDown = 1.0,          // how far the elbow's bend-plane bows DOWN (model-frame -Y) — the dominant term, since
                               // a reader's elbows hang down from the shoulder and only the forearms fold up
                               // to the book, rather than the whole arm reaching forward and up
    elbowFwd = .18,           // small forward bow (model-frame +Z) so the elbow doesn't pin straight back into the
                               // backrest
  } = opts;

  if (!human._seatedBaseV28) {
    human._seatedBaseV28 = {
      bodyPosition: human.body.position.clone(),
      bodyQuaternion: human.body.quaternion.clone(),
      headQuaternion: human.head.quaternion.clone(),
      leftFootQuaternion: human.leftLeg.shoe.quaternion.clone(),
      rightFootQuaternion: human.rightLeg.shoe.quaternion.clone(),
    };
  }
  const base = human._seatedBaseV28;
  human.body.position.copy(base.bodyPosition);
  human.body.quaternion.copy(base.bodyQuaternion);
  human.head.quaternion.copy(base.headQuaternion);

  human.body.position.y -= seatDrop;
  human.body.position.z -= bodyBack;
  human.body.rotateX(-recline); // NOTE: negated — see the corrected sign note at the top of this file; positive
                                  // recline is meant to mean "leans back more", but the Body bone's own rotateX(+)
                                  // tips it forward, so it must be negated here to match that intent

  aimBoneLocal(THREE, human, human.leftLeg.upper, new THREE.Vector3(-kneeSplit, -.06, thighForward));
  aimBoneLocal(THREE, human, human.rightLeg.upper, new THREE.Vector3(kneeSplit, -.06, thighForward));
  aimBoneLocal(THREE, human, human.leftLeg.lower, new THREE.Vector3(-.02, -.99, shinBack));
  aimBoneLocal(THREE, human, human.rightLeg.lower, new THREE.Vector3(.02, -.99, shinBack));
  placeFootAtCalfLocal(THREE, human.leftLeg, base.leftFootQuaternion);
  placeFootAtCalfLocal(THREE, human.rightLeg, base.rightFootQuaternion);

  // page-turn: one hand lifts + sweeps once per `pageTurnPeriod` seconds of progress, in the tail of the cycle
  const cycle = ((t % pageTurnPeriod) + pageTurnPeriod) % pageTurnPeriod / pageTurnPeriod;
  const turnWindow = .78;
  const turnPhase = cycle > turnWindow ? (cycle - turnWindow) / (1 - turnWindow) : 0;
  const pageTurn = turnPhase > 0 ? Math.sin(turnPhase * Math.PI) : 0;
  const breathe = Math.sin((t / breathePeriod) * Math.PI * 2) * breatheAmplitude;

  human.head.rotateX(headTilt + breathe * .5);
  human.body.position.y += breathe;
  human.model.updateMatrixWorld(true);

  // r48: bone lengths measured ONCE per human from the rig's own bone world positions (translation-only offsets,
  // so the length between a bone and its child is correct regardless of what rotation is currently applied to
  // either of them) rather than borrowed from ending-scene-r15.js's separately hand-authored mascot rig.
  if (!human._readerArmLengthsV28) {
    const worldPos = bone => bone.getWorldPosition(new THREE.Vector3());
    human._readerArmLengthsV28 = {
      leftUpper: worldPos(human.leftArm.upper).distanceTo(worldPos(human.leftArm.fore)),
      leftFore: worldPos(human.leftArm.fore).distanceTo(worldPos(human.leftArm.hand)),
      rightUpper: worldPos(human.rightArm.upper).distanceTo(worldPos(human.rightArm.fore)),
      rightFore: worldPos(human.rightArm.fore).distanceTo(worldPos(human.rightArm.hand)),
    };
  }
  const armLengths = human._readerArmLengthsV28;

  const modelQuat = human.model.getWorldQuaternion(new THREE.Quaternion());
  const modelUp = new THREE.Vector3(0, 1, 0).applyQuaternion(modelQuat);
  const modelFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(modelQuat);
  const modelRight = new THREE.Vector3(1, 0, 0).applyQuaternion(modelQuat);
  const shoulderMid = human.leftArm.upper.getWorldPosition(new THREE.Vector3())
    .add(human.rightArm.upper.getWorldPosition(new THREE.Vector3()))
    .multiplyScalar(.5);

  let leftHandError = 0, rightHandError = 0;
  if (bookRoot) {
    // 1) book pose FIRST, anchored to the chest/shoulder line — independent of wherever the hands end up.
    const bookCenter = shoulderMid.clone()
      .addScaledVector(modelFwd, bookForwardOffset)
      .addScaledVector(modelUp, bookChestUp);
    bookRoot.position.copy(bookCenter);
    bookRoot.quaternion.copy(modelQuat);
    bookRoot.rotateX(-bookTilt + pageTurn * .25);
    bookRoot.updateMatrixWorld(true);

    // 2) the two grip targets = the book's own lower-left/lower-right corners (world). Book's local +X corner
    // sits on the same screen side as the LEFT arm, -X on the same side as the RIGHT arm (see file header).
    const leftTarget = bookRoot.localToWorld(new THREE.Vector3(bookCornerX, bookCornerY, 0));
    const rightTarget = bookRoot.localToWorld(new THREE.Vector3(-bookCornerX, bookCornerY, 0))
      .addScaledVector(modelUp, pageTurn * .12)
      .addScaledVector(modelFwd, pageTurn * .06);

    // 3) solve each arm: elbow bend-plane biased down-and-in toward the ribs (elbowDown dominates, elbowIn/
    // elbowFwd are small side/forward nudges), mirrored per side.
    const leftPole = modelRight.clone().multiplyScalar(elbowIn)
      .addScaledVector(modelUp, -elbowDown)
      .addScaledVector(modelFwd, elbowFwd);
    const rightPole = modelRight.clone().multiplyScalar(-elbowIn)
      .addScaledVector(modelUp, -elbowDown)
      .addScaledVector(modelFwd, elbowFwd + pageTurn * .3);

    leftHandError = solveArmIK(THREE, human, human.leftArm, leftTarget, armLengths.leftUpper, armLengths.leftFore, leftPole);
    rightHandError = solveArmIK(THREE, human, human.rightArm, rightTarget, armLengths.rightUpper, armLengths.rightFore, rightPole);
  } else {
    // no book prop passed in: relaxed hands-near-the-lap idle shape so the pose still reads naturally without one.
    aimBoneLocal(THREE, human, human.leftArm.upper, new THREE.Vector3(.10, -.55, .40));
    aimBoneLocal(THREE, human, human.rightArm.upper, new THREE.Vector3(-.10, -.55, .40));
    aimBoneLocal(THREE, human, human.leftArm.fore, new THREE.Vector3(.05, -.30, .55));
    aimBoneLocal(THREE, human, human.rightArm.fore, new THREE.Vector3(-.05, -.30, .55));
  }

  return { pageTurn, breathe, leftHandError, rightHandError };
}
