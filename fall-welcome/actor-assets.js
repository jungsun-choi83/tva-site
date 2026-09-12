export const ACTOR_ASSET_KIND = 'independent-pose-sequence';

export const ACTOR_GROUP_CONTRACTS = Object.freeze({
  fall: Object.freeze({
    minimumFrames: 7,
    states: Object.freeze({ surprise: 1, flail: 2, tuck: 1, relief: 1, wave: 2 }),
    motionStates: Object.freeze(['flail', 'wave']),
  }),
  run: Object.freeze({
    minimumFrames: 6,
    states: Object.freeze({ cycle: 6 }),
    motionStates: Object.freeze(['cycle']),
  }),
  brake: Object.freeze({
    minimumFrames: 2,
    states: Object.freeze({ sequence: 2 }),
    motionStates: Object.freeze([]),
  }),
  service: Object.freeze({ minimumFrames: 4, states: null, motionStates: Object.freeze([]) }),
  archive: Object.freeze({ minimumFrames: 4, states: null, motionStates: Object.freeze([]) }),
});

const activeGroups = new Map();
const listeners = new Set();
let lastError = null;

const isUnit = value => Number.isFinite(value) && value >= 0 && value <= 1;

function freezePoint(value, label) {
  if (!value || !isUnit(Number(value.x)) || !isUnit(Number(value.y))) {
    throw new TypeError(`${label} must contain normalized x/y values.`);
  }
  return Object.freeze({ x: Number(value.x), y: Number(value.y) });
}

function freezeBounds(value, label) {
  if (!value) throw new TypeError(`${label} is required.`);
  const bounds = {
    left: Number(value.left),
    top: Number(value.top),
    right: Number(value.right),
    bottom: Number(value.bottom),
  };
  if (!Object.values(bounds).every(isUnit)
    || bounds.left >= bounds.right
    || bounds.top >= bounds.bottom) {
    throw new TypeError(`${label} must be normalized and non-empty.`);
  }
  return Object.freeze(bounds);
}

function resolveBaseURL(baseURL) {
  if (typeof baseURL !== 'string' || !baseURL.trim()) {
    throw new TypeError('A browser-served baseURL is required.');
  }
  const resolved = new URL(baseURL, import.meta.url);
  if (!resolved.pathname.endsWith('/')) resolved.pathname += '/';
  return resolved;
}

function normalizePose(raw, baseURL) {
  if (!raw || typeof raw !== 'object') throw new TypeError('Each pose must be an object.');
  const id = String(raw.id || '').trim();
  const group = String(raw.group || '').trim();
  const state = String(raw.state || '').trim();
  const file = String(raw.file || '').trim();
  const width = Number(raw.width);
  const height = Number(raw.height);
  const order = Number(raw.order ?? 0);
  if (!id || !group || !state || !file) throw new TypeError('Pose id, group, state, and file are required.');
  if (!ACTOR_GROUP_CONTRACTS[group]) throw new TypeError(`Unknown actor group: ${group}.`);
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new TypeError(`${id} must declare positive intrinsic width and height.`);
  }
  if (!Number.isInteger(order) || order < 0) throw new TypeError(`${id} order must be a non-negative integer.`);
  return Object.freeze({
    id,
    group,
    state,
    order,
    src: new URL(file, baseURL).href,
    file,
    width,
    height,
    bodyAnchor: freezePoint(raw.bodyAnchor, `${id}.bodyAnchor`),
    footAnchor: freezePoint(raw.footAnchor, `${id}.footAnchor`),
    bounds: freezeBounds(raw.bounds, `${id}.bounds`),
    motionModel: ACTOR_ASSET_KIND,
  });
}

function inferPoseState(id, group, animations) {
  if (group === 'fall') {
    if (animations?.flail?.includes(id)) return 'flail';
    if (animations?.wave?.includes(id)) return 'wave';
    if (id.includes('surprise')) return 'surprise';
    if (id.includes('panic') || id.includes('flail')) return 'flail';
    if (id.includes('brace') || id.includes('tuck')) return 'tuck';
    if (id.includes('wave')) return 'wave';
    if (id.includes('relief')) return 'relief';
  }
  if (group === 'run') return 'cycle';
  if (group === 'brake') return 'sequence';
  for (const [state, ids] of Object.entries(animations || {})) {
    if (Array.isArray(ids) && ids.includes(id)) return state;
  }
  return id;
}

function manifestPoses(manifest) {
  if (Array.isArray(manifest.poses)) return manifest.poses;
  if (!manifest.poses || typeof manifest.poses !== 'object') return [];
  const entries = [...Object.entries(manifest.poses), ...Object.entries(manifest.supplementaryPoses || {})]
    .filter(([id, pose], index, all) => all.findIndex(([, candidate]) => candidate.file === pose.file) === index);
  return entries.map(([id, pose], index) => {
    const group = String(pose.group || id.split('-')[0]);
    const state = String(pose.state || inferPoseState(id, group, manifest.animations));
    const sequence = manifest.animations?.[state];
    const sequenceIndex = Array.isArray(sequence) ? sequence.indexOf(id) : -1;
    return {
      ...pose,
      id,
      group,
      state,
      order: pose.order ?? (sequenceIndex >= 0 ? sequenceIndex : index),
    };
  });
}

function validateGroup(group, poses) {
  const contract = ACTOR_GROUP_CONTRACTS[group];
  if (poses.length < contract.minimumFrames) {
    throw new TypeError(`${group} requires at least ${contract.minimumFrames} distinct pose files.`);
  }
  if (new Set(poses.map(pose => pose.src)).size !== poses.length) {
    throw new TypeError(`${group} requires a distinct source file for every pose frame.`);
  }
  if (!contract.states) return;
  const stateCounts = new Map();
  poses.forEach(pose => stateCounts.set(pose.state, (stateCounts.get(pose.state) || 0) + 1));
  Object.entries(contract.states).forEach(([state, minimum]) => {
    if ((stateCounts.get(state) || 0) < minimum) {
      throw new TypeError(`${group}.${state} requires at least ${minimum} distinct pose file${minimum === 1 ? '' : 's'}.`);
    }
  });
}

function hasTransparentCorner(image, ownerDocument) {
  const canvas = ownerDocument.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  const points = [
    [0, 0],
    [image.naturalWidth - 1, 0],
    [0, image.naturalHeight - 1],
    [image.naturalWidth - 1, image.naturalHeight - 1],
  ];
  points.forEach(([x, y], index) => {
    context.drawImage(image, x, y, 1, 1, index % 2, Math.floor(index / 2), 1, 1);
  });
  const pixels = context.getImageData(0, 0, 2, 2).data;
  return [3, 7, 11, 15].some(index => pixels[index] < 32);
}

function preloadPose(pose, ownerDocument) {
  const ImageCtor = ownerDocument?.defaultView?.Image;
  if (!ImageCtor) throw new TypeError('installActorAssetManifest requires a browser document.');
  return new Promise((resolve, reject) => {
    const image = new ImageCtor();
    const finish = async () => {
      if (image.naturalWidth !== pose.width || image.naturalHeight !== pose.height) {
        reject(new Error(`${pose.id} intrinsic dimensions do not match its manifest.`));
        return;
      }
      try {
        if (typeof image.decode === 'function') await image.decode();
        if (!hasTransparentCorner(image, ownerDocument)) {
          reject(new Error(`${pose.id} has no verified transparent canvas padding.`));
          return;
        }
        resolve();
      } catch (error) {
        reject(new Error(`${pose.id} could not be decoded.`, { cause: error }));
      }
    };
    image.onload = finish;
    image.onerror = () => reject(new Error(`${pose.id} could not be loaded from ${pose.src}.`));
    image.src = pose.src;
  });
}

function makeGroup(group, poses) {
  const ordered = Object.freeze([...poses].sort((a, b) => a.state.localeCompare(b.state) || a.order - b.order));
  const states = new Map();
  ordered.forEach(pose => {
    if (!states.has(pose.state)) states.set(pose.state, []);
    states.get(pose.state).push(pose);
  });
  states.forEach((frames, state) => states.set(state, Object.freeze([...frames].sort((a, b) => a.order - b.order))));
  return Object.freeze({
    name: group,
    motionModel: ACTOR_ASSET_KIND,
    poses: ordered,
    getFrames: state => states.get(state) || Object.freeze([]),
  });
}

export async function installActorAssetManifest(manifest, { baseURL = manifest?.baseURL, ownerDocument, groups } = {}) {
  if (!manifest || Number(manifest.schemaVersion) !== 1 || manifest.kind !== ACTOR_ASSET_KIND) {
    throw new TypeError(`Actor manifest must use schemaVersion 1 and kind "${ACTOR_ASSET_KIND}".`);
  }
  const manifestEntries = manifestPoses(manifest);
  if (!manifestEntries.length) throw new TypeError('Actor manifest poses must be a non-empty collection.');
  const resolvedBaseURL = resolveBaseURL(baseURL);
  const selectedGroups = Array.isArray(groups) ? new Set(groups) : null;
  const poses = manifestEntries
    .map(raw => normalizePose(raw, resolvedBaseURL))
    .filter(pose => !selectedGroups || selectedGroups.has(pose.group));
  if (!poses.length) throw new TypeError('Actor manifest has no poses for the requested groups.');
  const ids = new Set();
  poses.forEach(pose => {
    if (ids.has(pose.id)) throw new TypeError(`Duplicate actor pose id: ${pose.id}.`);
    ids.add(pose.id);
  });
  const stagedGroups = new Map();
  poses.forEach(pose => {
    if (!stagedGroups.has(pose.group)) stagedGroups.set(pose.group, []);
    stagedGroups.get(pose.group).push(pose);
  });
  stagedGroups.forEach((groupPoses, group) => validateGroup(group, groupPoses));
  const documentRef = ownerDocument || (typeof document === 'undefined' ? null : document);
  await Promise.all(poses.map(pose => preloadPose(pose, documentRef)));
  stagedGroups.forEach((groupPoses, group) => activeGroups.set(group, makeGroup(group, groupPoses)));
  lastError = null;
  const installed = Object.freeze([...stagedGroups.keys()]);
  listeners.forEach(listener => listener(installed));
  return getActorAssetStatus();
}

export function getActorPose(id) {
  for (const group of activeGroups.values()) {
    const pose = group.poses.find(candidate => candidate.id === id);
    if (pose) return pose;
  }
  return null;
}

export function getActorFrames(group, state) {
  return activeGroups.get(group)?.getFrames(state) || Object.freeze([]);
}

export function getActorGroupStatus(group) {
  const active = activeGroups.get(group);
  return Object.freeze({
    group,
    ready: Boolean(active),
    poseCount: active?.poses.length || 0,
    motionModel: active?.motionModel || ACTOR_ASSET_KIND,
  });
}

export function getActorAssetStatus() {
  return Object.freeze({
    kind: ACTOR_ASSET_KIND,
    groups: Object.freeze([...activeGroups.keys()]),
    poseCount: [...activeGroups.values()].reduce((total, group) => total + group.poses.length, 0),
    error: lastError,
  });
}

export function subscribeActorAssetManifest(listener) {
  if (typeof listener !== 'function') throw new TypeError('Actor manifest listener must be a function.');
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function installActorAssetManifestFromURL(url, { ownerDocument, groups } = {}) {
  const manifestURL = new URL(url, import.meta.url);
  const response = await fetch(manifestURL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Actor manifest request failed with ${response.status}.`);
  const manifest = await response.json();
  return installActorAssetManifest(manifest, {
    baseURL: new URL('./', manifestURL).href,
    ownerDocument,
    groups,
  });
}

const defaultActorManifests = Object.freeze([
  Object.freeze({
    url: new URL('../assets/mascot/manifest-fall.json', import.meta.url),
    groups: Object.freeze(['fall']),
  }),
  Object.freeze({
    url: new URL('../assets/mascot/manifest.json', import.meta.url),
    groups: Object.freeze(['run', 'brake', 'service', 'archive']),
  }),
]);

async function installDefaultActorManifests() {
  const failures = [];
  for (const { url, groups } of defaultActorManifests) {
    try {
      await installActorAssetManifestFromURL(url, { ownerDocument: document, groups });
    } catch (error) {
      failures.push(error);
    }
  }
  lastError = failures.length
    ? failures.map(error => error instanceof Error ? error.message : String(error)).join(' ')
    : null;
  return getActorAssetStatus();
}

export const actorAssetReady = typeof document === 'undefined'
  ? Promise.resolve(getActorAssetStatus())
  : installDefaultActorManifests();
