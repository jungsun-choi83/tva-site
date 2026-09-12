// ending-mascot-model-r30.js
// Rebuilt procedural body for the TVA ending mascot, re-tuned against the
// APPROVED character sheet (assets/ending/r10-image-first/character-original-v3/
// 01-front / 02-side / 03-three-quarter / 04-walk), not a generic
// "Macintosh 128K" reference. Measurements taken by pixel-scanning the four
// sheet renders live in runtime/ending-mascot-r30/measurements.json.
//
// r31 fixes (owner-rejected r30 comparison, see
// QA_Evidence/tva-claude-20260909/mascot-r30-1280/crops/{model-vs-sheet-3q,
// walk-crop,sit-crop}.png):
//  1. Face screen rendered almost black in the live scene. Root-caused by
//     running the diagnostic capture-ending-scrub against the real page
//     (not just the isolated test.html): the RECESS mesh behind the screen
//     was, like every other detail mesh, being wrapped in its own outline
//     shell (r30's makeOutline(), offset 0.022 along each vertex normal).
//     Offset outward along the recess's own front-face normal (+Z), that
//     shell's front cap lands FORWARD of the screen mesh's own base z
//     (confirmed: recessFrontZ+0.022 = 0.554 vs screen base z = 0.536,
//     only the screen's own central bulge — max +0.028 — pokes past that),
//     so the recess's own outline (near-black BackSide material) covered
//     almost the entire screen opening, leaving only a small bulge of the
//     face art visible. That is also why the screen LOOKED small: only its
//     bulging centre ever cleared the recess-outline's front cap.
//     Confirmed live with a temporary window.__DEBUG_MASCOT hook: the face
//     texture/material/UVs were always correct — this was purely a
//     draw-order occlusion bug, not a texture or lighting problem.
//     Fixed here by no longer wrapping every detail mesh in its own
//     outline shell: only the main tapered body shell gets one (a single
//     clean silhouette line), matching the "single outline, no doubling"
//     brief. The screen material is also set unlit + toneMapped=false +
//     fog=false so it stays fully readable regardless of any scene
//     lighting/tone-mapping/fog now or in the future (belt-and-suspenders;
//     the actual occluder above was the real cause here).
//  2. Screen too small — a side effect of #1 (see above) plus an
//     excessively round screen corner radius (was 22% of screen width,
//     almost a squircle, eating into the rectangular screen area). Fixed
//     to ~8% per the approved brief, re-measured screen-rect fractions
//     against 01-front.webp's own cabinet bbox (isolated from the arms by
//     scanning per-row silhouette width — the arms flare the silhouette
//     wider starting ~y=520/1254), landing on x0=.149 x1=.834 y0=.1305
//     y1=.588 (all inside the brief's expected ranges).
//  3. Colour too pale/yellow — re-sampled the cabinet's own lit mid-tone
//     directly off 03-three-quarter.png (several flat front-face patches,
//     avoiding the badge/highlight/background) and landed on #CEB781
//     (206,183,129); kept a faint per-vertex colour jitter (not a UV
//     texture, to sidestep the r30 tiling bug on the extrude's own bevel
//     UVs) for a subtle speckle instead of a flat, printer-toner-flat fill.
//  4. Shape — reduced the front→back taper from ~17.5% to ~7%, increased
//     the vertical-edge bevel from 2% to ~5.5% of width, switched the base
//     from a WIDER plinth to a properly INSET stepped foot (~6% of height,
//     ~4% narrower than the body), added 2 more side vent slits (4 -> 6),
//     and added a plain back panel + small port strip (previously the back
//     was just the bare extrusion cap). The old double-outline artefact
//     (every mesh, including the bezel block flush against the body, each
//     getting its own shell) is resolved by #1's fix — only bodyShell now
//     carries an outline.
//
// export function createMascotBody(THREE, opts = {}) -> { root, screen, screenMat, dims }
//   dims: { width, height, depth, frontZ, screenWidth, screenHeight }
// Same local-space contract as the old createMacintosh() from
// ending-mac-model-r26.js (width=1 local unit, bottom at local y=0, front
// face at local z=dims.frontZ) so ending-props-r15.js's createMascot() can
// swap the import with no change to its own scale/position math.

function roundedRectShape(THREE, w, h, r, ox = 0, oy = 0) {
  const shape = new THREE.Shape();
  const x = -w / 2 + ox;
  const y = -h / 2 + oy;
  const rr = Math.min(r, w / 2, h / 2);
  shape.moveTo(x, y + rr);
  shape.lineTo(x, y + h - rr);
  shape.quadraticCurveTo(x, y + h, x + rr, y + h);
  shape.lineTo(x + w - rr, y + h);
  shape.quadraticCurveTo(x + w, y + h, x + w, y + h - rr);
  shape.lineTo(x + w, y + rr);
  shape.quadraticCurveTo(x + w, y, x + w - rr, y);
  shape.lineTo(x + rr, y);
  shape.quadraticCurveTo(x, y, x, y + rr);
  return shape;
}

function roundedRectPath(THREE, w, h, r, ox = 0, oy = 0) {
  // Wound opposite to roundedRectShape's outer contour so ExtrudeGeometry
  // treats it as a hole rather than a second overlapping solid contour.
  const path = new THREE.Path();
  const x = -w / 2 + ox;
  const y = -h / 2 + oy;
  const rr = Math.min(r, w / 2, h / 2);
  path.moveTo(x + rr, y);
  path.lineTo(x + w - rr, y);
  path.quadraticCurveTo(x + w, y, x + w, y + rr);
  path.lineTo(x + w, y + h - rr);
  path.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  path.lineTo(x + rr, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - rr);
  path.lineTo(x, y + rr);
  path.quadraticCurveTo(x, y, x + rr, y);
  return path;
}

// Body footprint (top-down, X/Z): wide at front (+z), tapering to a
// narrower, rounded-corner rear (-z) — matches the sheet's back-taper trait.
// r31: the front-left/front-right corners are now ALSO rounded (frontR) —
// this is where the cabinet's own "rounded vertical edges" trait actually
// belongs. r30 only rounded the back corners and tried to get vertical-edge
// rounding out of ExtrudeGeometry's bevelThickness/bevelSize instead — but
// that bevel operates on the EXTRUDE axis (this shape is extruded along Y
// after the caller's geo.rotateX), i.e. it rounds the cabinet's TOP/BOTTOM
// edges, not its verticals. Worse, cranking that bevel up to ~5.5% of width
// to fake vertical rounding hit a classic miter-join spike at this shape's
// then-sharp front corners (a naive offset at a sharp convex corner
// overshoots outward by roughly bevelSize/sin(halfAngle)), which blew the
// bevel geometry forward far enough to fully cover the bezel/screen/badge/
// slot/vents (confirmed by A/B: reverting just that one bevel value from
// .055 back to .02 immediately brought the whole face back). Rounding the
// corners HERE instead gives true vertical-edge rounding with no such
// blowup, and the small Y-extrude bevel stays at a modest, purely
// top/bottom-softening value.
function bodyFootprintShape(THREE, frontW, backW, depth, frontR, backR) {
  const shape = new THREE.Shape();
  const hf = frontW / 2;
  const hb = backW / 2;
  const zf = depth / 2;
  const zb = -depth / 2;
  const rf = Math.min(frontR, hf * 0.9, depth * 0.35);
  const rb = Math.min(backR, hb * 0.9, depth * 0.35);
  shape.moveTo(-hf + rf, zf);
  shape.lineTo(hf - rf, zf);
  shape.quadraticCurveTo(hf, zf, hf, zf - rf);
  shape.lineTo(hb, zb + rb);
  shape.quadraticCurveTo(hb, zb, hb - rb, zb);
  shape.lineTo(-hb + rb, zb);
  shape.quadraticCurveTo(-hb, zb, -hb, zb + rb);
  shape.lineTo(-hf, zf - rf);
  shape.quadraticCurveTo(-hf, zf, -hf + rf, zf);
  return shape;
}

// r31: faint per-VERTEX colour jitter (not a UV-mapped canvas texture) so
// the cabinet keeps a subtle speckled-plastic look without re-triggering
// r30's checkerboard-tiling bug on ExtrudeGeometry's own bevel-cap UVs.
// Material must have vertexColors=true and its own .color left at the
// sampled base hex (vertex colours multiply it, so jitter is expressed as
// small deviations from 1.0, not the base colour itself).
function addVertexSpeckle(THREE, geometry, amount = 0.05) {
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const jitter = 1 + (Math.random() * 2 - 1) * amount;
    colors[i * 3] = jitter;
    colors[i * 3 + 1] = jitter;
    colors[i * 3 + 2] = jitter;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// r40 (render-quality pass, owner complaint: "얼굴만 그림이고 몸은 밋밋한
// 상자" — the face reads as a flat sticker on a flat-lit box). Extends the
// r31 per-vertex jitter into real per-vertex FORM SHADING: darker toward the
// geometry's own bottom (base) and lighter toward its own top, baked as a
// vertical (Y) gradient in the same per-vertex-colour channel the r31 fix
// already uses — still no UV-mapped canvas texture on this geometry, so the
// ExtrudeGeometry bevel-cap tiling bug r31 sidestepped stays sidestepped.
// The random jitter term is kept (smaller) on top of the gradient for the
// "fine speckle" trait so the surface doesn't read as two flat bands.
function addFormShadingColors(THREE, geometry, { bottomMult = 0.85, topMult = 1.05, jitter = 0.03 } = {}) {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const minY = bb.min.y, maxY = bb.max.y;
  const span = Math.max(1e-6, maxY - minY);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / span; // 0 at bottom, 1 at top
    const grad = bottomMult + (topMult - bottomMult) * t;
    const speck = 1 + (Math.random() * 2 - 1) * jitter;
    const v = grad * speck;
    colors[i * 3] = v;
    colors[i * 3 + 1] = v;
    colors[i * 3 + 2] = v;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// r40: fine procedural speckle texture (256x256 canvas, low-contrast noise
// centred near white) used as a .map on the cabinet materials so the plastic
// reads as a real surface instead of a flat toner fill, per the approved
// sheet's "fine plastic speckle" trait. Centred near-white (not mid-grey) so
// multiplying it into matBody/matFront's base colour doesn't darken the
// cabinet — it only adds a few percent of high-frequency grain. Tiled with a
// modest repeat (set by the caller) so any UV distortion from
// ExtrudeGeometry's own bevel-cap UVs (the r30 tiling bug) shows as
// unnoticeable extra grain rather than a visible repeating pattern, since
// noise has no directional structure to reveal seams.
function cabinetSpeckleTexture(THREE, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = 238 + (Math.random() * 2 - 1) * 16; // ~0.87-1.0 of white, low contrast
    img.data[i * 4] = n;
    img.data[i * 4 + 1] = n;
    img.data[i * 4 + 2] = n;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

// r40: switched from a corner-to-corner diagonal wash to a soft RADIAL
// highlight blob sitting in the upper-left quadrant, per the brief ("a soft
// specular highlight" reading "as a CRT reflection") — the sheet's screen
// shows a distinct round highlight there, not a diffuse diagonal gradient.
// Kept low-opacity/additive so it stays a glass glint, not a wash over the
// face art.
// r42 fix: in the real scene (walking, brighter overall exposure than the
// isolated test rig) this blob washed the upper half of the face to
// near-white and buried the eyes. Two changes: (1) opacity dropped to ~40%
// of r40's stops, (2) radius shrunk and pulled tighter into the upper-left
// corner so the gradient reaches ~0 well before the screen's own centre
// (centre sits ~0.27*size away from cx/cy) instead of washing past it.
function screenGlareTexture(THREE, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size * 0.26, cy = size * 0.24, r = size * 0.22;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(255,255,255,.10)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.042)');
  grad.addColorStop(0.6, 'rgba(255,255,255,.009)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// r30 fix (kept in r31): displaces each vertex along its own normal, which
// is independent of how far the geometry sits from the world origin (unlike
// the old r26 "scale the whole mesh about world (0,0,0)" method, which
// produced wildly uneven shell thickness once a mesh's own placement was
// baked into its geometry via geo.translate(...) instead of mesh.position).
//
// r31: this is now applied to EXACTLY ONE mesh (bodyShell) instead of every
// mesh in the model. r30 wrapped every detail mesh (recess, bezel ring,
// badge, slot, vents, seam) in its own shell, which (a) produced a visibly
// doubled outline anywhere two of those meshes sit close together (e.g. the
// bezel block flush against the body front) and (b) actively broke the
// face screen: the recess mesh's own outward-offset shell landed IN FRONT
// of the screen mesh's base z, covering almost the whole opening (see the
// file-header comment for the measured numbers). Outlining only the body's
// own silhouette avoids both problems — the bezel block shares the body's
// own front footprint width exactly, so the body's outline already reads
// as wrapping the whole visible cabinet silhouette from the front/3q view.
// r33 fix: r30/r31 offset every vertex along its own NORMAL. That is fine on
// smooth/flat regions but overshoots badly wherever normals from adjacent
// faces diverge sharply (exactly the top-right region here, where the
// top-cap bevel meets the now-larger frontR/backR vertical rounding) —
// confirmed visually as a stray dark line hugging the top-right silhouette
// in side-by-side-3q-r31.png that doesn't track the actual body edge. Fixed
// by switching to a uniform scale about the mesh's own bounding-box centre
// instead: every vertex moves by the same proportional amount regardless of
// its local normal direction, so there is no per-corner overshoot and the
// shell stays a clean, tight silhouette line at every angle.
function makeOutline(THREE, mesh, scaleFactor = 1.008, color = 0x1a1610) {
  const geo = mesh.geometry.clone();
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cy = (bb.min.y + bb.max.y) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      cx + (pos.getX(i) - cx) * scaleFactor,
      cy + (pos.getY(i) - cy) * scaleFactor,
      cz + (pos.getZ(i) - cz) * scaleFactor,
    );
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const outlineMat = new THREE.MeshBasicMaterial({
    color, side: THREE.BackSide,
    polygonOffset: true, polygonOffsetFactor: 8, polygonOffsetUnits: 8,
  });
  const outline = new THREE.Mesh(geo, outlineMat);
  outline.renderOrder = -1;
  return outline;
}

// =============================================================================
// r55 — 3D FACE
// =============================================================================
// Owner complaint: "캐릭터 얼굴이 그냥 드로잉이고 3D가 아니라서 이질감 든다" — the
// body is modelled but the face was a flat crop of the character sheet pasted
// on the screen mesh. Everything below rebuilds the SAME face design as real
// geometry sitting on the screen's convex dome.
//
// The layout numbers are measured (not eyeballed) off the sheet itself,
// assets/ending/r10-image-first/character-original-v3/01-front.webp, inside the
// exact same screen crop rect the old face texture used ([434,233,810,545] of
// the 1254px render — MASCOT_SCREEN_RECT in ending-props-r15.js). They are
// expressed as fractions of that rect: u across (0 = screen's left edge),
// v down (0 = screen's top edge), so they map 1:1 onto the screen mesh's own
// width/height whatever those end up being.
//
// Measurement method (PIL, luminance < 90 = ink, plus a 4px erosion pass to
// separate each pupil from the eye's own outline stroke):
//   eye ovals   ink comps  x[63..158] / x[219..313], y[69..202]
//   sclera      cream fill y from .349 down -> the half-lid line
//   pupils      eroded ink comps, centres u .368 / .779, v .462 (BOTH pupils
//               sit right of their eye's centre — the character looks to its
//               own left; that asymmetry is part of the design)
//   brows       per-column ink centreline, both arches peak left of centre
//   nose        a "C" opening right, back edge at u .399, v .55-.69
//   mouth       per-column ink centreline for rows below the nose, the right
//               end hooks up ~.09v higher than the left -> the asymmetric smile
//   lower lip   small separate stroke at v .86
const FACE_LAYOUT = {
  eye: { rxU: 0.1263, ryV: 0.2131, cvV: 0.4343, lidV: 0.3494, cuL: 0.2939, cuR: 0.7074 },
  pupil: { du: 0.0680, cvV: 0.465, rxU: 0.0590, ryV: 0.1250 },
  brows: [
    [[0.186, 0.228], [0.229, 0.185], [0.271, 0.170], [0.314, 0.173], [0.356, 0.222]],
    [[0.644, 0.245], [0.686, 0.176], [0.729, 0.168], [0.771, 0.180], [0.814, 0.226]],
  ],
  // nose: the measured numbers are the ink's own left/top EDGE, so the
  // centreline is half a stroke width in from them (+.008u, +.006v).
  nose: [[0.476, 0.589], [0.432, 0.596], [0.407, 0.618], [0.406, 0.658], [0.418, 0.692], [0.446, 0.707], [0.482, 0.713]],
  mouth: [[0.391, 0.789], [0.433, 0.808], [0.476, 0.816], [0.519, 0.817], [0.561, 0.811], [0.604, 0.795], [0.646, 0.772], [0.689, 0.734], [0.712, 0.722]],
  lip: [[0.503, 0.862], [0.543, 0.866], [0.582, 0.853]],
};

// A shallow dome patch: a triangle fan from `hub` out to a closed CCW
// `boundary` polyline, with `rings` concentric rings so the interior actually
// has vertices to displace (a plain ShapeGeometry only triangulates the
// outline, which would leave the cap dead flat). Each vertex is pushed out to
// baseZ(x,y) + lift + cap*(1-s^2), s being the 0..1 radial parameter — so the
// patch hugs the screen's own dome AND carries its own gentle bulge on top.
function faceCapGeometry(THREE, boundary, hub, rings, lift, cap, baseZ) {
  const n = boundary.length;
  const pos = [];
  const idx = [];
  const zAt = (x, y, s) => baseZ(x, y) + lift + cap * (1 - s * s);
  pos.push(hub[0], hub[1], zAt(hub[0], hub[1], 0));
  for (let r = 1; r <= rings; r++) {
    const s = r / rings;
    for (let i = 0; i < n; i++) {
      const x = hub[0] + (boundary[i][0] - hub[0]) * s;
      const y = hub[1] + (boundary[i][1] - hub[1]) * s;
      pos.push(x, y, zAt(x, y, s));
    }
  }
  const at = (r, i) => (r === 0 ? 0 : 1 + (r - 1) * n + (i % n));
  for (let i = 0; i < n; i++) idx.push(at(0, 0), at(1, i), at(1, i + 1));
  for (let r = 1; r < rings; r++) {
    for (let i = 0; i < n; i++) {
      const a = at(r, i), b = at(r, i + 1), c = at(r + 1, i), d = at(r + 1, i + 1);
      idx.push(a, c, d, a, d, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function createMascotBody(THREE, opts = {}) {
  const screenAspect = opts.screenAspect || (807 - 436) / (543 - 236); // sheet screen crop aspect, ~1.208
  const outline = opts.outline !== false;
  const tint = opts.tint !== undefined ? new THREE.Color(opts.tint) : null;

  // ---- Overall dimensions, measured off 01-front.webp / 02-side.webp ----
  // Front cabinet bbox measured 547x686px -> width:height 0.797. Width=1.
  const W = 1.0;
  const H = 1.0 / 0.797; // ~1.255
  // Side-view measured depth:width ~0.894 (perspective-inflated on the sheet's
  // side render); nudged slightly deeper per the approved brief's "slightly
  // deeper than wide" call and confirmed visually against 03-three-quarter.
  const D = 1.02;
  const frontZ = D * 0.5;

  const root = new THREE.Group();
  root.name = 'mascotBody';

  // ---- Materials ----
  // r31: base colour re-sampled directly off 03-three-quarter.png's own
  // lit front-face mid-tone (several flat patches averaged, avoiding the
  // badge/highlight/background) -> #CEB781 (206,183,129). Faint per-vertex
  // speckle (addVertexSpeckle) keeps the "faint speckle" trait without the
  // r30 canvas-texture tiling bug.
  // r50: +blue nudge (0xCEB781 -> 0xCFBA8C). Rendered under the scene's own
  // warm key the old value came out (205,173,112) against the sheet's
  // (203,180,127) — same lightness, noticeably more yellow.
  const BASE_HEX = 0xcfba8c;
  const baseColor = tint || new THREE.Color(BASE_HEX);
  const bodyColor = tint ? tint.clone().multiplyScalar(0.94) : new THREE.Color(BASE_HEX).multiplyScalar(0.94);
  const undersideColor = tint ? tint.clone().multiplyScalar(0.72) : new THREE.Color(BASE_HEX).multiplyScalar(0.72);
  // r40: roughness/metalness tuned to the brief's "soft matte plastic"
  // (roughness ~.7, metalness 0) and a shared fine speckle map added (see
  // cabinetSpeckleTexture above) so the cabinet doesn't read as a flat
  // printer-toner fill under the scene's own lights.
  const speckleTex = cabinetSpeckleTexture(THREE);
  // r50: roughness 0.7 -> 0.55. In the real scene there is exactly one
  // directional light and no environment map, so at 0.7 the cabinet returned
  // essentially no specular at all and read as unlit matte card — a flat box
  // with a picture on it, which is precisely the owner's complaint. At 0.55
  // the rounded top/vertical edges pick up a soft moulded-plastic sheen (the
  // sheet's own cabinet clearly carries one) without going shiny.
  const matFront = new THREE.MeshStandardMaterial({
    color: baseColor, roughness: 0.55, metalness: 0, vertexColors: true, map: speckleTex,
  });
  const matBody = new THREE.MeshStandardMaterial({
    color: bodyColor, roughness: 0.55, metalness: 0, vertexColors: true, map: speckleTex,
  });
  const matUnderside = new THREE.MeshStandardMaterial({
    color: undersideColor, roughness: 0.85, metalness: 0.02,
  });
  const matBezelLight = new THREE.MeshStandardMaterial({ color: 0xe4d6ac, roughness: 0.6, metalness: 0.03 });
  const matSlot = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.7 });
  const matBadge = new THREE.MeshStandardMaterial({ color: 0xe6450d, roughness: 0.45, metalness: 0.08 });
  const matVent = new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.8 });
  const matBack = new THREE.MeshStandardMaterial({ color: undersideColor.clone().multiplyScalar(1.12), roughness: 0.8, metalness: 0.02 });
  const matPort = new THREE.MeshStandardMaterial({ color: 0x100e0b, roughness: 0.6, metalness: 0.15 });
  // r31: unlit + toneMapped=false + fog=false so the face screen stays
  // fully readable regardless of scene lighting/tone-mapping/fog.
  // depthTest=false + depthWrite=false (paired with a high renderOrder set
  // on the mesh below) is the actual production-bug fix — see the screen
  // mesh's own comment further down for the full writeup of why a small
  // polygonOffset bias was NOT sufficient here (tried first; the failure
  // is genuine angle-dependent depth-buffer compression, not a fixed-size
  // precision gap, so no fixed offset magnitude is reliably enough at every
  // viewing angle). Ignoring the depth test entirely and simply painting
  // this mesh last is the deterministic fix.
  const matScreenDefault = new THREE.MeshBasicMaterial({
    color: 0x708c5e, side: THREE.DoubleSide, toneMapped: false, fog: false,
    depthTest: false, depthWrite: false,
  });

  const outlineMeshes = [];
  function addMesh(geo, mat, group = root, trackOutline = false) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (trackOutline) outlineMeshes.push(mesh);
    return mesh;
  }

  // =========================================================
  // BASE — stepped INSET plinth (r31: narrower than the body, not wider —
  // height ~6% of cabinet height, inset ~4% narrower than the body's own
  // front footprint, per the approved brief).
  // =========================================================
  const baseH = H * 0.06;
  const stepH = baseH * 0.4;
  const baseInset = 0.04;

  // =========================================================
  // BODY — tapered rounded cabinet, front wide, back narrower
  // =========================================================
  const bodyTop = H;
  const bodyBottom = baseH;
  const bodyH = bodyTop - bodyBottom;
  const bodyFrontW = W * 0.98;
  const bodyBackW = bodyFrontW * 0.93; // r31: ~7% taper (was ~17.5%)
  const bodyDepth = D * 0.95;
  // r33: proud amount increased (was 1.2% of width) so the bezel front
  // plate reads as a distinct, slightly-raised panel against the body, per
  // the sheet, rather than nearly flush with it.
  const bezelProud = W * 0.02;
  const bodyFrontZ = frontZ - bezelProud;
  const bodyBackZ = bodyFrontZ - bodyDepth;

  const baseW = bodyFrontW * (1 - baseInset);
  const baseD = bodyDepth * (1 - baseInset);
  {
    const shape = roundedRectShape(THREE, baseW, baseD, 0.05);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: stepH, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, 0);
    addMesh(geo, matUnderside);
    // inset upper step, slightly smaller footprint, sits on top of the lower step
    const shape2 = roundedRectShape(THREE, baseW * 0.9, baseD * 0.92, 0.05);
    const geo2 = new THREE.ExtrudeGeometry(shape2, {
      depth: baseH - stepH, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 8,
    });
    geo2.rotateX(-Math.PI / 2);
    geo2.translate(0, stepH, 0);
    addMesh(geo2, matUnderside);
  }

  {
    // r33: vertical-edge bevel enlarged to match the approved sheet more
    // closely (was frontR=5.5%/backR=9% of width; sheet reads closer to
    // ~7-8% on the verticals) -> frontR=7.5%, backR=8.5%. Top/bottom cap
    // bevel (the Y-extrude bevelThickness/bevelSize below) also enlarged
    // from 2% to ~4% of width per the sheet's softer top edge — safe now
    // that the front corners are rounder (the old miter-join spike this
    // file's r31 comment warned about was a sharp-corner artifact; a
    // rounder corner does not overshoot the same way).
    const footprint = bodyFootprintShape(THREE, bodyFrontW, bodyBackW, bodyDepth, W * 0.075, W * 0.085);
    const geo = new THREE.ExtrudeGeometry(footprint, {
      // Top/bottom cap rounding (this bevel runs along the extrude axis,
      // which becomes vertical/Y after the rotateX below — i.e. it softens
      // the cabinet's TOP and BOTTOM edges, not its verticals, so it stays
      // unrelated to the frontR/backR vertical-edge rounding above). r33:
      // enlarged from 2% to 4% of width so the top face reads as slightly
      // domed/rounded into the sides, per the sheet.
      depth: bodyH, bevelEnabled: true, bevelThickness: W * 0.04, bevelSize: W * 0.04, bevelSegments: 10, curveSegments: 16,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, bodyBottom, (bodyFrontZ + bodyBackZ) / 2);
    geo.computeVertexNormals();
    // r40: real form shading (darker near the base, lighter toward the top)
    // instead of just flat random jitter — see addFormShadingColors' header
    // comment for why this stays a per-vertex-colour gradient rather than a
    // UV-mapped texture.
    addFormShadingColors(THREE, geo, { bottomMult: 0.85, topMult: 1.05, jitter: 0.03 });
    var bodyShellMesh = addMesh(geo, matBody, root, outline);
    bodyShellMesh.name = 'bodyShell';
  }
  // r31: the side-vent placement below used to derive its outward X offset
  // from bodyFootprintShape's own straight-line footprint half-width
  // (lerped between bodyFrontW/2 and bodyBackW/2). That badly undershoots
  // the ACTUAL surface: ExtrudeGeometry's bevel (bevelSize=W*0.02 above)
  // bulges the side wall outward well past the raw footprint — confirmed by
  // raycasting the real bodyShell mesh at the vent's own y/z (see the r31
  // dev notes): the analytic formula gave half-widths of ~0.46, but the
  // real surface there was ~0.50-0.51, so every vent sat ~0.045 units
  // INSIDE the solid body — fully buried and invisible from any angle, no
  // matter how much the small manual offset on top of that formula was
  // increased. Raycasting the actual built mesh instead of trusting the
  // footprint formula is what actually finds the real surface.
  const bodySurfaceRaycaster = new THREE.Raycaster();
  function bodyOuterXAt(y, z) {
    bodySurfaceRaycaster.set(new THREE.Vector3(W * 3, y, z), new THREE.Vector3(-1, 0, 0));
    const hits = bodySurfaceRaycaster.intersectObject(bodyShellMesh, false);
    return hits.length ? hits[0].point.x : bodyFrontW / 2;
  }

  // side vertical vent slits, bottom of the side panel (both sides, near back)
  // r31: 6 slits (was 4) per the approved brief ("5-6 vertical vent slits").
  {
    // r50: the vent band was 6 hairline slits covering only ~13% of the
    // cabinet's depth. On 02-side.webp the vent band is a clearly readable
    // feature covering ~27% of the depth — at the scene's own scale the old
    // version disappeared entirely, leaving the side of the case a blank
    // panel. Widened the slits and the spacing and raised the count to 8.
    const slitW = 0.016, slitH = 0.17, slitD = 0.014;
    const count = 8;
    const startY = bodyBottom + bodyH * 0.09;
    const slitCenterY = startY + slitH / 2;
    const zCenter = bodyBackZ + bodyDepth * 0.26;
    for (let i = 0; i < count; i++) {
      const z = zCenter - i * (slitW * 2.05);
      // raycast the REAL surface at this exact y/z (see bodyOuterXAt's
      // comment above) instead of the footprint formula that used to leave
      // every one of these buried inside the solid body.
      const outerX = bodyOuterXAt(slitCenterY, z);
      for (const side of [-1, 1]) {
        const geo = new THREE.BoxGeometry(slitD, slitH, slitW);
        const mesh = addMesh(geo, matVent);
        mesh.position.set(side * (outerX - slitD * 0.35), slitCenterY, z);
      }
    }
  }

  // =========================================================
  // BACK — plain back panel with a small port strip (r31: was previously
  // just the bare extrusion cap with no detail at all).
  // =========================================================
  {
    // r50: the back panel was small (86%/60%) and nearly the same tone as the
    // body, so the seated shot (p=.78, which shows the character's BACK for
    // several seconds) was a blank tan slab. Enlarged, given a real recess
    // step and a vent grill so the rear reads as a moulded computer case.
    const backW = bodyBackW * 0.92;
    const backH = bodyH * 0.72;
    const panelShape = roundedRectShape(THREE, backW, backH, 0.03);
    const geo = new THREE.ExtrudeGeometry(panelShape, { depth: 0.006, bevelEnabled: false, curveSegments: 8 });
    geo.translate(0, bodyBottom + bodyH * 0.42, bodyBackZ - 0.004);
    geo.computeVertexNormals();
    addMesh(geo, matBack);

    const portW = backW * 0.34, portH = backH * 0.09;
    const portGeo = new THREE.BoxGeometry(portW, portH, 0.008);
    const port = addMesh(portGeo, matPort);
    port.position.set(-backW * 0.18, bodyBottom + bodyH * 0.30, bodyBackZ - 0.01);

    // r50: horizontal vent grill across the upper back
    const grillW = backW * 0.62, grillSlitH = backH * 0.035;
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.BoxGeometry(grillW, grillSlitH, 0.01);
      const m = addMesh(geo, matVent);
      m.position.set(0, bodyBottom + bodyH * (0.58 + i * 0.055), bodyBackZ - 0.011);
    }
  }

  // =========================================================
  // BEZEL — front slab, thin lighter bezel ring around the screen window
  // =========================================================
  const bezelW = bodyFrontW;
  const bezelH = bodyTop - baseH;
  const bezelThickness = 0.05;
  const bezelBackZ = frontZ - bezelThickness;

  // r31: screen rect re-measured off 01-front.webp's own cabinet bbox
  // (isolated from the arms/gloves by scanning per-row silhouette width —
  // the arms start flaring the silhouette wider at y~520/1254, so rows
  // 200-500 give the cabinet's own stable width, ~[352,901]px; cabinet
  // vertical span (rounded-top tip to where legs split off) is
  // y~[144,826]px). Screen crop [434,233,810,545]px against that bbox:
  // x0=(434-352)/549=.149 x1=(810-352)/549=.834 (width frac=.685, inside
  // the brief's .68-.72 target), y0=(233-144)/682=.1305 y1=(545-144)/682
  // =.588 (both inside the brief's .10-.13 / .55-.58 targets).
  // r50: the fractions above are of the SHEET's own cabinet bbox, but they are
  // applied here to bezelW/bezelH — a box whose top is eaten by the extrude's
  // 4%-of-width top-cap bevel and whose bottom starts above the base step, so
  // the window came out smaller than the sheet's. Measured side by side at
  // matched framing (runtime/ending-mascot-r30/side-by-side-3q-r50.png): the
  // sheet's screen is 0.70 of the visible front-face width and 0.44 of the
  // cabinet height, ours was 0.62 / 0.36. Grown ~9% about the window's own
  // centre to close that gap — this is the single biggest reason the case
  // read as "a big blank box with a small picture on it".
  const SCR = { x0: 0.128, x1: 0.855, y0top: 0.113, y1top: 0.605 };
  const winW = bezelW * (SCR.x1 - SCR.x0);
  const winH = bezelH * (SCR.y1top - SCR.y0top);
  const winCenterY = bezelH * (1 - (SCR.y0top + SCR.y1top) / 2);
  const winCenterX = bezelW * ((SCR.x0 + SCR.x1) / 2 - 0.5);

  let bezelMesh;
  {
    // r33: outer corner radius and edge bevel both nudged up slightly so
    // the bezel plate's own rounded corners read clearly against the body,
    // matching the sheet's "separate proud panel" look.
    const outer = roundedRectShape(THREE, bezelW, bezelH, 0.1, 0, bezelH / 2);
    const hole = roundedRectPath(THREE, winW, winH, 0.055, winCenterX, winCenterY);
    outer.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(outer, {
      depth: bezelThickness, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3, curveSegments: 10,
    });
    geo.translate(0, 0, -bezelThickness);
    geo.translate(0, baseH, frontZ);
    geo.computeVertexNormals();
    addFormShadingColors(THREE, geo, { bottomMult: 0.88, topMult: 1.04, jitter: 0.03 });
    // r31: no outline tracked here — flush against bodyShell's own front
    // footprint (bezelW===bodyFrontW), so bodyShell's single outline
    // already wraps this silhouette; giving this its own shell too was
    // exactly the "doubled outline" the brief flagged.
    bezelMesh = addMesh(geo, matFront);
    bezelMesh.name = 'bezelBlock';
  }

  // frontClearance pushes the whole ring/recess/screen/glare stack forward
  // of bodyShell's own (bevel-inflated) front wall so it can never be
  // re-occluded by the body — see the r30-era comment history in the
  // backup file for the measured raycast numbers behind this constant.
  const frontClearance = 0.03;

  // r31: the whole ring/recess/screen/glare stack keeps the SAME
  // slightly-proud-of-frontZ convention the original working design used
  // (bezel 0.46-0.51, ring front ~0.52, recess front ~0.532, screen base
  // ~0.536, glare ~0.564 — all a little forward of the cabinet's own front
  // plane; this is a deliberate layered-decal look, not a true recess, and
  // is what let frontClearance keep bodyShell from re-occluding it). What
  // actually broke in production was NOT that convention — an earlier pass
  // through this fix tried to move the whole stack backward INSIDE the
  // case instead, which put the screen behind bodyShell's own front wall
  // and made it vanish outright (confirmed live: FRONT_SCREEN < bodyFrontZ
  // there). The one real problem was the wafer-thin 0.004-unit gap between
  // the recess's front cap and the screen's own base z: fine at the
  // isolated test.html rig's close camera distance, but too thin at the
  // production scene's camera distance/scale — depth-buffer precision
  // degrades with distance, so that gap z-fought there, frequently
  // resolving in the recess's (dark, lit) favour instead of the screen's.
  // Fixed by keeping the original layering order/spacing but widening ONLY
  // that one gap (0.004 -> 0.025).
  const FRONT_RING = frontZ - bezelThickness * 0.4 + frontClearance; // ~0.52, same as the original working value
  const FRONT_RECESS = FRONT_RING + 0.006; // ~0.526, same small ring->recess step as the original
  const FRONT_SCREEN = FRONT_RECESS + 0.025; // ~0.551 — widened from the original's 0.004 gap
  const FRONT_GLARE = FRONT_SCREEN + 0.032 + 0.006; // just proud of the screen's own bulge apex (r40: bulge raised .028->.032)

  // thin lighter bezel ring, just inside the window opening (proud of the
  // recess, behind the outer bezel face) — "thin lighter bezel" trait.
  // r31: NOT tracked for outline (see the recess note below — this is the
  // exact class of small, screen-adjacent mesh whose own outline shell
  // used to bury the face art).
  const ringMargin = 0.012;
  {
    const ringOuter = roundedRectShape(THREE, winW + ringMargin * 2, winH + ringMargin * 2, 0.05, winCenterX, winCenterY + baseH);
    const ringHole = roundedRectPath(THREE, winW, winH, 0.045, winCenterX, winCenterY + baseH);
    ringOuter.holes.push(ringHole);
    const geo = new THREE.ExtrudeGeometry(ringOuter, { depth: 0.012, bevelEnabled: false, curveSegments: 10 });
    geo.translate(0, 0, -0.012);
    geo.translate(0, 0, FRONT_RING);
    geo.computeVertexNormals();
    addMesh(geo, matBezelLight);
  }

  // dark recess behind the screen window.
  // r31 fix (the actual production "screen renders almost black" cause —
  // see FRONT_SCREEN's comment above for the depth-precision root cause;
  // this file used to also blame — and partly fix — an outline-occlusion
  // bug, which was real but not the whole story). This mesh used to be
  // passed through the same generic outline pass as every other detail
  // mesh too; addMesh's trackOutline defaults to false now, so no change
  // needed here beyond removing the old blanket "for (const mesh of
  // outlineMeshes)" loop over every mesh.
  // r40: deepened from 0.018 to ~0.04 (per the brief's "recess ~.04 behind
  // the bezel plate") so the bezel reads as having real inset depth instead
  // of a near-flush dark rectangle. This only changes how far back the
  // recess's own back wall/side walls sit — it does NOT touch FRONT_RECESS
  // (the recess's own FRONT face, unchanged) or the FRONT_RECESS->
  // FRONT_SCREEN gap above, which stays the z-fighting-safe 0.025 the r31
  // fix widened it to.
  const recessDepth = 0.04;
  const recessFrontZ = FRONT_RECESS;
  {
    const recessShape = roundedRectShape(THREE, winW - 0.014, winH - 0.014, 0.05, winCenterX, winCenterY);
    const geo = new THREE.ExtrudeGeometry(recessShape, { depth: recessDepth, bevelEnabled: false, curveSegments: 8 });
    geo.translate(0, 0, -recessDepth);
    geo.translate(0, baseH, recessFrontZ);
    geo.computeVertexNormals();
    // r40: darker inner wall (was 0x2b2620) for a clearer sense of depth
    // against the lighter bezel rim.
    addMesh(geo, new THREE.MeshStandardMaterial({ color: 0x201b16, roughness: 0.75 }));
  }

  // convex-ish screen plane: a subtly curved (segmented) plane bowed toward
  // +Z at the centre, carrying the face texture — reads as a CRT bulge.
  let screenW = winW - 0.02;
  let screenH = screenW / screenAspect;
  if (screenH > winH - 0.02) { screenH = winH - 0.02; screenW = screenH * screenAspect; }
  // r31: corner radius brought down from 22% of screen width (an almost
  // squircle shape that visibly ate into the rectangular screen area, part
  // of why the screen read as "too small") to ~8%, per the approved brief.
  const screenCornerR = screenW * 0.08;
  const screenShape = roundedRectShape(THREE, screenW, screenH, screenCornerR);
  const screenGeo = new THREE.ShapeGeometry(screenShape, 24);
  {
    const pos = screenGeo.attributes.position;
    const uv = screenGeo.attributes.uv;
    const bulge = 0.032; // r40: slightly more convex dome, per the brief's "~.03"
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / (screenW / 2);
      const y = pos.getY(i) / (screenH / 2);
      const d = Math.max(0, 1 - (x * x + y * y) * 0.55);
      pos.setZ(i, d * bulge);
      uv.setXY(i, x * 0.5 + 0.5, y * 0.5 + 0.5);
    }
    screenGeo.computeVertexNormals();
  }
  // r31 fix (the ACTUAL production "screen renders almost black" cause,
  // found by bisecting which mesh reproduced it — see the dev notes below):
  // this mesh used to sit only 0.004 units in front of the recess mesh's
  // own front cap. Widening that local gap (kept at 0.025 below — harmless,
  // but NOT the actual fix on its own) doesn't reliably solve it: the
  // recess/ring/screen/glare stack is separated along the CHARACTER'S OWN
  // local +Z axis, and this rig rotates continuously during the
  // walk/turn/sit animation. Camera-space depth separation between two
  // points along a fixed local axis is (roughly) that local separation
  // times the cosine of the angle between that axis and the camera's view
  // direction — at some point during the walk the local +Z axis is viewed
  // at enough of a glancing angle that even a generous local gap compresses
  // toward zero in camera space, so it z-fights regardless of how large the
  // local gap is (bisected live: adding the glare mesh below — positioned
  // even FURTHER forward, i.e. an even BIGGER local gap — back into an
  // otherwise-working reduced scene was what actually reproduced the bug,
  // which a "just widen the local gap" theory cannot explain; a follow-up
  // attempt using a small polygonOffset bias also proved unreliable, since
  // the amount of camera-space compression varies with the viewing angle
  // and no fixed offset magnitude covers every angle). The deterministic
  // fix: this mesh ignores the depth test/buffer entirely (depthTest=false,
  // depthWrite=false on matScreenDefault above) and is given a high
  // renderOrder so it always paints last, on top of the rest of the case,
  // regardless of any depth ambiguity. The face screen is a small, purely
  // decorative "display" element — always-on-top is the correct behaviour
  // for it and costs nothing else in this model (nothing is meant to pass
  // in front of it).
  const screen = new THREE.Mesh(screenGeo, matScreenDefault);
  screen.position.set(winCenterX, baseH + winCenterY, recessFrontZ + 0.025);
  screen.receiveShadow = true;
  screen.renderOrder = 10;
  root.add(screen);

  {
    const glareTex = screenGlareTexture(THREE);
    const glareMat = new THREE.MeshBasicMaterial({
      map: glareTex, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
    });
    const glare = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), glareMat);
    glare.position.set(winCenterX, baseH + winCenterY, recessFrontZ + 0.063); // r40: +0.01 to clear the raised .032 bulge apex (was .053 for a .028 bulge)
    glare.renderOrder = 11; // paints after the screen (same always-on-top rationale)
    root.add(glare);
  }

  // =========================================================
  // r55 — THE 3D FACE (see FACE_LAYOUT above for the measured layout)
  // =========================================================
  // MODE DECISION (this is the "(a) faint texture base vs (b) screenFaceMode"
  // call the brief asked for, and the answer is neither of them literally):
  // ending-props-r15.js assigns `screen.material = faceScreenMat` (the flat
  // face crop) UNCONDITIONALLY — it does not check whether the material is
  // still the model's default, so simply handing back a plain sage screenMat
  // would not have stopped it, and leaving the drawn face underneath would
  // have doubled every feature (drawn eyes peeking out around 3D eyes).
  // Instead the 3D face is a self-contained group that OPAQUELY COVERS the
  // textured screen mesh: a sage glass cover, same dome shape, 1.4% larger,
  // 0.0022 proud, painted after it. So `screen` stays exactly what props
  // expects (same mesh, same position, same dims — its texture assignment
  // stays harmless), the glow plane props parents behind it still works, and
  // the visible face is entirely geometry. `screenFaceMode:'3d'` is also
  // returned so a future caller can tell without reading this comment.
  //
  // Depth handling: the whole face stack uses depthTest/depthWrite false with
  // ascending renderOrder, exactly like the screen mesh it replaces. That is
  // deliberate — see the screen mesh's own long comment above: this rig
  // rotates continuously, so local-Z separation between screen-adjacent
  // meshes compresses to nothing in camera space at glancing angles and
  // z-fights no matter how big the local gap is. Painter's order is the only
  // deterministic layering here, and the features are non-overlapping in
  // exactly the order they are added. Every face material is FrontSide, so
  // the whole face self-culls when the cabinet is turned away.
  const face = new THREE.Group();
  face.name = 'mascotFace3D';
  face.position.set(winCenterX, baseH + winCenterY, recessFrontZ + 0.025); // == the screen mesh
  root.add(face);
  {
    const SX = screenW, SY = screenH;
    const BULGE = 0.032; // must match the screen mesh's own bulge above
    const COVER = 0.0022; // how far the sage cover floats over the screen mesh
    // the screen dome's own height at a point, in face-local coords
    const domeZ = (x, y) => {
      const nx = x / (SX / 2), ny = y / (SY / 2);
      return Math.max(0, 1 - (nx * nx + ny * ny) * 0.55) * BULGE;
    };
    const baseZ = (x, y) => domeZ(x, y) + COVER; // the cover's surface
    // sheet fraction -> face-local point, lifted `lift` above the cover
    const P = (u, v, lift = 0) => {
      const x = (u - 0.5) * SX, y = (0.5 - v) * SY;
      return new THREE.Vector3(x, y, baseZ(x, y) + lift);
    };

    // transparent:true (at full opacity) is deliberate and load-bearing:
    // ending-props-r15.js parents an ADDITIVE green glow plane behind the
    // screen mesh (screenGlowPlane, opacity .2). Additive transparents always
    // paint after the whole opaque pass, so as opaque meshes the face features
    // came out washed a flat grey-green — the black pupils read mid-grey
    // (measured in QA_Evidence .../face55-crops/iter1). Joining the transparent
    // list with renderOrder 10.x puts the face AFTER that glow (renderOrder 0)
    // and still before the glass glare (11), which is the layering we want.
    const faceMat = (o) => new THREE.MeshStandardMaterial(Object.assign({
      metalness: 0, depthTest: false, depthWrite: false, side: THREE.FrontSide,
      transparent: true, opacity: 1,
    }, o));
    // sage glass: same family as the sheet's screen (#8BA875) but a touch
    // deeper, because unlike the old unlit crop this one is actually lit by
    // the scene and picks up the warm key on the dome.
    // r55 iter4: colour solved backwards from the render, not picked by eye —
    // at 0x7f9c6a the lit cover measured (152,165,115) against the sheet's own
    // (139,168,117), i.e. too yellow. 0x749e6c lands on the sheet's value.
    const matGlass = faceMat({ color: 0x749e6c, roughness: 0.42, emissive: 0x131c0f, vertexColors: true });
    // r55 iter3: ink darkened (sheet's strokes sample ~(30,26,24)) and made
    // matte — at roughness .5 the tubes picked up a specular sheen along
    // their spine that read as grey-brown piping next to the sheet's flat ink.
    const matInk = faceMat({ color: 0x1b1613, roughness: 0.78 });
    const matSclera = faceMat({ color: 0xeadcc0, roughness: 0.55 });
    const matPupil = faceMat({ color: 0x0e0b09, roughness: 0.92 });
    const matSpark = faceMat({ color: 0xffffff, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.35 });

    // r55 iter6 (found in-scene, not in the rig): because the face ignores the
    // depth buffer, from BEHIND the cabinet the far wall of every tube/cap is
    // front-facing to the camera and bled through the case as ghost eye rings
    // — clearly visible at the typing pose, p078 (see face55-crops/
    // back-zoom-p078-before.png). The old flat face never showed this because
    // it is one FrontSide plane, which self-culls; a tube cannot.
    // Gate: immediately before each face mesh draws, compare the face's own
    // world +Z against the direction to the camera and switch colorWrite off
    // when the face points away. onBeforeRender runs before the renderer
    // applies that draw call's material state, so it takes effect in the same
    // frame — no one-frame visibility lag, which matters for still captures.
    const faceNormal = new THREE.Vector3();
    const faceWorldPos = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    const faceGate = (renderer, scene, camera, geometry, material) => {
      face.getWorldPosition(faceWorldPos);
      faceNormal.set(0, 0, 1).transformDirection(face.matrixWorld);
      toCam.copy(camera.position).sub(faceWorldPos);
      material.colorWrite = faceNormal.dot(toCam) > 0;
    };
    const add = (mesh, order) => {
      mesh.renderOrder = order;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.onBeforeRender = faceGate;
      face.add(mesh);
      return mesh;
    };

    // ---- sage glass cover (hides props' flat face crop underneath) ----
    {
      const geo = screenGeo.clone();
      geo.scale(1.014, 1.014, 1.0);
      geo.translate(0, 0, COVER);
      geo.computeVertexNormals();
      // CRT vignette: the sheet's screen is clearly darker toward its rim and
      // brightest just off-centre. Baked per-vertex so it costs no texture.
      const p = geo.attributes.position;
      const cols = [];
      for (let i = 0; i < p.count; i++) {
        const nx = p.getX(i) / (SX / 2), ny = p.getY(i) / (SY / 2);
        const k = 1 - 0.26 * Math.min(1, (nx * nx + ny * ny) * 0.8);
        cols.push(k, k, k);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      add(new THREE.Mesh(geo, matGlass), 10.05);
    }

    // ---- ink stroke helper: a thin tube along a CatmullRom curve, hugging
    // the dome, with little round caps so the stroke ends read as brush ends
    // instead of open pipes ----
    // r55 iter4: the sheet's strokes are brush-like — thick through the middle,
    // tapering to a point at both ends. TubeGeometry has one radius, so each
    // stroke is drawn twice: a thin spine over the whole curve plus a full-
    // weight "belly" over the middle ~72%, with round caps. Same ink, same
    // renderOrder, no depth test, so the two passes merge into one stroke.
    const strokeFromFractions = (fracs, radius, order, lift = radius + 0.002) => {
      const pts = fracs.map(([u, v]) => P(u, v, lift));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
      const seg = Math.max(16, fracs.length * 6);
      const drawTube = (c, rad, segs) => {
        add(new THREE.Mesh(new THREE.TubeGeometry(c, segs, rad, 7, false), matInk), order);
        for (const t of [0, 1]) {
          const cap = new THREE.Mesh(new THREE.SphereGeometry(rad, 8, 6), matInk);
          cap.position.copy(c.getPoint(t));
          add(cap, order);
        }
      };
      drawTube(curve, radius * 0.5, seg);
      const belly = [];
      for (let i = 0; i <= 12; i++) belly.push(curve.getPoint(0.14 + (0.72 * i) / 12));
      drawTube(new THREE.CatmullRomCurve3(belly, false, 'catmullrom', 0.5), radius, seg);
    };

    // ---- eyes ----
    const E = FACE_LAYOUT.eye, PU = FACE_LAYOUT.pupil;
    const rx = E.rxU * SX, ry = E.ryV * SY;
    for (const cu of [E.cuL, E.cuR]) {
      const ecx = (cu - 0.5) * SX;
      const ecy = (0.5 - E.cvV) * SY;

      // oval outline stroke (a closed tube ring around the whole eye)
      {
        const pts = [];
        for (let i = 0; i < 40; i++) {
          const t = (i / 40) * Math.PI * 2;
          const x = ecx + Math.cos(t) * rx, y = ecy + Math.sin(t) * ry;
          pts.push(new THREE.Vector3(x, y, baseZ(x, y) + 0.006));
        }
        const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
        add(new THREE.Mesh(new THREE.TubeGeometry(curve, 56, 0.0068, 7, true), matInk), 10.1);
      }

      // sclera: the oval clipped by the half-lid line (v = E.lidV). Above that
      // line the screen's own sage shows through, which is what makes the eyes
      // read half-lidded on the sheet.
      {
        const lidY = (0.5 - E.lidV) * SY;
        const sinT = Math.min(0.95, (lidY - ecy) / ry);
        const t0 = Math.PI - Math.asin(sinT); // left end of the lid chord
        const t1 = Math.PI * 2 + Math.asin(sinT); // right end, one turn later
        const boundary = [];
        const N = 34;
        for (let i = 0; i <= N; i++) {
          const t = t0 + (t1 - t0) * (i / N);
          boundary.push([ecx + Math.cos(t) * rx * 0.985, ecy + Math.sin(t) * ry * 0.985]);
        }
        // close the loop back along the lid chord (right -> left)
        const a = boundary[boundary.length - 1], b = boundary[0];
        for (let i = 1; i < 4; i++) boundary.push([a[0] + (b[0] - a[0]) * (i / 4), a[1] + (b[1] - a[1]) * (i / 4)]);
        const geo = faceCapGeometry(THREE, boundary, [ecx, ecy - ry * 0.18], 4, 0.005, 0.012, baseZ);
        add(new THREE.Mesh(geo, matSclera), 10.15);
      }

      // pupil: a pie-cut cap — an ellipse with a wedge notch bitten out of its
      // outer side, the sheet's own pupil shape.
      {
        const pcx = ((cu + PU.du) - 0.5) * SX;
        const pcy = (0.5 - PU.cvV) * SY;
        const prx = PU.rxU * SX, pry = PU.ryV * SY;
        const notch = Math.PI, half = 0.24; // narrow slit centred on -X, like the sheet's
        const boundary = [];
        const N = 30;
        // ... and, like the sheet's, cut flat along the lid line at the top:
        // on the sheet the pupil runs right up under the half-lid, so its top
        // edge is a straight chord, not a dome. Without this clamp a band of
        // cream sits above the pupil and the eye reads wide-open instead of
        // half-lidded (QA_Evidence .../face55-crops/side-by-side-iter4).
        const lidYp = (0.5 - E.lidV) * SY - 0.001;
        for (let i = 0; i <= N; i++) {
          const t = notch + half + (Math.PI * 2 - half * 2) * (i / N);
          boundary.push([pcx + Math.cos(t) * prx, Math.min(lidYp, pcy + Math.sin(t) * pry)]);
        }
        boundary.push([pcx + Math.cos(notch) * prx * 0.14, pcy + Math.sin(notch) * pry * 0.14]);
        const geo = faceCapGeometry(THREE, boundary, [pcx, pcy], 3, 0.016, 0.005, baseZ);
        add(new THREE.Mesh(geo, matPupil), 10.2);

        // tiny white highlight, sitting in the mouth of the pie cut
        const spark = new THREE.Mesh(new THREE.SphereGeometry(PU.rxU * SX * 0.30, 10, 8), matSpark);
        spark.scale.set(0.85, 1.05, 0.45);
        spark.position.set(pcx - prx * 0.34, pcy + pry * 0.04, baseZ(pcx - prx * 0.34, pcy) + 0.026);
        add(spark, 10.25);
      }
    }

    // ---- brows, nose, mouth, lower lip ----
    // r55 iter3: stroke weights re-derived from the sheet's own ink widths
    // (eye oval ~8px, brow ~14px, mouth ~7px, nose ~5px, lip ~4px of the
    // 376px-wide crop) instead of the thinner first pass.
    for (const brow of FACE_LAYOUT.brows) strokeFromFractions(brow, 0.0125, 10.3);
    strokeFromFractions(FACE_LAYOUT.nose, 0.0045, 10.3);
    strokeFromFractions(FACE_LAYOUT.mouth, 0.0072, 10.3);
    strokeFromFractions(FACE_LAYOUT.lip, 0.0036, 10.3);
  }

  // =========================================================
  // CHIN — badge (lower-left, horizontal), slot (lower-right, horizontal),
  // 3 vent slits (bottom-right of front)
  // =========================================================
  // r33b regression fix: these chin details used to sit safely proud of
  // frontZ (frontZ + 0.004~0.009). r33 doubled bodyShellMesh's top/bottom
  // cap bevel (bevelThickness/bevelSize W*0.02 -> W*0.04, see the footprint
  // extrude above), which bulges the body's own front surface forward past
  // frontZ near the BOTTOM cap (exactly where this chin sits, right above
  // baseH) — the bulge now reaches past the badge/slot/vent's shallow
  // z-offset and buries them under the body. Fix: raycast the real built
  // surfaces (bodyShellMesh, whose bulge varies with x/y, and bezelMesh)
  // at each detail's own x/y to find whichever panel is actually frontmost
  // there, then sit ~0.004 in front of THAT — the same "raycast the real
  // mesh, don't trust the nominal footprint" fix already used for the side
  // vents above (bodyOuterXAt).
  const chinRaycaster = new THREE.Raycaster();
  function frontmostZAt(x, y) {
    chinRaycaster.set(new THREE.Vector3(x, y, frontZ + D), new THREE.Vector3(0, 0, -1));
    const hits = chinRaycaster.intersectObjects([bodyShellMesh, bezelMesh], false);
    return hits.length ? hits[0].point.z : frontZ;
  }
  {
    // badge: horizontal orange rectangle, lower-left
    const badgeW = bezelW * (0.245 - 0.104);
    const badgeHgt = bezelH * (0.843 - 0.787);
    const badgeX = bezelW * ((0.104 + 0.245) / 2 - 0.5);
    const badgeY = bezelH * (1 - (0.787 + 0.843) / 2);
    const badgeShape = roundedRectShape(THREE, badgeW, badgeHgt, 0.006);
    const badgeGeo = new THREE.ExtrudeGeometry(badgeShape, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 });
    const badge = addMesh(badgeGeo, matBadge);
    badge.position.set(badgeX, baseH + badgeY, frontmostZAt(badgeX, baseH + badgeY) + 0.004);

    // slot: horizontal black groove, lower-right
    const slotW = bezelW * (0.845 - 0.506);
    const slotHgt = bezelH * (0.748 - 0.72);
    const slotX = bezelW * ((0.506 + 0.845) / 2 - 0.5);
    const slotY = bezelH * (1 - (0.72 + 0.748) / 2);
    const slotFrontZ = frontmostZAt(slotX, baseH + slotY);
    const slotOuterGeo = new THREE.BoxGeometry(slotW + 0.02, slotHgt + 0.014, 0.02);
    const slotOuter = addMesh(slotOuterGeo, matBezelLight);
    slotOuter.position.set(slotX, baseH + slotY, slotFrontZ + 0.004);
    const slotInnerGeo = new THREE.BoxGeometry(slotW, slotHgt, 0.018);
    const slotInner = addMesh(slotInnerGeo, matSlot);
    slotInner.position.set(slotX, baseH + slotY, slotFrontZ + 0.007);

    // 3 short horizontal vent slits, bottom-right of the front face
    const ventX0 = bezelW * (0.731 - 0.5);
    const ventX1 = bezelW * (0.914 - 0.5);
    const ventY0 = bezelH * (1 - 0.986);
    const ventY1 = bezelH * (1 - 0.908);
    const ventCenterX = (ventX0 + ventX1) / 2;
    const ventW = ventX1 - ventX0;
    const ventRowH = (ventY1 - ventY0) / 3 * 0.55;
    for (let i = 0; i < 3; i++) {
      const y = ventY0 + (ventY1 - ventY0) * (i + 0.5) / 3;
      const geo = new THREE.BoxGeometry(ventW, ventRowH, 0.014);
      const m = addMesh(geo, matVent);
      m.position.set(ventCenterX, baseH + y, frontmostZAt(ventCenterX, baseH + y) + 0.004);
    }

    // thin seam line between bezel and body
    const seamGeo = new THREE.BoxGeometry(bezelW * 0.99, 0.005, 0.01);
    const seam = addMesh(seamGeo, new THREE.MeshStandardMaterial({ color: 0x6b5f45, roughness: 0.9 }));
    seam.position.set(0, baseH + 0.003, bodyFrontZ + 0.004);
  }

  // r31: only bodyShell is wrapped in an outline shell now (see the
  // per-mesh comments above for why every other mesh dropped out) — a
  // single clean silhouette line instead of the old doubled/occluding mess.
  if (outline) {
    for (const mesh of outlineMeshes) {
      const sh = makeOutline(THREE, mesh, 1.008);
      mesh.add(sh);
    }
  }

  root.updateMatrixWorld(true);

  const dims = {
    width: W,
    height: bodyTop,
    depth: D,
    screenWidth: screenW,
    screenHeight: screenH,
    frontZ,
  };

  // r55: `screen`/`screenMat`/`dims` are unchanged (props still textures the
  // screen mesh; that texture now simply sits behind the 3D face cover).
  // `face`/`screenFaceMode` are additive extras, not part of the contract.
  return { root, screen, screenMat: screen.material, dims, face, screenFaceMode: '3d' };
}

export default createMascotBody;
