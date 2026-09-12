import * as THREE from '../vendor/three.module.js';

const START = .86;
const SETTLED = .94;
const MOBILE_BREAKPOINT = 760;
const DPR_LIMIT = 1.5;
const WORLD_HEIGHT = 10;

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const smooth = value => {
  const p = clamp01(value);
  return p * p * (3 - 2 * p);
};

const STONES = Object.freeze([
  { x: -.455, y: .395, size: .30, shape: 0, tint: 0x10191f, turn: [ .24, -.42,  .20], drift: [-.26,  .10] },
  { x: -.355, y: .245, size: .42, shape: 1, tint: 0x0c1020, turn: [-.32,  .68, -.18], drift: [-.18,  .06] },
  { x: -.455, y: .045, size: .34, shape: 2, tint: 0x1b121f, turn: [ .50, -.18,  .42], drift: [-.22,  0] },
  { x: -.385, y: -.225, size: .27, shape: 0, tint: 0x0d1e1f, turn: [-.18,  .54, -.45], drift: [-.16, -.05] },
  { x: -.275, y: -.385, size: .31, shape: 1, tint: 0x17101f, turn: [ .40, -.62,  .12], drift: [-.10, -.12] },
  { x: -.265, y: -.055, size: .23, shape: 2, tint: 0x151a1d, turn: [-.48,  .22,  .36], drift: [-.12,  .02] },
  { x:  .455, y: .385, size: .36, shape: 1, tint: 0x0d1b20, turn: [-.28,  .52,  .26], drift: [ .25,  .08] },
  { x:  .335, y: .235, size: .24, shape: 2, tint: 0x151020, turn: [ .42, -.38, -.30], drift: [ .14,  .06] },
  { x:  .455, y: .055, size: .43, shape: 0, tint: 0x19151f, turn: [-.36,  .74,  .14], drift: [ .24,  0] },
  { x:  .365, y: -.105, size: .29, shape: 2, tint: 0x0d2020, turn: [ .34, -.46,  .52], drift: [ .16, -.02] },
  { x:  .285, y: -.285, size: .25, shape: 1, tint: 0x19121f, turn: [-.52,  .30, -.20], drift: [ .12, -.08] },
  { x:  .455, y: -.395, size: .35, shape: 0, tint: 0x101b21, turn: [ .26, -.58,  .38], drift: [ .22, -.12] },
]);

const MOBILE_STONES = Object.freeze([0, 2, 4, 6, 8, 11]);
const GLINTS = Object.freeze([
  { stone: 0, x: -.07, y: .12, size: .88, peak: .915 },
  { stone: 6, x:  .08, y: .10, size: 1.08, peak: .940 },
  { stone: 8, x: -.10, y: .06, size: .94, peak: .965 },
  { stone: 11, x: -.06, y: .11, size: .82, peak: .985 },
]);

function createFlareTexture(ownerDocument) {
  const canvas = ownerDocument.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(64, 64, 0, 64, 64, 34);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(.08, 'rgba(240,248,255,.95)');
  glow.addColorStop(.34, 'rgba(185,214,255,.28)');
  glow.addColorStop(1, 'rgba(130,170,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 128, 128);
  const beam = context.createLinearGradient(0, 64, 128, 64);
  beam.addColorStop(0, 'rgba(255,255,255,0)');
  beam.addColorStop(.43, 'rgba(255,255,255,.08)');
  beam.addColorStop(.5, 'rgba(255,255,255,.95)');
  beam.addColorStop(.57, 'rgba(255,255,255,.08)');
  beam.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = beam;
  context.fillRect(0, 62.5, 128, 3);
  context.save();
  context.translate(64, 64);
  context.rotate(Math.PI / 2);
  context.translate(-64, -64);
  context.fillRect(0, 63.2, 128, 1.6);
  context.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function noOpLayer() {
  return Object.freeze({ draw() {}, dispose() {} });
}

function irregularGeometry(geometry, seed) {
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const random = offset => {
      const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 19.19 + offset) * 43758.5453;
      return value - Math.floor(value);
    };
    positions.setXYZ(
      index,
      x * (.82 + random(1.7) * .34),
      y * (.78 + random(4.1) * .40),
      z * (.80 + random(8.3) * .36),
    );
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createStudioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x010103);
  const panelGeometry = new THREE.PlaneGeometry(1, 1);
  const panels = [
    { color: 0xffffff, position: [-4.5, 4.2, 4.5], scale: [5, 2.2] },
    { color: 0x7bdfff, position: [4.8, 1.8, 3], scale: [3.8, 1.6] },
    { color: 0xa76dff, position: [-3.2, -3.8, 2.5], scale: [3.2, 1.4] },
    { color: 0xff84cb, position: [3.5, -3.2, -1.5], scale: [2.8, 1.3] },
    { color: 0xe9f5ff, position: [0, 1.5, -5], scale: [4.5, 3] },
  ].map(spec => {
    const material = new THREE.MeshBasicMaterial({ color: spec.color, side: THREE.DoubleSide });
    const panel = new THREE.Mesh(panelGeometry, material);
    panel.position.set(...spec.position);
    panel.scale.set(spec.scale[0], spec.scale[1], 1);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
    return panel;
  });
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(studio, .035, .1, 30);
  generator.dispose();
  panels.forEach(panel => panel.material.dispose());
  panelGeometry.dispose();
  return target;
}

export function createCTAReflections(mount, wake = () => {}) {
  if (!mount?.ownerDocument) throw new TypeError('createCTAReflections requires a DOM mount.');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    return noOpLayer();
  }

  const canvas = renderer.domElement;
  canvas.className = 'fall-cta-reflections';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block',
    pointerEvents: 'none',
    zIndex: '8',
    opacity: '0',
    visibility: 'hidden',
  });
  const cta = mount.querySelector('.fall-cta');
  if (cta) mount.insertBefore(canvas, cta);
  else mount.append(canvas);

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  renderer.sortObjects = true;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 40);
  camera.position.z = 12;
  const environment = createStudioEnvironment(renderer);
  scene.environment = environment.texture;

  const geometries = [
    irregularGeometry(new THREE.IcosahedronGeometry(1, 0), 1),
    irregularGeometry(new THREE.OctahedronGeometry(1, 1), 2),
    irregularGeometry(new THREE.DodecahedronGeometry(1, 0), 3),
  ];
  const materials = STONES.map((spec, index) => new THREE.MeshPhysicalMaterial({
    color: spec.tint,
    roughness: .045 + index % 3 * .012,
    metalness: 1,
    clearcoat: 1,
    clearcoatRoughness: .035,
    iridescence: .22 + index % 4 * .045,
    iridescenceIOR: 1.32,
    iridescenceThicknessRange: [170 + index * 4, 310 + index * 6],
    envMapIntensity: 2.6,
    flatShading: true,
  }));
  const meshes = STONES.map((spec, index) => {
    const mesh = new THREE.Mesh(geometries[spec.shape], materials[index]);
    mesh.rotation.set(index * .37, index * -.29, index * .19);
    mesh.renderOrder = 1;
    scene.add(mesh);
    return mesh;
  });

  const flareTexture = createFlareTexture(mount.ownerDocument);
  const flares = GLINTS.map(() => {
    const material = new THREE.SpriteMaterial({
      map: flareTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 4;
    scene.add(sprite);
    return sprite;
  });

  let disposed = false;
  let width = 0;
  let height = 0;
  let lastState = null;

  function resize(nextWidth, nextHeight) {
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, DPR_LIMIT));
    renderer.setSize(width, height, false);
    const worldWidth = WORLD_HEIGHT * width / height;
    camera.left = worldWidth * -.5;
    camera.right = worldWidth * .5;
    camera.top = WORLD_HEIGHT * .5;
    camera.bottom = WORLD_HEIGHT * -.5;
    camera.updateProjectionMatrix();
  }

  function draw({ progress = 0, reduced = false } = {}) {
    if (disposed) return;
    const p = clamp01(progress);
    lastState = { progress: p, reduced: Boolean(reduced) };
    if (p < START) {
      canvas.style.opacity = '0';
      canvas.style.visibility = 'hidden';
      return;
    }

    const bounds = mount.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(bounds.width || globalThis.innerWidth || 1));
    const nextHeight = Math.max(1, Math.round(bounds.height || globalThis.innerHeight || 1));
    resize(nextWidth, nextHeight);
    const portrait = nextWidth <= MOBILE_BREAKPOINT || nextWidth / nextHeight < .92;
    const active = portrait ? MOBILE_STONES : STONES.map((_, index) => index);
    const activeSet = new Set(active);
    const worldWidth = WORLD_HEIGHT * nextWidth / nextHeight;
    const entrance = reduced ? 1 : smooth((p - START) / (SETTLED - START));

    meshes.forEach((mesh, index) => {
      const spec = STONES[index];
      const visible = activeSet.has(index);
      mesh.visible = visible;
      if (!visible) return;
      const delay = (active.indexOf(index) % 4) * .055;
      const local = reduced ? 1 : smooth((entrance - delay) / (1 - delay));
      const size = spec.size * (portrait ? .66 : .78);
      mesh.position.set(
        spec.x * worldWidth + spec.drift[0] * (1 - local),
        spec.y * WORLD_HEIGHT + spec.drift[1] * (1 - local),
        (index % 3 - 1) * .22,
      );
      mesh.rotation.set(
        index * .37 + spec.turn[0] * local,
        index * -.29 + spec.turn[1] * local,
        index * .19 + spec.turn[2] * local,
      );
      mesh.scale.set(
        size * (1.18 + (index % 3) * .12) * local,
        size * (.72 + (index % 4) * .11) * local,
        size * (1.02 + (index % 2) * .16) * local,
      );
    });

    flares.forEach((sprite, index) => {
      const flare = GLINTS[index];
      const spec = STONES[flare.stone];
      const visible = activeSet.has(flare.stone);
      sprite.visible = visible;
      if (!visible) return;
      const flash = reduced ? .48 : .34 + .66 * Math.exp(-Math.pow((p - flare.peak) / .032, 2));
      sprite.material.opacity = entrance * flash;
      sprite.position.set(spec.x * worldWidth + flare.x, spec.y * WORLD_HEIGHT + flare.y, 3);
      const flareSize = flare.size * (portrait ? .72 : 1);
      sprite.scale.set(flareSize * 1.65, flareSize, 1);
    });

    canvas.style.visibility = 'visible';
    canvas.style.opacity = String(reduced ? .82 : .18 + entrance * .82);
    renderer.render(scene, camera);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    meshes.forEach(mesh => scene.remove(mesh));
    flares.forEach(sprite => {
      scene.remove(sprite);
      sprite.material.dispose();
    });
    materials.forEach(material => material.dispose());
    geometries.forEach(geometry => geometry.dispose());
    flareTexture.dispose();
    environment.dispose();
    renderer.dispose();
    canvas.remove();
    lastState = null;
  }

  return Object.freeze({ draw, dispose });
}
