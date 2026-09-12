import * as THREE from '../vendor/three.module.js';
import { HOTEL_PENDING_LAYERS, HOTEL_SOURCE_DIRECTORY, loadHotelAssets } from './hotel-assets.js';
import { loadStudioStickerManifest } from './sticker-assets.js';

const clamp = value => Math.max(0, Math.min(1, value));

export function createFallEnvironment(mount, wake = () => {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch {
    mount.dataset.environmentStatus = 'unavailable';
    return { draw() {}, resize() {}, dispose() {} };
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.domElement.className = 'fall-environment__canvas';
  mount.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x285f62);
  scene.fog = new THREE.Fog(0xeadbbd, 72, 164);
  const camera = new THREE.PerspectiveCamera(50, 1, .1, 190);
  const set = new THREE.Group();
  scene.add(set);

  const corridor = {
    halfWidth: 8.4,
    floor: -5.45,
    ceiling: 5.55,
    start: 10,
    end: -158,
    bay: 12,
    wainscotHeight: 4.15,
  };
  const corridorHeight = corridor.ceiling - corridor.floor;
  const upperHeight = corridorHeight - corridor.wainscotHeight;
  const upperY = corridor.floor + corridor.wainscotHeight + upperHeight / 2;
  const wainscotY = corridor.floor + corridor.wainscotHeight / 2;

  const materials = {
    upperWall: new THREE.MeshBasicMaterial({ color: 0xeadfc6, side: THREE.DoubleSide }),
    wainscot: new THREE.MeshBasicMaterial({ color: 0x237a78, side: THREE.DoubleSide }),
    floor: new THREE.MeshBasicMaterial({ color: 0x2f7773, side: THREE.DoubleSide }),
    ceiling: new THREE.MeshBasicMaterial({ color: 0xe8dbc0, side: THREE.DoubleSide }),
    endWall: new THREE.MeshBasicMaterial({ color: 0xeadfc6, side: THREE.DoubleSide }),
    door: new THREE.MeshBasicMaterial({ transparent: true, alphaTest: .02, depthWrite: false, side: THREE.DoubleSide }),
    sconce: new THREE.MeshBasicMaterial({ transparent: true, alphaTest: .02, depthWrite: false, side: THREE.DoubleSide }),
  };

  const surfaces = new Map();
  Object.keys(materials).forEach(role => surfaces.set(role, []));

  function addSurface(role, geometry, position, rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, materials[role]);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.receiveShadow = role !== 'upperWall' && role !== 'wainscot';
    if (HOTEL_PENDING_LAYERS.includes(role)) mesh.visible = false;
    set.add(mesh);
    surfaces.get(role).push(mesh);
    return mesh;
  }

  const bayCount = Math.ceil((corridor.start - corridor.end) / corridor.bay);
  const corridorLength = corridor.start - corridor.end;
  const corridorCentre = (corridor.start + corridor.end) / 2;
  addSurface(
    'floor',
    new THREE.PlaneGeometry(corridor.halfWidth * 2, corridorLength),
    [0, corridor.floor, corridorCentre],
    [-Math.PI / 2, 0, 0],
  );
  addSurface(
    'ceiling',
    new THREE.PlaneGeometry(corridor.halfWidth * 2, corridorLength),
    [0, corridor.ceiling, corridorCentre],
    [Math.PI / 2, 0, 0],
  );

  for (let index = 0; index < bayCount; index += 1) {
    const bayStart = corridor.start - index * corridor.bay;
    const bayEnd = Math.max(corridor.end, bayStart - corridor.bay);
    const length = bayStart - bayEnd;
    const centre = (bayStart + bayEnd) / 2;

    for (const side of [-1, 1]) {
      addSurface(
        'upperWall',
        new THREE.PlaneGeometry(length + .04, upperHeight),
        [side * corridor.halfWidth, upperY, centre],
        [0, side * Math.PI / 2, 0],
      );
      addSurface(
        'wainscot',
        new THREE.PlaneGeometry(length + .04, corridor.wainscotHeight),
        [side * corridor.halfWidth, wainscotY, centre],
        [0, side * Math.PI / 2, 0],
      );
      addSurface(
        'door',
        new THREE.PlaneGeometry(3.25, 6.8),
        [side * (corridor.halfWidth - .025), corridor.floor + 3.4, centre - 2.1],
        [0, side * Math.PI / 2, 0],
      );
      addSurface(
        'sconce',
        new THREE.PlaneGeometry(1.3, 1.3),
        [side * (corridor.halfWidth - .035), 1.15, centre + 3.25],
        [0, side * Math.PI / 2, 0],
      );
    }
  }

  addSurface(
    'endWall',
    new THREE.PlaneGeometry(corridor.halfWidth * 2, corridorHeight),
    [0, corridor.floor + corridorHeight / 2, corridor.end - .02],
  );

  mount.dataset.hotelAssetSource = HOTEL_SOURCE_DIRECTORY;
  mount.dataset.hotelAssetStatus = 'loading';
  mount.dataset.hotelReviewStatus = 'draft-user-review-pending';
  mount.dataset.hotelPending = HOTEL_PENDING_LAYERS.join(',');
  let hotelAssets = null;
  let disposed = false;
  loadHotelAssets().then(result => {
    if (disposed) {
      result.dispose();
      return;
    }
    hotelAssets = result;
    result.textures.forEach((texture, role) => {
      const material = materials[role];
      if (!material) return;
      material.map = texture;
      material.color.setHex(0xffffff);
      material.needsUpdate = true;
      surfaces.get(role)?.forEach(surface => {
        const frame = result.frames.get(role);
        if (frame) {
          const physicalHeight = role === 'door' ? 6.8 : 1.3;
          const physicalWidth = physicalHeight * frame.width / frame.height;
          surface.scale.set(
            physicalWidth / surface.geometry.parameters.width,
            physicalHeight / surface.geometry.parameters.height,
            1,
          );
          if (role === 'door') surface.position.y = corridor.floor + physicalHeight / 2;
        }
        surface.visible = true;
      });
    });
    mount.dataset.hotelAssetStatus = result.status;
    mount.dataset.hotelInvalid = result.invalid.join(',');
    mount.dataset.hotelPending = result.pending.join(',');
    wake();
  });

  scene.add(new THREE.HemisphereLight(0xfff6df, 0x1b5555, 1.15));
  const propLight = new THREE.DirectionalLight(0xfff1d5, 1.3);
  propLight.position.set(-4, 9, 8);
  scene.add(propLight);

  const props = [];
  const stickerLoader = new THREE.TextureLoader();
  let propLoadStarted = false;
  const loadStickerTexture = asset => new Promise(resolve => {
    stickerLoader.load(asset.url, texture => resolve({ asset, texture }), undefined, () => resolve({ asset, texture: null }));
  });
  async function loadManifestProps() {
    let assets = [];
    try {
      assets = await loadStudioStickerManifest();
    } catch {
      mount.dataset.environmentStatus = 'sticker-manifest-unavailable';
      return;
    }
    const loaded = await Promise.all(assets.map(loadStickerTexture));
    if (disposed) {
      loaded.forEach(({ texture }) => texture?.dispose());
      return;
    }
    loaded.forEach(({ asset, texture }, index) => {
      if (!texture) return;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.offset.set(asset.bounds.left, 1 - asset.bounds.bottom);
      texture.repeat.set(asset.bounds.right - asset.bounds.left, asset.bounds.bottom - asset.bounds.top);
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      const visibleWidth = (asset.bounds.right - asset.bounds.left) * asset.width;
      const visibleHeight = (asset.bounds.bottom - asset.bounds.top) * asset.height;
      const planeHeight = 1.35 + (index % 4) * .22;
      const planeWidth = planeHeight * visibleWidth / Math.max(1, visibleHeight);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: .02,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeHeight), material);
      const group = new THREE.Group();
      group.add(plane);
      set.add(group);
      const side = index % 2 ? 1 : -1;
      group.position.set(
        side * (6.05 + (index % 3) * .48),
        -2.7 + (index % 5) * 1.02,
        -8 - index * 7.1,
      );
      group.userData.base = group.position.clone();
      group.userData.baseRotationZ = (index % 5 - 2) * .07;
      group.userData.slot = index + 1;
      group.userData.material = material;
      props.push(group);
    });
    mount.dataset.environmentStatus = props.length === assets.length
      ? `loaded-stickers-${props.length}`
      : `partial-stickers-${props.length}`;
    wake();
  }
  mount.dataset.environmentStatus = 'awaiting-stickers';

  let width = 0;
  let height = 0;
  function resize() {
    width = mount.clientWidth || innerWidth;
    height = mount.clientHeight || innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width < 760 ? 1.5 : 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.fov = width < 760 ? 64 : 50;
    camera.updateProjectionMatrix();
  }

  function draw({ progress = 0, reduced = false } = {}) {
    if (document.hidden) return;
    if (!propLoadStarted) {
      propLoadStarted = true;
      void loadManifestProps();
    }
    if (mount.clientWidth !== width || mount.clientHeight !== height) resize();
    const p = reduced ? .9 : clamp(progress);
    const travel = p < .8 ? p / .8 : 1;
    const cameraY = 1.1 - travel * 2.7 + Math.sin(p * Math.PI) * .16;
    camera.position.set(
      Math.sin(p * Math.PI * 1.4) * .34,
      cameraY,
      5 - travel * 129,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(camera.position.x * .3, cameraY + .8 + travel * .35, camera.position.z - 24);
    camera.rotateZ((1 - clamp(p / .46)) * -.24 + Math.sin(p * Math.PI) * .035);

    props.forEach(prop => {
      const depth = camera.position.z - prop.userData.base.z;
      prop.visible = depth > 4 && depth < 43;
      const fade = clamp((depth - 4) / 6) * clamp((43 - depth) / 10);
      prop.userData.material.opacity = fade;
      prop.position.copy(prop.userData.base);
      if (width < 760) prop.position.x *= .96;
      const near = clamp(1 - Math.abs(depth) / 18);
      const side = prop.userData.slot % 2 ? 1 : -1;
      prop.lookAt(camera.position);
      prop.rotateZ(prop.userData.baseRotationZ + near * .08 * side);
    });

    renderer.render(scene, camera);
    mount.dataset.environmentRendered = 'true';
  }

  function dispose() {
    disposed = true;
    const textures = new Set();
    const sceneMaterials = new Set();
    scene.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => sceneMaterials.add(material));
      }
    });
    sceneMaterials.forEach(material => {
      Object.values(material).forEach(value => {
        if (value?.isTexture) textures.add(value);
      });
      material.dispose();
    });
    textures.forEach(texture => texture.dispose());
    if (hotelAssets) hotelAssets.textures.clear();
    renderer.dispose();
    renderer.domElement.remove();
  }

  resize();
  return { draw, resize, dispose };
}
