// ending-props-r15.js
// Higher-quality mascot + desk props for the ENDING scene, matching the
// soft-shaded retro-game (old-Sims prerender) look of the room plate.
// No dependencies beyond ./vendor/three.module.js. Pure ES module.
//
// Exports:
//   createMascot(THREE, faceTexture, opts) -> { group, rig, materials, leftLeg, rightLeg, leftArm, rightArm }
//   createDesk(THREE, homeTexture, opts)   -> { root, screenMat, screen, textures }
//
// Joint hierarchy / pivots / lengths are kept IDENTICAL to the previous
// mascot()+refineMascot() / desk() in ending-scene-r15.js so the existing
// walk-IK, sit-IK and camera-match code in that file keeps working untouched.
//
// r27: both the mascot's case and the desk computer now build their housing
// from the shared procedural Macintosh model (createMacintosh), scaled to
// each one's existing envelope, instead of hand-built boxes/bezels.

import { createMacintosh } from './ending-mac-model-r26.js?v=quality-r29.hac54e722';
// r35: the DESK computer's own housing now builds from a purpose-modelled
// shape (createDeskComputer) measured directly off the truth reference
// (assets/hero/tva-hero-keyvisual-1920x1080-v1.webp — a warm beige all-in-one
// CRT with an INTEGRATED KEYBOARD DECK), instead of the generic
// createMacintosh() "Macintosh 128K" reference model (which had no
// keyboard). Same {root, screen, screenMat, dims} contract as
// createMacintosh, so createDesk's own downstream code (screen texture/
// glow, dims-based placement) is unchanged below. createMascot (above) is
// untouched — it still uses createMascotBody.
import { createDeskComputer } from './ending-desk-computer-r35.js?v=quality-r59.h7264dd86';
// r30: the MASCOT's own body now builds from a purpose-modelled shape
// (createMascotBody) measured directly off the approved character sheet
// (assets/ending/r10-image-first/character-original-v3/*), instead of the
// generic createMacintosh() "Macintosh 128K" reference used for the desk
// computer below (createDesk keeps createMacintosh — untouched).
import { createMascotBody } from './ending-mascot-model-r30.js?v=quality-r59.h1954f369';

// ---------- small local helpers (self-contained, no shared state) ----------

// r30: gathers every unique material used by a mesh graph (root.traverse)
// into a flat {prefixN: material} object, so a model that doesn't expose its
// own `.materials` map (createMascotBody) can still be merged into the
// scene's fade-loop material bag the same way createMacintosh()'s own
// `.materials` used to be spread in.
function collectMaterials(root, prefix) {
  const seen = new Set();
  const out = {};
  let i = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      out[`${prefix}${i++}`] = m;
    }
  });
  return out;
}

function makeRoundedRectShape(THREE, w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Smooth-shaded rounded box (extruded rounded rect), higher curve/bevel
// resolution than the old flat-shaded primitive so it reads as a soft
// injection-moulded plastic case instead of a beveled cube.
function roundedBox(THREE, w, h, d, r = 0.14, opts = {}) {
  const shape = makeRoundedRectShape(THREE, w, h, r);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelSegments: opts.bevelSegments ?? 4,
    steps: 1,
    bevelSize: opts.bevelSize ?? 0.035,
    bevelThickness: opts.bevelThickness ?? 0.035,
    curveSegments: opts.curveSegments ?? 10,
  });
  geometry.computeVertexNormals();
  return geometry;
}

// Shears the top half of a housing back along Z to fake the slightly
// sloped-back CRT silhouette (classic all-in-one computer profile) without
// needing a full lathe profile. Operates in the box's own local space
// (y in [-h/2, h/2], z in [0, d]).
function slopeBack(geometry, h, amount) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, (y + h / 2) / h); // 0 bottom .. 1 top
    const z = pos.getZ(i);
    pos.setZ(i, z - amount * t * t);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

// r25: narrows a box's X extent progressively toward its LOCAL z=0 end, used
// for the Mac case's rear body so it tapers narrower toward the back instead
// of staying a constant-width slab (classic all-in-one silhouette in top/side
// view). amount=0 leaves it untouched, amount near .3 pulls the back corners
// in noticeably. Operates in the box's own local space (z in [0, d]).
function taperNarrow(geometry, d, amount) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const t = Math.max(0, Math.min(1, 1 - z / d)); // 1 at local z=0 (back) .. 0 at local z=d (front seam)
    const x = pos.getX(i);
    pos.setX(i, x * (1 - amount * t));
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

// A frame with a rectangular window cut out of it (real depth), used for
// bezels so the screen actually looks inset instead of just painted on.
function frameWithHole(THREE, w, h, holeW, holeH, depth, r = 0.06, holeR = 0.02) {
  const shape = makeRoundedRectShape(THREE, w, h, r);
  const hole = makeRoundedRectShape(THREE, holeW, holeH, holeR);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    curveSegments: 8,
  });
  geometry.computeVertexNormals();
  return geometry;
}

// ---------- canvas textures (prebaked soft shading, Sims-era style) ----------

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

// Plastic with speckle + a soft vertical gradient baked in, so the surface
// reads as gently shaded even under flat game-style lighting.
// r28: finer/denser speckle (smaller dots, lower alpha, higher count) so the
// grain reads as a fine plastic texture rather than a visible dot pattern —
// matches the same "polish the textures of all the computers" pass applied
// to ending-mac-model-r26.js?v=quality-r29.hac54e722's own speckleTexture().
function plasticTexture(THREE, base = '#cdb887', speck = 'rgba(70,50,20,.16)', light = 'rgba(255,250,235,.14)', repeat = [2, 2]) {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,.16)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(0,0,0,.14)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = i % 3 ? speck : light;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.1, 1.1);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 4;
  return texture;
}

function woodTexture(THREE, base = '#5a341d', repeat = [2.5, 1.25]) {
  const { canvas, ctx } = makeCanvas(256, 128);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 128);
  for (let y = 5; y < 128; y += 9) {
    ctx.strokeStyle = y % 18 ? 'rgba(35,16,8,.24)' : 'rgba(225,156,84,.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.07 + y) * 2.4);
    ctx.stroke();
  }
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,225,180,.10)');
  grad.addColorStop(1, 'rgba(0,0,0,.16)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  return texture;
}

function clothTexture(THREE, base = '#2c4666', repeat = [2, 2]) {
  const { canvas, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 128);
  ctx.globalAlpha = 0.5;
  for (let y = 0; y < 128; y += 3) {
    ctx.strokeStyle = y % 6 ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const grad = ctx.createRadialGradient(64, 40, 10, 64, 64, 110);
  grad.addColorStop(0, 'rgba(255,255,255,.10)');
  grad.addColorStop(1, 'rgba(0,0,0,.22)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  return texture;
}

// r50: the old version painted rgba(0,0,0,.28)/.30 bands down BOTH edges of
// the tube. Multiplied into an already-dim scene (hemisphere ground colour
// 0x394228 kills the underside of every vertical cylinder), that is what
// turned the limbs into the near-black sticks the owner rejected — measured
// on the standalone rig under the scene's own lights: limb pixels came out
// (39,20,9) against the approved sheet's (85,60,35) at the same spot, i.e.
// less than half as bright and far more crushed. The wrap shading a rubber-
// hose tube needs is already produced by the lighting itself, so the texture
// is now only a faint warm grain plus a soft highlight band down the lit
// side — no black edges at all.
function limbTexture(THREE, base = '#4c2a18') {
  const { canvas, ctx } = makeCanvas(64, 128);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 64, 128);
  const grad = ctx.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(40,20,6,.10)');
  grad.addColorStop(0.42, 'rgba(255,236,205,.16)');
  grad.addColorStop(1, 'rgba(40,20,6,.12)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  return texture;
}

function softMat(THREE, color, map, opts = {}) {
  return new THREE.MeshPhongMaterial({
    color,
    map: map || null,
    flatShading: false,
    shininess: opts.shininess ?? 10,
    specular: opts.specular ?? 0x2b2418,
  });
}

function flatMat(THREE, color, opts = {}) {
  return new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: opts.shininess ?? 6 });
}

// Cheap cel/toon outline: an inverted, slightly enlarged, back-face-only
// dark shell around a mesh's geometry.
function outlineShell(THREE, geometry, scale = 1.035, color = 0x1c140c) {
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.multiplyScalar(scale);
  return mesh;
}

// r50: a sphere scaled to (rx, ry, rz) whose bottom is sliced FLAT at
// -ry*cut. Used for the mascot's boots: a plain squashed sphere is round at
// the very bottom, so any sole disc wide enough to be visible ends up wider
// than the boot itself and reads from the scene camera as a dark saucer under
// a red ball (exactly how the old shoes looked). A flat-bottomed volume gives
// the boot a real footprint to sit on and a straight edge for the sole welt
// to follow, like the approved sheet's boots.
function flatBottomSphere(THREE, rx, ry, rz, cut = 0.55, seg = 20) {
  const geo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  geo.scale(rx, ry, rz);
  const floor = -ry * cut;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < floor) pos.setY(i, floor);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.userData.flatBottomY = floor;
  geo.userData.footRX = rx * Math.sqrt(Math.max(0, 1 - cut * cut));
  geo.userData.footRZ = rz * Math.sqrt(Math.max(0, 1 - cut * cut));
  return geo;
}

function place(mesh, parent, position, rotation) {
  if (position) mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  parent.add(mesh);
  return mesh;
}

// ---------- original-drawing textures for the mascot case ----------
// The character's case is textured directly from the hand-designed
// reference renders instead of re-modelling bezel/badge/slot/vent meshes,
// so it reads as the illustration from every angle. Paths are resolved
// against this module's own URL (== site root, ending-props-r15.js lives
// next to /assets) so it works regardless of which page imports the
// module (production page at site root, or the nested test harness).
const MASCOT_ART_BASE = new URL('./assets/ending/r10-image-first/character-original-v3/', import.meta.url);

// Kick these loads off as soon as the module is evaluated (well before
// createMascot() is ever called, and before the caller's own await'ed
// texture loads resolve) so the decoded image is very likely already
// available by the time createMascot() builds its materials. If it is
// not yet ready, the texture is wired up to flip on as soon as the
// browser's 'load' event fires (materials update via needsUpdate).
function preloadArt(file) {
  const img = new Image();
  img.src = new URL(file, MASCOT_ART_BASE).href;
  return img;
}
const MASCOT_FRONT_IMG = preloadArt('01-front.webp');
const MASCOT_SIDE_IMG = preloadArt('02-side.webp');
const MASCOT_ART_IMG_SIZE = 1254; // both source renders are 1254x1254

// Crop rectangles (pixel coords, top-left origin) picked out of the
// original 1254x1254 renders: just the case (bezel/screen/face/badge/
// slot/vents), with the limbs cropped away.
const MASCOT_FRONT_RECT = [335, 144, 915, 868]; // 01-front.webp: front of case
const MASCOT_SIDE_RECT = [425, 128, 922, 810]; // 02-side.webp: case side + vents

// r27: just the drawn screen/face region (smiling eyes+mouth on the green
// CRT), a sub-rect of MASCOT_FRONT_RECT above, used to texture the
// createMacintosh() model's own screen mesh instead of painting the whole
// case front. Measured by thresholding for green-dominant pixels inside
// MASCOT_FRONT_RECT (QA_Evidence/tva-claude-20260909/detect-screen-rect.py
// found the green bbox at [434,233,810,545] in the 1254x1254 source; visual
// crop-preview confirmed it is exactly the face, no case/bezel bleed).
const MASCOT_SCREEN_RECT = [434, 233, 810, 545];
const MASCOT_SCREEN_ASPECT = (MASCOT_SCREEN_RECT[2] - MASCOT_SCREEN_RECT[0]) / (MASCOT_SCREEN_RECT[3] - MASCOT_SCREEN_RECT[1]);

// Converts a pixel-space crop rect (in an image of size imgSize x imgSize,
// or [imgW, imgH] for a non-square source) into three.js texture
// repeat/offset, optionally mirrored horizontally (used to reuse the single
// side render for the opposite side).
function cropToRepeatOffset([x0, y0, x1, y1], imgSize, mirror) {
  const [iw, ih] = Array.isArray(imgSize) ? imgSize : [imgSize, imgSize];
  const rw = (x1 - x0) / iw;
  const rh = (y1 - y0) / ih;
  const ox = x0 / iw;
  const oy = 1 - y1 / ih; // flip: image Y grows down, UV V grows up
  return mirror
    ? { repeat: [-rw, rh], offset: [ox + rw, oy] }
    : { repeat: [rw, rh], offset: [ox, oy] };
}

function makeArtTexture(THREE, img, rect, imgSize, mirror = false) {
  const texture = new THREE.Texture(img);
  const { repeat, offset } = cropToRepeatOffset(rect, imgSize, mirror);
  texture.repeat.set(repeat[0], repeat[1]);
  texture.offset.set(offset[0], offset[1]);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  const markReady = () => { texture.needsUpdate = true; };
  if (img.complete && img.naturalWidth > 0) markReady();
  else img.addEventListener('load', markReady, { once: true });
  return texture;
}

// (r24: removed a fully-unused leftover photo-crop path for the desk Mac —
// preloadImage/HERO_IMG/CASE_FRONT_RECT/KEYBOARD_RECT/makeRoundedCropTexture
// were never called from createDesk(), which already models the Mac and its
// screen crop straight from `homeTexture` below.)

// r28: a faint additive glow plane sat just behind a Macintosh model's own
// screen mesh, so the CRT's own light reads as bleeding onto the inner
// bezel lip instead of the opening looking like a flat hole with a picture
// stuck in a corner of it. Factored out of createDesk() (r21) so the
// mascot's own face-screen gets the same glow ("character render just
// needs to be prettier" — a lit screen reads noticeably more polished than
// a flat unlit one). color is an [r,g,b] triplet for the gradient core.
function screenGlowPlane(THREE, mac, color = [150, 255, 190], opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const [r, g, b] = color;
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, `rgba(${r},${g},${b},.85)`);
  gradient.addColorStop(0.55, `rgba(${Math.round(r * 0.8)},${Math.round(g * 0.92)},${Math.round(b * 0.9)},.35)`);
  gradient.addColorStop(1, `rgba(${Math.round(r * 0.8)},${Math.round(g * 0.92)},${Math.round(b * 0.9)},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, opacity: opts.opacity ?? 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(mac.dims.screenWidth * (opts.scaleW ?? 1.14), mac.dims.screenHeight * (opts.scaleH ?? 1.2)),
    material,
  );
  plane.position.set(mac.screen.position.x, mac.screen.position.y, mac.screen.position.z - 0.01);
  mac.root.add(plane);
  return plane;
}

// =============================================================================
// MASCOT
// =============================================================================

export function createMascot(THREE, faceTexture, opts = {}) {
  // r27: the hand-built housing (roundedBox + slopeBack + base tiers + back
  // plate + full-case front decal plane) is replaced by the shared
  // procedural Macintosh model (createMacintosh), scaled to the SAME
  // envelope the rig's limb anchors were always built around: width 1.48,
  // height ~1.82, bottom at y=.48 (where the legs attach), front face at
  // z~.28 (where the arms/shoulders are built around). caseScaleZ keeps the
  // previous hand-built case's own depth ratio (CASE_D was .92 of the .95
  // desk case's width-equivalent) so the body reads with the same
  // proportions as before, just modelled instead of a single tapered box.
  const CASE_ENV_W = 1.48, CASE_ENV_H = 1.82, CASE_BOTTOM_Y = 0.48, CASE_FRONT_Z = 0.28;
  // r30: swapped createMacintosh() for createMascotBody() — same {root,
  // screen, screenMat, dims} contract (dims: width/height/depth/frontZ/
  // screenWidth/screenHeight), same local-space convention (width=1 local
  // unit, bottom at local y=0, front face at local z=dims.frontZ), so the
  // envelope-fit scale/position math below is unchanged from the r27/r29
  // createMacintosh version.
  // r50: outline OFF. The approved character sheet has no ink line at all —
  // its silhouette is carried entirely by form shading. The BackSide shell
  // read as a black hairline hugging the top/left edges of the cabinet in
  // every in-scene crop (QA_Evidence .../limbs44-crops, scene43-crops), which
  // is exactly the "black outline artifact" the brief rules out; at scene
  // scale it also made the case look like a sticker-covered box rather than a
  // shaded volume.
  const macModel = createMascotBody(THREE, { screenAspect: MASCOT_SCREEN_ASPECT, outline: false });
  const caseScaleX = CASE_ENV_W / macModel.dims.width;
  const caseScaleY = CASE_ENV_H / macModel.dims.height;
  const caseScaleZ = 0.92;
  macModel.root.scale.set(caseScaleX, caseScaleY, caseScaleZ);
  macModel.root.position.set(0, CASE_BOTTOM_Y, CASE_FRONT_Z - caseScaleZ * macModel.dims.frontZ);

  // the drawn front-of-case illustration's own screen/face region (a
  // sub-crop of MASCOT_FRONT_RECT, measured in detail above at
  // MASCOT_SCREEN_RECT) becomes the model's screen-mesh texture, so the
  // smiling face now sits INSIDE the modelled bezel opening instead of
  // being painted over the whole case front.
  // r31: toneMapped=false + fog=false so the face screen stays fully
  // readable regardless of scene lighting/tone-mapping/fog changes.
  // depthTest=false + depthWrite=false is the actual fix for the
  // production "screen renders almost black" bug: the screen/recess/ring/
  // glare stack's local Z separation compresses to near-zero in camera
  // space whenever the character's local +Z axis is viewed at a glancing
  // angle (it rotates continuously during the walk/turn/sit animation), so
  // it z-fought against the recess mesh behind it at some viewing angles no
  // matter how large that local gap was made, and no fixed polygonOffset
  // magnitude reliably covered every angle either (both tried first — see
  // ending-mascot-model-r30.js's screen-mesh comment for the full writeup
  // and QA_Evidence r31 crops for the fixed result). Ignoring the depth
  // test/buffer entirely and relying on the mesh's own renderOrder (set on
  // the mesh itself in the model file, so it survives this material swap)
  // to always paint last is the deterministic fix. THIS is the material
  // actually assigned to the mesh in production (it replaces the model's
  // own default), so it has to carry the same depthTest/depthWrite here.
  const faceScreenMat = new THREE.MeshBasicMaterial({
    map: makeArtTexture(THREE, MASCOT_FRONT_IMG, MASCOT_SCREEN_RECT, MASCOT_ART_IMG_SIZE),
    toneMapped: false,
    fog: false,
    depthTest: false,
    depthWrite: false,
  });
  macModel.screen.material = faceScreenMat;
  // r28: faint screen glow, matching the desk Mac's own (screenGlowPlane
  // above) — part of the "character render just needs to be prettier"
  // pass, a lit-looking face screen reads noticeably more polished than a
  // flat unlit one.
  // r50: glow opacity dropped 0.4 -> 0.2. At 0.4 the face rendered BRIGHTER
  // than the cabinet around it under the scene's own (dim, warm) lights,
  // which is a large part of why it read as a sticker pasted onto the box
  // rather than a screen inside it — a lit CRT in this scene should sit at
  // roughly the same exposure as the case, with only its own highlight above.
  screenGlowPlane(THREE, macModel, [150, 255, 190], { opacity: 0.2, scaleW: 1.1, scaleH: 1.15 });

  const materials = {
    // Lower repeat than the other case-adjacent materials: with the front
    // now covered by the drawn art plane, this texture only shows on the
    // plain top/back/margins, where a busier tile reads as stray creases.
    // r28: lower shininess (was 14/10) for a softer matte plastic finish,
    // matching the roughness bump on the shared Macintosh model's own
    // materials (ending-mac-model-r26.js?v=quality-r29.hac54e722) so the mascot's case reads as the
    // same material family as the desk computer.
    case: softMat(THREE, 0xd0bd8e, plasticTexture(THREE, '#d0bd8e', 'rgba(70,50,20,.14)', 'rgba(255,250,235,.16)', [1, 1]), { shininess: 9 }),
    dark: softMat(THREE, 0x8d7248, plasticTexture(THREE, '#8d7248', 'rgba(30,18,8,.30)', 'rgba(255,240,210,.10)', [2, 1.4]), { shininess: 7 }),
    ink: flatMat(THREE, 0x17140e, { shininess: 4 }),
    // r44: owner complaint ("thin black sticks with tiny gloves" —
    // /Volumes/교육자료/AI_Hub/QA_Evidence/tva-claude-20260909/mascot42-crops/mascot42-p04-crop.png)
    // measured against the approved character sheet (character-original-v3/
    // 01-front.webp, 02-side.webp, 03-three-quarter.png) via PIL color-mask
    // pixel measurement: limb tube color there is a warm brown (#5a3a24
    // family), NOT the near-black this scene's old shininess:16/specular:
    // 0x3a2210 combo read as under this scene's lighting. Matched to the
    // sheet's warm brown and flattened to a matte finish (roughness≈.8 ==
    // low Phong shininess + a dark, low-chroma specular so it doesn't throw
    // a bright highlight that reads as a shiny black rod).
    // r50: albedo raised from 0x5a3a24 to 0xa2683c. The old value was the
    // sheet's own *rendered* brown used as an ALBEDO, which double-counts the
    // sheet's lighting: re-lit by this scene's dim warm-key/olive-ground rig
    // it landed at (39,20,9) on screen where the sheet reads (85,60,35).
    // Raised so the LIT result matches the sheet instead of the albedo doing
    // so, and given a soft sheen (rubber-hose tubes on the sheet carry a
    // clear rolled highlight, not a dead matte face).
    limb: softMat(THREE, 0xa2683c, limbTexture(THREE, '#a2683c'), { shininess: 16, specular: 0x4a3524 }),
    // Sheet-measured red family (#D8332C) at a matte finish, down from the
    // old shininess:30 gloss (still glossy enough at 14 to read as painted
    // plastic, not flat-matte-to-the-point-of-chalky).
    red: softMat(THREE, 0xd8332c, plasticTexture(THREE, '#d8332c', 'rgba(40,5,0,.14)', 'rgba(255,220,200,.16)', [1.6, 1.6]), { shininess: 14, specular: 0x3a120e }),
    // Sheet-measured cream (#F1E9D8) at a matte cloth-like finish (was
    // shininess:18, glossier than the sheet's soft mitten fabric read).
    glove: softMat(THREE, 0xf1e9d8, plasticTexture(THREE, '#f1e9d8', 'rgba(120,90,50,.08)', 'rgba(255,255,255,.14)', [1.4, 1.4]), { shininess: 8 }),
    // r50: the shoe sole on the approved sheet is a darker RED-BROWN welt
    // (sampled ~(96,39,36) against the boot's own (224,60,54)), not the
    // near-black `ink` the old sole used — at scene scale that black rim was
    // the main reason the shoes read as flat discs with a dirty edge.
    soleDark: softMat(THREE, 0x7e2b25, null, { shininess: 10, specular: 0x2a100e }),
    // Kept for API/back-compat (the scene fades every material in this
    // object) even though the drawn screen art above already contains the
    // face, so no mesh uses this material any more.
    face: new THREE.MeshBasicMaterial({ map: faceTexture }),
    // Original-drawing case art, unlit so the painted linework/shading
    // stays crisp regardless of scene lighting. Kept for API/back-compat
    // (unused by any mesh now that the model's own geometry+materials
    // render the case; the face itself moved to faceScreenMat above).
    frontArt: new THREE.MeshBasicMaterial({
      map: makeArtTexture(THREE, MASCOT_FRONT_IMG, MASCOT_FRONT_RECT, MASCOT_ART_IMG_SIZE),
      side: THREE.DoubleSide,
    }),
    sideArt: new THREE.MeshBasicMaterial({
      map: makeArtTexture(THREE, MASCOT_SIDE_IMG, MASCOT_SIDE_RECT, MASCOT_ART_IMG_SIZE, false),
      side: THREE.DoubleSide,
    }),
    sideArtMirror: new THREE.MeshBasicMaterial({
      map: makeArtTexture(THREE, MASCOT_SIDE_IMG, MASCOT_SIDE_RECT, MASCOT_ART_IMG_SIZE, true),
      side: THREE.DoubleSide,
    }),
    // the model's own case materials (front/body/bezelDark/slot/badge/vent/
    // port/seam/screen), merged in so the scene's per-frame fade loop
    // (Object.values(hero.materials) in ending-scene-r15.js) still dims
    // every visible surface of the case during the ending dive. `screen` is
    // overridden right after the spread to the actual face-art material
    // assigned to the mesh above.
    //
    // r30: createMascotBody() (unlike createMacintosh()) does not return a
    // `.materials` map of its own — it builds several MeshStandardMaterials
    // internally (case/body/bezel/badge/slot/vent/screen/outline shells) and
    // only exposes the mesh graph via `.root`. Collected by traversal instead
    // so every visible surface of the new body still lands in this object
    // and keeps getting dimmed by the scene's per-frame fade loop
    // (Object.values(hero.materials) in ending-scene-r15.js) — the same
    // requirement the old `...macModel.materials` spread satisfied.
    ...collectMaterials(macModel.root, 'mascotBody'),
    screen: faceScreenMat,
  };

  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);

  // HARD CONSTRAINT: ending-scene-r15.js reads `hero.rig.children[0]` as
  // "the housing mesh" and uses it two ways: Box3.setFromObject(...) (works
  // on any Object3D, traverses children) AND a raw
  // `heroCaseMesh.geometry.attributes.position` vertex loop (line ~501,
  // requires an actual Mesh with BufferGeometry, NOT a Group). The visible
  // case is now the multi-mesh macModel.root group, so an invisible proxy
  // Mesh — a plain box spanning the model's own local envelope (width x
  // height x depth, bottom at local y=0, same as the model's own dims
  // contract) — is added FIRST (so it lands at rig.children[0]) with the
  // exact same transform as the visible model, keeping both measurements
  // (world width, local top-Y) correct without rendering anything itself.
  const envelopeGeo = new THREE.BoxGeometry(macModel.dims.width, macModel.dims.height, macModel.dims.depth);
  envelopeGeo.translate(0, macModel.dims.height / 2, 0);
  const heroCaseMesh = new THREE.Mesh(envelopeGeo, new THREE.MeshBasicMaterial({ visible: false }));
  heroCaseMesh.visible = false;
  heroCaseMesh.scale.copy(macModel.root.scale);
  heroCaseMesh.position.copy(macModel.root.position);
  rig.add(heroCaseMesh); // MUST stay rig.children[0] — see ending-scene-r15.js's heroCaseMesh comment
  rig.add(macModel.root);

  // --- limbs: identical joint hierarchy / pivots / lengths as before ---
  const limbs = {};
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.35, 0.48, 0);
    rig.add(leg);
    // r44: thigh tube widened (.10/.11 -> .125/.115) and re-tapered so the
    // hip end (radiusTop) is the thicker one, matching the sheet's "slightly
    // thicker at the thigh" read (character-original-v3/02-side.webp) — group
    // position/height unchanged, only the cylinder radii moved.
    place(new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.115, 0.48, 20), materials.limb), leg, [0, -0.23, 0]);

    const knee = new THREE.Group();
    knee.position.y = -0.46;
    leg.add(knee);
    place(new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.105, 0.43, 20), materials.limb), knee, [0, -0.20, 0]);
    // r50: rubber-hose joint ball. Without it the thigh and shin tubes met as
    // two flat cylinder caps, which is what made the legs read as cut sticks
    // rather than the sheet's continuous soft hose. Purely a cosmetic mesh
    // parented to the existing knee group — the group's own position is
    // untouched, so walk/IK are unaffected.
    place(new THREE.Mesh(new THREE.SphereGeometry(0.128, 16, 12), materials.limb), knee, [0, 0, 0]);
    // r50: the ankle collar used to sit at y-0.405, i.e. INSIDE the boot
    // volume, so it never showed. On the sheet it is a clearly visible rolled
    // red ring where the brown tube enters the boot — moved up to just above
    // the boot's own top and thickened a little.
    const cuff = place(new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.054, 10, 20), materials.red), knee, [0, -0.242, 0.05]);
    cuff.rotation.x = Math.PI / 2;

    const shoe = new THREE.Group();
    shoe.position.set(side * 0.02, -0.49, 0.06);
    knee.add(shoe);
    // r50 shoe rebuild. The old stack read as a flat red pancake with a black
    // rim: the body sphere was squashed to 0.58 in Y (~0.27 tall against a
    // ~2.3-tall character, where the sheet's boot is ~0.14 of the character's
    // height, i.e. ~0.32) and the sole used the near-black `ink` material,
    // which on the sheet is actually a darker RED-BROWN, not black. Rebuilt as
    // a chunky rounded boot: taller body, a raised toe box, a small heel bump,
    // and a thin dark-red sole. The sole's own lowest point is deliberately
    // unchanged (centre y -0.135, y-scale 0.22 of r 0.205 => bottom -0.180) so
    // the foot level the walk/IK depends on does not move; the extra height is
    // added upward only.
    // flat-bottomed boot volume (see flatBottomSphere above). Sized off the
    // sheet: boot width ~0.33 of the cabinet's width, length ~0.6 of its
    // depth, height ~0.13 of the character's full height. Sits so its own
    // flat sole plane is at y=-0.145 and the welt below it bottoms out at
    // -0.180 — the SAME lowest point the old stack had, so the foot level the
    // walk/IK relies on is unchanged.
    // Boot size is taken from the sheet as a fraction of the CHARACTER's own
    // height, not guessed: on 01-front.webp the boot is ~0.17 of the full
    // figure (160px of 946px) and ~0.32 of the cabinet's width. This rig's
    // figure is ~2.95 tall, so the boot wants to be ~0.45 tall and ~0.5 wide.
    // The old shoe was 0.27 tall — less than two thirds of that — which is
    // why the character read as a box on stilts with little red pucks (the
    // rig's leg bones are frozen, so the boot is the only place that
    // proportion can be recovered).
    const bootGeo = flatBottomSphere(THREE, 0.265, 0.27, 0.40, 0.55);
    const shoeBody = place(new THREE.Mesh(bootGeo, materials.red), shoe, [0, 0.0035, 0.06]);
    // thin darker welt following the boot's own flat footprint
    const footRX = bootGeo.userData.footRX, footRZ = bootGeo.userData.footRZ;
    const sole = place(new THREE.Mesh(new THREE.CylinderGeometry(footRX * 1.03, footRX * 0.95, 0.036, 24), materials.soleDark), shoe, [0, -0.162, 0.06]);
    sole.scale.set(1, 1, footRZ / footRX);

    // r28: shoulder anchors moved outward/up from the old (side*.79, 1.72) —
    // at that spot the case's own front/side surface (only ~.05 narrower
    // than the shoulder x) hid the arms almost entirely once seated at the
    // desk (feedback: "arms not visible at all"). Pushed out to clear the
    // case body's silhouette with real margin and up onto the case's upper
    // side (near the screen band) instead of the lower/back edge. Leg
    // anchors (above) are untouched.
    //
    // The seated camera view is NOT a mirror-symmetric view of the rig: the
    // hero turns to face the desk via a ~135° yaw (workDesk.root's own -45°
    // yaw + a 180° flip, see seatQuaternion in ending-scene-r15.js) composed
    // with the scene's fixed 30° ISO_TILT — a compound rotation that is not
    // a multiple of 180° around any single axis, so it does NOT preserve
    // left/right mirror symmetry the way the idle/walk pose does. Measured
    // with QA_Evidence/tva-claude-20260909/inspect-arms-r28.mjs at the
    // seated typing pose (p=.78): the side=-1 (left) shoulder at x=-.81
    // clears the case's own silhouette with a visible glove beside it, but
    // the mirrored side=+1 (right) shoulder/hand path stays projected onto
    // the case's own top face and stays fully hidden — no combination of
    // this anchor's own x/y/z made it clear the case (see that file's
    // history), so instead the fix lives on the OTHER end of that arm: its
    // desk hand target is raised clear of the case in ending-scene-r15.js's
    // deskHandTargets (see the comment there) rather than mirrored 1:1 with
    // the first target's desk-level y.
    //
    // r34: the side=+1 (right) shoulder alone is nudged out an extra .08 (0.81->0.89) — the OTHER end (desk hand
    // target y) needed to go higher than r28's 1.85 to clear the case top with a real margin (see that comment in
    // ending-scene-r15.js), which stretches this arm's reach; moving just this shoulder further from the body
    // buys back enough reach budget for the higher target to stay well inside the 2-bone arm's .748 max length
    // (measured reach .666 at the new target vs. a .787+/failing reach at the same target height with the old
    // .81 anchor). side=-1 (left) is untouched — it already reads correctly and was not part of this fix.
    const arm = new THREE.Group();
    arm.position.set(side * (side > 0 ? 0.89 : 0.81), 1.74, 0.015);
    rig.add(arm);
    // r44: arm tube widened (.078/.093 -> .09/.105) to match the sheet-
    // measured ratio (arm diameter ≈.10-.12 of the case's 1.48 width,
    // measured off character-original-v3/01-front.webp's brown-mask cross-
    // section) — arm/elbow/hand GROUP positions below are untouched, only
    // these mesh radii move.
    place(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.105, 0.42, 18), materials.limb), arm, [0, -0.19, 0]);
    // r50: rounded shoulder cap — the bare cylinder's flat top cap sat against
    // the cabinet's side as a visibly glued-on plank end.
    place(new THREE.Mesh(new THREE.SphereGeometry(0.102, 14, 12), materials.limb), arm, [0, 0, 0]);

    const elbow = new THREE.Group();
    elbow.position.y = -0.38;
    arm.add(elbow);
    place(new THREE.Mesh(new THREE.CylinderGeometry(0.084, 0.093, 0.34, 18), materials.limb), elbow, [0, -0.15, 0]);
    place(new THREE.Mesh(new THREE.SphereGeometry(0.104, 14, 12), materials.limb), elbow, [0, 0, 0]);

    const hand = new THREE.Group();
    hand.position.set(0, -0.37, 0.02);
    elbow.add(hand);
    // r44: palm widened .18 -> .225 (glove diameter ≈.30 of the case's 1.48
    // width once scaled, matching the sheet's cream-mask hand-region
    // measurement) and the finger/thumb capsules shortened + thickened into
    // soft rounded lobes (was thin .032r/.12-long sticks reading as spindly
    // "tiny glove" fingers) — a big rounded mitten with 3 soft finger lobes
    // and one thumb lobe, per the sheet. All offsets below are re-derived
    // from the new palmR so they land in the same relative spot on the
    // bigger palm; the hand GROUP position/elbow/arm anchors are untouched.
    // r50 mitten rebuild. r44's capsule fingers hung BELOW the palm sphere as
    // four separate stalks — at scene scale they read as spider legs under a
    // cream egg, which is a large part of "모델링이 구리다". On the approved
    // sheet the hand is one soft mitten volume: a big rounded palm whose lower
    // edge is broken into three shallow fused finger lobes, one thumb lobe
    // sitting high on the inner side, and a rolled white cuff where the brown
    // tube enters it. Rebuilt from overlapping spheres (each lobe sunk into
    // the palm so only its cap shows) instead of protruding capsules. Palm
    // radius and the hand GROUP position are unchanged, so the rig's hand
    // anchor and reach are untouched.
    // palm radius: r44's 0.225 over-corrected an earlier "tiny gloves"
    // complaint — measured against the sheet, the mitten is ~0.24-0.26 of the
    // cabinet's own width (front view), i.e. ~0.38 in this rig's units, where
    // 0.225*2*1.06 = 0.48 was ~0.32 of the cabinet. 0.195 lands the silhouette
    // on the sheet's ratio while staying clearly a big cartoon mitten.
    const palmR = 0.195;
    const palm = place(new THREE.Mesh(new THREE.SphereGeometry(palmR, 18, 14), materials.glove), hand, [0, -0.02, 0]);
    // flattened front-to-back: a mitten is a paddle, not a ball. At the
    // near-spherical 0.84 depth the glove read as a white lollipop head
    // whenever the arm swung so the camera saw the back of the hand
    // (QA .../mascot50 p=.24), which is most of the walk.
    palm.scale.set(1.16, 1.06, 0.70);
    // three fused finger lobes along the mitten's lower edge — sunk deep
    // enough into the palm that only their caps show as soft scallops
    for (let index = 0; index < 3; index++) {
      const t = index - 1; // -1, 0, 1
      const lobe = place(new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 12), materials.glove), palm, [
        (t * 0.085) / 1.16,
        (-0.115 - Math.abs(t) * 0.012) / 1.06,
        (0.012) / 0.70,
      ]);
      lobe.scale.set(0.80, 1.02, 1.10);
      lobe.rotation.z = -t * 0.18;
    }
    // thumb lobe: high on the inner side, angled up-forward like the sheet's
    const thumb = place(new THREE.Mesh(new THREE.SphereGeometry(0.098, 14, 12), materials.glove), palm, [
      (-side * 0.145) / 1.16,
      (0.005) / 1.06,
      (0.030) / 0.70,
    ]);
    thumb.scale.set(0.74, 1.05, 1.15);
    thumb.rotation.z = side * 0.55;
    // rolled cuff where the arm tube enters the mitten (clearly drawn on all
    // four sheet views; without it the brown tube just vanished into a ball)
    const wristCuff = place(new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.049, 10, 20), materials.glove), hand, [0, 0.14, 0.005]);
    wristCuff.rotation.x = Math.PI / 2;

    limbs[side < 0 ? 'leftLeg' : 'rightLeg'] = { upper: leg, lower: knee, shoe };
    limbs[side < 0 ? 'leftArm' : 'rightArm'] = { upper: arm, lower: elbow, hand };
  }

  return { group, rig, materials, ...limbs };
}

// =============================================================================
// DESK
// =============================================================================

export function createDesk(THREE, homeTexture, opts = {}) {
  const root = new THREE.Group();

  const grain = woodTexture(THREE, '#5a341d', [2.5, 1.25]);
  const grainDark = woodTexture(THREE, '#2f1d12', [2, 1]);
  const plastic = plasticTexture(THREE, '#c9b78a', 'rgba(70,50,20,.18)', 'rgba(255,250,235,.16)', [2, 2]);
  const cloth = clothTexture(THREE, '#2c4666', [2.2, 2.2]);

  const wood = softMat(THREE, 0xd9b28c, grain, { shininess: 20, specular: 0x553322 });
  const woodDark = softMat(THREE, 0x3a2517, grainDark, { shininess: 14, specular: 0x2a1a10 });
  // Tint sampled from the HOME key-visual photo's case plastic (averaged a
  // few highlight/midtone points on the side panel: ~rgb(152,143,116)) so
  // the untextured case sides/top read as the same beige as the photo front.
  const cream = softMat(THREE, 0xc7b48a, plastic, { shininess: 12 });
  const creamDark = softMat(THREE, 0x8d7a56, plastic, { shininess: 10 });
  // r25: the front bezel BLOCK gets its own slightly warmer/lighter tint than
  // the rear body (`cream` above), matching the photo where the front
  // face/chin reads a shade lighter and warmer than the case sides/top — this
  // is what makes the two-part profile (bezel block + tapered rear body)
  // actually read as two parts instead of one flat-colored box.
  const creamFront = softMat(THREE, 0xd8c399, plastic, { shininess: 14 });
  const metal = softMat(THREE, 0x9c8e70, null, { shininess: 55, specular: 0x555044 });
  const clothMat = softMat(THREE, 0xffffff, cloth, { shininess: 8 });
  const ink = flatMat(THREE, 0x17140e);
  const bezelMat = flatMat(THREE, 0x2a271f, { shininess: 8 });
  const badgeMat = softMat(THREE, 0xd7cbaa, null, { shininess: 30 });

  // ---- desk top + legs (unchanged footprint) ----
  const topGeo = roundedBox(THREE, 3.15, 0.18, 1.47, 0.08, { curveSegments: 8 });
  const deskTopMesh = place(new THREE.Mesh(topGeo, wood), root, [0, 1.25, -0.65]);
  for (const x of [-1.35, 1.35]) for (const z of [-0.42, 0.42]) {
    place(new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.25, 0.16), woodDark), root, [x, 0.62, z]);
    place(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.03, 0.20), woodDark), root, [x, 0.005, z]);
  }

  // drawer unit with real handles
  const drawersGeo = roundedBox(THREE, 0.82, 0.82, 0.92, 0.06, { curveSegments: 6 });
  place(new THREE.Mesh(drawersGeo, wood), root, [1.02, 0.75, -0.46]);
  for (let index = 0; index < 3; index++) {
    place(new THREE.Mesh(new THREE.BoxGeometry(0.69, 0.025, 0.02), woodDark), root, [1.02, 0.53 + index * 0.22, 0.475]);
    place(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8), metal), root, [1.02, 0.55 + index * 0.22, 0.50], [0, 0, Math.PI / 2]);
  }

  // ---- computer: shared procedural Macintosh model (createMacintosh), r27.
  // r24: no desk keyboard any more (item 1) — the mascot's gloves rest
  // directly on the desk surface in front of it (see deskHandTargets in
  // ending-scene-r15.js) instead of typing on keys.
  const computer = new THREE.Group();
  // r21: pushed back (was z=-0.06) to open a real gap between the Mac's own case and the seated mascot's
  // (very deep, Mac-shaped) torso — measured with inspectPose().boxes at p=.72/.78, see ending-scene-r15.js.
  computer.position.set(0.14, 1.32, -0.22);
  root.add(computer);

  const compHousing = new THREE.Group();
  computer.add(compHousing);

  // r35: the hand-built/createMacintosh() housing (no keyboard) is replaced
  // by createDeskComputer() (ending-desk-computer-r35.js), which models the
  // truth reference's integrated keyboard deck as part of the same body.
  // MAC_SCALE is chosen so the HEAD alone (createDeskComputer's HEAD_W=.80
  // local units, matching the reference photo's near-square CRT box) reads
  // at the SAME on-screen width the old bare createMacintosh() case had
  // (old case: model width 1.0 local * old MAC_SCALE .95 = .95 visible
  // width) — MAC_SCALE = .95 / .80 = 1.1875. Positioned so the model's own
  // bottom (local y=0, now the keyboard deck's underside) and chin/bezel
  // front face (local z=dims.frontZ=.40) land at the SAME computer-local
  // anchors the old case used — old case bottom COMP_CASE_BOTTOM_Y=-.15,
  // old outermost front face (frontBlockFrontZ)=.47 — so the seated hero's
  // hand targets (deskHandTargets in ending-scene-r15.js, which are NOT
  // derived from the screen/case transform and are NOT edited here) still
  // land in front of the case's chin without needing to move.
  // r46 owner decision: the keyboard deck itself is now removed entirely
  // from ending-desk-computer-r35.js (CRT head + chin only) — the mascot's
  // gloves rest on the actual DESK TOP (deskTopMesh below) in front of the
  // computer instead of on the deck's former sloped top surface. The r46
  // comment here used to claim MAC_SCALE/MAC_BOTTOM_Y/MAC_FRONT_Z stayed
  // correct unchanged because dims.frontZ/width/height/depth/screen* are
  // numerically identical — true for X/Z, but WRONG for Y: dims.height is
  // still measured from an assumed y=0 baseline (HEAD_TOP_Y), yet the
  // keyboard deck was the part of the old model that actually reached down
  // to y=0 — the remaining CRT head/chin shell's own lowest point is
  // HEAD_BOTTOM_Y=.42 (ending-desk-computer-r35.js's KBD_BACK_TOP constant,
  // == "head bottom", see its own comments), not 0. MAC_BOTTOM_Y=-.15 (which
  // assumed the model's bottom sits at its own local y=0) was therefore
  // placing the model's TRUE bottom .42*MAC_SCALE≈.499 units higher than
  // intended — landing well above the desk top surface instead of on it —
  // which is r56's defect B ("컴퓨터가 책상 뒤에 떨어져 있다" / floating with a
  // visible gap under it, see QA_Evidence/tva-claude-20260909/seat51-crops/
  // crop-p078-type.png). Fixed below by anchoring to the desk top's own
  // MEASURED surface height (DESK_TOP_SURFACE_Y=1.375, desk-local — see the
  // deskTopBox comment above CHAIR_BACK_DELTA in ending-scene-r15.js:
  // "deskTopBox measures desk-local y 1.125..1.375 (top surface 1.375)")
  // instead of the old hand-picked -.15: MAC_BOTTOM_Y is now solved so that
  // computer.position.y + MAC_BOTTOM_Y + HEAD_BOTTOM_Y*MAC_SCALE ==
  // DESK_TOP_SURFACE_Y, i.e. the model's real bottom sits exactly on the
  // desk top. MAC_FRONT_Z / MAC_SCALE / the computer group's own x/z
  // position (footprint stays within deskTopBox's z range -.685..+.855, see
  // measure-desk-boxes-r27.mjs) are untouched — only the Y anchor moves.
  const MAC_SCALE = 0.95 / 0.80;
  const DESK_TOP_SURFACE_Y = 1.375; // deskTopBox top, desk-local (see comment above)
  const DESK_COMPUTER_HEAD_BOTTOM_Y = 0.42; // == ending-desk-computer-r35.js's HEAD_BOTTOM_Y/KBD_BACK_TOP (the model's real lowest point, local, pre-scale)
  const MAC_BOTTOM_Y = DESK_TOP_SURFACE_Y - computer.position.y - DESK_COMPUTER_HEAD_BOTTOM_Y * MAC_SCALE;
  const MAC_FRONT_Z = 0.47;
  const deskMac = createDeskComputer(THREE, { screenAspect: 4 / 3, outline: true });
  deskMac.root.scale.setScalar(MAC_SCALE);
  deskMac.root.position.set(0, MAC_BOTTOM_Y, MAC_FRONT_Z - MAC_SCALE * deskMac.dims.frontZ);
  compHousing.add(deskMac.root);

  // HARD CONSTRAINT: PlaneGeometry at (0,~.55,~.40)-ish, computer-local — the
  // scene draws HOME onto this plane and dives into it at the end
  // (ending-scene-r15.js's homePortalTexture clones this same crop). The
  // plane is now the model's OWN screen mesh (inside its modelled bezel
  // opening) instead of a standalone plane; the scene reads its actual
  // world transform/geometry live (screen.getWorldPosition/Quaternion/Scale,
  // screen.geometry.parameters.width/height), so no downstream code needs a
  // hardcoded SCREEN_Y/SCREEN_Z any more.
  //
  // r21: a plain "cover" crop of the WHOLE 16:9 frame (keep full height, crop the sides to a centred 4:3 window)
  // left the picture looking wrong on the desk screen: the HOME key-visual's actual subject (the smiling Mac)
  // sits right-of-center on a mostly black/foggy field and only fills a little more than half the frame, so a
  // plain center/cover crop mostly showed empty dark background with the computer a small, dim, off-corner
  // smudge - reading as a switched-off/broken screen rather than a lit CRT. Cropped tightly to the subject's own
  // measured pixel box instead (both axes, not just a horizontal re-centre), with a small margin, so the picture
  // fills the 4:3 opening edge to edge. Box measured with QA_Evidence/tva-claude-20260909/measure-home-crop.py
  // (threshold=300 on summed RGB - the case + its screen glow against the near-black background): x[741..1842],
  // y[157..970] of the 1920x1080 source.
  const HOME_IMG_W = 1920, HOME_IMG_H = 1080;
  const HOME_SUBJECT = { x0: 741, x1: 1842, y0: 157, y1: 970 };
  const HOME_MARGIN = 0.08; // extra breathing room around the measured box, as a fraction of the box's own size
  const homeSubjectW = HOME_SUBJECT.x1 - HOME_SUBJECT.x0, homeSubjectH = HOME_SUBJECT.y1 - HOME_SUBJECT.y0;
  const homeSubjectCx = (HOME_SUBJECT.x0 + HOME_SUBJECT.x1) / 2, homeSubjectCy = (HOME_SUBJECT.y0 + HOME_SUBJECT.y1) / 2;
  const homeMarginedW = homeSubjectW * (1 + 2 * HOME_MARGIN), homeMarginedH = homeSubjectH * (1 + 2 * HOME_MARGIN);
  // r54: this is now the BEZEL WINDOW's own aspect (~1.412), read straight back
  // out of the model, because the screen quad IS the window as of r54 (see the
  // SCREEN section of ending-desk-computer-r35.js). Deriving the crop from the
  // same number that sizes the quad is what guarantees the HOME photo is
  // cover-cropped — never stretched — and fills the opening edge to edge.
  const homeCropAspect = deskMac.dims.screenWidth / deskMac.dims.screenHeight;
  // fit the tightest 4:3 window that still contains the margined subject box, centred on it
  let homeCropPxW = homeMarginedW, homeCropPxH = homeCropPxW / homeCropAspect;
  if (homeCropPxH < homeMarginedH) { homeCropPxH = homeMarginedH; homeCropPxW = homeCropPxH * homeCropAspect; }
  // clamp the window fully inside the source image, keeping it centred on the subject as closely as bounds allow
  homeCropPxW = Math.min(homeCropPxW, HOME_IMG_W); homeCropPxH = Math.min(homeCropPxH, HOME_IMG_H);
  const clampCenter = (center, size, imgSize) => Math.min(imgSize - size / 2, Math.max(size / 2, center));
  const homeCropCx = clampCenter(homeSubjectCx, homeCropPxW, HOME_IMG_W), homeCropCy = clampCenter(homeSubjectCy, homeCropPxH, HOME_IMG_H);
  const homeCropX0 = homeCropCx - homeCropPxW / 2, homeCropY0 = homeCropCy - homeCropPxH / 2;
  const homeCropRepeatX = homeCropPxW / HOME_IMG_W;
  const homeCropOffsetX = homeCropX0 / HOME_IMG_W;
  const homeCropRepeatY = homeCropPxH / HOME_IMG_H;
  // three.js textures are Y-flipped by default (flipY=true): v=0 is the BOTTOM row of the source image, v=1 is
  // the TOP row. Converting the desired top-of-window pixel row (homeCropY0, measured top-down like the crop
  // math above) into that v-space: v_top = 1 - homeCropY0/H, and offset.y is the BOTTOM of the sampled v-range.
  const homeCropOffsetY = 1 - (homeCropY0 + homeCropPxH) / HOME_IMG_H;
  const homeScreenTexture = homeTexture.clone();
  homeScreenTexture.repeat.set(homeCropRepeatX, homeCropRepeatY);
  homeScreenTexture.offset.set(homeCropOffsetX, homeCropOffsetY);
  homeScreenTexture.needsUpdate = true;
  const screenMat = new THREE.MeshBasicMaterial({ map: homeScreenTexture });
  const screen = deskMac.screen;
  screen.material = screenMat;

  // r21/r28: a faint additive green glow plane just behind the screen, so
  // the CRT's own light reads as bleeding onto the inner bezel lip instead
  // of the opening looking like a flat dark hole with a picture stuck in a
  // corner of it. Factored into screenGlowPlane() above (r28) so the
  // mascot's own face-screen gets the same treatment.
  screenGlowPlane(THREE, deskMac);

  // r24: item-1 cleanup — the desk keyboard (tray + keycap rows + space bar) is removed entirely; nothing
  // keyboard-like remains on the desk. The mascot now rests its gloves directly on the desk surface in front
  // of the Mac during typing (see ending-scene-r15.js's deskHandTargets, the keyboardTargets replacement).

  // ---- chair: real seat cushion + curved back + five-star base w/ casters ----
  const chair = new THREE.Group();
  // r21: scooted back (was z=1) so the seated mascot's own case clears the desk top/Mac in front of it —
  // measured with inspectPose().boxes.
  chair.position.set(0.05, 0.2, 1.55);
  root.add(chair);

  const SEAT_CUSHION_Y = 0.5, SEAT_CUSHION_H = 0.16, SEAT_CUSHION_Z = -0.375;
  const seatGeo = roundedBox(THREE, 0.9, SEAT_CUSHION_H, 0.75, 0.12, { curveSegments: 8 });
  place(new THREE.Mesh(seatGeo, clothMat), chair, [0, SEAT_CUSHION_Y, SEAT_CUSHION_Z]);
  // debug getter: world-space top of the seat cushion (case-bottom rests here when the hero sits)
  const getSeatTop = () => root.localToWorld(new THREE.Vector3(chair.position.x, chair.position.y + SEAT_CUSHION_Y + SEAT_CUSHION_H / 2, chair.position.z + SEAT_CUSHION_Z));
  const getChairBack = () => root.localToWorld(new THREE.Vector3(chair.position.x, chair.position.y + 0.98, chair.position.z + 0.15));

  // r53 owner decision: chair backrest REMOVED — the chair is now a stool (seat cushion + gas-lift
  // post + star base only). ending-scene-r15.js locates the "backrest" mesh at runtime not by name but
  // by traversing workDesk.chair's meshes and sorting by local y (chair-local y≈.98 was "comfortably the
  // tallest" per that file's own comment) — chairMeshesByHeight[0] is treated as chairBackMesh. Deleting
  // this mesh outright would shift that sort (the gas-lift cap at y=0.42 would become index 0) and could
  // silently repoint chairBackBox at the wrong geometry. So the mesh (and its position, still the tallest
  // local y in the group) stays as an inert placeholder: invisible and scaled to ~0 so groupBoxOf/Box3
  // measurements on it collapse to a point and overlapCaseChair's backrest term is always 0. getChairBack()
  // above is a fixed offset off chair.position (not mesh-derived) and is intentionally left untouched.
  const backGeo = roundedBox(THREE, 0.86, 1.05, 0.15, 0.20, { curveSegments: 10 });
  const backMesh = place(new THREE.Mesh(backGeo, clothMat), chair, [0, 0.98, 0.15]);
  backMesh.rotation.x = -0.10;
  backMesh.visible = false;
  backMesh.scale.setScalar(0.0001);

  // gas-lift cylinder
  place(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.42, 10), ink), chair, [0, 0.21, 0]);
  place(new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.05, 12), ink), chair, [0, 0.42, 0]);

  // five-star base with a caster wheel at the tip of every spoke
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    const spoke = place(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.07), ink), chair, [0, 0.02, 0]);
    spoke.rotation.y = angle;
    const caster = place(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), ink), chair, [Math.cos(angle) * 0.30, -0.02, Math.sin(angle) * 0.30]);
    caster.scale.set(1, 0.8, 1);
  }

  return {
    root, screenMat, screen,
    textures: [grain, grainDark, plastic, cloth, homeScreenTexture],
    homeScreenTexture, homeCropRepeatX, homeCropOffsetX, homeCropRepeatY, homeCropOffsetY,
    // r54: the ending's dive builds its own portal quad with this so the
    // flatten hand-off starts from the monitor window's exact outline.
    makeScreenQuad: deskMac.makeScreenQuad, screenRadius: deskMac.dims.screenRadius,
    getSeatTop, getChairBack,
    // debug/measurement handles (Box3.setFromObject) for interference checks
    deskTopMesh, macCaseMesh: compHousing,
    // r38 QA fix: exposed so ending-scene-r15.js can nudge the chair back
    // (keeping seat contact via getSeatTop/getChairBack, which read this
    // group's position live) when the desk computer's own keyboard deck
    // (ending-desk-computer-r35.js) grows forward enough to need the extra
    // clearance — see CHAIR_BACK_DELTA in ending-scene-r15.js. Geometry/
    // placement of the chair itself is unchanged here.
    chair,
  };
}
