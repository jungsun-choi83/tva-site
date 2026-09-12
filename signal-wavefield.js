import * as THREE from './vendor/three.module.js';

const clamp = value => Math.max(0, Math.min(1, value));

const vertexShader = `
  varying vec2 vUv;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vUv = uv;
  }
`;

// Adapted from HADAKA's public WaveMaterial: the zebra field is procedural,
// scroll-addressable and contains no background image or generated asset.
const fragmentShader = `
  uniform float time;
  uniform float y;
  uniform float density;
  uniform vec3 colorStart;
  varying vec2 vUv;

  float zebraNoise(vec2 uv) {
    const float uv2Multiplier = 1.542;
    float uvNoiseMultiplier = 0.7;
    float uv2NoiseMultiplier = 0.3;
    float noise = 0.0;
    float nx;
    float ny;
    float nz;
    float nw;

    float t = time;
    uv += vec2(t * 0.2, t * 0.3);
    uv.y -= y * 0.15;

    vec2 uv2 = uv * uv2Multiplier;
    uv2 += y * 0.1;
    nx = sin(uv2.x);
    nx -= cos(uv2.x / 2.0);
    ny = sin(uv2.y);
    nz = sin(uv2.y + nx);
    nx += y * 0.1;
    nw = nx + ny;

    vec2 uv2Noise = vec2(nz, nw);
    float sine = sin(t);
    float cosine = cos(t);
    uv2Noise = vec2(
      uv2Noise.x * cosine - uv2Noise.y * sine,
      uv2Noise.x * sine + uv2Noise.y * cosine
    );
    uv += uv2Noise * uv2NoiseMultiplier;

    uv *= vec2(2.0, density);
    nx = uv.y;
    ny = sin(uv.x);
    nz = abs(fract(nx + ny) - 0.5);
    nw = nz * uvNoiseMultiplier;
    noise += nw;
    return noise;
  }

  vec3 permute(vec3 value) {
    return mod(((value * 34.0) + 1.0) * value, 289.0);
  }

  float simplexNoise(vec2 value) {
    const vec4 constants = vec4(
      0.211324865405187,
      0.366025403784439,
      -0.577350269189626,
      0.024390243902439
    );
    vec2 index = floor(value + dot(value, constants.yy));
    vec2 x0 = value - index + dot(index, constants.xx);
    vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + constants.xxzz;
    x12.xy -= i1;
    index = mod(index, 289.0);
    vec3 permutation = permute(
      permute(index.y + vec3(0.0, i1.y, 1.0)) +
      index.x + vec3(0.0, i1.x, 1.0)
    );
    vec3 weight = max(
      0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
      0.0
    );
    weight *= weight;
    weight *= weight;
    vec3 x = 2.0 * fract(permutation * constants.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    weight *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 gradient;
    gradient.x = a0.x * x0.x + h.x * x0.y;
    gradient.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(weight, gradient);
  }

  void main() {
    float noise = zebraNoise(vUv * vec2(10.0));
    float feather = fwidth(vUv.y) * 0.5;
    float strength = smoothstep(-feather + 0.105, feather + 0.122, noise);
    strength = clamp(strength, 0.0, 1.0);
    float colorNoise = simplexNoise(vUv * 2.0 + sin(time * 0.8));
    vec3 paperLine = vec3(0.47, 0.44, 0.36);
    vec3 oliveLine = vec3(0.31, 0.34, 0.25);
    float warmth = smoothstep(-0.45, 0.8, colorNoise) * 0.18;
    float edge = smoothstep(0.16, 0.49, abs(vUv.x - 0.5));
    float horizon = smoothstep(0.58, 1.0, vUv.y);
    float linePresence = strength * (0.035 + edge * 0.36 + horizon * 0.15);
    vec3 lineColor = mix(oliveLine, paperLine, warmth + horizon * 0.18);
    gl_FragColor = vec4(mix(colorStart, lineColor, linePresence), 1.0);
  }
`;

export function initSignalWavefield(mount) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    mount.dataset.waveStatus = 'unavailable';
    return { draw() {}, resize() {} };
  }

  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'signal-wavefield-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  const cameraTravel = 7.5;
  camera.position.z = 5;
  const root = new THREE.Group();
  scene.add(root);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 3 },
      y: { value: 0 },
      density: { value: 2.35 },
      colorStart: { value: new THREE.Color('#11140f') }
    },
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    extensions: { derivatives: true }
  });
  const plane = new THREE.Mesh(geometry, material);
  plane.position.z = -8;
  root.add(plane);
  let width = 0;
  let height = 0;

  function resize() {
    width = mount.clientWidth || window.innerWidth;
    height = mount.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    const distance = camera.position.z - plane.position.z;
    const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
    const baseHeight = visibleHeight * 1.4;
    const extendedHeight = baseHeight + cameraTravel;
    plane.scale.set(baseHeight * camera.aspect, extendedHeight, 1);
    plane.position.y = -cameraTravel * .5;
    const uv = geometry.attributes.uv;
    for (let index = 0; index < uv.count; index++) {
      const originalY = geometry.attributes.position.getY(index) + .5;
      uv.setY(index, originalY * extendedHeight / baseHeight - cameraTravel / baseHeight);
    }
    uv.needsUpdate = true;
  }

  function draw(progress = 0, reduced = false) {
    if (mount.clientWidth !== width || mount.clientHeight !== height) resize();
    const value = reduced ? 0.56 : clamp(Number(progress) || 0);
    camera.position.y = -cameraTravel * value;
    root.position.y = 0;
    root.position.z = 0;
    material.uniforms.time.value = 3;
    material.uniforms.y.value = value * 13.5;
    material.uniforms.density.value = 2.28;
    renderer.render(scene, camera);
    mount.dataset.waveStatus = 'rendered';
  }

  resize();
  mount.dataset.waveStatus = 'ready';
  return { draw, resize };
}
