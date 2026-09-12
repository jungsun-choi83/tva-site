import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const clamp = value => Math.max(0, Math.min(1, value));
export function initWorldScene(mount, kind, wake) {
  if (kind === 'drop') return { draw() {}, resize() {}, interact() {}, layout() {} };
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
  catch { return { draw() {}, resize() {}, interact() {}, layout() {} }; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.className = 'world-canvas';
  renderer.domElement.style.removeProperty('display');
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.prepend(renderer.domElement);
  mount.classList.add('world-ready');
  const ledge = mount.querySelector('.studio-ledge');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 180);
  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(-5, 12, 10);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.left = -14; light.shadow.camera.right = 14;
  light.shadow.camera.top = 14; light.shadow.camera.bottom = -14;
  light.shadow.normalBias = .04;
  scene.add(light, light.target, new THREE.HemisphereLight(0xfffbef, 0x777061, 1.65));
  const stages = [], actions = [0, 0, 0, 0], pendingModels = [];
  const loader = new GLTFLoader();
  let modelsExpected = 0, modelsLoaded = 0;

  function model(name, parent, position, size, rotation = 0) {
    const group = new THREE.Group();
    modelsExpected++;
    parent.add(group); group.position.set(...position); group.rotation.y = rotation;
    const path = `assets/studio-props/${name.slice(7)}/${name.slice(7)}_1k.gltf`;
    pendingModels.push(() => loader.load(path, gltf => {
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const dimensions = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      const factor = size / Math.max(dimensions.x, dimensions.y, dimensions.z);
      gltf.scene.scale.setScalar(factor);
      gltf.scene.position.set(-centre.x * factor, -box.min.y * factor, -centre.z * factor);
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true; child.receiveShadow = true;
        }
      });
      group.add(gltf.scene);
      scene.updateMatrixWorld(true);
      const floorBox = new THREE.Box3().setFromObject(group);
      const parentFloor = parent.getWorldPosition(new THREE.Vector3()).y;
      const parentScale = parent.getWorldScale(new THREE.Vector3()).y || 1;
      group.position.y += (parentFloor - floorBox.min.y) / parentScale;
      group.userData.floorY = group.position.y;
      modelsLoaded++;
      if (modelsLoaded === modelsExpected) mount.dataset.modelStatus = 'loaded';
      wake();
    }, undefined, () => { mount.dataset.modelStatus = 'unavailable'; }));
    return group;
  }

  {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 28), new THREE.ShadowMaterial({ opacity: .13 }));
    ground.position.set(29, -.5, 0); ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true; scene.add(ground);
    const positions = [0, 12, 19.92, 29.04, 38.16, 46.08];
    const models = [
      { name: 'stationery_supplies', size: 4, rotation: -.38 },
      { name: 'binder_notebook', size: 3.8, rotation: -.3, tilt: .48 },
      { name: 'measuring_tape_01', size: 3.8, rotation: -.5 },
      { name: 'cardboard_box_01', size: 4.1, rotation: -.28 },
      { name: 'vintage_video_camera', size: 3.5, rotation: -.44 },
      { name: 'binder_notebook', size: 3.2, rotation: -.24, tilt: .56 }
    ];
    positions.forEach((x, index) => {
      const spec = models[index];
      const group = new THREE.Group(); group.position.set(x + 3.7, -.48, -.55); scene.add(group);
      const object = model(`studio:${spec.name}`, group, [0, 0, 0], spec.size, spec.rotation);
      object.rotation.x = spec.tilt || 0;
      stages.push({ group, object, pressed: false, baseRotation: spec.rotation });
    });
  }
  let width = 0, height = 0, worldTravel = 41.04;
  function resize() {
    width = mount.clientWidth; height = Math.max(1, mount.clientHeight);
    renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  resize();
  function ledgeTopAt(viewportX) {
    if (!ledge || !ledge.offsetWidth) return null;
    const rect = ledge.getBoundingClientRect();
    const styles = getComputedStyle(ledge);
    const slope = styles.transform === 'none' ? 0 : new DOMMatrix(styles.transform).b;
    const originX = Number.parseFloat(styles.transformOrigin) || 0;
    const leftShift = slope * -originX;
    const rightShift = slope * (ledge.offsetWidth - originX);
    const untransformedTop = rect.top - Math.min(leftShift, rightShift);
    const localX = Math.max(0, Math.min(ledge.offsetWidth, viewportX - rect.left));
    return untransformedTop + slope * (localX - originX);
  }

  function alignFloorToLedge(stage) {
    camera.clearViewOffset();
    if (!stage || !ledge) return;
    camera.updateMatrixWorld(true);
    stage.object.updateWorldMatrix(true, true);
    let lowerExtent = null;
    const point = new THREE.Vector3();
    stage.object.traverse(child => {
      if (!child.isMesh || !child.visible || !child.geometry) return;
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
      const box = child.geometry.boundingBox;
      if (!box) return;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        point.set(x, y, z).applyMatrix4(child.matrixWorld).project(camera);
        const projected = { x: (point.x + 1) * width * .5, y: (1 - point.y) * height * .5 };
        if (!lowerExtent || projected.y > lowerExtent.y) lowerExtent = projected;
      }
    });
    if (!lowerExtent) return;
    const mountRect = mount.getBoundingClientRect();
    const ledgeY = ledgeTopAt(mountRect.left + lowerExtent.x);
    if (ledgeY === null) return;
    camera.setViewOffset(width, height, 0, lowerExtent.y - (ledgeY - mountRect.top), width, height);
  }

  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    pendingModels.splice(0).forEach(load => load());
    observer.disconnect();
  }, { rootMargin: '150% 0px' });
  observer.observe(mount);
  function draw(progress, pointer = { x: 0, y: 0 }, movement = 0, reduced = false) {
    if (mount.clientWidth !== width || mount.clientHeight !== height) resize();
    const mobile = width < 760;
    {
      const x = progress * worldTravel;
      const centre = x + (mobile ? 1.2 : .5);
      const targetY = mobile ? 1.6 : .55;
      const frameSpan = mobile ? 7.2 : width < 1000 ? 10 : 11.5;
      const distance = frameSpan / (2 * Math.tan(THREE.MathUtils.degToRad(17.5)) * camera.aspect);
      camera.clearViewOffset();
      camera.position.set(centre + pointer.x * .24, targetY + distance * .14, distance);
      camera.lookAt(centre, targetY, 0);
      let floorStage = null;
      let floorFocus = -1;
      stages.forEach((stage, index) => {
        const focalCentre = centre + (mobile ? 2.7 : 3.7);
        const separation = Math.abs(stage.group.position.x - focalCentre);
        const focus = 1 - clamp((separation - 1.5) / 8);
        const viewportScale = mobile ? 1.08 : width < 1000 ? 1.02 : 1;
        stage.group.visible = focus > .82;
        const scale = viewportScale * (.18 + focus * .82);
        stage.group.scale.setScalar(scale);
        stage.group.position.y = -.48;
        stage.group.position.z = -.55 - (1 - focus) * 8.5;
        if (focus > floorFocus) { floorStage = stage; floorFocus = focus; }
        if (index > 0 && index < 5) {
          actions[index - 1] += ((stage.pressed ? 1 : 0) - actions[index - 1]) * (reduced ? 1 : .14);
          const action = actions[index - 1];
          stage.object.rotation.y = stage.baseRotation + action * .2 + pointer.x * .035;
          stage.object.position.y = (stage.object.userData.floorY || 0) + Math.sin(action * Math.PI) * .12;
          stage.object.scale.setScalar(1 + action * .045);
        }
      });
      alignFloorToLedge(floorStage);
      light.position.set(centre - 5, 12, 10); light.target.position.set(centre, 0, 0);
    }
    renderer.render(scene, camera);
    mount.dataset.worldRendered = 'true';
  }
  return { draw, resize,
    layout(offsets, travel, viewportWidth) {
      worldTravel = travel / viewportWidth * 12;
      if (kind === 'about') stages.forEach((stage, index) => {
        const localOffset = index === 5 ? .8 : index === 0 ? 3.9 : 4.05;
        stage.group.position.x = offsets[index] / viewportWidth * 12 + localOffset;
      });
    },
    interact(index, pressed) { if (stages[index + 1]) stages[index + 1].pressed = pressed; }
  };
}
