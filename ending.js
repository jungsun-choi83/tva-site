const clamp = value => Math.min(1, Math.max(0, value));
const segment = (p, a, b) => clamp((p - a) / (b - a));
const smooth = value => value * value * (3 - 2 * value);
const smoother = value => value * value * value * (value * (value * 6 - 15) + 10);

export function initEnding({ onComplete, canComplete, onNav }) {
  const section = document.getElementById('ending');
  const stage = section.querySelector('.ending-stage');
  const room = section.querySelector('.ending-room');
  const art = room.querySelector('img');
  const chrome = section.querySelector('.ending-chrome');
  const screen = section.querySelector('.ending-screen');
  const programme = section.querySelector('.ending-programme');
  const line = section.querySelector('.ending-crt-line');
  const canvas = section.querySelector('.ending-game');
  const gameUI = section.querySelector('.ending-game-ui');
  const home = section.querySelector('.ending-home-match');
  const rendererStatus = section.querySelector('.ending-fallback');
  let scene = null;
  let loading = null;
  let unavailable = false;
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
  let glassCoveredAt = .25;
  let glassQuad = [];

  function stop(reason = 'restart') { section.dataset.pauseReason = reason; cancelAnimationFrame(autoplay); autoplay = 0; playRequest += 1; }
  function ensureScene() {
    if (loading || reduced || unavailable) return loading;
    section.dataset.renderer = 'loading';
    rendererStatus.textContent = '마지막 장면을 준비하고 있습니다…';
    loading = import('./ending-scene-r15.js?v=eb-20260913').then(module => module.createEndingScene(canvas)).then(value => {
      scene = value;
      scene.resize(width, height);
      section.dataset.renderer = 'ready';
      schedule();
      return scene;
    }).catch(error => {
      unavailable = true;
      section.dataset.renderer = 'unavailable';
      rendererStatus.textContent = '이 브라우저에서는 마지막 장면을 띄울 수 없습니다. Back to home 을 누르면 처음 화면으로 돌아갑니다.';
      console.warn('Eternal Beam ending: 마지막 장면 렌더링을 쓸 수 없습니다', error);
      schedule();
    });
    return loading;
  }

  function resize() {
    if (width === stage.clientWidth && height === stage.clientHeight) { schedule(); return; }
    stop('resize');
    armed = false;
    width = stage.clientWidth;
    height = stage.clientHeight;
    const portrait = width / height <= .8;
    const artWidth = 1672;
    const artHeight = 941;
    const topInset = Math.min(64, height * .09);
    const bottomInset = portrait ? 105 : 0;
    const fit = Math.min(width / artWidth, (height - topInset - bottomInset) / artHeight);
    const w = artWidth * fit;
    const h = artHeight * fit;
    const x = (width - w) / 2;
    const y = topInset + (height - topInset - bottomInset - h) / 2;
    Object.assign(art.style, { width: `${w}px`, height: `${h}px`, left: `${x}px`, top: `${y}px` });
    // 아이와 시바를 소파 '좌석면'에 앉힌다. 세 상수가 그림(1672×941) 기준으로 뜻하는 것:
    //   seatY  = 좌석면의 세로 위치   hip = 그림 안에서 엉덩이가 닿는 지점   pairH = 두 사람의 키
    // 2026-09-12: seatY 가 .548 이었는데, 그 자리는 좌석면이 아니라 **등받이 윗선**이었다.
    //   1440×900 에서 재 보면 등받이 윗선 y≈485(=.548), 실제 좌석면 y≈615(=.703).
    //   그래서 둘이 등받이 위에 걸터앉아 있었다. hip 도 .62 였는데 그림에서 실제로 닿는 지점은 .58 이다.
    //   키(pairH)는 .50 → .57 로. 소파 등받이 높이가 130px 인데 앉은키가 220px 뿐이라 작아 보였다
    //   (어린이가 앉으면 머리가 등받이보다 등받이 한 칸쯤 올라오는 것이 자연스럽다 → 앉은키 약 250px).
    //   left 는 키가 커진 만큼 가로 중심이 그대로이도록 .236 → .2233.
    const pair = room.querySelector('.ending-pair');
    const pairH = h * .57;
    const hip = .58;
    const seatY = y + h * .703;
    if (pair) Object.assign(pair.style, { height: `${pairH}px`, width: 'auto', left: `${x + w * .2233}px`, top: `${seatY - pairH * hip}px` });
    const holo = room.querySelector('.ending-holo');
    if (holo) Object.assign(holo.style, { left: `${x + w * .868}px`, top: `${y + h * .456}px`, width: `${w * .058}px`, height: `${h * .086}px` });
    // Cube front glass on the striped plate (1672×941). Dark body ~1437–1600 × 418–525.
    const corners = [[1444,424],[1562,426],[1564,522],[1442,520]];
    glassQuad = corners.map(([sx,sy]) => [x + sx * fit, y + sy * fit]);
    screen.style.transform = projectScreen(glassQuad);
    screenX = glassQuad.reduce((sum, point) => sum + point[0], 0) / 4;
    screenY = glassQuad.reduce((sum, point) => sum + point[1], 0) / 4;
    zoomScale = scaleForGlassCoverage(glassQuad, screenX, screenY, width, height);
    glassCoveredAt = progressForGlassCoverage(glassQuad, screenX, screenY, zoomScale, width, height);
    room.style.transformOrigin = `${screenX}px ${screenY}px`;
    scene?.resize(width, height);
    if (inEnding && !completing) scrollTo({ top:section.offsetTop + Math.max(0, section.offsetHeight - height) * progress, behavior:'instant' });
    schedule();
  }

  async function complete() {
    if (completing || !canComplete()) return;
    completing = true;
    stop();
    const cover = home.cloneNode(true);
    cover.classList.add('ending-return-cover');
    Object.assign(cover.style, { position:'fixed', opacity:'1', zIndex:'1000' });
    document.body.append(cover);
    document.documentElement.classList.remove('ending-in-game');
    try {
      await onComplete();
      if (!reduced) await cover.animate([{ opacity:1 }, { opacity:0 }], { duration:360, easing:'ease-out', fill:'forwards' }).finished;
    } finally {
      cover.remove();
      completing = false;
      schedule();
    }
  }

  function update() {
    frame = 0;
    const rect = section.getBoundingClientRect();
    const visible = rect.top < height && rect.bottom > 0;
    inEnding = rect.top <= 1 && rect.bottom > 0;
    if (rect.top < height * 2.5 && rect.bottom > 0) ensureScene();
    progress = reduced || unavailable ? 0 : clamp(-rect.top / Math.max(1, section.offsetHeight - height));
    const p = progress;
    section.querySelector('.replay-button').textContent = reduced || unavailable ? 'Back to home ↗' : 'Replay ↻';
    section.dataset.progress = p.toFixed(4);
    const phase = p < .04 ? 'room' : p < .16 ? 'power-off' : p < .30 ? 'social' : p < .59 ? 'walk' : p < .72 ? 'sit' : p < .82 ? 'type' : p < .95 ? 'approach' : 'home';
    section.dataset.phase = phase;
    const dark = visible && p > .04;
    document.documentElement.classList.toggle('ending-in-game', dark);
    // 감사 [56]: 예전에는 여기서 상단바를 직접 켜고 껐다. 그 바람에 app.js 의 판단이 덮여
    // 엔딩에서 '화면엔 없는데 Tab 은 닿는' 바가 남았다. 이제는 app.js 에 다시 판단만 맡긴다.
    // 이 구역이 화면을 얼마나 덮었는지는 여기서 이미 쟀으니 그대로 넘겨 준다(자리 재기 중복을 피한다).
    onNav?.(Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0) > innerHeight * .5);
    const zoomTravel = smoother(segment(p, .01, .16));
    const scale = Math.exp(Math.log(zoomScale) * zoomTravel);
    room.style.transform = `translate(${(width / 2 - screenX) * zoomTravel}px,${(height / 2 - screenY) * zoomTravel}px) scale(${scale})`;
    room.style.opacity = '1';
    const collapse = smooth(segment(p, .075, .12));
    programme.style.transform = `scaleY(${Math.max(.002, 1 - collapse)})`;
    programme.style.filter = `brightness(${1 + collapse * 1.5})`;
    programme.style.opacity = String(1 - segment(p, .12, .128));
    const lineClose = smooth(segment(p, .128, .147));
    line.style.opacity = String(segment(p, .112, .122) * (1 - segment(p, .148, .156)));
    line.style.width = `${Math.max(.45, 88 * (1 - lineClose))}%`;
    line.style.height = `${Math.max(1.2, 2 - lineClose * .8)}px`;
    chrome.style.opacity = String(1 - segment(p, .015, .04));
    chrome.inert = p > .04;
    chrome.setAttribute('aria-hidden', String(p > .04));
    const gameRevealStart = Math.max(.145, glassCoveredAt);
    const waitingForScene = p >= gameRevealStart && !scene && !unavailable;
    section.dataset.waiting = String(waitingForScene);
    stage.style.backgroundColor = p < gameRevealStart ? '#fff' : '#050606';
    // 방을 먼저 지우고(.950~.962) 그 다음에 컴퓨터를 띄운다(.962~.976) — 예전에는 두 구간이 같아서
    // 바뀌는 동안 컴퓨터 그림이 캐릭터 위로 겹쳐 보였다(사장님 지적).
    canvas.style.opacity = String((scene ? smooth(segment(p, gameRevealStart, gameRevealStart + .012)) : 0) * (1 - smooth(segment(p, .950, .962))));
    // [80] 맨 끝에서 누를 수 있는 버튼이 하나도 없었다. 진행률 98.5% 부터 'Back to home ↗' 를 다시 띄우고,
    // inert 를 '보이는 정도'에 맞춰 풀어 준다 — 안 보이는데 키보드 포커스만 잡히는 상태도 같이 없앤다.
    const uiOpacity = Math.max(segment(p, .18, .22) * (1 - segment(p, .88, .93)), segment(p, .985, .997));
    gameUI.style.opacity = String(uiOpacity);
    gameUI.inert = uiOpacity < .5;
    gameUI.setAttribute('aria-hidden', String(gameUI.inert));
    home.style.opacity = String(smooth(segment(p, .962, .976)));   // 방이 다 지워진 뒤에 컴퓨터를 띄운다(겹침 없음)
    if (scene && visible && p >= .14 && p < 1) scene.render(p);
    if (p >= .999 && visible && armed && !completing && (scene || unavailable || reduced)) complete();
  }

  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  async function play() {
    if (completing || !canComplete()) return;
    stop();
    const request = playRequest;
    armed = true;
    if (reduced || unavailable) return complete();
    await ensureScene();
    if (request !== playRequest || !canComplete()) return;
    if (unavailable) return complete();
    const start = Math.max(section.offsetTop, scrollY);
    const target = section.offsetTop + section.offsetHeight - height;
    const duration = Math.max(900, (1 - progress) * 27500);
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
  section.querySelector('.ending-skip').addEventListener('click', () => complete());
  window.addEventListener('scroll', schedule, { passive:true });
  window.addEventListener('resize', resize, { passive:true });
  // r59 (2026-09-10 user request): one wheel-down tick on the ending starts the whole 27.5 s programme by
  // itself — no need to keep scrolling, and the wheel no longer scrubs the scene forward (that felt like the
  // character "accelerating" with the wheel). While it auto-plays, further wheel ticks are swallowed so they
  // can't jump or freeze it; Escape / arrow keys / touch still stop it, and wheel-up when it is not playing
  // still scrolls back out of the ending normally.
  window.addEventListener('wheel', event => {
    if (event.ctrlKey || !event.deltaY) return;
    if (completing) { event.preventDefault(); return; }
    if (autoplay) {
      // 자동 재생 중에 위로 굴리면 멈추고 되돌아갈 수 있게 둔다.
      // 예전에는 위로 굴려도 전부 삼켜서, 오히려 900px 씩 더 내려갔다(사장님 지적).
      if (event.deltaY < 0) { stop('wheel-up'); armed = false; schedule(); return; }
      event.preventDefault(); schedule(); return;
    }
    const rect = section.getBoundingClientRect();
    if (event.deltaY > 0 && rect.top <= 1 && rect.bottom > 0 && progress < .995 && !reduced && !unavailable && canComplete()) {
      event.preventDefault();
      play();
      return;
    }
    stop('wheel');
    if (event.deltaY > 0 && rect.top < height) armed = true;
    schedule();
  }, { passive:false });
  window.addEventListener('touchstart', () => { stop('touch'); if (section.getBoundingClientRect().top < height) armed = true; }, { passive:true });
  window.addEventListener('keydown', event => { if (['Escape','ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) stop(event.key); if (['ArrowDown','PageDown','End',' '].includes(event.key) && section.getBoundingClientRect().top < height) { armed = true; schedule(); } });
  window.addEventListener('tva:navigate', () => { stop('navigate'); armed = false; document.documentElement.classList.remove('ending-in-game'); schedule(); });
  window.addEventListener('tva:motion', event => { if (reduced !== event.detail.reduced) { stop('motion'); reduced = event.detail.reduced; } resize(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop('hidden'); });
  resize();
  // 엔딩 3D 방(three.js + 사람 모형 3개 ≈ 17MB)은 첫 화면에서 만들지 않는다. 화면이 가까워지면 그때 준비한다.
  const warmScene = () => { if ('requestIdleCallback' in window) requestIdleCallback(ensureScene, { timeout:2500 }); else ensureScene(); };
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { near.disconnect(); warmScene(); }
    }, { rootMargin: '150% 0px 150% 0px' });
    near.observe(section);
  } else warmScene();
  return { play, complete, get active() { return progress > 0 && progress < 1; } };
}

// Project the live 400 × 320 programme onto the illustrated glass plane.
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
  const travel = smoother(segment(progress, .01, .16));
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

function progressForGlassCoverage(quad, centerX, centerY, scale, width, height) {
  let low = .01;
  let high = .16;
  for (let i = 0; i < 24; i += 1) {
    const middle = (low + high) / 2;
    const camera = cameraAt(middle, scale, centerX, centerY, width, height);
    if (glassCoversViewport(quad, centerX, centerY, camera, width, height)) high = middle;
    else low = middle;
  }
  return high;
}
