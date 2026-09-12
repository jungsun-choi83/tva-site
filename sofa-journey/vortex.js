import * as THREE from '../vendor/three.module.js';

const clamp = v => Math.max(0, Math.min(1, Number(v) || 0));

const SELFIES = Array.from({ length: 16 }, (_, i) =>
  `era-selfie-${String(i + 1).padStart(2, '0')}.png`,
);

const FIELDS = ['hx-anadol-01.png', 'hx-anadol-02.png', 'hx-anadol-03.png'];

const vUrl = (folder, name) => {
  const u = new URL(`./assets/${folder}/${name}`, import.meta.url);
  u.searchParams.set('v', 'eternal-beam-r49');
  return u.href;
};

const INK = 0x0d0d0f;

function techFieldMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uSuck: { value: 0 },
      uFieldA: { value: null },
      uFieldB: { value: null },
    },
    vertexShader: `
      varying vec3 vPos;
      void main(){
        vPos=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uSuck;
      uniform sampler2D uFieldA;
      uniform sampler2D uFieldB;
      varying vec3 vPos;
      void main(){
        vec3 dir=normalize(vPos);
        float t=uTime;
        float r=length(dir.xy);
        float a=atan(dir.y,dir.x);
        float spin=.12+1.85*uSuck;
        a+=t*spin + r*(1.1+5.8*uSuck);
        float rr=mix(r, pow(r,.72), uSuck*.7);
        vec2 uv=vec2(fract(a*0.1591549 + .5), clamp(rr*.52 + .2 + dir.z*.08, .0, .99));
        vec2 uv2=uv+vec2(.17 + t*.012, t*.008);
        vec3 aCol=texture2D(uFieldA, uv).rgb;
        vec3 bCol=texture2D(uFieldB, fract(uv2)).rgb;
        vec3 col=mix(aCol, bCol, .28 + .18*sin(t*.21));
        float hole=smoothstep(.16,.015,r*(1.+uSuck*1.55));
        vec3 ink=vec3(.051,.051,.059);
        vec3 gold=vec3(.784,.631,.369);
        vec3 cyan=vec3(.18,.58,.64);
        col=mix(col, col*vec3(.92,.88,.78), .12);
        col+=gold*pow(1.-r, 5.)*.07;
        col+=cyan*pow(max(dir.y,0.), 2.2)*.05;
        col=mix(col, ink, hole);
        col*=.55 + .45*smoothstep(.08,.7,r);
        col=mix(col, ink, smoothstep(.72, 1.15, r)*.45);
        gl_FragColor=vec4(col,1.);
      }
    `,
  });
}

function particleMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uSuck: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      uniform float uSuck;
      attribute float aSeed;
      attribute float aSize;
      varying float vA;
      varying vec3 vC;
      void main(){
        float t=uTime*(.08+.06*aSeed);
        vec3 p=position;
        float ang=t*(.32+uSuck*1.4)+aSeed*6.28;
        float c=cos(ang),s=sin(ang);
        p.xy=mat2(c,-s,s,c)*p.xy;
        p*=mix(1.,.07,uSuck);
        p.z+=uSuck*-10.;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_PointSize=aSize*(62./max(1.2,-mv.z));
        gl_Position=projectionMatrix*mv;
        vA=mix(.04,.11,aSeed)*(1.-uSuck*.4);
        vC=mix(vec3(.78,.63,.37), vec3(.22,.72,.76), aSeed);
      }
    `,
    fragmentShader: `
      varying float vA;
      varying vec3 vC;
      void main(){
        vec2 d=gl_PointCoord-.5;
        float g=exp(-dot(d,d)*11.);
        if(g<.02)discard;
        gl_FragColor=vec4(vC,g*vA);
      }
    `,
  });
}

function makeCloud(count, radius) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = radius * Math.pow(Math.random(), 0.42);
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = (Math.random() - 0.5) * r * 0.78;
    pos[i * 3 + 2] = Math.sin(a) * r * 0.32 + (Math.random() - 0.5) * 6;
    seed[i] = Math.random();
    size[i] = 0.35 + Math.random() * 1.15;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  return geo;
}

function loadTex(loader, url, repeat = false) {
  return new Promise(resolve => {
    loader.load(url, tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      if (repeat) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      }
      resolve(tex);
    }, undefined, () => resolve(null));
  });
}

function coverCrop(tex, frameW, frameH) {
  const img = tex.image;
  if (!img || !img.width) return tex;
  const imgAspect = img.width / img.height;
  const frameAspect = frameW / frameH;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  if (imgAspect > frameAspect) {
    tex.repeat.set(frameAspect / imgAspect, 1);
    tex.offset.set((1 - tex.repeat.x) * 0.5, 0);
  } else {
    tex.repeat.set(1, imgAspect / frameAspect);
    tex.offset.set(0, (1 - tex.repeat.y) * 0.28);
  }
  tex.needsUpdate = true;
  return tex;
}

function makePhotoFrame(map, rimMat, w, h) {
  const g = new THREE.Group();
  const rim = 0.032;
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w + rim * 2, h + rim * 2, 0.04), rimMat));
  const photo = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map, toneMapped: true, side: THREE.DoubleSide }),
  );
  photo.position.z = 0.024;
  g.add(photo);
  g.userData.photo = photo;
  return g;
}

export function createHallucinationVortex(mount) {
  const canvas = document.createElement('canvas');
  canvas.className = 'sofa-journey__vortex';
  canvas.setAttribute('aria-hidden', 'true');

  let renderer, scene, camera, webgl = false;
  let fluid, fluidMat, dust, dustMat, tvs;
  let w = 0, h = 0, raf = 0, last = null;
  let selfieMaps = [];

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xb7b0a4,
    metalness: 0.72,
    roughness: 0.32,
    emissive: 0x2a261c,
    emissiveIntensity: 0.18,
  });

  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
    });
    renderer.setClearColor(INK, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(INK);
    scene.fog = new THREE.FogExp2(INK, 0.028);
    camera = new THREE.PerspectiveCamera(56, 1, 0.08, 90);

    fluidMat = techFieldMaterial();
    const inkTex = new THREE.DataTexture(new Uint8Array([13, 13, 15, 255]), 1, 1);
    inkTex.needsUpdate = true;
    fluidMat.uniforms.uFieldA.value = inkTex;
    fluidMat.uniforms.uFieldB.value = inkTex;
    fluid = new THREE.Mesh(new THREE.SphereGeometry(24, 72, 52), fluidMat);
    scene.add(fluid);

    dustMat = particleMaterial();
    dust = new THREE.Points(makeCloud(1600, 10), dustMat);
    scene.add(dust);

    scene.add(new THREE.AmbientLight(0x3a362c, 0.55));
    scene.add(new THREE.PointLight(0xc8a15e, 3.4, 22).translateZ(5).translateY(1.2));
    scene.add(new THREE.PointLight(0x2aa8b0, 2.8, 18).translateX(-2.4).translateY(0.8));

    tvs = new THREE.Group();
    scene.add(tvs);
    webgl = true;
  } catch {
    webgl = false;
  }

  function spawnFrames(maps) {
    if (!webgl || !maps.length) return;
    selfieMaps = maps;
    const rnd = (i, k) => {
      const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const count = 32;
    for (let i = 0; i < count; i++) {
      const a = rnd(i, 1), b = rnd(i, 2), c = rnd(i, 3), d = rnd(i, 4);
      const ring = Math.pow(a * 0.75 + 0.25, 0.7);
      let rad = 2.05 + ring * 4.35 + (b - 0.5) * 0.7;
      const ang = i * 2.399 + b * 1.9 + c * 0.55;
      let x = Math.cos(ang) * rad;
      let y = (c - 0.5) * 3.4 + Math.sin(ang * 1.15) * 0.45;
      const hole = Math.hypot(x, y * 0.82);
      if (hole < 2.2) {
        const boost = 2.25 / Math.max(0.2, hole);
        x *= boost;
        y *= boost;
        rad = Math.hypot(x, y);
      }
      const near = clamp((rad - 2.0) / 4.8);
      const depth = 1 - near;
      const scale = 0.22 + near * 0.92 + (c - 0.5) * 0.22;
      const fw = Math.max(0.28, 0.92 * scale);
      const fh = fw * (1.08 + d * 0.28);
      const frame = makePhotoFrame(maps[i % maps.length], rimMat, fw, fh);
      const home = {
        x,
        y,
        z: -9.8 + near * 12.4 + (d - 0.5) * 1.8,
        rad, ang,
      };
      frame.position.set(home.x, home.y, home.z);
      frame.userData = {
        ...frame.userData,
        home, depth, seed: a * 12.7 + i, spin: 0.55 + b * 1.5, tilt: (c - 0.5) * 0.7,
        twist: (d - 0.5) * 0.55, mapIndex: i % maps.length, fw, fh,
      };
      tvs.add(frame);
    }
  }

  if (webgl) {
    const loader = new THREE.TextureLoader();
    Promise.all([
      ...FIELDS.map(name => loadTex(loader, vUrl('bg', name), true)),
      ...SELFIES.map(name => loadTex(loader, vUrl('selfies', name))),
    ]).then(all => {
      const fields = all.slice(0, FIELDS.length).filter(Boolean);
      const pets = all.slice(FIELDS.length).filter(Boolean);
      pets.forEach(tex => coverCrop(tex, 1, 1.22));
      if (fields[0]) fluidMat.uniforms.uFieldA.value = fields[0];
      if (fields[1] || fields[0]) fluidMat.uniforms.uFieldB.value = fields[1] || fields[0];
      spawnFrames(pets);
    });
  }

  function resize() {
    w = mount.clientWidth || innerWidth;
    h = mount.clientHeight || innerHeight;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    if (!webgl || !w || !h) return;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function paint(state) {
    last = state;
    if (!w) resize();
    const p = state?.p || 0;
    const reduced = !!state?.reduced;
    const hide = reduced || p > .78 || p < .01;
    canvas.style.opacity = hide ? '0' : String((1 - clamp((p - .70) / .08)));
    if (!webgl || hide) return;

    const suck = Math.pow(clamp(p / .68), 0.82);
    const t = (state.now || performance.now()) * 0.001;
    fluidMat.uniforms.uTime.value = t;
    fluidMat.uniforms.uSuck.value = suck;
    dustMat.uniforms.uTime.value = t;
    dustMat.uniforms.uSuck.value = suck;

    camera.position.set(
      Math.sin(t * 0.11) * 0.06,
      0.18 + Math.sin(t * 0.09) * 0.04,
      8.6 - suck * 15.5,
    );
    camera.lookAt(0, 0.06, camera.position.z - 8);
    camera.fov = 54 + suck * 20;
    camera.updateProjectionMatrix();

    if (tvs && selfieMaps.length) {
      tvs.children.forEach(frame => {
        const { home, depth, seed, spin, tilt } = frame.userData;
        const pull = suck * (0.18 + depth * 1.05);
        const ang = home.ang + suck * (1.15 + spin) + t * (0.03 + suck * 0.48) * spin;
        const rad = home.rad * (1 - pull * 0.88);
        frame.position.x = Math.cos(ang) * rad;
        frame.position.y = home.y * (1 - pull * 0.7) - pull * 1.35 + Math.sin(t * 0.22 + seed) * 0.07;
        frame.position.z = home.z - pull * 10.4;
        const s = Math.max(0.07, 1 - pull * 0.74);
        frame.scale.setScalar(s);
        frame.lookAt(camera.position);
        frame.rotateX(tilt * 0.35 + Math.sin(t * 0.17 + seed) * 0.05);
        frame.rotateZ(frame.userData.twist + suck * 0.55 + Math.sin(t * 0.29 + seed) * 0.07);

        const next = Math.floor(t / 2.6 + seed) % selfieMaps.length;
        if (next !== frame.userData.mapIndex) {
          frame.userData.mapIndex = next;
          const photo = frame.userData.photo;
          photo.material.map = selfieMaps[next];
          photo.material.needsUpdate = true;
        }
      });
    }

    fluid.rotation.z = t * (0.08 + suck * 1.15);
    fluid.rotation.y = t * 0.03;
    renderer.render(scene, camera);
  }

  function loop() {
    raf = 0;
    if (!mount.classList.contains('is-live') || !last || last.p > .78) return;
    paint({ ...last, now: performance.now() });
    raf = requestAnimationFrame(loop);
  }

  function draw(state) {
    paint(state);
    if (!raf && webgl && mount.classList.contains('is-live') && state.p < .78 && !state.reduced) {
      raf = requestAnimationFrame(loop);
    }
  }

  function dispose() {
    cancelAnimationFrame(raf);
    if (webgl) {
      fluid.geometry.dispose();
      fluidMat.dispose();
      dust.geometry.dispose();
      dustMat.dispose();
      rimMat.dispose();
      tvs.children.forEach(frame => {
        frame.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        });
      });
      renderer.dispose();
    }
    canvas.remove();
  }

  resize();
  mount.append(canvas);
  return { canvas, draw, resize, dispose, webgl };
}
