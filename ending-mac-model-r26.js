// ending-mac-model-r26.js
// Procedural, reusable Three.js model of the original 1984 Macintosh 128K case.
// ES module. THREE is passed in by the caller (no import of three itself).
//
// export function createMacintosh(THREE, opts = {})
//   -> { root, screen, materials, dims }

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
  // A rounded rect usable as a Shape hole. Wound OPPOSITE to
  // roundedRectShape's outer contour (that one goes up-the-left-edge
  // first / clockwise; this one goes right-along-the-bottom-edge first /
  // counter-clockwise) so ExtrudeGeometry/earcut reliably treats it as a
  // hole instead of a second overlapping solid contour.
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

// Tapered body footprint (top-down, X/Z), wide at the front edge (+z),
// narrower at the back edge (-z), with rounded back corners only (the front
// corners are hidden under the bezel seam and stay square in plan).
function bodyFootprintShape(THREE, frontW, backW, depth, backR) {
  const shape = new THREE.Shape();
  const hf = frontW / 2;
  const hb = backW / 2;
  const zf = depth / 2;
  const zb = -depth / 2;
  const r = Math.min(backR, hb * 0.9, depth * 0.35);
  shape.moveTo(-hf, zf);
  shape.lineTo(hf, zf);
  shape.lineTo(hb, zb + r);
  shape.quadraticCurveTo(hb, zb, hb - r, zb);
  shape.lineTo(-hb + r, zb);
  shape.quadraticCurveTo(-hb, zb, -hb, zb + r);
  shape.lineTo(-hf, zf);
  return shape;
}

// r28: finer, subtler speckle (smaller dots, lower alpha ceiling, higher
// density+repeat so the grain reads as a fine plastic texture instead of a
// visible dot pattern), same warm-beige base colors as before.
function speckleTexture(THREE, baseColor, speckColor, size = 128, density = 1400) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < density; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = 0.02 + Math.random() * 0.05;
    ctx.fillStyle = speckColor;
    ctx.globalAlpha = a;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

// r28: a faint diagonal reflection gradient plane, sat just in front of a
// screen mesh, so the glass reads as glossy/lit instead of a flat matte
// rectangle. Purely additive/transparent — never occludes the face art
// drawn on the screen mesh behind it.
function screenGlareTexture(THREE, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, 'rgba(255,255,255,.16)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.04)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function makeOutline(THREE, mesh, thickness = 0.015, color = 0x1a1610) {
  const outlineMat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  outline.scale.setScalar(1 + thickness);
  outline.renderOrder = -1;
  return outline;
}

export function createMacintosh(THREE, opts = {}) {
  const screenAspect = opts.screenAspect || 4 / 3;
  const outline = opts.outline !== false;
  const tint = opts.tint !== undefined ? new THREE.Color(opts.tint) : null;

  // ---- Overall dimensions (local units, width = 1) ----
  const W = 1.0;          // overall width
  const H = 1.19;         // overall height
  const D = 1.0;          // overall depth
  const frontZ = 0.5;     // z of the front-most face (bezel front)

  const root = new THREE.Group();
  root.name = 'macintosh128k';

  // ---- Materials ----
  const beigeFrontTex = speckleTexture(THREE, '#d8c9a5', '#8d7b56');
  const beigeBodyTex = speckleTexture(THREE, '#cfc09a', '#7c6c4a');

  const matFront = new THREE.MeshStandardMaterial({
    color: tint || 0xffffff,
    map: beigeFrontTex,
    roughness: 0.85,
    metalness: 0.02,
  });
  const matBody = new THREE.MeshStandardMaterial({
    color: tint ? tint.clone().multiplyScalar(0.96) : 0xf2ead6,
    map: beigeBodyTex,
    roughness: 0.85,
    metalness: 0.02,
  });
  // r28: slightly darker variant of matBody for the underside/base plinth —
  // reads as gently self-shadowed instead of the same flat tone as the top.
  const matUnderside = new THREE.MeshStandardMaterial({
    color: tint ? tint.clone().multiplyScalar(0.8) : 0xcabf9c,
    map: beigeBodyTex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const matBezelDark = new THREE.MeshStandardMaterial({
    color: 0x2b2620,
    roughness: 0.6,
    metalness: 0.05,
  });
  const matSlot = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.7 });
  const matBadge = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 0.5, metalness: 0.1 });
  const matVent = new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.8 });
  const matPort = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  const matSeam = new THREE.MeshStandardMaterial({ color: 0x6b5f45, roughness: 0.9 });
  const matScreenDefault = new THREE.MeshStandardMaterial({ color: 0x08110d, roughness: 0.4, metalness: 0.1 });

  const materials = {
    front: matFront,
    body: matBody,
    underside: matUnderside,
    bezelDark: matBezelDark,
    slot: matSlot,
    badge: matBadge,
    vent: matVent,
    port: matPort,
    seam: matSeam,
    screen: matScreenDefault,
  };

  const outlineMeshes = [];
  function addMesh(geo, mat, group = root) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    outlineMeshes.push(mesh);
    return mesh;
  }

  // =========================================================
  // 1) BASE — shallow stepped plinth under everything
  // =========================================================
  const baseH = 0.065;
  const baseW = W * 1.02;
  const baseD = D * 1.0;
  const bodyMidZ = frontZ - D / 2; // = 0 by construction (D=1, frontZ=0.5)

  {
    const baseShape = roundedRectShape(THREE, baseW, baseD, 0.05);
    const geo = new THREE.ExtrudeGeometry(baseShape, {
      depth: baseH, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 6,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, bodyMidZ);
    geo.computeVertexNormals();
    addMesh(geo, matUnderside).position.y = 0;
  }

  // =========================================================
  // 2) BODY — tapered box (wide/front -> narrow/back), rounded top edge
  // =========================================================
  // r28: bezelProud is how far the bezel's own outer face sits ahead of the
  // body's front face — kept to ~.015 of the overall width so the case reads
  // as one continuous tapered form (per the reference key-visual) instead of
  // a separate front plate stuck onto the body. bodyTop now matches the
  // bezel's own top height exactly (see BEZEL BLOCK section below) so there
  // is no overhanging lip on top either.
  const bezelProud = W * 0.015;
  const bodyTop = 1.13;      // == bezel top height, see BEZEL BLOCK section
  const bodyBottom = baseH;
  const bodyH = bodyTop - bodyBottom;
  const bodyFrontW = W * 0.965;
  const bodyBackW = W * 0.80;
  const bodyDepth = D * 0.95; // from just behind the (thin) bezel cap to the rear
  const bodyFrontZ = frontZ - bezelProud; // only a thin proud edge shows past the body
  const bodyBackZ = bodyFrontZ - bodyDepth;

  {
    const footprint = bodyFootprintShape(THREE, bodyFrontW, bodyBackW, bodyDepth, 0.16);
    const geo = new THREE.ExtrudeGeometry(footprint, {
      depth: bodyH,
      bevelEnabled: true,
      // r28: smaller top-edge bevel than before (was .014/.012) — with the
      // body's front face now sitting only bezelProud (~.015) behind the
      // bezel's own front face, a large bevel could bulge the body's rounded
      // top edge out past the bezel's face and peek through the screen
      // window; kept comfortably smaller than bezelProud instead, which also
      // reads as a gentler, more continuous chamfer into the bezel above it.
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 3,
      curveSegments: 8,
    });
    // shape is authored in local (x,z); extrude runs along local Y (call it "up") -> rotate to world.
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, bodyBottom, (bodyFrontZ + bodyBackZ) / 2);
    geo.computeVertexNormals();
    addMesh(geo, matBody).name = 'bodyShell';
  }

  // side vent grilles near the rear, both sides. The body tapers from
  // bodyFrontW down to bodyBackW, so each slit's X offset is interpolated
  // to the body's actual half-width AT ITS OWN z — using a fixed offset
  // left the slits buried inside the tapered surface (invisible).
  {
    const ventGroup = new THREE.Group();
    const slitW = 0.014, slitH = 0.22, slitD = 0.01;
    const count = 5;
    const startY = bodyBottom + bodyH * 0.42;
    const zCenter = bodyBackZ + bodyDepth * 0.22;
    const halfWidthAtZ = (z) => {
      const t = THREE.MathUtils.clamp((z - bodyBackZ) / bodyDepth, 0, 1);
      return THREE.MathUtils.lerp(bodyBackW / 2, bodyFrontW / 2, t);
    };
    for (let i = 0; i < count; i++) {
      const z = zCenter - i * (slitW * 2.2);
      const hw = halfWidthAtZ(z);
      for (const side of [-1, 1]) {
        const geo = new THREE.BoxGeometry(slitD, slitH, slitW);
        const mesh = addMesh(geo, matVent, ventGroup);
        mesh.position.set(side * (hw + slitD * 0.5 - 0.003), startY, z);
      }
    }
    root.add(ventGroup);
  }

  // rear port panel + connector nubs + rear vent lines
  {
    const panelW = bodyBackW * 0.5;
    const panelH = 0.16;
    const panelGeo = new THREE.BoxGeometry(panelW, panelH, 0.01);
    const panel = addMesh(panelGeo, matPort);
    panel.position.set(-bodyBackW * 0.18, bodyBottom + bodyH * 0.30, bodyBackZ - 0.006);

    for (let i = 0; i < 3; i++) {
      const nub = new THREE.CylinderGeometry(0.018, 0.018, 0.014, 10);
      nub.rotateX(Math.PI / 2);
      const m = addMesh(nub, matBezelDark);
      m.position.set(panel.position.x - panelW * 0.3 + i * panelW * 0.3, panel.position.y, bodyBackZ - 0.012);
    }

    // rear horizontal vent lines (upper back, above handle recess)
    for (let i = 0; i < 4; i++) {
      const lineGeo = new THREE.BoxGeometry(bodyBackW * 0.5, 0.01, 0.01);
      const m = addMesh(lineGeo, matVent);
      m.position.set(bodyBackW * 0.12, bodyBottom + bodyH * 0.62 + i * 0.026, bodyBackZ - 0.008);
    }
  }

  // recessed carry handle groove on top, near the back — modelled as a
  // shallow sunken channel (dark) with a raised lip, rather than a floating
  // ring with a through-hole, so it reads correctly from every angle.
  {
    const handleOuterW = 0.34, handleOuterD = 0.115;
    const lipShape = roundedRectShape(THREE, handleOuterW, handleOuterD, 0.05);
    const lipGeo = new THREE.ExtrudeGeometry(lipShape, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 8 });
    lipGeo.rotateX(-Math.PI / 2);
    const lip = addMesh(lipGeo, matBody);
    lip.position.set(0, bodyTop - 0.002, bodyBackZ + bodyDepth * 0.30);

    const grooveW = handleOuterW * 0.72, grooveD = handleOuterD * 0.52;
    const grooveGeo = new THREE.ExtrudeGeometry(roundedRectShape(THREE, grooveW, grooveD, 0.03), {
      depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 8,
    });
    grooveGeo.rotateX(-Math.PI / 2);
    grooveGeo.translate(0, -0.03, 0);
    const groove = addMesh(grooveGeo, matBezelDark);
    groove.position.set(0, bodyTop + 0.006, bodyBackZ + bodyDepth * 0.30);
  }

  // =========================================================
  // 3) BEZEL BLOCK — front slab with screen window + chin details
  // =========================================================
  // r28: the bezel's OWN width and top height now match the body's front
  // cross-section (bodyFrontW / bodyTop) exactly, instead of the full W/H —
  // previously the bezel was wider AND taller than the body it sat on,
  // which is exactly what read as "a plate stuck on the body": from behind
  // or the side you could see the bezel's edges overhanging the body's own
  // (narrower, shorter) silhouette all the way around. With no size
  // mismatch left, the only thing that can still read as a seam is the
  // small forward step (bezelProud, ~.015 of width) plus the thin dark seam
  // line below, which is what a manufacturing seam actually looks like.
  const bezelW = bodyFrontW;
  const bezelH = bodyTop - baseH; // == body's own top height, no overhanging lip
  // The bezel's own geometry is still a normal-thickness slab (so the screen
  // window has real depth to recess into) but almost all of that thickness
  // now sits INSIDE the body's own volume (bodyFrontZ is only bezelProud
  // ahead of bezelBackZ) — only the thin bezelProud sliver is visibly proud
  // of the body from outside, so the case still reads as one continuous
  // tapered form rather than a separate front block.
  const bezelThickness = 0.05;
  const bezelBackZ = frontZ - bezelThickness;
  const bezelBottom = baseH;

  const chinFrac = 0.40; // lower 40% is solid chin, upper 60% has the screen window
  const chinH = bezelH * chinFrac;
  const winH = bezelH * (1 - chinFrac);
  const winMarginX = 0.075;
  const winMarginTop = 0.06;
  const winW = bezelW - winMarginX * 2;
  const winCenterY = chinH + winH / 2 - 0.012;

  let bezelMesh;
  {
    const outer = roundedRectShape(THREE, bezelW, bezelH, 0.085, 0, bezelH / 2);
    const hole = roundedRectPath(THREE, winW, winH - winMarginTop, 0.06, 0, winCenterY);
    outer.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(outer, {
      depth: bezelThickness, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.007, bevelSegments: 3, curveSegments: 10,
    });
    geo.translate(0, 0, -bezelThickness); // extrude goes -z from front face
    // NOTE: a rotated "rake" was tried here but it shifts the window hole
    // out of alignment with the (unrotated) recess/screen meshes behind it,
    // since the hole is baked into this same rotated geometry. The subtle
    // raked-back look is instead approximated by the outline/shading only;
    // the slab itself stays vertical to keep the screen opening true.
    geo.translate(0, bezelBottom, frontZ);
    geo.computeVertexNormals();
    bezelMesh = addMesh(geo, matFront);
    bezelMesh.name = 'bezelBlock';
  }

  // dark recess plate behind the screen window (visible inner bevel walls).
  // Its front cap sits between the bezel's back face and the screen plane,
  // clearly in front of the body's front face, so it reads as the visible
  // "inside" of the window rather than the body peeking through.
  const recessDepth = 0.02;
  // r28: with bodyFrontZ now only bezelProud (~.015) behind the bezel's own
  // front face (frontZ), the safe z-window for "ahead of the body's max
  // bevel bulge, behind the bezel's outer face" is much narrower than
  // before — pushed forward from bezelBackZ by most of bezelThickness
  // instead of a small fixed offset, still leaving a small margin on both
  // sides (checked against bodyFrontZ+bevelSize below via measure scripts).
  const recessFrontZ = bezelBackZ + bezelThickness * 0.84;
  {
    const recessW = winW - 0.02;
    const recessH = (winH - winMarginTop) - 0.02;
    const recessShape = roundedRectShape(THREE, recessW, recessH, 0.05);
    // No bevel here: ExtrudeGeometry's bevel can expand a cap noticeably
    // beyond its nominal footprint (bitten us on the body shell earlier),
    // and this cap must stay reliably behind the screen plane.
    const geo = new THREE.ExtrudeGeometry(recessShape, { depth: recessDepth, bevelEnabled: false, curveSegments: 8 });
    geo.translate(0, 0, -recessDepth);
    geo.translate(0, bezelBottom + winCenterY, recessFrontZ);
    geo.computeVertexNormals();
    addMesh(geo, matBezelDark);
  }

  // screen plane, inset just inside the recess, facing +Z. r28: offset from
  // recessFrontZ shrunk (was .006) to fit the narrower recessFrontZ..frontZ
  // budget left after bezelProud shrank — still comfortably ahead of the
  // recess's own dark plate and behind the bezel's outer front face.
  let screenW = Math.min(winW - 0.06, (winH - winMarginTop - 0.06) * screenAspect);
  let screenH = screenW / screenAspect;
  const screenGeo = new THREE.PlaneGeometry(screenW, screenH, 1, 1);
  const screen = new THREE.Mesh(screenGeo, matScreenDefault);
  screen.position.set(0, bezelBottom + winCenterY, recessFrontZ + 0.003);
  screen.receiveShadow = true;
  root.add(screen);

  // r28: faint glass reflection gradient overlay, just in front of the
  // screen plane. Additive + fully transparent where there's no highlight,
  // so it never washes out the face art / HOME crop drawn on the screen
  // mesh's own material behind it.
  {
    const glareTex = screenGlareTexture(THREE);
    const glareMat = new THREE.MeshBasicMaterial({
      map: glareTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glare = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), glareMat);
    glare.position.set(0, bezelBottom + winCenterY, recessFrontZ + 0.0035);
    root.add(glare);
  }

  // chin: floppy slot (right), apple-style badge (left), vent slits (bottom)
  {
    const chinCenterY = bezelBottom + chinH * 0.52;

    // floppy disk slot — wide thin dark slot, right side of chin. Pushed
    // slightly proud of the face (rather than flush) so directional light
    // actually casts a visible edge shadow instead of washing it out.
    const slotW = 0.30, slotH = 0.03;
    const slotOuterGeo = new THREE.BoxGeometry(slotW + 0.024, slotH + 0.018, 0.024);
    const slotOuter = addMesh(slotOuterGeo, matBezelDark);
    slotOuter.position.set(bezelW * 0.20, chinCenterY + chinH * 0.06, frontZ + 0.006);
    const slotInnerGeo = new THREE.BoxGeometry(slotW, slotH, 0.02);
    const slotInner = addMesh(slotInnerGeo, matSlot);
    slotInner.position.set(bezelW * 0.20, chinCenterY + chinH * 0.06, frontZ + 0.009);

    // apple-style rounded badge, left side of chin
    const badgeShape = roundedRectShape(THREE, 0.11, 0.05, 0.014);
    const badgeGeo = new THREE.ExtrudeGeometry(badgeShape, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 6 });
    const badge = addMesh(badgeGeo, matBadge);
    badge.position.set(-bezelW * 0.28, chinCenterY + chinH * 0.06, frontZ + 0.004);

    // vent slits along bottom edge of the chin
    const slitCount = 4;
    const slitW2 = 0.09, slitH2 = 0.016, gap = 0.028;
    const totalW = slitCount * slitW2 + (slitCount - 1) * gap;
    const startX = -totalW / 2 + slitW2 / 2;
    for (let i = 0; i < slitCount; i++) {
      const geo = new THREE.BoxGeometry(slitW2, slitH2, 0.016);
      const m = addMesh(geo, matVent);
      m.position.set(startX + i * (slitW2 + gap), bezelBottom + chinH * 0.16, frontZ + 0.004);
    }

    // thin seam line between the bezel block and the body — r28: sits right
    // at the new (much smaller) bodyFrontZ interface, just proud of the
    // body's own surface, so it reads as a hairline manufacturing seam
    // instead of being buried inside the body now that the body's front
    // face sits much closer to the bezel's own front face.
    const seamGeo = new THREE.BoxGeometry(bezelW * 0.99, 0.006, 0.01);
    const seam = addMesh(seamGeo, matSeam);
    seam.position.set(0, bezelBottom + 0.004, bodyFrontZ + 0.004);
  }

  // =========================================================
  // Outline shells (cel-style), if requested
  // =========================================================
  if (outline) {
    for (const mesh of outlineMeshes) {
      // r28: thinner cel outline (was .01) so the black rim reads as a
      // crisp line rather than a heavy border, now that the case itself has
      // fewer separate proud parts to outline.
      const sh = makeOutline(THREE, mesh, 0.015);
      mesh.add(sh);
    }
  }

  root.updateMatrixWorld(true);

  const dims = {
    width: W,
    // r28: the visible top of the model is now bodyTop (bezel top matches
    // it exactly, see BEZEL BLOCK section) rather than the old H constant —
    // callers that scale the model to fit an envelope height read this to
    // compute that scale, so it must track the model's actual visible top.
    height: bodyTop,
    depth: D,
    screenWidth: screenW,
    screenHeight: screenH,
    frontZ,
  };

  return { root, screen, materials, dims };
}

export default createMacintosh;
