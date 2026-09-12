import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { mergeVertices } from './vendor/utils/BufferGeometryUtils.js';

export const HUMAN_STYLES = Object.freeze({
  manCasual: './assets/ending/r13-humans/man-casual.glb',
  manHoodie: './assets/ending/r13-humans/man-hoodie.glb',
  womanCasual: './assets/ending/r13-humans/woman-casual.glb',
  womanFormal: './assets/ending/r13-humans/woman-formal.glb',
});

const loader = new GLTFLoader();
const assets = new Map();
const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const lerp = (from, to, amount) => from + (to - from) * amount;

function load(style) {
  const url = HUMAN_STYLES[style] || HUMAN_STYLES.manCasual;
  if (!assets.has(url)) assets.set(url, loader.loadAsync(url));
  return assets.get(url);
}

function mutedSmoothMaterials(root) {
  root.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.geometry.deleteAttribute('normal');
    object.geometry = mergeVertices(object.geometry, 1e-4);
    object.geometry.computeVertexNormals();
    const source = Array.isArray(object.material) ? object.material : [object.material];
    const adjusted = source.map(material => {
      const next = material.clone();
      if (next.color) {
        const hsl = {}; next.color.getHSL(hsl);
        next.color.setHSL(hsl.h, hsl.s * .78, Math.min(.78, hsl.l * .92));
      }
      next.flatShading = false;
      if ('roughness' in next) next.roughness = .82;
      if ('metalness' in next) next.metalness = 0;
      next.needsUpdate = true;
      return next;
    });
    object.material = Array.isArray(object.material) ? adjusted : adjusted[0];
  });
}

function node(root, name) {
  const sanitized = THREE.PropertyBinding.sanitizeNodeName(name);
  let resolved = null;
  root.traverse(object => {
    if (!resolved && object.isBone && (object.name === name || object.name === sanitized)) resolved = object;
  });
  if (!resolved) throw new Error(`Required human rig bone missing: ${name}`);
  return resolved;
}

function selectClip(human, name, normalizedTime, weight = 1) {
  const action = human.actions[name] || human.actions.Idle_Neutral || human.actions.Idle;
  if (!action) return;
  for (const candidate of Object.values(human.actions)) candidate.weight = candidate === action ? weight : 0;
  action.enabled = true;
  action.paused = false;
  action.play();
  const duration = action.getClip().duration || 1;
  human.mixer.setTime((((normalizedTime % 1) + 1) % 1) * duration);
}

export async function preloadHumans(styles = Object.keys(HUMAN_STYLES)) {
  await Promise.all(styles.map(load));
}

export async function createHuman(options = {}) {
  const style = typeof options === 'string' ? options : options.style || options.model || 'manCasual';
  const gltf = await new Promise((resolve, reject) => loader.load(HUMAN_STYLES[style] || HUMAN_STYLES.manCasual, resolve, undefined, reject));
  const model = gltf.scene;
  mutedSmoothMaterials(model);
  model.updateMatrixWorld(true);
  model.traverse(object => {
    if (!object.isSkinnedMesh) return;
    object.skeleton.update();
    object.computeBoundingBox();
  });
  const bounds = new THREE.Box3().setFromObject(model);
  const height = Math.max(.001, bounds.max.y - bounds.min.y);
  const root = new THREE.Group();
  const normalized = new THREE.Group();
  normalized.scale.setScalar(2.5 / height);
  normalized.position.y = -bounds.min.y * (2.5 / height);
  normalized.add(model);
  root.add(normalized);
  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(gltf.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  Object.values(actions).forEach(action => { action.enabled = true; action.play(); action.weight = 0; });
  const body = node(model, 'Body'), head = node(model, 'Head');
  const leftArm = { upper: node(model, 'UpperArm.L'), fore: node(model, 'LowerArm.L'), hand: node(model, 'Wrist.L') };
  const rightArm = { upper: node(model, 'UpperArm.R'), fore: node(model, 'LowerArm.R'), hand: node(model, 'Wrist.R') };
  const leftLeg = { upper: node(model, 'UpperLeg.L'), lower: node(model, 'LowerLeg.L'), shoe: node(model, 'Foot.L') };
  const rightLeg = { upper: node(model, 'UpperLeg.R'), lower: node(model, 'LowerLeg.R'), shoe: node(model, 'Foot.R') };
  const human = { root, normalized, model, body, head, leftArm, rightArm, leftLeg, rightLeg, mixer, actions, clips: gltf.animations, style, sourceHeight: height, normalizationScale: 2.5 / height };
  poseHumanIdle(human, 0);
  human.neutralBodyQuaternion = body.quaternion.clone();
  return human;
}

export function poseHumanIdle(human, phase = 0) {
  selectClip(human, human.actions.Idle_Neutral ? 'Idle_Neutral' : 'Idle', phase, 1);
}

export function poseHumanWalk(human, phase, weight = 1) {
  const amount = clamp01(weight);
  const walk = human.actions.Walk;
  const idle = human.actions.Idle_Neutral || human.actions.Idle;
  if (!walk) return poseHumanIdle(human, phase);
  walk.enabled = true; walk.play(); walk.weight = amount;
  if (idle) { idle.enabled = true; idle.play(); idle.weight = 1 - amount; }
  const duration = walk.getClip().duration || 1;
  human.mixer.setTime((((phase % 1) + 1) % 1) * duration);
}

export function poseHumanConversation(human, phase = 0) {
  selectClip(human, human.actions.Interact ? 'Interact' : 'Idle_Neutral', phase, 1);
  human.body.quaternion.copy(human.neutralBodyQuaternion);
  human.body.updateMatrixWorld(true);
}

function aimBone(human, bone, direction) {
  human.model.updateMatrixWorld(true);
  const worldDirection = direction.clone().normalize();
  worldDirection.applyQuaternion(human.model.getWorldQuaternion(new THREE.Quaternion()));
  const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  worldDirection.applyQuaternion(parentWorld).normalize();
  bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), worldDirection);
  bone.updateMatrixWorld(true);
}

function placeFootAtCalf(human, leg, side) {
  human.model.updateMatrixWorld(true);
  const endpoint = leg.lower.localToWorld(new THREE.Vector3(0, .43, 0));
  leg.shoe.position.copy(leg.shoe.parent.worldToLocal(endpoint));
  const outward = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side * .04);
  leg.shoe.quaternion.copy(human.readerBase[side < 0 ? 'leftFootQuaternion' : 'rightFootQuaternion']).multiply(outward);
  leg.shoe.updateMatrixWorld(true);
}

export function poseHumanReader(human, amount = 1) {
  const t = clamp01(amount);
  poseHumanIdle(human, .18);
  if (!human.readerBase) {
    human.readerBase = {
      bodyPosition: human.body.position.clone(),
      bodyQuaternion: human.body.quaternion.clone(),
      headQuaternion: human.head.quaternion.clone(),
      leftFootQuaternion: human.leftLeg.shoe.quaternion.clone(),
      rightFootQuaternion: human.rightLeg.shoe.quaternion.clone(),
    };
  }
  human.body.position.copy(human.readerBase.bodyPosition);
  human.body.quaternion.copy(human.readerBase.bodyQuaternion);
  human.head.quaternion.copy(human.readerBase.headQuaternion);
  human.body.position.y -= .22 * t;
  aimBone(human, human.leftLeg.upper, new THREE.Vector3(-.08, lerp(-1, -.1, t), .88 * t));
  aimBone(human, human.rightLeg.upper, new THREE.Vector3(.08, lerp(-1, -.1, t), .88 * t));
  aimBone(human, human.leftLeg.lower, new THREE.Vector3(-.03, -.96, -.12 * t));
  aimBone(human, human.rightLeg.lower, new THREE.Vector3(.03, -.96, -.12 * t));
  placeFootAtCalf(human, human.leftLeg, -1);
  placeFootAtCalf(human, human.rightLeg, 1);
  aimBone(human, human.leftArm.upper, new THREE.Vector3(.18, lerp(-1, -.45, t), .72 * t));
  aimBone(human, human.rightArm.upper, new THREE.Vector3(-.18, lerp(-1, -.45, t), .72 * t));
  aimBone(human, human.leftArm.fore, new THREE.Vector3(.28, -.12, .92));
  aimBone(human, human.rightArm.fore, new THREE.Vector3(-.28, -.12, .92));
  human.head.rotateX(.16 * t);
}

export const poseSeatedReader = poseHumanReader;

export function disposeHuman(human) {
  human.mixer.stopAllAction();
  human.model.traverse(object => {
    if (!object.isMesh) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
  });
}
