// ABOUT: 손그림 여섯 정거장 배경(strip.webp) 위를 캐릭터가 걸어 다니며 정거장마다 멈춰 포즈를 잡는다.
// 카메라(studio-track 이동)는 journey.js 그대로 쓰고, 이 파일은 배경 띠와 캐릭터 자리만 맡는다.
// 좌표 원본: Design_Studies/tva-about-anim-20260910/stops.js (띠 폭 10644×887, 칸 폭 1774)
const STRIP = { W: 10644, H: 887, PANEL: 1774, PANELS: 6, FLOOR: .95 };
const SEATF = .66; // 앉기 그림에서 엉덩이 높이(그림 높이 비율)
const P = STRIP.PANEL;
const STOPS = [
  { x: P * .355, pose: 'present', size: .50, ground: .95, seat: false, floor: .96 },  // 01 COMPANY — 골드 바로 왼쪽
  { x: P * 1.355, pose: 'letter', size: .50, ground: .95, seat: false, floor: .96 }, // 02 LETTER
  { x: P * 2.355, pose: 'point', size: .50, ground: .95, seat: false, floor: .96 },  // 03 IDENTITY
  { x: P * 3.355, pose: 'lookup', size: .50, ground: .95, seat: false, floor: .96 }, // 04 HOLOGRAM
  { x: P * 4.355, pose: 'tablet', size: .50, ground: .95, seat: false, floor: .96 }, // 05 MOTION
  { x: P * 5.355, pose: 'archive', size: .50, ground: .95, seat: false, floor: .96 }, // 06 ARCHIVE
  { x: P * 6.36, pose: 'usher', size: .50, ground: .95, seat: false, floor: .96 },   // 07 ALL PROCESSES — 다음으로 보냄
];
// 6번 칸 접수 테이블은 캐릭터보다 앞에 놓는 전경 층(띠 좌표에서 잘라낸 그림)
const TABLE_FG = { x: 9890, y: 540, w: 555, h: 310 };
// 5번 칸 원형 테이블+아크릴 굿즈도 캐릭터 앞 전경 층 (ABOUT 방 2026-09-10 확정본, _받는칸/2026-09-10_ABOUT방_상품칸-아크릴굿즈)
const TABLE_FG2 = { x: 7976, y: 480, w: 480, h: 382 };
const POSES = ['stand', 'walk1', 'walk1b', 'walk2', 'walk3', 'walk4', 'sit', 'present', 'letter', 'point', 'lookup', 'tablet', 'archive', 'usher'];
const WALK_FRAMES = ['walk1', 'walk2', 'walk3', 'walk4'];
// 2026-09-10 사장님 지적("포스트잇 붙이고 내려오는 거"): 팔 올린 그림(pointup)은 캔버스 안에서 몸통이 작고, 내려선 그림(stand)은 몸통이 캔버스를
// 거의 채운다. 같은 높이로 그리면 내려서는 순간 몸이 1.5배로 훌쩍 커졌다. 그림마다 몸통(모니터) 폭·중심·신발 아래끝을 재 두고(qa/fall-strip/pose_grid.py),
// 내려선 뒤에는 몸통 폭이 같아지도록 크기를 줄이고 몸통 중심과 신발 자리를 그대로 맞춘다.
const BODY_FRAC = .50;   // 캐릭터 키(모니터 위~신발 아래) = 띠 높이(887·배율)의 50% — 예전 걷는 크기와 같음
// 그림마다: 캔버스 폭 w, 몸통(모니터) 좌우 bodyL/bodyR(가로 중심 맞춤용), 모니터 위 bodyT, 신발 아래 shoeB (키 = shoeB−bodyT 로 배율을 정한다).
// 몸통 '폭'으로 맞추면 안 된다 — 걷는 그림은 3/4 옆모습이라 모니터가 좁고, 서 있는 그림은 정면이라 넓다(폭 기준이면 걷다 서는 순간 키가 40% 줄었음).
const GOYA_METRICS = { w: 1024, bodyL: 140, bodyR: 880, bodyT: 60, shoeB: 990 };
const POSE_METRICS = Object.fromEntries(POSES.map(name => [name, GOYA_METRICS]));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;

function init() {
  const about = document.querySelector('#about');
  const camera = about?.querySelector('.about-camera');
  const track = about?.querySelector('.studio-track');
  const host = about?.querySelector('.studio-host');
  const hostImage = host?.querySelector('img');
  if (!about || !camera || !track || !host || !hostImage) return;
  about.classList.add('about-walk');
  about.dataset.walkStrip = 'true';
  // journey.js 의 옛 캐릭터 조작(좌우 흔들기·달리기 그림 교체)은 이 속성이 있으면 쉰다.
  host.dataset.characterDirection = 'walk';
  host.dataset.characterPhase = 'rest';
  const base = new URL('./assets/about-walk/', import.meta.url).href;
  // 그림 파일 이름이 늘 같으므로(strip.webp 등) 스크립트의 ?v= 를 그림 주소에도 붙여 옛 캐시를 쓰지 않게 한다
  // 캐릭터 그림의 판 번호는 이 모듈의 판 번호와 별개다. 전에는 모듈의 ?v= 를 그대로 찍어
  // 같은 idle.png 를 nav-shelf(r51) 와 다른 주소로 한 번 더 내려받았다. journey.js 의 GOYA_V 와 같은 값을 쓴다.
  const ver = 'eb-20260914';
  const asset = name => `${base}${name}${ver ? `?v=${encodeURIComponent(ver)}` : ''}`;
  const strip = document.createElement('img');
  strip.className = 'about-walk__strip';
  strip.alt = '';
  strip.decoding = 'async';
  strip.src = asset('strip.webp');
  camera.insertBefore(strip, track);
  const tableFg = document.createElement('img');
  tableFg.className = 'about-walk__fg';
  tableFg.alt = '';
  tableFg.decoding = 'async';
  tableFg.src = asset('table_fg.webp');
  host.after(tableFg);
  const tableFg2 = document.createElement('img');
  tableFg2.className = 'about-walk__fg';
  tableFg2.alt = '';
  tableFg2.decoding = 'async';
  tableFg2.src = asset('table2_fg.webp');
  host.after(tableFg2);
  // 2번 칸: 캐릭터가 붙이고 내려온 뒤 벽에 남는 포스트잇 (팔 올린 그림의 메모 위치에서 잘라낸 그림)
  const note = document.createElement('img');
  note.className = 'about-walk__note';
  note.alt = '';
  note.src = asset('note.webp');
  note.hidden = true;
  host.before(note);
  const goyaBase = new URL('./assets/goya/', import.meta.url).href;
  const GOYA_FILE = {
    stand: 'idle.png', walk1: 'walk-a.png', walk1b: 'walk-b.png', walk2: 'walk-b.png',
    walk3: 'walk-c.png', walk4: 'walk-d.png',
    sit: 'sit.png', present: 'present.png', letter: 'letter.png', point: 'point.png',
    lookup: 'lookup.png', tablet: 'tablet.png', archive: 'archive.png', usher: 'usher.png',
  };
  const poseSrc = Object.fromEntries(POSES.map(name => {
    const file = GOYA_FILE[name] || 'idle.png';
    return [name, `${goyaBase}${file}${ver ? `?v=${encodeURIComponent(ver)}` : ''}`];
  }));
  // 그림을 미리 '디코딩'까지 해 둔다: src 만 바꾸면 새 그림이 준비될 때까지 한두 프레임 동안 옛 그림이 새 상자 크기로 그려져
  // (붙일 때 '작아졌다 커지는' 잔상) 보인다. 디코딩된 그림은 바꾸는 즉시 그려진다.
  const preloaded = POSES.map(name => { const img = new Image(); img.src = poseSrc[name]; if (img.decode) img.decode().catch(() => {}); return img; });
  window.__aboutPosePreload = preloaded;
  const swapImage = document.createElement('img');
  swapImage.className = 'studio-host__swap';
  swapImage.alt = '';
  swapImage.decoding = 'async';
  hostImage.after(swapImage);
  const POSE_BLEND_MS = 360;
  let poseSwapTimer = 0;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setPose(name, { blend = false } = {}) {
    const next = poseSrc[name];
    if (!next) return;
    if (hostImage.getAttribute('src') === next && !swapImage.classList.contains('is-in')) return;
    hostImage.style.visibility = '';
    if (!blend || reduceMotion() || !hostImage.getAttribute('src')) {
      if (poseSwapTimer) { clearTimeout(poseSwapTimer); poseSwapTimer = 0; }
      hostImage.src = next;
      swapImage.classList.remove('is-in');
      host.classList.remove('is-pose-swap');
      return;
    }
    if (swapImage.getAttribute('src') === next && swapImage.classList.contains('is-in')) return;
    if (poseSwapTimer) { clearTimeout(poseSwapTimer); poseSwapTimer = 0; }
    swapImage.src = next;
    swapImage.classList.remove('is-in');
    host.classList.remove('is-pose-swap');
    void swapImage.offsetWidth;
    swapImage.classList.add('is-in');
    host.classList.add('is-pose-swap');
    poseSwapTimer = setTimeout(() => {
      hostImage.src = next;
      swapImage.classList.remove('is-in');
      host.classList.remove('is-pose-swap');
      poseSwapTimer = 0;
    }, POSE_BLEND_MS);
  }
  let raf = 0;
  let walkingLoop = 0;
  let onScreen = false;        // ABOUT 이 화면에 걸쳐 있는가 — 밖이면 걷기/제자리 애니메이션 루프를 재우고 CPU 를 놓는다(2026-09-12 지적 [103])
  // 치수는 매 프레임 재지 않는다(전체 페이지 레이아웃을 강제해 0.4초씩 멈췄음). 크기 변화 때만 다시 잰다.
  let L = null;
  let lastHpx = 0;
  let lastPoseName = '';
  function measure() {
    if (about.classList.contains('is-linear')) { L = null; return; }
    const stationW = camera.clientWidth;
    const camH = camera.clientHeight;
    const travel = Math.max(0, track.scrollWidth - stationW);
    const narrow = innerWidth < 761;
    const floorY = camH * (narrow ? .9 : .86);         // 발이 닿는 화면 높이(정본 선반 = 아래 14%)
    // 배율은 폭 기준(칸 폭 = 그림 한 칸). 높이에 맞춰 줄이면 옆 칸이 비쳐 들어오고 글과 겹치므로 하지 않는다.
    // 납작한 화면에서는 그림 위쪽 여백이 상단 바 뒤로 들어가는데, 물건은 띠 y≥130 아래에 두어(포스터 벽 포함) 잘리지 않게 했다.
    const s = narrow ? Math.max(stationW / STRIP.PANEL, .42 * camH / STRIP.H) : stationW / STRIP.PANEL;
    const panelW = STRIP.PANEL * s;
    const k = panelW / stationW;                       // 띠가 스크롤보다 몇 배 빠른가(폭 기준일 때 1)
    const offset = Math.max(0, (stationW - panelW) / 2); // 칸보다 좁으면 가운데 맞춤
    const top = floorY - STRIP.FLOOR * STRIP.H * s;
    L = { stationW, camH, travel, s, panelW, k, offset, floorY, top, aboutTop: about.offsetTop, aboutH: about.offsetHeight, vh: innerHeight };
    about.style.setProperty('--aw-strip-top', `${top.toFixed(2)}px`);
    about.style.setProperty('--aw-strip-h', `${(STRIP.H * s).toFixed(2)}px`);
    strip.style.width = `${(STRIP.W * s).toFixed(2)}px`;
    strip.style.height = `${(STRIP.H * s).toFixed(2)}px`;
    tableFg.style.width = `${(TABLE_FG.w * s).toFixed(2)}px`;
    tableFg.style.height = `${(TABLE_FG.h * s).toFixed(2)}px`;
    tableFg2.style.width = `${(TABLE_FG2.w * s).toFixed(2)}px`;
    tableFg2.style.height = `${(TABLE_FG2.h * s).toFixed(2)}px`;
    lastHpx = 0;
  }
  // 칸을 바꿀 때 카메라는 그 자리에 두고, 고야만 화면을 가로질러 걷는다.
  // (카메라가 고야를 따라가면 배경이 같이 밀려 '미끄러져 넣는' 것처럼 보인다.)
  let charX = null;            // 캐릭터의 띠 좌표(x)
  let walk = null;             // { from, to, dir, phase:'out'|'in', cam, destX }
  const copyBoxes = [];        // 정거장별 글 잉크 범위(화면 좌표, 칸 시작 기준) — 캐릭터가 글과 겹치지 않게 서는 자리 계산용
  function copyBox(index) {
    if (copyBoxes[index] !== undefined) return copyBoxes[index];
    const st = track.children[index];
    const copies = st?.querySelectorAll('.station-copy');
    const copyRoot = copies?.length ? null : (st?.querySelector('.station-copy') || st);
    if (!copies?.length && !copyRoot) return (copyBoxes[index] = null);
    const rects = [];
    const collect = root => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim() || node.parentElement.closest('.exit-arrow')) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        for (const r of range.getClientRects()) if (r.width && r.height) rects.push(r);
      }
    };
    if (copies?.length) copies.forEach(collect); else collect(copyRoot);
    if (!rects.length) return (copyBoxes[index] = null);
    const stLeft = st.getBoundingClientRect().left;
    return (copyBoxes[index] = { right: Math.max(...rects.map(r => r.right)) - stLeft, bottom: Math.max(...rects.map(r => r.bottom)) - camera.getBoundingClientRect().top });
  }
  function stopX(index) {
    // 멈출 자리: 글 오른쪽 끝 다음이되, 오른쪽 검정 화면(칸의 약 절반) 안으로는 들어가지 않는다.
    const stop = STOPS[index]; const box = copyBox(index);
    const cap = index * STRIP.PANEL + STRIP.PANEL * .40;
    if (!box || !L) return Math.min(stop.x, cap);
    const hpx = STRIP.H * stop.size * L.s;
    const topAtStop = stop.seat ? L.top + stop.ground * STRIP.H * L.s - hpx * SEATF : L.top + STRIP.FLOOR * STRIP.H * L.s - hpx;
    if (topAtStop >= box.bottom + 8) return Math.min(stop.x, cap);
    const leftAtStop = L.offset + stop.x * L.s - L.k * index * L.stationW - hpx * .45;
    const need = box.right + 24 - leftAtStop;
    const next = need > 0 ? stop.x + need / L.s : stop.x;
    return Math.min(next, cap);
  }
  let facing = 1;              // 1=오른쪽, -1=왼쪽(뒤로 갈 때)
  let arrivedAt = 0, lastArrivedStation = -1, wasWalking = false;
  let lastTime = 0;
  const SPEED = STRIP.PANEL * 0.55;   // 초당 이동(띠 px): 화면의 약 절반을 1초쯤에 걸어 간다
  // 2026-09-13: 컷 간격 110ms → 80ms. 한 걸음(2컷)이 160ms 라 초당 여섯 걸음쯤 — '총총총' 하는 잔걸음이 된다.
  const WALK_FRAME_MS = 80;
  function stationDistance(index) {
    const el = track.children[clamp(index, 0, STOPS.length - 1)];
    return clamp(el ? el.offsetLeft : 0, 0, L.travel);
  }
  function stationIndexFromDistance(distance) {
    let index = 0;
    const probe = distance + L.stationW * .4;
    for (let i = 0; i < track.children.length; i++) {
      if (track.children[i].offsetLeft <= probe) index = i;
    }
    return clamp(index, 0, STOPS.length - 1);
  }
  function screenX(frac, cam) {
    return (frac * L.stationW - L.offset + L.k * cam) / L.s;
  }
  function pinScroll(distance) {
    document.documentElement.classList.add('is-about-walking');
    const top = L.aboutTop + distance;
    if (Math.abs(scrollY - top) < 2) return;
    window.scrollTo({ top, behavior: 'auto' });
  }
  function applyWorld(distance) {
    strip.style.transform = `translate3d(${(L.offset - L.k * distance).toFixed(2)}px,${L.top.toFixed(2)}px,0)`;
    tableFg.style.transform = `translate3d(${(L.offset + TABLE_FG.x * L.s - L.k * distance).toFixed(2)}px,${(L.top + TABLE_FG.y * L.s).toFixed(2)}px,0)`;
    tableFg2.style.transform = `translate3d(${(L.offset + TABLE_FG2.x * L.s - L.k * distance).toFixed(2)}px,${(L.top + TABLE_FG2.y * L.s).toFixed(2)}px,0)`;
  }
  function keepWalkingLoop() {
    if (!walkingLoop) walkingLoop = requestAnimationFrame(loop);
  }
  // 칸마다 물건이 닿는 바닥 행이 다르다(strip.webp 실측). 캐릭터 x 에 따라 앞뒤 정거장의 바닥 값을 잇는다.
  function floorAt(x) {
    const pts = STOPS.map(st => [st.x, st.floor ?? STRIP.FLOOR]);
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const t = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t; }
    return pts[pts.length - 1][1];
  }
  // ── 2026-09-12 지적 [101] 움직임 줄이기(reduced-motion)·낮은 화면에서는 ABOUT 이 세로로 펼쳐진다(is-linear).
  // 그때 가로로 흐르던 손그림 띠가 통째로 꺼져 글자만 남고, 캐릭터 앞 소품 두 장만 엉뚱한 자리에 겹쳐 있었다.
  // 고침: 정거장마다 띠에서 제 칸 하나씩을 잘라 정지 화면으로 깔고, 그 칸 안에 캐릭터·포스트잇·앞 소품을 같은 자리에 놓는다.
  // 자리 계산은 걷기와 똑같은 값(STOPS·POSE_METRICS)을 쓰되, 화면 크기와 무관하도록 전부 칸 크기의 백분율로 적는다.
  let linearBuilt = false;
  function buildLinear() {
    if (linearBuilt) return;
    linearBuilt = true;
    const put = (el, leftS, topS, wS, hS) => {   // 띠 좌표(px) → 칸 안 백분율
      el.style.left = `${(leftS / STRIP.PANEL * 100).toFixed(3)}%`;
      el.style.top = `${(topS / STRIP.H * 100).toFixed(3)}%`;
      el.style.width = `${(wS / STRIP.PANEL * 100).toFixed(3)}%`;
      el.style.height = `${(hS / STRIP.H * 100).toFixed(3)}%`;
    };
    [...track.children].forEach((station, index) => {
      const stop = STOPS[index];
      if (!stop) return;
      const panel = document.createElement('div');
      panel.className = 'about-walk__panel';
      panel.setAttribute('aria-hidden', 'true');
      // 띠 한 장을 칸 폭의 6배로 깔고 칸 번호만큼 왼쪽으로 민다(마지막 '나가는 칸'은 띠 밖이라 배경 없이 캐릭터만 선다)
      const stripPanel = document.createElement('img');
      stripPanel.className = 'awp-strip';
      stripPanel.alt = '';
      stripPanel.decoding = 'async';
      stripPanel.loading = 'lazy';
      stripPanel.src = asset('strip.webp');
      stripPanel.style.left = `${index * -100}%`;
      panel.append(stripPanel);
      const poseName = stop.then || stop.pose;           // 붙이고 내려선 뒤 모습(2번 칸)처럼 '도착한 다음' 자세로
      const PM = POSE_METRICS[poseName] || POSE_METRICS.stand;
      const k = BODY_FRAC * STRIP.H / (PM.shoeB - PM.bodyT);   // 그림 1px 이 띠에서 몇 px (키 기준, 걷기와 같은 식)
      const hS = 720 * k, wS = PM.w * k, localX = stop.x - index * STRIP.PANEL;
      const figure = document.createElement('img');
      figure.className = 'awp-figure';
      figure.alt = '';
      figure.decoding = 'async';
      figure.src = poseSrc[poseName] || poseSrc.stand;
      if (stop.flip) figure.style.transform = 'scaleX(-1)';
      put(figure,
        localX - (PM.bodyL + PM.bodyR) / 2 * k,
        (stop.seat ? stop.ground * STRIP.H - hS * SEATF : (stop.floor ?? STRIP.FLOOR) * STRIP.H - PM.shoeB * k) - (stop.lift ? stop.lift * STRIP.H : 0),
        wS, hS);
      figure.dataset.baseLeft = Number.parseFloat(figure.style.left);   // 글 피하기 전 원래 자리(다시 잴 때 기준)
      panel.append(figure);
      if (stop.note) {   // 2번 칸 벽에 남는 포스트잇 — 팔 올린 그림의 손끝 자리(걷기와 같은 계산)
        const PU = POSE_METRICS.pointup, kU = BODY_FRAC * STRIP.H / (PU.shoeB - PU.bodyT), upH = 720 * kU;
        const upLeft = localX - (PU.bodyL + PU.bodyR) / 2 * kU, upTop = STRIP.FLOOR * STRIP.H - PU.shoeB * kU;
        const nw = .137 * upH, nh = nw * 200 / 116;
        const noteCopy = document.createElement('img');
        noteCopy.className = 'awp-note';
        noteCopy.alt = '';
        noteCopy.decoding = 'async';
        noteCopy.src = asset('note.webp');
        put(noteCopy, upLeft + .067 * upH - nw / 2, upTop + .0625 * upH - .265 * nh, nw, nh);
        panel.append(noteCopy);
      }
      for (const fg of [[TABLE_FG2, 'table2_fg.webp'], [TABLE_FG, 'table_fg.webp']]) {   // 캐릭터보다 앞에 놓이는 테이블
        if (Math.floor(fg[0].x / STRIP.PANEL) !== index) continue;
        const fgCopy = document.createElement('img');
        fgCopy.className = 'awp-fg';
        fgCopy.alt = '';
        fgCopy.decoding = 'async';
        fgCopy.src = asset(fg[1]);
        put(fgCopy, fg[0].x - index * STRIP.PANEL, fg[0].y, fg[0].w, fg[0].h);
        panel.append(fgCopy);
      }
      station.prepend(panel);
    });
  }
  // 세로 배치에서도 캐릭터가 글을 가리지 않게 — 가로 배치의 stopX() 와 같은 규칙(글 오른쪽 끝 + 24px)
  function nudgeLinearFigures() {
    if (!linearBuilt || !about.classList.contains('is-linear')) return;
    for (const station of track.children) {
      const panel = station.querySelector('.about-walk__panel');
      const figure = panel?.querySelector('.awp-figure');
      const copy = station.querySelector('.station-copy');
      const base = Number.parseFloat(figure?.dataset.baseLeft ?? '');
      if (!panel || !figure || !copy || !Number.isFinite(base)) continue;
      figure.style.left = `${base.toFixed(3)}%`;      // 먼저 원래 자리로 되돌리고 다시 잰다
      const box = panel.getBoundingClientRect();
      if (!box.width) continue;
      const rects = []; const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT); let node;
      while ((node = walker.nextNode())) { if (!node.textContent.trim()) continue; const range = document.createRange(); range.selectNodeContents(node); for (const r of range.getClientRects()) if (r.width && r.height) rects.push(r); }
      if (!rects.length) continue;
      const fr = figure.getBoundingClientRect();
      if (fr.top >= Math.max(...rects.map(r => r.bottom)) + 8) continue;   // 글보다 아래면 겹칠 일이 없다
      const need = Math.max(...rects.map(r => r.right)) + 24 - fr.left;
      if (need > 0) figure.style.left = `${(base + need / box.width * 100).toFixed(3)}%`;
    }
  }
  function syncLinear() {
    if (!about.classList.contains('is-linear') || linearBuilt) return;
    buildLinear();
    requestAnimationFrame(nudgeLinearFigures);
  }
  function frame() {
    raf = 0;
    syncLinear();
    if (!L) measure();
    if (!L) return;
    const now = performance.now();
    const dt = lastTime ? Math.min(.05, (now - lastTime) / 1000) : 0;
    lastTime = now;
    const y = scrollY;
    let distance = walk ? walk.cam : clamp(y - L.aboutTop, 0, L.travel);
    if (walk) pinScroll(walk.cam);
    let station = walk
      ? (walk.phase === 'out' ? walk.from : walk.to)
      : stationIndexFromDistance(distance);
    let target = { ...STOPS[station], x: stopX(station) };
    const aboutOnScreen = y + L.vh > L.aboutTop && y < L.aboutTop + L.aboutH;
    onScreen = aboutOnScreen;
    if (charX === null || (!aboutOnScreen && !walk)) charX = target.x;
    let remain = 0;
    let walking = false;
    if (walk) {
      remain = walk.destX - charX;
      walking = true;
      facing = walk.dir;
      if (dt > 0) {
        const step = Math.min(Math.abs(remain), SPEED * dt);
        charX += Math.sign(remain || walk.dir) * step;
      }
      if (Math.abs(walk.destX - charX) <= 3) {
        charX = walk.destX;
        if (walk.phase === 'out') {
          walk.phase = 'in';
          walk.cam = stationDistance(walk.to);
          station = walk.to;
          target = { ...STOPS[station], x: stopX(station) };
          walk.destX = target.x;
          charX = screenX(walk.dir > 0 ? .08 : .90, walk.cam);
          pinScroll(walk.cam);
          distance = walk.cam;
        } else {
          station = walk.to;
          target = { ...STOPS[station], x: stopX(station) };
          walk = null;
          walking = false;
          document.documentElement.classList.remove('is-about-walking');
        }
      }
    } else {
      document.documentElement.classList.remove('is-about-walking');
      charX = target.x;
    }
    applyWorld(distance);
    const arrived = !walking;
    // 도착 시각: 정거장에 도착한 순간부터 재서, 붙이기(pointup) 뒤 내려서기(then) 같은 순서 연출에 쓴다
    if (arrived && (lastArrivedStation !== station || wasWalking)) { arrivedAt = now; lastArrivedStation = station; host.classList.remove('is-landing'); void host.offsetWidth; host.classList.add('is-landing'); if (target.then) setTimeout(schedule, target.thenMs + 30); }
    wasWalking = walking;
    const sinceArrival = arrived ? now - arrivedAt : 0;
    const afterPose = arrived && target.then && sinceArrival >= target.thenMs;
    // 2026-09-10 사장님 "달려오는 캐릭터 사이즈 같아야지": 걷는 그림·정거장 그림 모두 몸통(모니터) 폭이 화면에서 같도록 그림마다 배율을 정한다.
    // 그림별 몸통 좌우·신발 아래끝은 POSE_METRICS(qa/fall-strip/pose-grid 로 실측). 자리(charX)는 몸통 중심, 발은 바닥선, 앉는 칸은 엉덩이 높이 기준.
    const cycling = arrived && Array.isArray(target.cycle);
    const poseName = walking
      ? WALK_FRAMES[Math.floor(now / WALK_FRAME_MS) % WALK_FRAMES.length]
      : cycling ? target.cycle[Math.floor(sinceArrival / (target.cycleMs || 700)) % target.cycle.length] : (afterPose ? target.then : target.pose);
    const PM = POSE_METRICS[poseName] || POSE_METRICS.stand;
    const sPx = BODY_FRAC * STRIP.H * L.s / (PM.shoeB - PM.bodyT) * (PM.k || 1);   // 그림 1px 이 화면에서 몇 px (키 기준)
    const hpx = sPx * 720;                                              // 그림 캔버스 높이 720
    const hostW = sPx * PM.w;
    // 포스트잇: 팔 올린 그림 기준으로 손끝 자리(그림 안 비율: 왼쪽에서 .474·높이, 위에서 .102·높이)에 두고, 내려선 뒤에도 벽에 남긴다
    if (target.note && arrived) {
      const PU = POSE_METRICS.pointup; const sUp = BODY_FRAC * STRIP.H * L.s / (PU.shoeB - PU.bodyT) * (PU.k || 1); const upHpx = sUp * 720;
      const upTop = L.top + STRIP.FLOOR * STRIP.H * L.s - PU.shoeB * sUp;
      const upLeft = L.offset + target.x * L.s - L.k * distance - (PU.bodyL + PU.bodyR) / 2 * sUp;
      // v2 그림에서 손에 든 포스트잇: 캔버스(466×720) 안 x 0~95, y 0~90 → 중심 (.067, .0625)·높이, 폭 .132·높이. note.webp(116×200)는 위 2~105행이 포스트잇이라 그 중심(.265·nh)을 손 자리에 맞춘다
      const nw = .137 * upHpx, nh = nw * 200 / 116;
      note.style.left = `${(upLeft + .067 * upHpx - nw / 2).toFixed(2)}px`; note.style.top = `${(upTop + .0625 * upHpx - .265 * nh).toFixed(2)}px`; note.style.width = `${nw.toFixed(2)}px`; note.style.height = `${nh.toFixed(2)}px`;
      note.hidden = !afterPose;
    } else note.hidden = true;
    host.classList.toggle('is-hopping', arrived && Boolean(target.hop));
    const floorTop = L.top + floorAt(charX) * STRIP.H * L.s - PM.shoeB * sPx;   // 신발 아래끝이 그 자리 바닥선에
    const lift = arrived && target.lift ? target.lift * STRIP.H * L.s : 0;   // 받침대 위에 선 칸
    const top = (arrived && target.seat ? L.top + target.ground * STRIP.H * L.s - hpx * SEATF : floorTop) - lift;
    let cx = L.offset + charX * L.s - L.k * distance;
    // 2026-09-13 사장님 요청("총총총 걸어가는 모습"): 걷기 그림 4컷(walk-a~d)은 실측해 보면
    // 다리 자세가 서로 거의 같다 — 컷만 돌리면 걸음이 아니라 미끄러지는 것처럼 보인다.
    // 그래서 걸음은 그림이 아니라 '움직임'으로 만든다.
    //   한 걸음 = 2컷(=WALK_FRAME_MS×2). 걸음마다 작게 통통 튀고(bob), 몸이 살짝 기울었다 돌아온다(lean).
    //   예전에는 컷마다(110ms) 튀고 기울기는 8도로 고정이라, 몸이 기운 채 미끄러지는 모습이었다.
    const stepPhase = now / (WALK_FRAME_MS * 2) * Math.PI;      // 한 걸음의 위상
    const bob = walking ? Math.abs(Math.sin(stepPhase)) * hpx * .038 : 0;
    const lean = walking ? (facing > 0 ? -1 : 1) * (3.2 + Math.sin(stepPhase * 2) * 1.6) : 0;
    if (poseName !== lastPoseName) { host.style.transition = 'none'; requestAnimationFrame(() => { host.style.transition = ''; }); lastPoseName = poseName; }
    host.style.left = `${(cx - (PM.bodyL + PM.bodyR) / 2 * sPx).toFixed(2)}px`;
    host.style.top = `${top.toFixed(2)}px`;
    if (hostW !== lastHpx) { host.style.width = `${hostW.toFixed(2)}px`; host.style.height = `${hpx.toFixed(2)}px`; lastHpx = hostW; }
    if (!walking) facing = target.flip ? -1 : 1;
    const flipRight = facing > 0 ? '' : ' scaleX(-1)';
    host.style.transform = `${bob ? `translateY(${(-bob).toFixed(2)}px)` : ''}${lean ? ` rotate(${lean}deg)` : ''}${flipRight}`.trim();
    host.classList.toggle('is-walking', walking);
    host.classList.toggle('is-seated', arrived && target.seat);
    // 그림을 실제로 바꾸는 곳도 위에서 정한 poseName(간 거리 기준)을 그대로 쓴다.
    // 예전에는 여기만 시계(now/150)를 써서, 크기 계산과 보이는 그림이 따로 놀았다.
    if (walking) setPose(poseName, { blend: false });
    else setPose(poseName, { blend: true });
    host.classList.toggle('is-cycling', cycling);
    if ((walk || cycling || walking || host.classList.contains('is-pose-swap')) && onScreen && !walkingLoop) keepWalkingLoop();
  }
  function loop() {
    walkingLoop = 0;
    if (document.hidden) return;
    if (!raf) frame();
    if (onScreen && (walk || host.classList.contains('is-walking') || host.classList.contains('is-cycling') || host.classList.contains('is-pose-swap')) && !walkingLoop) keepWalkingLoop();
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
  const remeasure = () => { L = null; copyBoxes.length = 0; if (linearBuilt) requestAnimationFrame(nudgeLinearFigures); schedule(); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', remeasure);
  ['tva:motion', 'tva:restart', 'tva:navigate'].forEach(name => addEventListener(name, remeasure));
  addEventListener('tva:studio-station', schedule);
  addEventListener('tva:studio-station-intent', event => {
    const dir = Number(event.detail?.direction) || 0;
    if (!dir || walk) return;
    if (!L) measure();
    if (!L) return;
    const from = Number.isInteger(event.detail?.from)
      ? clamp(event.detail.from, 0, STOPS.length - 1)
      : stationIndexFromDistance(clamp(scrollY - L.aboutTop, 0, L.travel));
    const to = Number.isInteger(event.detail?.to)
      ? clamp(event.detail.to, 0, STOPS.length - 1)
      : clamp(from + dir, 0, STOPS.length - 1);
    if (to === from) return;
    facing = dir;
    if (reduceMotion()) {
      charX = stopX(to);
      pinScroll(stationDistance(to));
      document.documentElement.classList.remove('is-about-walking');
      schedule();
      return;
    }
    const cam = stationDistance(from);
    if (charX === null) charX = stopX(from);
    walk = {
      from, to, dir, phase: 'out', cam,
      destX: screenX(dir > 0 ? .90 : .10, cam),
    };
    pinScroll(cam);
    schedule();
    keepWalkingLoop();
  });
  strip.addEventListener('load', remeasure);
  new ResizeObserver(remeasure).observe(camera);
  // ABOUT 이 세로 배치(is-linear)로 바뀌는 순간은 클래스가 바뀔 때만 오므로, 1.5초마다 물어보지 않고 그 변화를 직접 본다
  new MutationObserver(() => syncLinear()).observe(about, { attributes: true, attributeFilter: ['class'] });
  // 다른 구역의 높이가 바뀌면(갤러리 로드 등) ABOUT 의 시작 위치가 밀리므로 가끔 다시 잰다.
  // 2026-09-12 지적 [14][110]: 이 검사는 offsetTop·scrollWidth 를 읽어 강제 레이아웃을 부른다. 세션 내내 돌던 것을
  // ABOUT 이 화면 근처에 있고 탭이 켜져 있을 때만 돌린다. 쉬는 동안 밀린 값은 다시 가까워지는 순간 한 번에 잰다.
  let driftTimer = 0, driftNear = true;
  const driftCheck = () => { if (L && (L.aboutTop !== about.offsetTop || L.travel !== Math.max(0, track.scrollWidth - camera.clientWidth))) remeasure(); };
  const driftStart = () => { if (driftTimer || document.hidden || !driftNear) return; driftCheck(); driftTimer = setInterval(driftCheck, 1500); };
  const driftStop = () => { if (driftTimer) { clearInterval(driftTimer); driftTimer = 0; } };
  if ('IntersectionObserver' in window) {
    driftNear = false;
    new IntersectionObserver(entries => {
      driftNear = entries[entries.length - 1].isIntersecting;
      if (driftNear) driftStart(); else driftStop();
    }, { rootMargin: '50% 0px' }).observe(about);
    addEventListener('visibilitychange', () => { if (document.hidden) driftStop(); else { driftStart(); schedule(); } });
  } else driftStart();   // 관찰자가 없는 브라우저는 예전처럼 늘 돈다
  frame();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
