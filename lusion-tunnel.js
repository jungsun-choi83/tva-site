import * as THREE from './vendor/three.module.js';

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (start, end, value) => {
  const progress = clamp((value - start) / Math.max(.0001, end - start));
  return progress * progress * (3 - 2 * progress);
};

const COLORS = {
  cobalt: new THREE.Color('#2639ed'),
  deepBlue: new THREE.Color('#161d91'),
  periwinkle: new THREE.Color('#9ea7de'),
  emissive: new THREE.Color('#f4f6ff'),
  void: new THREE.Color('#080911')
};

function seeded(index) {
  const value = Math.sin(index * 91.733 + 17.17) * 43758.5453;
  return value - Math.floor(value);
}

function archWallGeometry() {
  const wall = new THREE.Shape();
  wall.moveTo(-6, -5.04);
  wall.lineTo(6, -5.04);
  wall.lineTo(6, 5.04);
  wall.lineTo(-6, 5.04);
  wall.closePath();
  const opening = new THREE.Path();
  opening.moveTo(-2.68, -4.94);
  opening.lineTo(-2.68, .46);
  opening.absarc(0, .46, 2.68, Math.PI, 0, true);
  opening.lineTo(2.68, -4.94);
  opening.closePath();
  wall.holes.push(opening);
  return new THREE.ShapeGeometry(wall, 28);
}

function archLightGeometry() {
  const opening = new THREE.Shape();
  opening.moveTo(-2.62, -4.9);
  opening.lineTo(2.62, -4.9);
  opening.lineTo(2.62, .46);
  opening.absarc(0, .46, 2.62, 0, Math.PI, false);
  opening.closePath();
  return new THREE.ShapeGeometry(opening, 28);
}

function unavailable(mount) {
  mount.dataset.tunnelStatus = 'unavailable';
  return { draw() {}, resize() {}, setVisible() {}, available: false };
}

export function initLusionTunnel(mount) {
  if (!mount) return unavailable(document.documentElement);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance'
    });
  } catch {
    return unavailable(mount);
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.className = 'lusion-tunnel__canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = COLORS.cobalt.clone();
  scene.fog = new THREE.Fog(COLORS.deepBlue.clone(), 24, 132);
  const camera = new THREE.PerspectiveCamera(45, 1, .12, 260);
  scene.add(camera);

  const corridor = new THREE.Group();
  scene.add(corridor);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.cobalt,
    roughness: .9,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.deepBlue,
    roughness: .86,
    metalness: .02,
    side: THREE.DoubleSide,
    transparent: true
  });
  const loopMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.periwinkle,
    transparent: true,
    opacity: .9,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const apertureMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.emissive,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide
  });
  const corridorMaterials = [wallMaterial, edgeMaterial, loopMaterial, apertureMaterial];

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(17, 210), wallMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -5.05, -88);
  corridor.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(17, 210), wallMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 5.05, -88);
  corridor.add(ceiling);

  const beamGeometry = new THREE.BoxGeometry(17, .3, .44);
  const lipGeometry = new THREE.BoxGeometry(17, .16, .44);
  const pillarGeometry = new THREE.BoxGeometry(.3, 10.1, .44);
  const wallGeometry = archWallGeometry();
  const openingGeometry = archLightGeometry();
  const archGeometry = new THREE.TorusGeometry(2.62, .18, 8, 28, Math.PI);
  const archLegGeometry = new THREE.BoxGeometry(.26, 4.25, .28);
  const bayGroups = [];

  for (let index = 0; index < 16; index += 1) {
    const bay = new THREE.Group();
    bay.position.z = 4 - index * 12;
    corridor.add(bay);
    bayGroups.push(bay);

    const beam = new THREE.Mesh(beamGeometry, edgeMaterial);
    beam.position.y = 4.78;
    bay.add(beam);
    const lip = new THREE.Mesh(lipGeometry, edgeMaterial);
    lip.position.y = -4.91;
    bay.add(lip);

    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(pillarGeometry, edgeMaterial);
      pillar.position.x = side * 7.72;
      bay.add(pillar);

      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.rotation.y = side * Math.PI / 2;
      wall.position.x = side * 8.02;
      bay.add(wall);

      const opening = new THREE.Mesh(openingGeometry, apertureMaterial);
      opening.rotation.y = side * Math.PI / 2;
      opening.position.set(side * 8.16, 0, 0);
      bay.add(opening);

      const arch = new THREE.Mesh(archGeometry, edgeMaterial);
      arch.rotation.y = side * Math.PI / 2;
      arch.position.set(side * 7.89, .65, 0);
      bay.add(arch);
      for (const openingSide of [-1, 1]) {
        const leg = new THREE.Mesh(archLegGeometry, edgeMaterial);
        leg.position.set(side * 7.89, -1.48, openingSide * 2.62);
        bay.add(leg);
      }
    }
  }

  const loopGeometry = new THREE.RingGeometry(1.55, 2.04, 40);
  const loops = [];
  for (let index = 0; index < 96; index += 1) {
    const loop = new THREE.Mesh(loopGeometry, loopMaterial);
    const bayIndex = Math.floor(index / 6);
    const planeSlot = index % 6;
    const plane = planeSlot < 2 ? planeSlot : planeSlot < 4 ? 2 : 3;
    const z = 4 - bayIndex * 12 + (seeded(index + 4) - .5) * 8.6;
    const scaleX = 1.1 + seeded(index) * 1.55;
    const scaleY = .82 + seeded(index + 30) * 1.1;
    if (plane === 0 || plane === 1) {
      loop.rotation.x = Math.PI / 2;
      loop.position.set((seeded(index + 8) - .5) * 10.8, plane === 0 ? -5.035 : 5.035, z);
    } else {
      const side = plane === 2 ? -1 : 1;
      loop.rotation.y = Math.PI / 2;
      loop.position.set(side * 8.005, (seeded(index + 16) - .5) * 7.4, z);
    }
    loop.scale.set(scaleX, scaleY, 1);
    loop.userData.bayIndex = bayIndex;
    corridor.add(loop);
    loops.push(loop);
  }

  scene.add(new THREE.AmbientLight(0xffffff, .82));
  const key = new THREE.DirectionalLight(0xdce3ff, .62);
  key.position.set(-6, 8, 12);
  scene.add(key);
  const sideLights = [-36, -84, -132].map((z, index) => {
    const light = new THREE.PointLight(0xf4f6ff, 1.05, 28, 1.8);
    light.position.set(index % 2 ? 6.2 : -6.2, .4, z);
    scene.add(light);
    return light;
  });

  const shardGroup = new THREE.Group();
  camera.add(shardGroup);
  const shardGeometry = new THREE.BufferGeometry();
  shardGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -.18, -.21, 0,
    .22, -.1, 0,
    .03, .27, 0
  ], 3));
  shardGeometry.computeVertexNormals();
  const shardMaterial = new THREE.MeshPhysicalMaterial({
    color: COLORS.periwinkle,
    transparent: true,
    opacity: .62,
    roughness: .12,
    metalness: .22,
    transmission: .15,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const shards = Array.from({ length: 20 }, (_, index) => {
    const shard = new THREE.Mesh(shardGeometry, shardMaterial);
    const angle = seeded(index + 2) * Math.PI * 2;
    const radius = .8 + seeded(index + 11) * 3.1;
    shard.userData = {
      angle,
      startX: Math.cos(angle) * radius * .22,
      startY: Math.sin(angle) * radius * .18,
      endX: Math.cos(angle) * (3.2 + seeded(index + 21) * 5.8),
      endY: Math.sin(angle) * (2.4 + seeded(index + 31) * 4.3),
      depth: 3.4 + seeded(index + 41) * 3.2,
      spin: (seeded(index + 51) - .5) * 7,
      scale: .45 + seeded(index + 61) * 1.2
    };
    shard.visible = false;
    shardGroup.add(shard);
    return shard;
  });

  let width = 0;
  let height = 0;
  let mobileView = false;
  let visible = true;
  let contextAvailable = true;
  let lastProgress = 0;
  let lastPointer = { x: 0, y: 0 };
  let lastReduced = false;

  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextAvailable = false;
    mount.dataset.tunnelStatus = 'context-lost';
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    contextAvailable = true;
    mount.dataset.tunnelStatus = 'ready';
    resize();
    if (visible && !document.hidden) draw(lastProgress, lastPointer, lastReduced);
  });

  function resize() {
    width = mount.clientWidth || window.innerWidth;
    height = mount.clientHeight || window.innerHeight;
    mobileView = width < 760 || width / Math.max(1, height) < .92;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileView ? 1.05 : 1.4));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    corridor.scale.x = mobileView ? .64 : 1;
    bayGroups.forEach((bay, index) => { bay.visible = !mobileView || index < 12; });
    loops.forEach(loop => { loop.visible = !mobileView || loop.userData.bayIndex < 12; });
  }

  function draw(progress = 0, pointer = { x: 0, y: 0 }, reduced = false) {
    lastProgress = progress;
    lastPointer = { x: Number(pointer?.x) || 0, y: Number(pointer?.y) || 0 };
    lastReduced = reduced;
    if (!visible || !contextAvailable || document.hidden) return;
    if (mount.clientWidth !== width || mount.clientHeight !== height) resize();
    const value = reduced ? .9 : clamp(Number(progress) || 0);
    const flight = smoothstep(0, .56, value);
    const monitor = smoothstep(.53, .66, value);
    const fade = smoothstep(.72, .9, value);
    const burst = smoothstep(.68, .83, value);
    const shardFade = 1 - smoothstep(.88, .97, value);
    const pointerX = reduced ? 0 : clamp(Number(pointer?.x) || 0, -1, 1);
    const pointerY = reduced ? 0 : clamp(Number(pointer?.y) || 0, -1, 1);

    const travel = 118 * flight;
    const roll = (1 - smoothstep(.08, .4, value)) * -.13;
    camera.position.set(pointerX * .18 * (1 - monitor), .2 - pointerY * .12 * (1 - monitor), 14 - travel);
    camera.lookAt(pointerX * .05, -.1, camera.position.z - 34);
    camera.rotateZ(roll);
    camera.fov = (mobileView ? 58 : 45) - smoothstep(.18, .56, value) * 4;
    camera.updateProjectionMatrix();

    corridor.position.x = -pointerX * .08;
    corridor.rotation.z = roll * .14;
    corridorMaterials.forEach(material => {
      material.opacity = material === apertureMaterial
        ? 1 - fade * .78
        : Math.max(.035, 1 - fade);
    });
    loops.forEach((loop, index) => {
      loop.rotation.z = (seeded(index + 71) - .5) * .2;
    });
    sideLights.forEach((light, index) => {
      light.intensity = (1.05 - fade * .72) * (index === 1 ? 1.12 : 1);
    });
    scene.background.lerpColors(COLORS.cobalt, COLORS.void, fade);
    scene.fog.color.copy(scene.background);
    scene.fog.near = 22 - monitor * 8;
    scene.fog.far = 132 - monitor * 42;

    shardMaterial.opacity = .62 * shardFade;
    shards.forEach((shard, index) => {
      const data = shard.userData;
      shard.visible = value >= .665 && shardFade > .01;
      const thrust = burst * burst;
      shard.position.set(
        data.startX + (data.endX - data.startX) * thrust,
        data.startY + (data.endY - data.startY) * thrust,
        -6.35 + data.depth * thrust
      );
      shard.rotation.set(data.spin * thrust * .45, data.spin * thrust, data.angle + data.spin * thrust * .3);
      const scale = data.scale * (.35 + burst * .8) * (1 - smoothstep(.9, .98, value));
      shard.scale.setScalar(scale);
      shard.renderOrder = 30 + index;
    });

    renderer.render(scene, camera);
    mount.dataset.tunnelStatus = 'rendered';
    mount.dataset.tunnelStage = value < .18 ? 'approach' : value < .55 ? 'flight' : value < .7 ? 'frame-break' : value < .84 ? 'emerge' : 'greet';
  }

  function setVisible(next) {
    visible = Boolean(next);
    renderer.domElement.style.visibility = visible ? '' : 'hidden';
  }

  resize();
  mount.dataset.tunnelStatus = 'ready';
  return { draw, resize, setVisible, available: true };
}
