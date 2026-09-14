const clamp = value => Math.min(1, Math.max(0, value));
const segment = (p, a, b) => clamp((p - a) / (b - a));
const smooth = value => value * value * (3 - 2 * value);
const smoother = value => value * value * value * (value * (value * 6 - 15) + 10);

const ZOOM_START = .02;
const ZOOM_END = .72;
const RETURN_AT = .78;

export function initEnding({ onComplete, canComplete, onNav }) {
  const section = document.getElementById('ending');
  const stage = section.querySelector('.ending-stage');
  const room = section.querySelector('.ending-room');
  const art = room.querySelector('img');
  const chrome = section.querySelector('.ending-chrome');
  const screen = section.querySelector('.ending-screen');
  const home = section.querySelector('.ending-home-match');
  const holo = room.querySelector('.ending-holo');
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame = 0;
  let autoplay = 0;
  let playRequest = 0;
  let completing = false;
  let armed = false;
  let inEnding = false;
  let progress = 0;
  let width = 1;
  let height = 1;
  let screenX = 0;
  let screenY = 0;
  let zoomScale = 1;
  let glassQuad = [];

  function stop(reason = 'restart') { section.dataset.pauseReason = reason; cancelAnimationFrame(autoplay); autoplay = 0; playRequest += 1; }

  function resize() {
    if (width === stage.clientWidth && height === stage.clientHeight) { schedule(); return; }
    stop('resize');
    armed = false;
    width = stage.clientWidth;
    height = stage.clientHeight;
    const mobile = width <= 760;
    const portrait = width / height <= .8;
    const artWidth = 1280;
    const artHeight = 720;
    const topInset = mobile ? 0 : Math.min(48, height * .07);
    const bottomInset = mobile ? Math.max(52, height * .08) : (portrait ? 96 : 0);
    let fit;
    if (mobile) fit = (width * 1.22) / artWidth;
    else fit = Math.min(width / artWidth, (height - topInset - bottomInset) / artHeight);
    const w = artWidth * fit;
    const h = artHeight * fit;
    const x = mobile ? Math.min(0, width - w + width * .02) : (width - w) / 2;
    const y = mobile ? (height - bottomInset - h) * .48 : topInset + (height - topInset - bottomInset - h) / 2;
    Object.assign(art.style, { width: `${w}px`, height: `${h}px`, left: `${x}px`, top: `${y}px` });
    const tableFg = room.querySelector('.ending-table-fg');
    if (tableFg) Object.assign(tableFg.style, { width: `${w}px`, height: `${h}px`, left: `${x}px`, top: `${y}px` });
    const pair = room.querySelector('.ending-pair');
    const pairH = h * .48;
    const hip = .49;
    const seatY = y + h * .655;
    if (pair) Object.assign(pair.style, { height: `${pairH}px`, width: 'auto', left: `${x + w * .288}px`, top: `${seatY - pairH * hip}px` });
    if (holo) Object.assign(holo.style, { left: `${x + w * .872}px`, top: `${y + h * .468}px`, width: `${w * .074}px`, height: `${h * .088}px` });
    const corners = [[1108,332],[1216,334],[1224,410],[1100,408]];
    glassQuad = corners.map(([sx,sy]) => [x + sx * fit, y + sy * fit]);
    if (screen) screen.style.transform = projectScreen(glassQuad);
    screenX = glassQuad.reduce((sum, point) => sum + point[0], 0) / 4;
    screenY = glassQuad.reduce((sum, point) => sum + point[1], 0) / 4;
    zoomScale = scaleForGlassCoverage(glassQuad, screenX, screenY, width, height);
    room.style.transformOrigin = `${screenX}px ${screenY}px`;
    if (inEnding && !completing) scrollTo({ top:section.offsetTop + Math.max(0, section.offsetHeight - height) * progress, behavior:'instant' });
    schedule();
  }

  async function complete() {
    if (completing || !canComplete()) return;
    completing = true;
    stop();
    document.documentElement.classList.remove('ending-in-game');
    const cover = document.createElement('div');
    cover.className = 'ending-return-cover';
    Object.assign(cover.style, {
      position:'fixed', inset:'0', zIndex:'1000', pointerEvents:'none',
      background:'#050606', opacity:'0'
    });
    document.body.append(cover);
    try {
      if (!reduced) await cover.animate([{ opacity:0 }, { opacity:1 }], { duration:280, easing:'ease-in', fill:'forwards' }).finished;
      else cover.style.opacity = '1';
      await onComplete();
      if (!reduced) await cover.animate([{ opacity:1 }, { opacity:0 }], { duration:420, easing:'ease-out', fill:'forwards' }).finished;
    } finally {
      cover.remove();
      completing = false;
      schedule();
    }
  }

  let lastPhase = '';
  let lastInGame = false;
  function update() {
    frame = 0;
    const rect = section.getBoundingClientRect();
    const visible = rect.top < height && rect.bottom > 0;
    if (!visible && !completing && !autoplay) {
      if (lastInGame) {
        lastInGame = false;
        document.documentElement.classList.remove('ending-in-game');
      }
      room.style.willChange = 'auto';
      return;
    }
    inEnding = rect.top <= 1 && rect.bottom > 0;
    progress = reduced ? 0 : clamp(-rect.top / Math.max(1, section.offsetHeight - height));
    const p = progress;
    section.dataset.progress = p.toFixed(4);
    const phase = p < .08 ? 'room' : 'zoom';
    if (phase !== lastPhase) {
      lastPhase = phase;
      section.dataset.phase = phase;
      room.style.willChange = phase === 'zoom' ? 'transform' : 'auto';
    }
    const inGame = visible && p > .06;
    if (inGame !== lastInGame) {
      lastInGame = inGame;
      document.documentElement.classList.toggle('ending-in-game', inGame);
    }
    onNav?.(Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0) > innerHeight * .5);
    const zoomTravel = smoother(segment(p, ZOOM_START, ZOOM_END));
    const scale = Math.exp(Math.log(zoomScale) * zoomTravel);
    room.style.transform = `translate3d(${(width / 2 - screenX) * zoomTravel}px,${(height / 2 - screenY) * zoomTravel}px,0) scale(${scale})`;
    if (holo) holo.style.opacity = String(1 - smooth(segment(p, .38, .56)));
    chrome.style.opacity = String(1 - segment(p, .02, .08));
    const chromeOff = p > .08;
    if (chrome.inert !== chromeOff) {
      chrome.inert = chromeOff;
      chrome.setAttribute('aria-hidden', String(chromeOff));
    }
    const skip = section.querySelector('.ending-skip');
    if (skip) {
      const skipOn = p > .08 && p < RETURN_AT;
      skip.style.opacity = String(skipOn ? 1 : 0);
      if (skip.inert === skipOn) {
        skip.inert = !skipOn;
        skip.setAttribute('aria-hidden', String(!skipOn));
      }
    }
    if (home) home.style.opacity = '0';
    if (p >= RETURN_AT - .01 && visible && armed && !completing) complete();
  }

  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  async function play() {
    if (completing || !canComplete()) return;
    stop();
    const request = playRequest;
    armed = true;
    if (reduced) return complete();
    if (request !== playRequest || !canComplete()) return;
    const start = Math.max(section.offsetTop, scrollY);
    const target = section.offsetTop + Math.max(0, section.offsetHeight - height) * Math.min(1, RETURN_AT + .03);
    const duration = Math.max(700, (RETURN_AT - progress) * 5200);
    const began = performance.now();
    const tick = now => {
      const t = clamp((now - began) / duration);
      scrollTo({ top:start + (target - start) * t, behavior:'instant' });
      if (t < 1) autoplay = requestAnimationFrame(tick);
      else { autoplay = 0; schedule(); }
    };
    autoplay = requestAnimationFrame(tick);
  }

  section.querySelector('.ending-scroll').addEventListener('click', play);
  section.querySelector('.ending-skip')?.addEventListener('click', () => complete());
  window.addEventListener('scroll', schedule, { passive:true });
  window.addEventListener('resize', resize, { passive:true });
  const onWheel = event => {
    if (event.ctrlKey || !event.deltaY) return;
    if (completing) { event.preventDefault(); return; }
    if (autoplay) {
      if (event.deltaY < 0) { stop('wheel-up'); armed = false; schedule(); return; }
      event.preventDefault(); schedule(); return;
    }
    const rect = section.getBoundingClientRect();
    if (event.deltaY > 0 && rect.top <= 1 && rect.bottom > 0 && progress < RETURN_AT && !reduced && canComplete()) {
      event.preventDefault();
      play();
      return;
    }
    stop('wheel');
    if (event.deltaY > 0 && rect.top < height) armed = true;
    schedule();
  };
  let wheelOn = false;
  const setWheel = on => {
    if (on === wheelOn) return;
    wheelOn = on;
    if (on) window.addEventListener('wheel', onWheel, { passive:false });
    else window.removeEventListener('wheel', onWheel);
  };
  new IntersectionObserver(([entry]) => { setWheel(entry.isIntersecting); if (entry.isIntersecting) schedule(); }, { rootMargin:'8% 0px' }).observe(section);
  window.addEventListener('touchstart', () => { stop('touch'); if (section.getBoundingClientRect().top < height) armed = true; }, { passive:true });
  window.addEventListener('keydown', event => { if (['Escape','ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) stop(event.key); if (['ArrowDown','PageDown','End',' '].includes(event.key) && section.getBoundingClientRect().top < height) { armed = true; schedule(); } });
  window.addEventListener('tva:navigate', () => { stop('navigate'); armed = false; document.documentElement.classList.remove('ending-in-game'); schedule(); });
  window.addEventListener('tva:motion', event => { if (reduced !== event.detail.reduced) { stop('motion'); reduced = event.detail.reduced; } resize(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop('hidden'); });
  resize();
  return { play, complete, get active() { return progress > 0 && progress < 1; } };
}

function projectScreen([[x0,y0],[x1,y1],[x2,y2],[x3,y3]]) {
  const dx1=x1-x2, dx2=x3-x2, dx3=x0-x1+x2-x3;
  const dy1=y1-y2, dy2=y3-y2, dy3=y0-y1+y2-y3;
  const determinant=dx1*dy2-dx2*dy1;
  const g=(dx3*dy2-dx2*dy3)/determinant;
  const h=(dx1*dy3-dx3*dy1)/determinant;
  const a=x1-x0+g*x1, b=x3-x0+h*x3;
  const d=y1-y0+g*y1, e=y3-y0+h*y3;
  return `matrix3d(${a/400},${d/400},0,${g/400},${b/320},${e/320},0,${h/320},0,0,1,0,${x0},${y0},0,1)`;
}

function cameraAt(progress, scale, centerX, centerY, width, height) {
  const travel = smoother(segment(progress, ZOOM_START, ZOOM_END));
  return {
    travel,
    scale: Math.exp(Math.log(scale) * travel),
    x: (width / 2 - centerX) * travel,
    y: (height / 2 - centerY) * travel
  };
}

function transformedGlass(quad, centerX, centerY, camera) {
  return quad.map(([x,y]) => [
    centerX + camera.x + (x - centerX) * camera.scale,
    centerY + camera.y + (y - centerY) * camera.scale
  ]);
}

function containsPoint(quad, [x,y]) {
  let direction = 0;
  for (let i = 0; i < quad.length; i += 1) {
    const [ax,ay] = quad[i];
    const [bx,by] = quad[(i + 1) % quad.length];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cross) < .001) continue;
    const side = Math.sign(cross);
    if (direction && side !== direction) return false;
    direction = side;
  }
  return true;
}

function glassCoversViewport(quad, centerX, centerY, camera, width, height) {
  const projected = transformedGlass(quad, centerX, centerY, camera);
  return [[-6,-6],[width + 6,-6],[width + 6,height + 6],[-6,height + 6]]
    .every(point => containsPoint(projected, point));
}

function scaleForGlassCoverage(quad, centerX, centerY, width, height) {
  let low = 1;
  let high = 2;
  const centeredCamera = scale => ({ scale, x:width / 2 - centerX, y:height / 2 - centerY });
  while (high < 256 && !glassCoversViewport(quad, centerX, centerY, centeredCamera(high), width, height)) high *= 2;
  for (let i = 0; i < 28; i += 1) {
    const middle = (low + high) / 2;
    if (glassCoversViewport(quad, centerX, centerY, centeredCamera(middle), width, height)) high = middle;
    else low = middle;
  }
  return high * 1.025;
}
