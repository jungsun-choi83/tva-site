const manifestURL = new URL('../assets/studio-stickers/manifest-transparent.json', import.meta.url);
const assetBaseURL = new URL('../assets/studio-stickers/', import.meta.url);

let manifestPromise = null;

function normalizeAsset(asset, index) {
  const width = Number(asset?.width);
  const height = Number(asset?.height);
  const bounds = Array.isArray(asset?.boundsPixels) ? asset.boundsPixels.map(Number) : [];
  if (!asset?.id || !asset?.file || !asset.hasRealTransparency
    || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0
    || bounds.length !== 4 || !bounds.every(Number.isFinite)
    || bounds[0] < 0 || bounds[1] < 0 || bounds[2] <= bounds[0] || bounds[3] <= bounds[1]
    || bounds[2] > width || bounds[3] > height) {
    throw new TypeError(`Invalid transparent sticker record at index ${index}.`);
  }
  const url = new URL(asset.file, assetBaseURL);
  if (!url.href.startsWith(assetBaseURL.href)) throw new TypeError(`Sticker path escapes its asset directory: ${asset.id}.`);
  return Object.freeze({
    id: String(asset.id),
    url: url.href,
    width,
    height,
    bounds: Object.freeze({
      left: bounds[0] / width,
      top: bounds[1] / height,
      right: bounds[2] / width,
      bottom: bounds[3] / height,
    }),
  });
}

export function loadStudioStickerManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(manifestURL, { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error(`Sticker manifest request failed with ${response.status}.`);
    const manifest = await response.json();
    if (manifest?.schemaVersion !== 1 || manifest?.kind !== 'individual-transparent-stickers') {
      throw new TypeError('Sticker manifest contract is invalid.');
    }
    const assets = (manifest.assets || []).map(normalizeAsset);
    if (assets.length !== 20 || new Set(assets.map(asset => asset.id)).size !== 20) {
      throw new TypeError('Sticker manifest must contain exactly 20 unique transparent assets.');
    }
    return Object.freeze(assets);
  }).catch(error => {
    manifestPromise = null;
    throw error;
  });
  return manifestPromise;
}

export function mountStudioStickers(mount, wake = () => {}) {
  let disposed = false;
  mount.dataset.stickerStatus = 'loading';
  loadStudioStickerManifest().then(assets => {
    if (disposed) return;
    const fragment = mount.ownerDocument.createDocumentFragment();
    assets.forEach((asset, index) => {
      const image = mount.ownerDocument.createElement('img');
      image.className = 'fall-cta__sticker';
      image.alt = '';
      image.decoding = 'async';
      image.draggable = false;
      image.src = asset.url;
      image.dataset.stickerId = asset.id;
      image.dataset.stickerIndex = String(index);
      image.dataset.boundLeft = String(asset.bounds.left);
      image.dataset.boundTop = String(asset.bounds.top);
      image.dataset.boundRight = String(asset.bounds.right);
      image.dataset.boundBottom = String(asset.bounds.bottom);
      image.dataset.intrinsicWidth = String(asset.width);
      image.dataset.intrinsicHeight = String(asset.height);
      fragment.append(image);
    });
    mount.replaceChildren(fragment);
    mount.dataset.stickerStatus = 'ready-20';
    wake();
  }).catch(error => {
    if (disposed) return;
    mount.dataset.stickerStatus = 'unavailable';
    mount.dataset.stickerError = error instanceof Error ? error.message : String(error);
  });
  return {
    dispose() {
      disposed = true;
      mount.replaceChildren();
      delete mount.dataset.stickerStatus;
      delete mount.dataset.stickerError;
    },
  };
}
