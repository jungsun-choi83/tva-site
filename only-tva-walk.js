// ONLY TVA — Z축 카메라 워킹 (Claude, only-tva lane)

const P = 1200, IW = 1671, IH = 941;
const NAVH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 0;   // 정본 nav 높이(64px) 아래가 무대

// 카메라 : 01 트럭 → 02 문을 통과해 백화점 안쪽까지 → 03 빠지면서 명찰이 앞으로
const KEYS = [
  { p: 0.00, z:    0, x:  150, y:   0 },
  { p: 0.13, z:   70, x:  118, y:   0, ease: 'out'   },  // 01 / 7 DAYS
  { p: 0.52, z:  980, x:  -14, y:-142, ease: 'in'    },  // 02 / VENUE — 입구 코앞까지 쑥
  { p: 0.89, z: -320, x: -158, y:  20, ease: 'out'   },  // 03 / NETWORKING
  { p: 1.00, z: -400, x: -178, y:   0, ease: 'inout' },
];
const FOCUS = [
  { p: 0.00, z:    0 }, { p: 0.13, z:    0 },
  { p: 0.52, z: -700 }, { p: 0.89, z:  300 }, { p: 1.00, z: 300 },
];
const EASE = {
  inout: (t) => t * t * (3 - 2 * t),
  in:    (t) => t * t * t * t,          // 천천히 출발했다가 확 빨려든다 (쑥)
  out:   (t) => 1 - Math.pow(1 - t, 3), // 빠르게 물러났다가 부드럽게 선다
};
function lerpKeys(arr, p, pair){
  for (let i = 0; i < arr.length - 1; i++){
    const a = arr[i], b = arr[i+1];
    if (p <= b.p || i === arr.length - 2){
      const raw = Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p)));
      const t = (EASE[b.ease] || EASE.inout)(raw);
      return pair ? { z: a.z + (b.z - a.z) * t, x: a.x + (b.x - a.x) * t,
                      y: (a.y ?? 0) + ((b.y ?? 0) - (a.y ?? 0)) * t }
                  : a.z + (b.z - a.z) * t;
    }
  }
}
const MAX_BLUR = 14, BLUR_PER = 70;

document.documentElement.dataset.box = new URLSearchParams(location.search).get('box') || 'card';
document.documentElement.dataset.type = new URLSearchParams(location.search).get('type') || 'stack';
{ const fr = new URLSearchParams(location.search).get('frame'); document.documentElement.dataset.frame = fr === 'off' ? '' : (fr || 'n1'); }
document.documentElement.dataset.bug = new URLSearchParams(location.search).get('bug') || 'l6';
// 뉴스 프레임 시계 — 2026-09-12 지적 [110]: 1초마다 글자를 바꾸는 타이머가 구역이 화면 밖일 때도 세션 내내 돌았다.
// 지금은 구역이 화면 가까이 있고 탭이 켜져 있을 때만 돌리고, 다시 켜는 순간 지금 시각을 바로 찍는다(멈춰 있던 시각이 보이지 않게).
const nfTimeEl = document.getElementById('nf-time');
const nfTick = () => { if (nfTimeEl) nfTimeEl.textContent = new Date().toLocaleTimeString('en-GB', { hour12: false }); };
let nfClock = 0, nfNear = true;
const nfStart = () => { if (!nfTimeEl || nfClock || document.hidden || !nfNear) return; nfTick(); nfClock = setInterval(nfTick, 1000); };
const nfStop = () => { if (nfClock) { clearInterval(nfClock); nfClock = 0; } };
nfTick();
const mark = document.getElementById('otw-mark');
const walk = document.getElementById('only-tva');
const stage = document.getElementById('otw-stage');
const cam = document.getElementById('otw-camera');
const layers = [...cam.querySelectorAll('.otw-layer')];
const words = [...document.querySelectorAll('.otw-word')];
const pEl = document.getElementById('p') || {}, zEl = document.getElementById('z') || {}, xEl = document.getElementById('x') || {};

let SW = 0, SH = 0, dw = 0, dh = 0, base = 16;

function place(){
  SW = stage.clientWidth; SH = stage.clientHeight;
  const fill = Math.max(SW / IW, SH / IH);
  dw = IW * fill; dh = IH * fill;
  const narrowL = SW < 700;
  for (const l of layers){
    const z = +l.dataset.z, s = (P - z) / P;
    const img = l.querySelector('img');
    const ratio = img.naturalHeight / img.naturalWidth || 0.5;
    if (narrowL && l.dataset.wm !== undefined){
      // 좁은 화면: 화면 폭·높이 기준으로 놓는다 (배경은 그대로 화면을 덮는다)
      const w = (+l.dataset.wm) * SW * s, h = w * ratio;
      l.style.width = w + 'px';
      l.dataset.dx = ((+l.dataset.cxm) - 0.5) * SW * s;
      l.dataset.dy = ((+l.dataset.bym) - 0 - 0.5) * SH * s - h / 2;
      continue;
    }
    const w = (+l.dataset.w) * dw * s;
    l.style.width = w + 'px';
    const h = w * ratio;
    l.dataset.dx = ((+l.dataset.cx) - 0.5) * dw * s;
    l.dataset.dy = l.dataset.by !== undefined
      ? ((+l.dataset.by) - 0 - 0.5) * dh * s - h / 2   // 뉴스 프레임: 앞쪽 층은 자막 띠 위로 올린다
      : ((+l.dataset.cy) - 0.5) * dh * s;
  }
  // 2026-09-12 [90]: 390px 화면은 계산값이 8px 이라 하한 13px 에 걸리고, 거기에 모바일 배율까지 곱해져 본문이 8.6px 로 나왔다.
  base = Math.max(SW < 700 ? 18 : 13, Math.min(30, Math.min(SW, SH * 1.75) * 0.0205));
  const narrow = SW < 700;
  for (const w of words){
    w.style.fontSize = ((w.dataset.tight !== undefined && SW >= 700) ? base * 0.9 : base) + 'px';   // 좁은 장면(02)은 글을 조금 작게 (좁은 화면에서는 더 줄이지 않는다)
    const colW0 = narrow ? Math.min(SW - 36, 400) : Math.min(SW * 0.31, 420);   // 좁은 기둥이 더 단정하다
    const colW = w.dataset.tight !== undefined ? Math.round(colW0 * 0.88) : colW0;
    const isFade = document.documentElement.dataset.box === 'fade' && w.dataset.card !== undefined;
    w.style.width = (isFade ? colW + Math.max(40, Math.round(SW * 0.075)) + 4.5 * base : w.dataset.card !== undefined ? colW + 2.7 * base : colW) + 'px';
  }
}

function render(p){
  const c = lerpKeys(KEYS, p, true), cz = c.z;
  const camK = Math.min(1, SW / 1440);            // 좁은 화면일수록 카메라 옆·위아래 이동을 줄인다
  const newsY = document.documentElement.dataset.frame ? -(SW < 700 ? 0.06 : 0.10) * SH : 0;   // 뉴스 프레임: 자막 띠만큼 화면 전체를 위로 든다 (발이 띠에 안 잘리게)
  const camx = c.x * camK, camy = c.y * (1 + (1 - camK) * 0.6) + newsY;   // 좁을수록 옆 이동은 줄이고 위로는 더 든다
  const zK = 0.6 + 0.4 * camK;                     // 폰 0.7배, 태블릿 0.8배, 데스크탑 1배
  const czA = cz > 0 ? cz * zK : cz;
  const fz = lerpKeys(FOCUS, p, false);
  cam.style.transform = `translate3d(${camx}px,${camy}px,${czA}px)`;

  const anchorX = {};
  for (const l of layers){
    const z = +l.dataset.z, eff = z + czA, effFade = z + cz;   // 사라지는 판정은 원래 카메라 경로(cz) 기준
    // 지나쳐 가면 사라진다 (층마다 사라지는 지점이 다르다)
    const f0 = +(l.dataset.fade0 ?? 620), f1 = +(l.dataset.fade1 ?? 860);
    let op = effFade > f0 ? Math.max(0, 1 - (effFade - f0) / (f1 - f0)) : 1;
    // 구간이 정해진 층(백화점 안쪽)은 그 구간에서만 보인다
    if (l.dataset.from !== undefined){
      const a = +l.dataset.from, b = +l.dataset.to, ease = 0.06;
      op *= Math.max(0, Math.min(1, (p - a) / ease)) * Math.max(0, Math.min(1, (b - p) / ease));
    }
    const blur = l.dataset.sharp !== undefined ? 0 : Math.min(MAX_BLUR, Math.abs(z - fz) / BLUR_PER);
    l.style.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : 'none';
    l.style.opacity = op;
    if (l.dataset.sharp !== undefined) l.classList.toggle('otw-on', op > 0.5);
    const f = P / (P - eff);
    let dy = +l.dataset.dy;
    if (document.documentElement.dataset.frame && l.dataset.band !== undefined){
      // 뉴스 프레임: 바닥 = 자막 띠 윗변(화면 크기와 무관한 고정 px). 층 밑변이 띠 위 offset 자리에 오도록 역산한다
      const cs = getComputedStyle(walk);
      const B = SH - (parseFloat(cs.getPropertyValue('--nf-ticker')) || 38) - (parseFloat(cs.getPropertyValue('--nf-band')) || 160) + (+l.dataset.band) * (SW < 700 ? 0.7 : 1), hh = l.offsetHeight;
      dy = (B - SH / 2) / f - hh / 2 - camy;
    }
    l.style.transform = `translate3d(calc(-50% + ${l.dataset.dx}px), calc(-50% + ${dy}px), ${z}px)`;
    anchorX[l.dataset.key] = SW / 2 + ((+l.dataset.dx) + camx) * f;
  }

  // 글 자리 격자: 옆 여백은 화면폭의 7.5%, 위 여백은 화면높이의 13% — 세 장면이 같은 선 위에 선다
  {
    const size = Math.max(64, Math.min(150, Math.round(SW * 0.095)));   // 정본 ORIGINAL 제목 급의 크기
    mark.style.setProperty('--markSize', size + 'px');
    mark.style.left = '0px';
    mark.style.top = Math.round(SH * 0.045) + 'px';
  }
  const markR = mark.getBoundingClientRect(), stR = stage.getBoundingClientRect();
  const markBox = { l: 0, r: markR.right - stR.left, b: markR.bottom - stR.top, on: document.documentElement.dataset.type !== 'none' };
  const narrowW = SW < 700;
  const M = narrowW ? 18 : Math.max(40, Math.round(SW * 0.075));
  const T = narrowW ? Math.round(SH * 0.10) : Math.round(SH * 0.13);
  for (const w of words){
    const on = Math.abs(p - +w.dataset.at) < 0.15;
    w.style.opacity = on ? 1 : 0;
    w.classList.toggle('otw-on', on);
    if (!on) continue;
    const bw = w.offsetWidth, bh = w.offsetHeight;
    let side = w.dataset.side;
    if (!side){ const ax = anchorX[w.dataset.anchor] ?? SW / 2; side = ax < SW / 2 ? 'right' : 'left'; }
    let x = side === 'right' ? SW - bw - M : M, y = w.dataset.tight !== undefined ? Math.round(SH * 0.08) : T;
    const fade = document.documentElement.dataset.box === 'fade' && w.dataset.card !== undefined;
    if (fade){ w.style.paddingLeft = M + 'px'; x = side === 'right' ? SW - bw : 0; }   // 페이드는 화면 끝에서 시작한다
    // 그림 속 가로선(백화점 캐노피)을 기준으로: 블록이 선 위에 다 들어가면 선 바로 위에,
    // 안 들어가면 제목과 설명 사이 틈에 선이 지나가게 앉힌다 — 글자를 선이 가로지르지 않는다
    if (w.dataset.snap){
      const lay = cam.querySelector('[data-key="' + w.dataset.snap + '"]');
      const r = lay.getBoundingClientRect(), st = stage.getBoundingClientRect();
      const [l0, l1] = w.dataset.line.split(',').map(Number);
      const u = Math.max(0, Math.min(1, ((x + bw / 2) - (r.left - st.left)) / r.width));   // 블록 가운데가 그림의 어디쯤인지
      const lineY = (r.top - st.top) + r.height * (l0 + (l1 - l0) * u);
      const gap = 0.35 * base;
      if (bh + gap <= lineY - M) y = lineY - bh - gap;
      else {
        const h2 = w.querySelector('h2'), h3 = w.querySelector('h3');
        // 제목 바닥과 설명 머리 사이 틈에 선이 오되, 선 두께와 세리프 글자의 내려오는 획을 감안해 위로 조금 더 띄운다
        const mid = (h2.offsetTop + h2.offsetHeight + h3.offsetTop) / 2;
        y = lineY - mid;
      }
    }
    if (!fade) x = Math.max(M, Math.min(SW - bw - M, x));
    if (markBox.on && x < markBox.r + 12 && y < markBox.b + 8) y = Math.round(markBox.b + 0.9 * base);   // 워드마크와 겹치면 그 아래로
    const topMin = w.dataset.snap ? Math.round(M * 0.45) : M;   // 선에 맞춘 블록은 위 여백을 조금 양보한다
    y = Math.max(topMin, Math.min(SH - bh - M, y));
    w.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    const h2 = w.querySelector('h2');
    if (h2){ h2.style.fontSize = '';
      const cs = getComputedStyle(w);
      const inner = w.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const over = h2.scrollWidth / inner;
      if (over > 1.001) h2.style.fontSize = (2.3 / over).toFixed(3) + 'em'; }
  }

  pEl.textContent = p.toFixed(2); zEl.textContent = Math.round(czA); xEl.textContent = Math.round(camx);
}

await Promise.all([...cam.querySelectorAll('img')].map(i =>
  i.complete ? Promise.resolve() : new Promise(r => i.addEventListener('load', r, { once: true }))));

/* ── 구동부 ────────────────────────────────────────────────────────────
   구간 안에서는 스크롤이 없다. 장면 번호(target)만 바뀌고, 진행값(prog)이 거기에
   붙는다. 그래서 어느 위치에 있든 동작이 똑같다. 페이지 스크롤은 들어오고 나갈 때만. */
const STOPS = [0.13, 0.52, 0.89];        // 01 · 02 · 03
const TAU   = 88;                         // 붙는 속도(105→88: 장면이 더 빨리 자리를 잡는다)
const QUIET = 220;                        // 이만큼 조용해야 새 제스처 (사이트 규칙: 한 번 굴림 = 한 칸, app.js 의 350ms 와 같은 결)
const COOLDOWN = 70;

let prog = 0, target = 0;
let lastWheel = 0, gestureOpen = true, lastCommit = 0;
let edgePush = 0, edgeAt = 0;   // 끝에서 한 번은 붙잡는다
let lastDir = 0;                // 방향이 바뀌면 새 제스처
let prevAbs = 0, fell = 0;      // 관성 꼬리는 계속 작아진다. 다시 커지면 사람이 또 쓴 것이다.
let gAcc = 0;                   // 이번 굴림에서 굴린 총량 — 살짝 스친 것과 진짜 굴린 것을 가른다
let running = false, prev = 0;
// 2026-09-10 정본 합침: 구간에 막 들어온 제스처의 관성 꼬리가 장면을 건너뛰지 않게, 들어온 방향에 맞는 첫 장면에서 시작하고,
// 끝 장면에서 한 번 더 굴리면 페이지 이동은 app.js 에 맡긴다 (tva:walk-leave). 서로 스크롤을 뺏지 않는다.
let wasActive = false, activeSince = -1e9, leaveUntil = 0, lastY = scrollY, scrollDir = 1, armed = false, inactiveSince = -1e9;
let entrySettled = true;   // 이 구간으로 데려온 제스처가 끝났는지(조용해졌는지)
let wheelSawActive = false;   // 굴림 처리 기준으로 본 직전 활성 상태

const pAt = (g) => {
  const a = Math.max(0, Math.min(STOPS.length - 1, Math.floor(g)));
  const b = Math.min(STOPS.length - 1, a + 1);
  return STOPS[a] + (STOPS[b] - STOPS[a]) * (g - a);
};
// 손가락으로 굴리는 기기인가 — 마우스는 app.js 가 굴릴 때마다 자리를 딱 맞춰 주지만, 터치는 맞춰 주는 사람이 없다
const COARSE = (navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer:coarse)').matches;
// 이 구간이 지금 화면을 차지하고 있는가
// 2026-09-12 [89]: 4px 만 허용하면 휴대폰 주소창이 오르내릴 때마다 판정이 거짓이 되어 걷기가 한 번도 안 켜졌다.
//   터치 기기에서만 허용 오차를 화면 비례로 넓힌다(마우스는 예전 그대로 4px — app.js 와 판정이 어긋나지 않게).
const SLACK = () => COARSE ? Math.max(28, innerHeight * 0.05) : 4;
const active = () => {
  const r = walk.getBoundingClientRect(), T = SLACK();
  return r.top <= NAVH() + T && r.bottom >= innerHeight - T;
};
// 거의 다 보이는데 살짝 어긋나 있으면 딱 맞춰 세운다
let aligning = false;
const alignGoal = () => Math.round(scrollY + walk.getBoundingClientRect().top - NAVH());   // offsetTop 대신 실제 화면 위치로 — 부모가 바뀌어도 맞는다
function alignIfClose(){
  if (aligning || active()) return;
  const r = walk.getBoundingClientRect();
  const shown = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
  // 터치는 착지가 넓게 흩어지므로 1/3 만 보여도 맞춘다. 마우스는 app.js 가 굴릴 때마다 자리를 맞추므로 예전 기준(0.55)을 그대로 둔다.
  if (shown > innerHeight * (COARSE ? 0.35 : 0.55)){
    aligning = true;
    scrollTo({ top: alignGoal(), behavior: 'smooth' });
    // 부드러운 이동은 남은 터치 관성에 취소된다. 0.5초 뒤에도 안 맞으면 한 번만 즉시 이동으로 마무리한다(터치 전용).
    if (COARSE) setTimeout(() => { if (!active()) scrollTo({ top: alignGoal(), behavior: 'instant' }); }, 500);
    setTimeout(() => { aligning = false; }, COARSE ? 640 : 420);
  }
}
// 터치: 손을 뗀 뒤 관성까지 멈추면 한 번 더 맞춘다 (굴림이 없는 기기에는 자리를 맞춰 줄 사람이 없다)
let settleTimer = 0;
function scheduleSettle(){
  if (!COARSE) return;
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => { if (performance.now() >= leaveUntil) alignIfClose(); }, 200);
}

function loop(now){
  const dt = Math.min(64, now - prev || 16); prev = now;
  const isActive = active();
  if (!isActive && wasActive) inactiveSince = now;
  // 착지 보정 같은 2~3px 흔들림으로 잠깐 벗어났다 돌아온 것은 새로 들어온 게 아니다
  // 자리를 잡는 동안 들어온 굴림이 곧바로 '나가기'로 처리되지 않도록, 활성으로 바뀌는 순간에는
  // 400ms 조건과 상관없이 항상 '들어온 제스처가 아직 안 끝났다'로 표시한다.
  if (isActive && !wasActive) entrySettled = false;
  if (isActive && !wasActive && now - inactiveSince > 400){ activeSince = now; target = scrollDir > 0 ? 0 : STOPS.length - 1; prog = target; gestureOpen = false; gAcc = 0; fell = 0; armed = false; lastDir = scrollDir; (window.__wheelLog ||= []).push({ act: Math.round(now), dir: scrollDir, y: scrollY }); }
  wasActive = isActive;
  // 동작 줄이기(OS 설정 또는 사이트 토글 html.reduced-motion)면 장면을 즉시 배치한다
  const reducedMotion = document.documentElement.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  prog = reducedMotion ? target : prog + (target - prog) * (1 - Math.exp(-dt / TAU));
  if (Math.abs(target - prog) < 0.0008) prog = target;
  render(pAt(prog));
  window.__dbg = { prog, target, active: active(), y: scrollY, stops: STOPS.length };
  // 구간이 화면에 있는 동안은 루프를 계속 돌린다.
  // (2026-09-12: '안 보일 때 루프 멈추기' 최적화를 넣었더니, 구간에 들어온 사실을 기록하는
  //  자리가 실행되지 않아 위로 올라올 때 ONLY TVA 가 통째로 건너뛰어졌다. 정확성을 우선한다.
  //  화면 밖에서는 active() 가 거짓이라 어차피 멈춘다.)
  if (Math.abs(target - prog) > 0.0008 || active()) requestAnimationFrame(loop);
  else running = false;
}
function kick(){ if (!running){ running = true; prev = performance.now(); requestAnimationFrame(loop); } }

function step(dir){
  const next = target + dir;
  if (next < 0 || next > STOPS.length - 1) return false;
  target = next; kick(); return true;
}

addEventListener('wheel', (e) => {
  const now = performance.now();
  const gap = now - lastWheel;
  const dir = e.deltaY > 0 ? 1 : -1;
  const a   = Math.abs(e.deltaY);

  // 기기 구분 — 톱니가 딱딱 걸리는 일반 마우스는 wheelDeltaY 가 120 의 배수로 들어온다
  const wd = Math.abs(e.wheelDeltaY || 0);
  const notch = e.deltaMode !== 0 || (wd >= 120 && wd % 120 === 0);

  // 새로 쓴 것으로 볼 조건 셋
  //  1) 손을 뗐다(조용해졌다)  2) 방향을 바꿨다
  //  3) 꺼져가던 신호가 다시 세졌다 — 관성 꼬리 도중에 또 쓴 경우. 이게 없어서 안 먹혔다.
  if (a < prevAbs - 0.5) fell++;
  const surge  = fell >= 3 && a >= 8 && a > prevAbs * 1.3 + 1;
  const turned = lastDir !== 0 && dir !== lastDir && a >= 4;   // 첫 굴림(lastDir=0)을 '방향 바꿈'으로 오인해 관성 꼬리마다 새 제스처로 열리던 버그 수정
  if (gap > QUIET || turned) { gestureOpen = true; fell = 0; gAcc = 0; lastDir = dir; if (now - activeSince > 250) armed = true; }   // 들어온 뒤 손을 한 번 뗀 다음부터만 듣는다 (관성 꼬리의 재가속은 새 제스처로 안 본다)
  gAcc += a;
  prevAbs = a;
  lastWheel = now;

  // 활성 여부를 여기서 직접 본다. 프레임 루프가 도는 시점과 굴림이 오는 시점이 어긋나서,
  // 루프가 '들어왔다'를 기록하기 전에 굴림이 먼저 도착하면 도착하자마자 나가 버렸다(실측).
  const nowActive = active();
  if (nowActive && !wheelSawActive) entrySettled = false;   // 막 들어왔다 → 이 제스처의 꼬리는 무시
  wheelSawActive = nowActive;
  if (!nowActive){ if (now >= leaveUntil) alignIfClose(); return; }
  // 이 구간으로 데려온 제스처의 꼬리는 삼킨다 (장면을 건너뛰지 않게)
  // 이 구간으로 데려온 제스처의 꼬리는 끝날 때까지 삼킨다(시간이 아니라 '조용해짐' 기준).
  // 트랙패드 한 번 튕김은 670ms 넘게 이어져서, 고정 시간으로 막으면 꼬리가 새어 나가
  // 도착하자마자 '나가기'가 실행되고 구간이 통째로 건너뛰어졌다.
  if (!entrySettled) {
    if (gap > QUIET) entrySettled = true;          // 손을 뗐다 → 이번 굴림부터 듣는다
    else { e.preventDefault(); return; }           // 아직 같은 제스처의 꼬리다
  }
  if (now < leaveUntil){ e.preventDefault(); return; }

  if (target + dir < 0 || target + dir > STOPS.length - 1){
    // 끝 장면에서 새로 굴리면 페이지 이동을 app.js 에 맡긴다. 한 번 굴림 = 한 칸.
    e.preventDefault();
    // 들어온 제스처가 끝나기 전에는 나가지 않는다 — 이게 없으면 도착하자마자 지나쳐 버린다
    if (gestureOpen && armed && entrySettled && now - lastCommit > 400){
      gestureOpen = false; leaveUntil = now + 850;   // 나간 뒤 잠금 1500→850 (역방향에서 '휠이 안 먹는' 느낌의 원인)
      dispatchEvent(new CustomEvent('tva:walk-leave', { detail: { direction: dir } }));
    }
    return;
  }
  edgePush = 0;
  e.preventDefault();

  (window.__wheelLog ||= []).push({ dir, target, gap: Math.round(gap), d: +a.toFixed(1), acc: Math.round(gAcc), notch, surge, open: gestureOpen });
  // 한 번 굴림 = 장면 한 칸. 톱니 마우스도 손을 뗐다 다시 굴려야 다음 장면으로 간다 (사이트 전체 규칙과 같게, 2026-09-10)
  const ready = armed && gestureOpen && (notch || gAcc >= 12) && now - lastCommit > 260;   // 장면 사이 최소 간격 400→260
  if (!ready) return;
  gestureOpen = false; lastCommit = now; lastDir = dir;
  (window.__wheelLog ||= []).push({ step: dir, t: Math.round(now), from: target, sinceAct: Math.round(now - activeSince), gap: Math.round(gap) });
  step(dir);
}, { passive: false });

addEventListener('keydown', (e) => {
  if (!active()) return;
  const d = ['ArrowDown', 'PageDown', ' '].includes(e.key) ? 1
          : ['ArrowUp', 'PageUp'].includes(e.key) ? -1 : 0;
  if (d && step(d)) e.preventDefault();
});
let ty0 = null;
addEventListener('touchstart', (e) => { ty0 = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', (e) => { if (active() && ty0 !== null) e.preventDefault(); }, { passive: false });
addEventListener('touchend', (e) => {
  if (ty0 === null) return;
  const dy = ty0 - (e.changedTouches[0]?.clientY ?? ty0); ty0 = null;
  if (!active()){ if (performance.now() >= leaveUntil) alignIfClose(); return; }
  if (performance.now() - activeSince < 700 || performance.now() < leaveUntil) return;
  if (Math.abs(dy) >= 34 && !step(dy > 0 ? 1 : -1)){
    leaveUntil = performance.now() + 1500;
    dispatchEvent(new CustomEvent('tva:walk-leave', { detail: { direction: dy > 0 ? 1 : -1 } }));
  }
}, { passive: true });

// 자리를 맞추려고 우리가 위로 굴린 것을 '위로 올라가는 중'으로 읽으면 들어오자마자 03 장면에서 시작한다 — aligning 중에는 방향을 갱신하지 않는다
addEventListener('scroll', () => { const y = scrollY; if (y !== lastY && !aligning) scrollDir = y > lastY ? 1 : -1; lastY = y; kick(); scheduleSettle(); }, { passive: true });
addEventListener('resize', () => { place(); render(pAt(prog)); }, { passive: true });
// 2026-09-12 [115]: 화면 밖에 있는 동안에도 이 구역의 애니메이션(뉴스 티커·LIVE 깜빡임·카드 등장·캐릭터 걸음·그림자)이
//   계속 돌아 CPU를 태운다. 구역이 화면에서 멀어지면 클래스를 붙여 CSS 로 통째로 세운다(다시 들어오면 이어서 돈다).
//   같은 관찰자로 뉴스 프레임 시계도 함께 세운다(지적 [110]).
if ('IntersectionObserver' in window){
  nfNear = false;
  new IntersectionObserver((es) => {
    for (const e of es){ walk.classList.toggle('otw-away', !e.isIntersecting); nfNear = e.isIntersecting; }
    if (nfNear) nfStart(); else nfStop();
  }, { rootMargin: '25% 0px' }).observe(walk);
  addEventListener('visibilitychange', () => { if (document.hidden) nfStop(); else nfStart(); });
} else nfStart();   // 관찰자가 없는 브라우저는 예전처럼 늘 돈다

place(); render(pAt(prog)); kick();
