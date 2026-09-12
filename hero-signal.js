(() => {
  "use strict";

  const whenReady = (callback) => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", callback, { once: true });
    else callback();
  };

  whenReady(() => {
    const hero = document.querySelector(".hero");
    const signalCanvas = document.querySelector("#signalCanvas");
    const typeCanvas = document.querySelector("#typeCanvas");
    const title = document.querySelector("#hero-title");
    const modeMount = document.querySelector("#signalModes");
    const typeToggle = document.querySelector("#typeToggle");
    const stats = document.querySelector("#renderStats");
    if (!hero || !signalCanvas || !typeCanvas || !title || !modeMount || !typeToggle || !stats) return;
    const signalScreen = signalCanvas.closest(".signal-screen");
    if (!signalScreen) return;

    const modes = ["liquid", "wire", "dither"];
    const modeLabels = { liquid: "Liquid", wire: "Wire", dither: "Dither" };
    const modeButtons = [...modeMount.querySelectorAll("[data-signal-mode]")].filter((button) => modes.includes(button.dataset.signalMode));
    const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);
    const mediaMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const typeContext = typeCanvas.getContext("2d", { alpha: true });
    let mode = modeButtons.find((button) => button.getAttribute("aria-pressed") === "true")?.dataset.signalMode || "liquid";
    let reduced = false;
    let visible = true;
    let documentVisible = !document.hidden;
    let frame = 0;
    let previousTime = 0;
    let elapsed = 0;
    let lastFpsMark = 0;
    let framesSinceMark = 0;
    let fps = 0;
    let heroWidth = 1;
    let heroHeight = 1;
    let particles = [];
    let exploded = false;
    let assembling = false;
    let signalPointer = { x: -2, y: -2, active: false };
    let typePointer = { x: -2, y: -2, active: false };
    let shock = { x: 0.5, y: 0.5, at: -99 };

    const vertexSource = `
      attribute vec2 aPosition;
      void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
    `;
    const fragmentSource = `
      precision highp float;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform vec2 uPointer;
      uniform vec3 uShock;
      uniform float uMode;

      mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = .54;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p = rot(.65) * p * 2.03 + 4.3; a *= .5; }
        return v;
      }
      float surface(vec2 p, float t) {
        vec2 q = p;
        q += vec2(fbm(q * 1.2 + t * .08), fbm(q * 1.2 - t * .07)) * .38;
        float l = length(q * vec2(.88, 1.12));
        float scallop = sin(atan(q.y, q.x) * 5.0 + fbm(q * 3.0) * 3.0) * .055;
        return l - (.48 + scallop + fbm(q * 2.4 + t * .12) * .13);
      }
      vec3 palette(float v) {
        vec3 cobalt = vec3(.055, .14, .90);
        vec3 cyan = vec3(.20, .92, .94);
        vec3 cream = vec3(.965, .94, .84);
        vec3 yellow = vec3(.96, 1., .45);
        return mix(mix(cobalt, cyan, smoothstep(.12, .47, v)), mix(cream, yellow, smoothstep(.58, .9, v)), smoothstep(.42, .7, v));
      }
      void main() {
        vec2 uv = (gl_FragCoord.xy - .5 * uResolution.xy) / uResolution.y;
        float t = uTime;
        vec2 p = uv - vec2(.20, -.03);
        vec2 mouse = (uPointer - .5) * vec2(uResolution.x / uResolution.y, 1.0);
        vec2 delta = p - mouse;
        float md = length(delta) + .001;
        p += normalize(delta) * (.11 / (1.0 + md * 16.0)) * exp(-md * 2.6);
        vec2 click = (uShock.xy - .5) * vec2(uResolution.x / uResolution.y, 1.0);
        float waveDistance = length(p - click);
        float shockAge = max(0.0, t - uShock.z);
        p += normalize(p - click + .0001) * sin(waveDistance * 54. - shockAge * 12.) * exp(-shockAge * 1.6 - waveDistance * 3.1) * .16;
        p = rot(sin(t * .13) * .12) * p;
        float d = surface(p, t);
        float edge = smoothstep(.022, -.018, d);
        vec2 e = vec2(.003, 0.0);
        vec3 normal = normalize(vec3(surface(p + e.xy, t) - d, surface(p + e.yx, t) - d, .025));
        vec3 light = normalize(vec3(-.55, .66, .78));
        float diffuse = max(0., dot(normal, light));
        float fresnel = pow(1. - max(0., normal.z), 2.2);
        float bands = fbm(p * 3.1 + normal.xy * 2.2 + t * .05) + .19 * sin(p.x * 13. - p.y * 8. + t);
        vec3 chrome = palette(bands + diffuse * .24 + fresnel * .44);
        chrome += vec3(.2, .28, .42) * pow(max(0., dot(reflect(vec3(0., 0., -1.), normal), light)), 14.);
        vec3 backdrop = vec3(.055, .11, .61) + .10 * vec3(sin(uv.y * 8. + t), .25, .55);
        vec3 color = mix(backdrop, chrome, edge);
        float contour = 1.0 - smoothstep(.002, .012, abs(d));
        if (uMode > .5 && uMode < 1.5) {
          float meridian = abs(sin(atan(p.y, p.x) * 18. + t * .28));
          float latitude = abs(sin((length(p) + fbm(p * 2.0) * .06) * 74. - t * .45));
          float wire = smoothstep(.025, .0, min(meridian, latitude));
          color = mix(backdrop * .42, vec3(.15, .96, 1.), wire * edge);
          color += contour * vec3(1., .96, .62);
        } else if (uMode > 1.5) {
          vec3 quantized = floor(chrome * 4.0) / 4.0;
          float dots = step(.54, fract((gl_FragCoord.x + gl_FragCoord.y * 1.7) * .22 + bands * 3.));
          color = mix(backdrop * .72, quantized * (.54 + dots * .64), edge);
          color += contour * vec3(.96, 1., .45);
        } else {
          color += contour * vec3(.94, 1., .55) * .65;
        }
        float vignette = smoothstep(1.18, .18, length(uv));
        gl_FragColor = vec4(color * (.64 + vignette * .36), 1.0);
      }
    `;

    function compile(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message || "Shader compilation failed");
      }
      return shader;
    }

    function createRenderer() {
      const gl = signalCanvas.getContext("webgl", { alpha: true, antialias: false, powerPreference: "high-performance" }) || signalCanvas.getContext("experimental-webgl", { alpha: true, antialias: false });
      if (!gl) return null;
      try {
        const program = gl.createProgram();
        gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
        gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Shader link failed");
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, "aPosition");
        return { gl, program, position, buffer, uniforms: {
          resolution: gl.getUniformLocation(program, "uResolution"), time: gl.getUniformLocation(program, "uTime"),
          pointer: gl.getUniformLocation(program, "uPointer"), shock: gl.getUniformLocation(program, "uShock"), mode: gl.getUniformLocation(program, "uMode")
        }};
      } catch (error) {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return null;
      }
    }

    const renderer = createRenderer();
    if (!renderer) {
      hero.classList.add("webgl-unavailable");
      signalCanvas.setAttribute("aria-label", "Static signal. WebGL is unavailable.");
      stats.textContent = "STATIC SIGNAL · WEBGL UNAVAILABLE";
    }

    function updateStats(paused = false) {
      if (!renderer) return;
      stats.textContent = `${paused ? "PAUSED" : `${fps || "…"} FPS`} · WEBGL · ${modeLabels[mode]}`;
    }

    function resize() {
      const heroBounds = hero.getBoundingClientRect();
      const signalBounds = signalScreen.getBoundingClientRect();
      heroWidth = Math.max(1, Math.round(heroBounds.width));
      heroHeight = Math.max(1, Math.round(heroBounds.height));
      const ratio = dpr();
      signalCanvas.width = Math.max(1, Math.round(signalBounds.width * ratio));
      signalCanvas.height = Math.max(1, Math.round(signalBounds.height * ratio));
      typeCanvas.width = Math.round(heroWidth * ratio);
      typeCanvas.height = Math.round(heroHeight * ratio);
      typeContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (exploded) sampleParticles();
      renderImmediately();
    }

    function drawSignal() {
      if (!renderer) return;
      const { gl, program, position, buffer, uniforms } = renderer;
      gl.viewport(0, 0, signalCanvas.width, signalCanvas.height);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uniforms.resolution, signalCanvas.width, signalCanvas.height);
      gl.uniform1f(uniforms.time, elapsed);
      gl.uniform2f(uniforms.pointer, signalPointer.x, 1 - signalPointer.y);
      gl.uniform3f(uniforms.shock, shock.x, 1 - shock.y, shock.at);
      gl.uniform1f(uniforms.mode, modes.indexOf(mode));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function letterSpacing(style) {
      const value = parseFloat(style.letterSpacing);
      return Number.isFinite(value) ? value : 0;
    }

    function drawSpacedText(context, text, x, baseline, style) {
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      context.fillStyle = "#fff";
      context.textBaseline = "alphabetic";
      let cursor = x;
      const spacing = letterSpacing(style);
      for (const char of text) {
        context.fillText(char, cursor, baseline);
        cursor += context.measureText(char).width + spacing;
      }
    }

    function titleRuns() {
      const heroRect = hero.getBoundingClientRect();
      const runs = [];
      title.childNodes.forEach((node) => {
        if (!node.textContent.trim()) return;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        if (rect.width && rect.height && element) runs.push({ text: node.textContent.trim(), rect, style: getComputedStyle(element) });
      });
      return { heroRect, runs };
    }

    function sampleParticles() {
      const { heroRect, runs } = titleRuns();
      const ratio = dpr();
      const sampling = document.createElement("canvas");
      sampling.width = typeCanvas.width;
      sampling.height = typeCanvas.height;
      const sample = sampling.getContext("2d", { willReadFrequently: true });
      sample.setTransform(ratio, 0, 0, ratio, 0, 0);
      runs.forEach(({ text, rect, style }) => drawSpacedText(sample, text, rect.left - heroRect.left, rect.bottom - heroRect.top, style));
      const image = sample.getImageData(0, 0, sampling.width, sampling.height).data;
      const next = [];
      const stride = heroWidth < 600 ? 5 : 4;
      for (let y = 0; y < sampling.height; y += stride * ratio) {
        for (let x = 0; x < sampling.width; x += stride * ratio) {
          if (image[(Math.floor(y) * sampling.width + Math.floor(x)) * 4 + 3] < 130) continue;
          if (next.length > 2600 && Math.random() > .35) continue;
          const tx = x / ratio;
          const ty = y / ratio;
          const angle = Math.random() * Math.PI * 2;
          const distance = 90 + Math.random() * Math.min(heroWidth, heroHeight) * .42;
          next.push({ tx, ty, sx: tx + Math.cos(angle) * distance, sy: ty + Math.sin(angle) * distance, x: tx, y: ty, vx: 0, vy: 0, size: 1 + Math.random() * 1.55, seed: Math.random() * 100 });
        }
      }
      particles = next;
    }

    function drawParticles(delta) {
      typeContext.clearRect(0, 0, heroWidth, heroHeight);
      if (!exploded || !particles.length) return;
      typeContext.globalCompositeOperation = "screen";
      for (const particle of particles) {
        const dx = particle.x - typePointer.x * heroWidth;
        const dy = particle.y - typePointer.y * heroHeight;
        const distance2 = dx * dx + dy * dy;
        if (typePointer.active && !assembling && distance2 < 19000) {
          const push = reduced ? 34 : 460 / Math.max(70, distance2);
          particle.vx += dx * push;
          particle.vy += dy * push;
        }
        const targetX = assembling ? particle.tx : particle.sx;
        const targetY = assembling ? particle.ty : particle.sy;
        particle.vx += (targetX - particle.x) * (reduced ? .34 : .018);
        particle.vy += (targetY - particle.y) * (reduced ? .34 : .018);
        if (!reduced) {
          if (!assembling) {
            particle.vx += Math.sin(elapsed * 1.3 + particle.seed) * .018;
            particle.vy += Math.cos(elapsed * 1.1 + particle.seed) * .018;
          }
          particle.vx *= .84;
          particle.vy *= .84;
          particle.x += particle.vx;
          particle.y += particle.vy;
        } else {
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.vx *= .3;
          particle.vy *= .3;
        }
        const tint = particle.seed % 1;
        typeContext.fillStyle = tint > .72 ? "#f4ff74" : tint > .42 ? "#7af8f3" : "#f6f2e8";
        typeContext.fillRect(particle.x, particle.y, particle.size, particle.size);
      }
      typeContext.globalCompositeOperation = "source-over";
    }

    function shouldAnimate() {
      return visible && documentVisible && (!reduced || exploded && typePointer.active);
    }

    function render(now) {
      frame = 0;
      const delta = previousTime ? Math.min(40, now - previousTime) : 16.7;
      previousTime = now;
      if (!reduced) elapsed += delta * .001;
      drawSignal();
      drawParticles(delta);
      if (assembling && particles.every((particle) => Math.abs(particle.tx - particle.x) + Math.abs(particle.ty - particle.y) < 1.2)) {
        assembling = false;
        exploded = false;
        hero.classList.remove("type-particles-active");
        typeContext.clearRect(0, 0, heroWidth, heroHeight);
        typeToggle.setAttribute("aria-pressed", "false");
        typeToggle.textContent = "Scatter type";
      }
      if (!reduced && renderer) {
        framesSinceMark += 1;
        if (now - lastFpsMark > 500) {
          fps = Math.round((framesSinceMark * 1000) / (now - lastFpsMark || 1));
          framesSinceMark = 0;
          lastFpsMark = now;
          updateStats();
        }
      }
      if (shouldAnimate()) frame = requestAnimationFrame(render);
      else updateStats(true);
    }

    function requestRender() {
      if (!frame && visible && documentVisible) frame = requestAnimationFrame(render);
    }

    function renderImmediately() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      render(performance.now());
    }

    function syncMotionPreference() {
      const next = mediaMotion.matches || document.documentElement.classList.contains("reduced-motion");
      if (next === reduced) return;
      reduced = next;
      previousTime = 0;
      renderImmediately();
    }

    modeMount.setAttribute("role", "group");
    modeMount.setAttribute("aria-label", "TV signal mode");
    modeButtons.forEach((button) => {
      const selected = button.dataset.signalMode === mode;
      button.textContent = modeLabels[button.dataset.signalMode];
      button.setAttribute("aria-label", `${modeLabels[button.dataset.signalMode]} signal mode`);
      button.setAttribute("aria-pressed", String(selected));
      button.addEventListener("click", () => {
        mode = button.dataset.signalMode;
        modeButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        updateStats();
        requestRender();
      });
    });

    typeToggle.setAttribute("aria-pressed", "false");
    typeToggle.setAttribute("aria-label", "Scatter and reassemble the typography");
    typeToggle.textContent = "Scatter type";
    typeToggle.addEventListener("click", () => {
      if (!exploded) {
        exploded = true;
        assembling = false;
        typeToggle.setAttribute("aria-pressed", "true");
        typeToggle.textContent = "Reassemble type";
        hero.classList.add("type-particles-active");
        sampleParticles();
        if (reduced) particles.forEach((particle) => { particle.x = particle.sx; particle.y = particle.sy; });
      } else if (reduced) {
        exploded = false;
        assembling = false;
        hero.classList.remove("type-particles-active");
        typeContext.clearRect(0, 0, heroWidth, heroHeight);
        typeToggle.setAttribute("aria-pressed", "false");
        typeToggle.textContent = "Scatter type";
      } else {
        assembling = true;
        typeToggle.setAttribute("aria-pressed", "false");
        typeToggle.textContent = "Reassembling";
      }
      requestRender();
    });

    hero.addEventListener("pointermove", (event) => {
      const heroBounds = hero.getBoundingClientRect();
      const signalBounds = signalScreen.getBoundingClientRect();
      const titleBounds = title.getBoundingClientRect();
      typePointer.x = Math.max(0, Math.min(1, (event.clientX - heroBounds.left) / heroBounds.width));
      typePointer.y = Math.max(0, Math.min(1, (event.clientY - heroBounds.top) / heroBounds.height));
      typePointer.active = event.clientX >= titleBounds.left && event.clientX <= titleBounds.right && event.clientY >= titleBounds.top && event.clientY <= titleBounds.bottom;
      signalPointer.x = (event.clientX - signalBounds.left) / signalBounds.width;
      signalPointer.y = (event.clientY - signalBounds.top) / signalBounds.height;
      signalPointer.active = event.clientX >= signalBounds.left && event.clientX <= signalBounds.right && event.clientY >= signalBounds.top && event.clientY <= signalBounds.bottom;
      requestRender();
    }, { passive: true });
    hero.addEventListener("pointerleave", () => { signalPointer.active = false; typePointer.active = false; requestRender(); }, { passive: true });
    hero.addEventListener("pointerdown", (event) => {
      const bounds = signalScreen.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
      shock = { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height, at: elapsed };
      requestRender();
    }, { passive: true });

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) requestRender();
      else if (frame) { cancelAnimationFrame(frame); frame = 0; updateStats(true); }
    }, { threshold: 0.01 }).observe(hero);
    document.addEventListener("visibilitychange", () => {
      documentVisible = !document.hidden;
      if (documentVisible) requestRender();
      else if (frame) { cancelAnimationFrame(frame); frame = 0; updateStats(true); }
    });
    window.addEventListener("tva:restart", () => {
      elapsed = 0;
      previousTime = 0;
      shock.at = -99;
      exploded = false;
      assembling = false;
      particles = [];
      hero.classList.remove("type-particles-active");
      typeContext.clearRect(0, 0, heroWidth, heroHeight);
      typeToggle.setAttribute("aria-pressed", "false");
      typeToggle.textContent = "Scatter type";
      requestRender();
    });
    mediaMotion.addEventListener("change", syncMotionPreference);
    new MutationObserver(syncMotionPreference).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hero);
    resizeObserver.observe(signalScreen);
    document.fonts?.ready.then(() => {
      if (exploded) sampleParticles();
      requestRender();
    });

    syncMotionPreference();
    resize();
    lastFpsMark = performance.now();
    requestRender();
  });
})();
