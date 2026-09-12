import * as THREE from '../vendor/three.module.js';

export const HOTEL_SOURCE_DIRECTORY = '/Volumes/교육자료/AI_Hub/Design_Studies/tva-web-assets-20260908/hotel/';

const hotelBaseUrl = new URL('../assets/fall-welcome/hotel/', import.meta.url);

const deliveredAssets = [
  { role: 'upperWall', filename: 'hotel-upper-wall-paper.png', repeat: [1, 1] },
  { role: 'wainscot', filename: 'hotel-wainscot.png', repeat: [1, 1] },
  { role: 'floor', filename: 'hotel-floor-carpet-texture.png', repeat: [2, 16] },
  { role: 'ceiling', filename: 'hotel-ceiling-strip.png', repeat: [1, 2] },
  { role: 'endWall', filename: 'hotel-wall-wainscot-panel.png', repeat: [1, 1] },
  { role: 'door', filename: 'hotel-door.png', repeat: [1, 1], requiresAlpha: true },
  { role: 'sconce', filename: 'hotel-sconce.png', repeat: [1, 1], requiresAlpha: true },
];

export const HOTEL_PENDING_LAYERS = Object.freeze(['door', 'sconce']);

function inspectDecodedAlpha(image) {
  const sample = document.createElement('canvas');
  sample.width = image.naturalWidth || image.width;
  sample.height = image.naturalHeight || image.height;
  const context = sample.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, sample.width, sample.height);
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
  let minX = sample.width;
  let minY = sample.height;
  let maxX = -1;
  let maxY = -1;
  let hasTransparency = false;
  for (let y = 0; y < sample.height; y += 1) {
    for (let x = 0; x < sample.width; x += 1) {
      const alpha = pixels[(y * sample.width + x) * 4 + 3];
      if (alpha < 250) hasTransparency = true;
      if (!alpha) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!hasTransparency || maxX < minX || maxY < minY) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    imageWidth: sample.width,
    imageHeight: sample.height,
  };
}

function configureTexture(texture, repeat, frame) {
  texture.colorSpace = THREE.SRGBColorSpace;
  if (frame) {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.offset.set(frame.x / frame.imageWidth, 1 - (frame.y + frame.height) / frame.imageHeight);
    texture.repeat.set(frame.width / frame.imageWidth, frame.height / frame.imageHeight);
  } else {
    texture.wrapS = repeat[0] > 1 ? THREE.MirroredRepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.wrapT = repeat[1] > 1 ? THREE.MirroredRepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.repeat.set(...repeat);
  }
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function loadTexture(loader, record, baseUrl) {
  const url = new URL(record.filename, baseUrl);
  if (!url.href.startsWith(baseUrl.href)) {
    return Promise.resolve({ record, error: 'outside-asset-base' });
  }
  return new Promise(resolve => {
    loader.load(url.href, texture => {
      const frame = record.requiresAlpha ? inspectDecodedAlpha(texture.image) : null;
      if (record.requiresAlpha && !frame) {
        texture.dispose();
        resolve({ record, error: 'missing-decoded-alpha' });
        return;
      }
      resolve({ record, frame, texture: configureTexture(texture, record.repeat || [1, 1], frame) });
    }, undefined, () => resolve({ record, error: 'load-failed' }));
  });
}

export async function loadHotelAssets({ records = deliveredAssets, baseUrl = hotelBaseUrl } = {}) {
  const safeBaseUrl = baseUrl instanceof URL ? baseUrl : new URL(baseUrl, import.meta.url);
  const loader = new THREE.TextureLoader();
  const settled = await Promise.all(records.map(record => loadTexture(loader, record, safeBaseUrl)));
  const textures = new Map();
  const frames = new Map();
  const invalid = [];

  settled.forEach(result => {
    if (result.texture) {
      textures.set(result.record.role, result.texture);
      if (result.frame) frames.set(result.record.role, result.frame);
    }
    else invalid.push(`${result.record.role}:${result.error}`);
  });

  return {
    status: invalid.length ? `partial-${textures.size}` : `layered-${textures.size}`,
    textures,
    frames,
    invalid,
    pending: HOTEL_PENDING_LAYERS.filter(role => !textures.has(role)),
    dispose() {
      textures.forEach(texture => texture.dispose());
      textures.clear();
      frames.clear();
    },
  };
}

export const verifyDecodedAlpha = image => Boolean(inspectDecodedAlpha(image));
