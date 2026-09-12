// ending-desk-computer-r35.js
// Procedural, reusable Three.js model of the DESK computer prop for the TVA
// ending scene: a warm beige/tan all-in-one CRT with an INTEGRATED KEYBOARD
// DECK sloping forward from the base as one body (matching
// assets/hero/tva-hero-keyvisual-1920x1080-v1.webp — "our computer"), instead
// of the generic 1984-Macintosh-128K reference model previously reused for
// this prop (createMacintosh, ending-mac-model-r26.js).
//
// ES module. THREE is passed in by the caller (no import of three itself).
// No dependency on ending-props-r15.js or ending-mac-model-r26.js — all
// shape helpers are self-contained here so ending-props-r15.js can import
// this module without a cycle.
//
// export function createDeskComputer(THREE, opts = {})
//   -> { root, screen, screenMat, dims }
//
// Local-space convention (kept identical to createMacintosh's, so the
// caller's envelope-fit scale/position math is unchanged): width = 1 local
// unit (the widest cross-section — the keyboard deck's front edge), bottom
// at local y=0 (the keyboard deck's underside, resting on the desk), front
// face is +Z. dims.frontZ is the CHIN/BEZEL's own front face (not the
// keyboard's, which extends further forward) so callers that align "the
// case's front" against a fixed desk-local z keep the same visual gap to
// whatever sits in front of the case that they had with the old model.
//
// Measured off the truth reference (assets/hero/tva-hero-keyvisual-...png,
// see QA_Evidence/tva-claude-20260909/desk35-crops/ for the crops used):
// rounded-corner CRT head roughly as wide as tall (measured tan-body bbox
// ratio ~1.07 w/h, screen occupying ~0.79 of the head's own width), a chin
// below the screen with a small grey badge lower-left and a horizontal
// floppy slot lower-right, vertical side vents, and a keyboard deck flowing
// forward from the same body with low dark keycaps and one red/orange key
// at the keyboard's own upper-left.

// ---------------- shape / geometry helpers (self-contained) ----------------

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

// r54: flat, UV-mapped rounded-rect quad — the geometry the SCREEN uses so the
// picture has EXACTLY the bezel window's own outline (same width/height/corner
// radius as the hole cut in the bezel), instead of a smaller rectangular
// PlaneGeometry floating inside it.
//
// THREE.ShapeGeometry's own generated UVs are the raw shape-space x/y (so here
// roughly -w/2..w/2), which would sample far outside the 0..1 texture range —
// they are rewritten below to map the shape's bounding box onto 0..1 exactly
// like PlaneGeometry does, so any texture (the HOME crop, the typed-text
// canvas) fills the quad edge to edge with no offset.
//
// `parameters` is attached deliberately: ending-scene-r15.js's dive math reads
// screen.geometry.parameters.width/height live off whatever geometry the screen
// happens to carry (it was written against PlaneGeometry), and that contract is
// kept here rather than editing every reader.
export function roundedQuadGeometry(THREE, w, h, r) {
  const geo = new THREE.ShapeGeometry(roundedRectShape(THREE, w, h, Math.max(0, r)), 16);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  geo.parameters = { width: w, height: h, radius: Math.max(0, r) };
  return geo;
}

function roundedRectPath(THREE, w, h, r, ox = 0, oy = 0) {
  // Wound opposite to roundedRectShape's outer contour so ExtrudeGeometry
  // reliably treats it as a hole (same trick as ending-mac-model-r26.js).
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

// A slightly-tapered box for the CRT head: rounded rect footprint at the
// front (+z), narrowing a touch toward the back (-z) — the classic
// slope-backed all-in-one silhouette — built as a loft between a front and
// back rounded-rect footprint instead of a plain box.
function headShellGeometry(THREE, frontW, backW, depth, h, r) {
  const footprint = new THREE.Shape();
  const hf = frontW / 2, hb = backW / 2, zf = depth / 2, zb = -depth / 2;
  const rb = Math.min(r, hb * 0.9, depth * 0.4);
  // Front corners get their own rounding too (r35 only rounded the back
  // corners, leaving the front-facing vertical edges — the ones most visible
  // to camera — hard/boxy; r37 fix). rf is capped a touch tighter than rb so
  // it never overruns the short front edge on a narrow head.
  const rf = Math.min(r, hf * 0.9, depth * 0.35);
  // Taper-side edge directions (front-right->back-right, front-left->back-left)
  // so the front-corner curve's end point lands ON that sloped edge instead
  // of assuming it is axis-aligned.
  const dxR = hb - hf, dyR = (zb + rb) - zf;
  const lenR = Math.hypot(dxR, dyR) || 1;
  const uRx = dxR / lenR, uRy = dyR / lenR;
  const dxL = -hb - -hf, dyL = (zb + rb) - zf;
  const lenL = Math.hypot(dxL, dyL) || 1;
  const uLx = dxL / lenL, uLy = dyL / lenL;

  footprint.moveTo(-hf + rf, zf);
  footprint.lineTo(hf - rf, zf);
  footprint.quadraticCurveTo(hf, zf, hf + uRx * rf, zf + uRy * rf);
  footprint.lineTo(hb, zb + rb);
  footprint.quadraticCurveTo(hb, zb, hb - rb, zb);
  footprint.lineTo(-hb + rb, zb);
  footprint.quadraticCurveTo(-hb, zb, -hb, zb + rb);
  footprint.lineTo(-hf + uLx * rf, zf + uLy * rf);
  footprint.quadraticCurveTo(-hf, zf, -hf + rf, zf);
  // No bevel: ExtrudeGeometry's bevel can expand a cap noticeably beyond its
  // nominal footprint (bitten us on ending-mac-model-r26.js's body shell
  // before, and again here in r35's own first render — the bevelled front
  // cap bulged forward PAST the bezel's screen recess/screen plane sitting
  // just .003-.006 ahead of it, hiding the screen behind the head's own lit
  // material). The head's edges still read as soft/rounded from the single
  // thin outline shell added in createDeskComputer() below, so a hard-edge
  // cap here costs nothing visually.
  const geo = new THREE.ExtrudeGeometry(footprint, {
    depth: h, bevelEnabled: false, curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

// Keyboard deck wedge: a tapered-width, sloped-top wedge extruded along Z
// (back -> front), narrower/taller at the back (where it tucks under the
// head's chin) and wider/lower at the front (nearest the seated mascot).
// Built as a small hand-rolled BufferGeometry (8 verts, 2 side quads + top +
// front + bottom + 2 ends) since it is a simple sloped box rather than a
// rounded-rect extrusion.
// r38 QA fix: bottomY now also accepts {back, front} so a caller can build a
// slab whose BOTTOM face is itself sloped (needed for the single inset
// keycap panel below, which has to sit flush on the keyboard deck's own
// sloped top surface rather than on a flat bottomY=0 desk plane). A plain
// number keeps the old flat-bottom behaviour (all existing deck-wedge
// callers pass bottomY=0, unchanged). Always emits uv + per-face groups
// (harmless for single-material meshes, and lets the panel mesh below use a
// per-face material array — same trick as addKeycap's BoxGeometry groups —
// to put a canvas texture on just the top face).
function keyboardWedgeGeometry(THREE, backW, frontW, backZ, frontZ, backTop, frontTop, bottomY) {
  const hb = backW / 2, hf = frontW / 2;
  const backBottom = (typeof bottomY === 'object' && bottomY !== null) ? bottomY.back : bottomY;
  const frontBottom = (typeof bottomY === 'object' && bottomY !== null) ? bottomY.front : bottomY;
  // 8 corners: back-bottom-L/R, back-top-L/R, front-bottom-L/R, front-top-L/R
  const p = [
    [-hb, backBottom, backZ], [hb, backBottom, backZ], [-hb, backTop, backZ], [hb, backTop, backZ],
    [-hf, frontBottom, frontZ], [hf, frontBottom, frontZ], [-hf, frontTop, frontZ], [hf, frontTop, frontZ],
  ];
  // quads (as two triangles each), wound so normals point outward (verified
  // by cross-product per face — an earlier winding here was backwards on
  // every face, which back-face-culled the whole deck invisible in the r35
  // first standalone render).
  const quads = [
    [3, 2, 6, 7], // top
    [0, 1, 5, 4], // bottom
    [0, 4, 6, 2], // left side
    [1, 3, 7, 5], // right side
    [4, 5, 7, 6], // front
    [0, 2, 3, 1], // back
  ];
  const uvQuad = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const positions = [];
  const uvs = [];
  const geo = new THREE.BufferGeometry();
  quads.forEach(([a, b, c, d], qi) => {
    positions.push(...p[a], ...p[b], ...p[c]);
    positions.push(...p[a], ...p[c], ...p[d]);
    const [ua, ub, uc, ud] = uvQuad;
    uvs.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud);
    geo.addGroup(qi * 6, 6, qi);
  });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function speckleTexture(THREE, baseColor, speckColor, size = 128, density = 1200) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < density; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = speckColor;
    ctx.globalAlpha = 0.02 + Math.random() * 0.05;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

// r38 QA fix: the keyboard used to be 48 individual keycap boxes (4 staggered
// rows + a space-bar row + a right-hand cluster, see the removed addKeycap
// loop below createDeskComputer). At scene scale (viewed from the ending
// camera, p~.78) those tiny boxes merged into a visually confusing stack of
// grey stripes — read as floating bars stairstepping up toward the CRT head
// rather than as a keyboard (see owner screenshot / QA_Evidence/
// tva-claude-20260909/kbdbase-crop-078.png captured before this fix). One
// inset dark panel with a texture-drawn key grid reads correctly at that
// scale instead: a single recessed slab, a faint 4-row grid, one red key
// top-left, one long space-bar bar — "a computer with a keyboard", not a
// staircase.
function keyPanelTexture(THREE) {
  const w = 512, h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#333333';
  ctx.fillRect(0, 0, w, h);
  // faint 4-row grid: thin lighter horizontal grooves dividing the panel,
  // plus a few faint vertical ticks per row (just enough to read as "keys"
  // without drawing 40+ individual boxes again).
  const rows = 4;
  const rowH = h / rows;
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 3;
  for (let r = 1; r < rows; r++) {
    const y = r * rowH;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let r = 0; r < rows; r++) {
    const yTop = r * rowH, yBot = yTop + rowH;
    const cols = 11;
    for (let c = 1; c < cols; c++) {
      const x = (c / cols) * w;
      ctx.beginPath(); ctx.moveTo(x, yTop + rowH * 0.15); ctx.lineTo(x, yBot - rowH * 0.15); ctx.stroke();
    }
  }
  // one red key, top-left of the panel (matches the truth photo's single
  // red/orange accent key at the keyboard's own upper-left).
  const redW = w * 0.075, redH = rowH * 0.62;
  ctx.fillStyle = '#c73f19';
  ctx.fillRect(w * 0.02, rowH * 0.19, redW, redH);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(w * 0.02, rowH * 0.19, redW, redH * 0.28);
  // long space-bar bar along the panel's frontmost row.
  const barY = h - rowH * 0.62, barH = rowH * 0.42;
  ctx.fillStyle = '#464646';
  ctx.fillRect(w * 0.24, barY, w * 0.52, barH);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(w * 0.24, barY, w * 0.52, barH * 0.3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeOutline(THREE, mesh, thickness = 0.008, color = 0x1a1610) {
  const outlineMat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  outline.scale.setScalar(1 + thickness);
  outline.renderOrder = -1;
  return outline;
}

// =============================================================================

export function createDeskComputer(THREE, opts = {}) {
  const screenAspect = opts.screenAspect || 4 / 3;
  const outline = opts.outline !== false;

  // ---- Overall proportions (local units, overall width = 1) ----
  // Head (CRT box): near-square front face (measured tan-body bbox ratio
  // ~1.07 w/h off the truth photo).
  const HEAD_W = 0.80;
  const HEAD_D = 0.56;
  const HEAD_H = 0.80;
  const FRONT_Z = 0.40;               // chin/bezel OUTER front face
  const HEAD_BACK_W = HEAD_W * 0.90;  // slight taper toward the back
  // bezelProud: the head shell's own front cap sits a hair BEHIND the
  // bezel's outer face (same trick as ending-mac-model-r26.js's own
  // bezelProud) so the screen recess/screen plane — placed between the
  // head's front cap and the bezel's outer face, see BEZEL section below —
  // physically occludes the head shell within the window's footprint
  // instead of the head's own solid front cap filling the "hole" the bezel
  // cuts for the screen (that was the r35 first-render bug: the screen
  // never showed because the head shell's front cap sat flush with the
  // bezel's outer face, i.e. exactly where the recess/screen were supposed
  // to read as recessed INTO).
  const BEZEL_PROUD = 0.006;
  const HEAD_FRONT_Z = FRONT_Z - BEZEL_PROUD;
  const HEAD_BACK_Z = HEAD_FRONT_Z - HEAD_D;

  // Keyboard deck: tucks slightly under the chin (KBD_BACK_Z a touch behind
  // FRONT_Z) and flares out to the model's own full width at the front lip.
  //
  // r35 QA fix: KBD_FRONT_Z was originally 1.30 (deep enough to pass directly
  // under deskHandTargets[0], ending-scene-r15.js) but that made the desk
  // computer's own bounding box (workDesk.macCaseMesh) overlap the seated
  // hero's own case box (hero.rig.children[0]) — measured with
  // measure-desk-boxes-r27.mjs desk35: overlapCaseMac ~.23 at p=.74/.78/.82.
  // Root cause, not fixable by resizing/repositioning alone: deskHandTargets[0]
  // itself (root-local ~(.55,1.44,1.0)) sits INSIDE the hero case box's own
  // measured AABB (root-local z=[.99,1.83] at these p's) — any solid geometry
  // reaching that exact point necessarily overlaps that box. Pulled the
  // deck's own front edge back to KBD_FRONT_Z=.86 instead (desk-local front
  // stays ~.80, comfortably under the .99 boundary with margin for the
  // case's own idle "breathing" scale animation) — the deck's top surface
  // still passes under the hand's height at the hand's own x, it just no
  // longer reaches all the way to the hand's z, so the glove reads as
  // resting just past the deck's own front edge rather than dead-center on
  // it. Verified overlapCaseMac=0 (still overlapCaseDesk=0, handErrors
  // unchanged ~.013) at p=.74/.78/.82 after this change.
  // r38 QA fix (v2): a first attempt made the deck's own thickness follow
  // the owner's raw fractions of HEAD_W (front .10, back .16) as a THIN slab
  // added below the case's UNCHANGED bottom (HEAD_BOTTOM_Y=.42) — verified
  // with debug-deck2.mjs that the geometry built correctly, but the actual
  // render (kbd38v1 crops) came back with NO visible deck at all: at this
  // scene's specific camera angle the mascot's own (much taller) seated case
  // sits closer to camera and fully occludes anything that short/low in
  // front of the desk case. Reverted the deck's own vertical proportions to
  // r35's proven-visible values (KBD_BACK_TOP flush with HEAD_BOTTOM_Y,
  // still a single wedge) — the actual defect (see keyPanelTexture's comment
  // for the owner screenshot) was never the deck's height, it was (a) the
  // front edge pulled back to .86, barely extending past the chin, and (b)
  // 48 tiny keycaps merging into a "staircase" of grey bars. Both are fixed
  // below (KBD_FRONT_Z pushed out, single inset key panel) without touching
  // the deck's vertical profile.
  const KBD_BACK_Z = FRONT_Z - 0.08;
  const KBD_FRONT_Z = 1.05;
  const KBD_BACK_W = 0.86;
  const KBD_FRONT_W = 1.0;    // == overall model width
  const KBD_BACK_TOP = 0.42;  // == head bottom (unchanged from r35/r37)
  const KBD_FRONT_TOP = 0.20; // unchanged from r35/r37 — proven visible at this camera angle
  const HEAD_BOTTOM_Y = KBD_BACK_TOP;
  const HEAD_TOP_Y = HEAD_BOTTOM_Y + HEAD_H;
  // width/top-height at any Z within the deck's own z-range
  // (KBD_BACK_Z..KBD_FRONT_Z), used to place the single inset keycap panel
  // flush on the deck's own sloped top surface.
  const kbdWidthAt = (z) => {
    const t = THREE.MathUtils.clamp((z - KBD_BACK_Z) / (KBD_FRONT_Z - KBD_BACK_Z), 0, 1);
    return THREE.MathUtils.lerp(KBD_BACK_W, KBD_FRONT_W, t);
  };
  const kbdTopAt = (z) => {
    const t = THREE.MathUtils.clamp((z - KBD_BACK_Z) / (KBD_FRONT_Z - KBD_BACK_Z), 0, 1);
    return THREE.MathUtils.lerp(KBD_BACK_TOP, KBD_FRONT_TOP, t);
  };

  const root = new THREE.Group();
  root.name = 'deskComputer';

  // ---- Materials: photo-matched warm greige case (#C9B99A-#CEB781), r.85 ----
  // r35's own map colors ('#d6c592' etc.) plus a near-white multiplier
  // (0xf1e8cf/0xefe4c6) compounded into a too-pale, yellow-leaning case —
  // r37 fix: keep the multiplier neutral (0xffffff) and put the actual
  // warm-greige mid-tone straight into the texture base so the lit result
  // lands in the truth photo's own #C9B99A-#CEB781 range instead of past it.
  // Base tones sit ~25% below the raw #C9B99A-#CEB781 target because this
  // harness's own lighting rig (ambient .55 + key 1.1 + fill .35, no tone
  // mapping) brightens a directly-facing warm-tan albedo by roughly that
  // much before it reaches the pixel — confirmed by sampling the r37 first
  // pass (side face read (239,230,213) against a (201,185,154) base, ~1.27x)
  // — so the pre-light albedo is pulled down to land the LIT result in the
  // photo's own mid-tone range instead of the raw hex clipping toward white.
  const bezelTex = speckleTexture(THREE, '#9a8c69', '#6b5b3b');
  const bodyTex = speckleTexture(THREE, '#968b73', '#67583c');
  const kbdTex = speckleTexture(THREE, '#92815d', '#5d5033');

  const matBezel = new THREE.MeshStandardMaterial({ map: bezelTex, color: 0xffffff, roughness: 0.85, metalness: 0.02 });
  const matBody = new THREE.MeshStandardMaterial({ map: bodyTex, color: 0xffffff, roughness: 0.85, metalness: 0.02 });
  const matKbdDeck = new THREE.MeshStandardMaterial({ map: kbdTex, color: 0xffffff, roughness: 0.85, metalness: 0.02 });
  const matUnderside = new THREE.MeshStandardMaterial({ color: 0x75674a, roughness: 0.88, metalness: 0.02 });
  const matBezelDark = new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 0.6, metalness: 0.05 });
  const matSlot = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.7 });
  const matBadge = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 0.5, metalness: 0.1 });
  const matVent = new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.8 });
  const matScreenDefault = new THREE.MeshStandardMaterial({ color: 0x08110d, roughness: 0.4, metalness: 0.1 });

  const outlineMeshes = [];
  function addMesh(geo, mat, group = root, track = true) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (track) outlineMeshes.push(mesh);
    return mesh;
  }

  // =========================================================
  // r46 owner decision: REMOVE the keyboard entirely — CRT head + chin only
  // (badge, floppy slot, vents), no keyboard deck, no key panel. The two mesh
  // blocks that used to build the integrated keyboard deck wedge and its
  // inset keycap panel (r35/r38) are deleted below; the KBD_* constants and
  // kbdWidthAt/kbdTopAt helpers above are DELIBERATELY left untouched (still
  // computed, just no longer consumed by any mesh) because `dims` at the
  // bottom of this function is derived from them (width=KBD_FRONT_W,
  // height=HEAD_TOP_Y which reads HEAD_BOTTOM_Y=KBD_BACK_TOP,
  // depth=KBD_FRONT_Z-HEAD_BACK_Z) and the task requires dims.width/height/
  // depth/frontZ/screen* to stay numerically IDENTICAL to before this change
  // (nothing downstream re-fits the envelope) — the head shell, bezel and
  // screen placement below are completely unmodified from r35/r38, so the
  // CRT head's own size/position does not move at all.
  // =========================================================

  // =========================================================
  // 2) HEAD — rounded, slightly back-tapered CRT box
  // =========================================================
  {
    const geo = headShellGeometry(THREE, HEAD_W, HEAD_BACK_W, HEAD_D, HEAD_H, HEAD_W * 0.07);
    geo.translate(0, HEAD_BOTTOM_Y, HEAD_BACK_Z + HEAD_D / 2);
    addMesh(geo, matBody).name = 'headShell';
  }

  // underside sliver (keeps the join between deck and head from ever
  // showing a gap when viewed from slightly below)
  {
    const geo = new THREE.BoxGeometry(HEAD_BACK_W * 0.98, 0.02, HEAD_D * 0.98);
    const m = addMesh(geo, matUnderside, root, false);
    m.position.set(0, HEAD_BOTTOM_Y + 0.01, HEAD_BACK_Z + HEAD_D / 2);
  }

  // side vents: vertical slits on the head's side, near the back
  {
    const slitW = 0.012, slitH = 0.20, slitD = 0.01, count = 5;
    const startY = HEAD_BOTTOM_Y + HEAD_H * 0.42;
    const zCenter = HEAD_BACK_Z + HEAD_D * 0.24;
    for (let i = 0; i < count; i++) {
      const z = zCenter - i * (slitW * 2.4);
      const t = THREE.MathUtils.clamp((z - HEAD_BACK_Z) / HEAD_D, 0, 1);
      const hw = THREE.MathUtils.lerp(HEAD_BACK_W / 2, HEAD_W / 2, t);
      for (const side of [-1, 1]) {
        const m = addMesh(new THREE.BoxGeometry(slitD, slitH, slitW), matVent, root, false);
        m.position.set(side * (hw + slitD * 0.5 - 0.002), startY, z);
      }
    }
  }

  // =========================================================
  // 3) BEZEL — front slab with rounded screen window + chin details
  // =========================================================
  const bezelThickness = 0.045;
  // r54: hoisted out of the ExtrudeGeometry options below (values unchanged)
  // so the SCREEN can be sized/placed against the bezel's ACTUAL front-most
  // plane and its actual flared opening rather than against the nominal shape.
  const bezelBevelT = 0.007;   // ExtrudeGeometry bevelThickness
  const bezelBevelS = 0.006;   // ExtrudeGeometry bevelSize
  const chinFrac = 0.34;
  const chinH = HEAD_H * chinFrac;
  const winH = HEAD_H * (1 - chinFrac);
  const winMarginX = 0.06;
  const winMarginTop = 0.05;
  const winW = HEAD_W - winMarginX * 2;
  const winCenterY = chinH + winH / 2 - 0.01;
  // the window opening's own nominal size/corner radius (the hole cut below)
  const WIN_W = winW;
  const WIN_H = winH - winMarginTop;
  const WIN_R = 0.055;

  let bezelMesh;
  {
    const outer = roundedRectShape(THREE, HEAD_W, HEAD_H, 0.08, 0, HEAD_H / 2);
    const hole = roundedRectPath(THREE, WIN_W, WIN_H, WIN_R, 0, winCenterY);
    outer.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(outer, {
      depth: bezelThickness, bevelEnabled: true, bevelThickness: bezelBevelT, bevelSize: bezelBevelS, bevelSegments: 3, curveSegments: 10,
    });
    geo.translate(0, 0, -bezelThickness);
    geo.translate(0, HEAD_BOTTOM_Y, FRONT_Z);
    geo.computeVertexNormals();
    bezelMesh = addMesh(geo, matBezel);
    bezelMesh.name = 'bezelBlock';
  }

  // dark recess plate behind the window — its own front cap MUST sit ahead
  // of the head shell's own front cap (HEAD_FRONT_Z) so it occludes the head
  // within the window's footprint instead of the head's solid front cap
  // filling the "hole" the bezel cuts for the screen — see the BEZEL_PROUD
  // comment above dims for the full writeup of that bug.
  const recessDepth = 0.018;
  const recessFrontZ = HEAD_FRONT_Z + 0.003;
  {
    const recessW = WIN_W - 0.018, recessH = WIN_H - 0.018;
    const geo = new THREE.ExtrudeGeometry(roundedRectShape(THREE, recessW, recessH, 0.045), {
      depth: recessDepth, bevelEnabled: false, curveSegments: 8,
    });
    geo.translate(0, 0, -recessDepth);
    geo.translate(0, HEAD_BOTTOM_Y + winCenterY, recessFrontZ);
    geo.computeVertexNormals();
    addMesh(geo, matBezelDark, root, false);
  }

  // =========================================================
  // SCREEN — r54 owner fix: "화면 엉망이다, 딱 모니터에 맞춰"
  // =========================================================
  // ROOT CAUSE of the defect this replaces: the screen was a RECTANGULAR
  // PlaneGeometry sized to a 4:3 box hard-inset inside the window by a fixed
  // .05 margin —
  //     screenW = min(WIN_W - .05, (WIN_H - .05) * 4/3) = .5707
  //     screenH = screenW / (4/3)                       = .4280
  // — while the bezel's actual opening is WIN_W x WIN_H = .68 x .478 with
  // WIN_R=.055 ROUNDED corners. So the picture was ~8% narrower and ~5%
  // shorter than the hole it sat in (a .0546 dark band down each side, .025
  // top and bottom) and its square corners cut across the window's rounded
  // ones. On top of that it sat .012 BEHIND the bezel's front face, so at
  // this scene's oblique camera the bezel's own inner wall showed as an extra
  // dark band on the two sides facing away from camera — which is exactly the
  // "photo pasted crooked inside a frame, dark gaps on two sides" the owner
  // screenshotted at p≈.90-.94.
  //
  // The fix makes the textured surface BE the window: same rounded-rect
  // outline, sized to the opening at its widest (the ExtrudeGeometry bevel
  // flares the hole outward by bevelSize over the bevelThickness closest to
  // the viewer, so a nominal-size quad would still leave a bevelSize hairline
  // of dark all round), and sat just proud of the bezel's front-most plane so
  // there is no recess parallax to open a gap at any camera angle. The quad
  // therefore covers the bevelled lip of the opening and nothing else — it
  // never spills onto the bezel's flat face.
  const SCREEN_W = WIN_W + bezelBevelS * 2;
  const SCREEN_H = WIN_H + bezelBevelS * 2;
  const SCREEN_R = WIN_R + bezelBevelS;
  const SCREEN_Z = FRONT_Z + bezelBevelT + 0.002;
  // NOTE: opts.screenAspect no longer sizes this quad — the window's own
  // aspect (SCREEN_W/SCREEN_H ≈ 1.412) is the truth, and callers read it back
  // out of dims.screenWidth/screenHeight to build a matching cover-crop
  // (see createDesk's homeCropAspect in ending-props-r15.js). The option is
  // still accepted so the call sites' signatures keep working.
  const screenGeo = roundedQuadGeometry(THREE, SCREEN_W, SCREEN_H, SCREEN_R);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x0d1a14, toneMapped: false });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, HEAD_BOTTOM_Y + winCenterY, SCREEN_Z);
  screen.receiveShadow = true;
  root.add(screen);
  const screenW = SCREEN_W, screenH = SCREEN_H;

  // chin: grey badge lower-left, floppy slot lower-right
  {
    const chinCenterY = HEAD_BOTTOM_Y + chinH * 0.52;

    const slotW = 0.24, slotH = 0.026;
    const slotOuter = addMesh(new THREE.BoxGeometry(slotW + 0.02, slotH + 0.016, 0.02), matBezelDark, root, false);
    slotOuter.position.set(HEAD_W * 0.20, chinCenterY + chinH * 0.05, FRONT_Z + 0.005);
    const slotInner = addMesh(new THREE.BoxGeometry(slotW, slotH, 0.018), matSlot, root, false);
    slotInner.position.set(HEAD_W * 0.20, chinCenterY + chinH * 0.05, FRONT_Z + 0.008);

    const badgeShape = roundedRectShape(THREE, 0.09, 0.042, 0.012);
    const badgeGeo = new THREE.ExtrudeGeometry(badgeShape, { depth: 0.009, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 6 });
    const badge = addMesh(badgeGeo, matBadge, root, false);
    badge.position.set(-HEAD_W * 0.26, chinCenterY + chinH * 0.05, FRONT_Z + 0.004);

    // chin vent slits along the bottom edge (3 short slits per the truth photo)
    const slitCount = 3, slitW2 = 0.075, slitH2 = 0.013, gap = 0.022;
    const totalW = slitCount * slitW2 + (slitCount - 1) * gap;
    const startX = -totalW / 2 + slitW2 / 2;
    for (let i = 0; i < slitCount; i++) {
      const m = addMesh(new THREE.BoxGeometry(slitW2, slitH2, 0.014), matVent, root, false);
      m.position.set(startX + i * (slitW2 + gap), HEAD_BOTTOM_Y + chinH * 0.14, FRONT_Z + 0.004);
    }
  }

  // =========================================================
  // Outline shells (single thin cel-style outline per major body mesh)
  // =========================================================
  if (outline) {
    for (const mesh of outlineMeshes) {
      const sh = makeOutline(THREE, mesh, 0.008);
      mesh.add(sh);
    }
  }

  root.updateMatrixWorld(true);

  const dims = {
    width: KBD_FRONT_W,          // overall widest cross-section (keyboard front)
    height: HEAD_TOP_Y,
    depth: KBD_FRONT_Z - HEAD_BACK_Z,
    screenWidth: screenW,        // r54: == the bezel window's own width
    screenHeight: screenH,       // r54: == the bezel window's own height
    screenRadius: SCREEN_R,      // r54: the window's corner radius, same units
    frontZ: FRONT_Z,             // chin/bezel front face (placement anchor, matches createMacintosh's convention)
  };

  // r54: lets the caller build MORE quads with this exact outline — the
  // ending's dive portal plane needs one so the flattening hand-off keeps the
  // monitor's own rounded window shape instead of popping to a rectangle.
  // roundness: 1 = the window's own corner radius, 0 = square corners.
  const makeScreenQuad = (roundness = 1) => roundedQuadGeometry(THREE, SCREEN_W, SCREEN_H, SCREEN_R * roundness);

  return { root, screen, screenMat, dims, makeScreenQuad };
}

export default createDeskComputer;
