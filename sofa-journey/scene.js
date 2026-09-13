import {createFallingActor} from './actor.js?v=eb-20260913';
import {createHallucinationVortex} from './vortex.js?v=eternal-beam-r49';
import {installSignalVeil} from './veil.js?v=fall-lab-54.hc254e7b1';
import {TYPE_CHUNKS, TYPE_STARS} from './type-layout.js?v=fall-lab-54.h87786693';
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const bound = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = (from, to, value) => { const p = clamp((value - from) / Math.max(.0001, to - from)); return p * p * (3 - 2 * p); };
const lerp = (from, to, value) => from + (to - from) * value;
const validAperture = aperture => aperture && [aperture.left, aperture.top, aperture.width, aperture.height].every(Number.isFinite) && aperture.width > 0 && aperture.height > 0;
const validCorners = corners => Array.isArray(corners) && corners.length === 4 && corners.every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
// ── [8] 저사양(CPU 6배 감속)에서 낙하가 끊기던 것을 고친 자리 — 2026-09-12
// 연출의 모양과 타이밍은 하나도 바꾸지 않았다. 프레임마다 '하는 일'만 줄였다.
//  (1) 값이 안 바뀐 스타일은 다시 쓰지 않는다 — 한 줄 쓸 때마다 브라우저가 다시 계산한다
//  (2) 투명도 0 인 층(시대 사진 16장 중 보통 13장)은 손대지 않고 visibility 로 내려 그리기까지 건너뛴다
//  (3) 위치 읽기(getBoundingClientRect)를 스타일 쓰기보다 먼저 해서 강제 재계산을 없앤다
const sv = (el, prop, value) => { const c = el.__sv || (el.__sv = {}); if (c[prop] === value) return; c[prop] = value; el.style[prop] = value; };
const svar = (el, name, value) => { const c = el.__sv || (el.__sv = {}); if (c[name] === value) return; c[name] = value; el.style.setProperty(name, value); };
const sd = (el, key, value) => { const c = el.__sd || (el.__sd = {}); if (c[key] === value) return; c[key] = value; el.dataset[key] = value; };
const asset = path => { const u = new URL(`./assets/${path}`, import.meta.url); u.searchParams.set('v', 'eternal-beam-r96'); return u.href; };
const rootAsset = path => { const u = new URL(`../assets/${path}`, import.meta.url); u.searchParams.set('v', 'eternal-beam-r96'); return u.href; };
const N = 16, D = 1500, HOLD = 340;
const ERA_END = .68, IMPACT = .95, SETTLED = .97, FAR = .10, ROOM_IN = .80, ROOM_FADE = .045;
// ── [104] 동작 줄이기(reduced-motion) 정거장 — 2026-09-12
// 예전에는 reduced 일 때 진행도를 1 로 못박아, 낙하 구간 전체가 '이미 앉은 마지막 한 컷'으로 접혔다.
// 그래서 시대 배경 16장과 연도·채널 라벨이 통째로 도달 불가능했다(실측 0/16장).
// 지금은 진행도를 '정거장' 단위로 끊는다 — 시대 통로는 사진 16칸, 도착한 방은 4칸.
// 칸과 칸 사이에는 아무것도 보간되지 않으므로 화면이 흐르지 않고 한 칸씩 '툭' 바뀐다.
// 관성·기울기·속도선·흔들림은 아래 draw 안에서 reduced 일 때 이미 전부 0 이라 그대로 꺼져 있다.
// 진행도 0 은 아직 첫 화면(TV) 안이라 낙하 구간이 화면에 없다. 그래서 enter(낙하 구간이 화면에
// 들어오는 지점)부터 16칸을 나눠야 앞쪽 사진 몇 장이 화면 밖에서 지나가 버리지 않는다.
const ROOM_STOPS = [.70, .86, .94, 1];               // 어두운 통로 → 방 등장 → 소파 근처 → 착석
const stepStation = (raw, enter = 0) => raw >= ERA_END ? N - 1
  : Math.min(N - 1, Math.max(0, Math.floor((raw - enter) / Math.max(.05, ERA_END - enter) * N)));
const stepProgress = (raw, enter = 0) => raw >= ERA_END
  ? ROOM_STOPS[Math.min(ROOM_STOPS.length - 1, Math.floor((raw - ERA_END) / (1 - ERA_END) * ROOM_STOPS.length))]
  : (stepStation(raw, enter) + .5) / N * ERA_END;    // 칸 한가운데 값을 써서 사진이 정확히 화면 중앙에 선다
const frameTilt = [[-3,1.5,-2],[2,-1,2.5],[-4,2,-1.5],[3,-1.5,2],[-2,1,-2],[4,-2,1.5],[-3,1.5,-2.5],[2,-1,1]];
const DEPTH_Z = [-90, -320, -160, -420, -120, -360, -200, -280, -340, -110, -260, -430, -150, -380, -220, -300];
const filters = ["saturate(1.08) contrast(1.04)","saturate(1.08) contrast(1.04)","saturate(1.06) contrast(1.03)","saturate(1.06) contrast(1.03)","saturate(1.05) contrast(1.04)","saturate(1.05) contrast(1.04)","saturate(1.08) contrast(1.03)","saturate(1.08) contrast(1.03)","saturate(1.06) contrast(1.04)","saturate(1.06) contrast(1.04)","saturate(1.04) contrast(1.05)","saturate(1.04) contrast(1.05)","saturate(1.08) contrast(1.04)","saturate(1.08) contrast(1.04)","saturate(1.06) contrast(1.03)","saturate(1.1) contrast(1.05)"];
const eras = [["b1-1920s.webp","LATENT"],["c1-1936.webp","ARCHIVE"],["c2-1945.webp","MEMORY"],["b2-1956.webp","FLOW"],["c3-1964.webp","CLUSTER"],["b3-1969.webp","STORM"],["c4-1977.webp","DREAM"],["c5-1985.webp","CORE"],["b4-1988.webp","THRESHOLD"],["b5-1989.webp","FORM"],["b6-1991.webp","PORTAL"],["c6-1996.webp","SOLID"],["b7-2002.webp","WORLD"],["c7-2006.webp","ROOM"],["c8-2012.webp","ARRIVAL"],["b8-2020s.webp","BEAM"]];

function portalMatrix(corners, source, width, height, resolve = 0) {
  const viewport=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}], mix=clamp(resolve);
  const points=corners.map((point,index)=>({x:point.x+(viewport[index].x-point.x)*mix,y:point.y+(viewport[index].y-point.y)*mix}));
  const sl=source.left*(1-mix), st=source.top*(1-mix), sw=source.width+(width-source.width)*mix, sh=source.height+(height-source.height)*mix;
  const [p0,p1,p2,p3]=points, dx1=p1.x-p2.x, dx2=p3.x-p2.x, dx3=p0.x-p1.x+p2.x-p3.x, dy1=p1.y-p2.y, dy2=p3.y-p2.y, dy3=p0.y-p1.y+p2.y-p3.y;
  const denominator=dx1*dy2-dx2*dy1; let g=0,h=0;
  if(Math.abs(dx3)+Math.abs(dy3)>.000001&&Math.abs(denominator)>.000001){g=(dx3*dy2-dx2*dy3)/denominator;h=(dx1*dy3-dx3*dy1)/denominator;}
  const a=p1.x-p0.x+g*p1.x,b=p3.x-p0.x+h*p3.x,c=p0.x,d=p1.y-p0.y+g*p1.y,e=p3.y-p0.y+h*p3.y,f=p0.y;
  const ua=a/sw,ub=b/sh,ud=d/sw,ue=e/sh,ug=g/sw,uh=h/sh,k=1-ug*sl-uh*st;
  const values=[ua/k,ud/k,0,ug/k,ub/k,ue/k,0,uh/k,0,0,1,0,(c-ua*sl-ub*st)/k,(f-ud*sl-ue*st)/k,0,1];
  return values.every(Number.isFinite)?`matrix3d(${values.map(value=>value.toFixed(9)).join(',')})`:'none';
}

function installStyle(documentRef){
  if(!documentRef.querySelector('link[data-sofa-journey-style]')){
    const link=documentRef.createElement('link'); link.dataset.sofaJourneyStyle=''; link.rel='stylesheet'; const styleUrl=new URL('./scene.css',import.meta.url); styleUrl.search=new URL(import.meta.url).search; link.href=styleUrl.href; documentRef.head.append(link);
  }
  if(!documentRef.querySelector('link[data-brand-mark-style]')){
    const brand=documentRef.createElement('link'); brand.dataset.brandMarkStyle=''; brand.rel='stylesheet'; const brandUrl=new URL('../brand-mark.css',import.meta.url); brandUrl.search='?v=eternal-beam-r29'; /* index.html 과 같은 판 번호여야 한 번만 받는다 */ brand.href=brandUrl.href; documentRef.head.append(brand);
  }
}

function applyPortal(mount, aperture, bridge, reduced){
  const projected=aperture?.projected===true&&validCorners(aperture.corners)&&!reduced&&bridge<1;
  if(projected){
    const resolve=clamp(aperture.projectionResolve), apertureAspect=aperture.width/aperture.height, viewportAspect=innerWidth/innerHeight;
    const sourceWidth=viewportAspect>apertureAspect?innerHeight*apertureAspect:innerWidth, sourceHeight=viewportAspect>apertureAspect?innerHeight:innerWidth/apertureAspect;
    const source={left:(innerWidth-sourceWidth)*.5,top:(innerHeight-sourceHeight)*.5,width:sourceWidth,height:sourceHeight};
    const clipLeft=source.left*(1-resolve),clipTop=source.top*(1-resolve),clipRight=(innerWidth-source.left-source.width)*(1-resolve),clipBottom=(innerHeight-source.top-source.height)*(1-resolve);
    sv(mount,'transformOrigin','0 0'); sv(mount,'transform',portalMatrix(aperture.corners,source,innerWidth,innerHeight,resolve));
    sv(mount,'clipPath',`inset(${clipTop.toFixed(2)}px ${clipRight.toFixed(2)}px ${clipBottom.toFixed(2)}px ${clipLeft.toFixed(2)}px round ${(Math.min(sourceWidth,sourceHeight)*.095*(1-resolve)).toFixed(2)}px)`);
    return `brightness(${lerp(.68,1,resolve).toFixed(3)}) saturate(${lerp(.72,1,resolve).toFixed(3)}) sepia(${lerp(.14,0,resolve).toFixed(3)})`;
  }else if(validAperture(aperture)&&!reduced&&bridge<.999){
    sv(mount,'transform','none');
    if(validCorners(aperture.corners)) sv(mount,'clipPath',`polygon(${aperture.corners.map(point=>`${point.x.toFixed(2)}px ${point.y.toFixed(2)}px`).join(',')})`);
    else {const right=Math.max(0,innerWidth-aperture.left-aperture.width),bottom=Math.max(0,innerHeight-aperture.top-aperture.height);sv(mount,'clipPath',`inset(${Math.max(0,aperture.top)}px ${right}px ${bottom}px ${Math.max(0,aperture.left)}px round ${(aperture.width*.12).toFixed(2)}px)`);}
    return 'none';
  }
  sv(mount,'transform','none');sv(mount,'clipPath','none');
  return 'none';
}

function projectedSourceRect(aperture, bridge, reduced, width, height){
  if(aperture?.projected!==true||!validCorners(aperture.corners)||reduced||bridge>=1)return {left:0,top:0,width,height};
  const apertureAspect=aperture.width/aperture.height,viewportAspect=width/height,sourceWidth=viewportAspect>apertureAspect?height*apertureAspect:width,sourceHeight=viewportAspect>apertureAspect?height:width/apertureAspect;
  return {left:(width-sourceWidth)*.5,top:(height-sourceHeight)*.5,width:sourceWidth,height:sourceHeight};
}

export function createSofaJourneyScene(mount, wake=()=>{}){
  installStyle(mount.ownerDocument); mount.classList.add('sofa-journey'); mount.closest('#drop')?.classList.add('sofa-journey-ready');
  const hxWebm=asset('bg/photo-shaft-fall.webm'),hxMp4=asset('bg/photo-shaft-fall.mp4'),hxStill=asset('bg/photo-shaft.jpg');
  mount.innerHTML=`<div class="sofa-journey__hx"><div class="sofa-journey__hx-spin"><img class="sofa-journey__hx-still" src="${hxStill}" alt=""><video class="sofa-journey__hx-video" muted playsinline preload="none" disablepictureinpicture poster="${hxStill}"><source src="${hxWebm}" type="video/webm"><source src="${hxMp4}" type="video/mp4"></video></div></div><div class="sofa-journey__camera"></div><i class="sofa-journey__white"></i><div class="sofa-journey__landing"><img class="sofa-journey__bg" src="${asset('bg/landing-sofa-empty-v2.webp')}" alt=""><p class="sofa-journey__moment">Keep Our<br>Memory Moment</p><div class="sofa-journey__type" aria-hidden="true"></div></div><div class="sofa-journey__cushion"><img src="${asset('bg/landing-sofa-empty-v2.webp')}" alt=""></div><i class="sofa-journey__contact-shadow"></i><i class="sofa-journey__burst"></i><div class="sofa-journey__streak-layer"><i class="sofa-journey__speed"></i><i class="sofa-journey__speed"></i><i class="sofa-journey__speed"></i><i class="sofa-journey__speed"></i><i class="sofa-journey__speed"></i><i class="sofa-journey__speed"></i></div><div class="sofa-journey__dust-layer"><i class="sofa-journey__dust"></i><i class="sofa-journey__dust"></i><i class="sofa-journey__dust"></i><i class="sofa-journey__dust"></i><i class="sofa-journey__dust"></i><i class="sofa-journey__dust"></i><i class="sofa-journey__dust"></i></div><div class="sofa-journey__mascot sofa-journey__actor"></div><i class="sofa-journey__grain"></i><i class="sofa-journey__mask"></i>`;
  const camera=mount.querySelector('.sofa-journey__camera'),hx=mount.querySelector('.sofa-journey__hx'),hxSpin=mount.querySelector('.sofa-journey__hx-spin'),hxVid=mount.querySelector('.sofa-journey__hx-video'),underlay=mount.querySelector('.sofa-journey__white'),landing=mount.querySelector('.sofa-journey__landing'),cushion=mount.querySelector('.sofa-journey__cushion'),actor=mount.querySelector('.sofa-journey__actor'),shadow=mount.querySelector('.sofa-journey__contact-shadow'),burstGlow=mount.querySelector('.sofa-journey__burst'),dust=[...mount.querySelectorAll('.sofa-journey__dust')],speed=[...mount.querySelectorAll('.sofa-journey__speed')],grain=mount.querySelector('.sofa-journey__grain'),mask=mount.querySelector('.sofa-journey__mask'),streakLayer=mount.querySelector('.sofa-journey__streak-layer'),dustLayer=mount.querySelector('.sofa-journey__dust-layer');
  const rig=createFallingActor(actor),seated=rig.goya,card=rig.cards[0];
  mount.classList.add('sofa-journey--shaft');
  const vortex=createHallucinationVortex(mount, rootAsset);
  if(vortex.canvas){ vortex.canvas.hidden=true; vortex.canvas.style.display='none'; }
  const typeBlock=mount.querySelector('.sofa-journey__type');
  typeBlock.innerHTML='';
  typeBlock.setAttribute('hidden','');
  const veil=installSignalVeil(mount.ownerDocument);
  hxVid.addEventListener('loadeddata',wake,{once:true});
  mount.querySelectorAll('img').forEach(image=>{if(!image.complete)image.addEventListener('load',wake,{once:true});});
  // [107] 낙하 구간이 화면에서 멀면 합성 레이어 예약(will-change)을 통째로 내린다.
  // 화면 앞뒤 60% 여유를 두고 미리 켜므로, 되돌아올 때 레이어가 늦게 올라오는 일은 없다.
  let liveWatcher=null, videoWatcher=null, videoOn=false;
  const liveTarget=mount.closest('#drop')||mount;
  if(typeof IntersectionObserver==='function'){
    liveWatcher=new IntersectionObserver(entries=>{for(const entry of entries)mount.classList.toggle('is-live',entry.isIntersecting);},{rootMargin:'60% 0px 60% 0px'});
    liveWatcher.observe(liveTarget);
    // 2026-09-12 #N02: 재생 판단은 is-live 로 하면 안 된다. is-live 는 합성 레이어를 미리 올리려고
    // 앞뒤 60% 를 더 보기 때문에, 첫 화면(y=0)에서 이미 켜져 있다 — 그 값으로 재생을 판단하면
    // 10MB 영상을 첫 로드에 그대로 얹는다(실측으로 확인). 재생은 '진짜로 화면에 걸쳐 있을 때'만 한다.
    // 그리고 관찰자가 켜질 때 한 번 깨워야 한다 — 안 그러면 통로에 가만히 서 있을 때
    // 다음 스크롤이 올 때까지 배경 영상이 첫 프레임에 멈춰 있다(실측: y=1400 에서 2.2초 뒤에도 paused).
    videoWatcher=new IntersectionObserver(entries=>{for(const entry of entries){
      const on=entry.isIntersecting;
      if(on!==videoOn){videoOn=on;wake();}
    }},{rootMargin:'0px'});
    videoWatcher.observe(liveTarget);
  } else {mount.classList.add('is-live');videoOn=true;}
  let handoff=0, impactAt=0, cardImpactAt=0;
  // [8] 시대 사진 16장의 transform 은 화면 높이가 바뀔 때만 달라진다 — 프레임마다 다시 만들지 않는다
  let tfStep=-1; const tfCache=new Array(N);
  const buildFrameTransforms = S => { tfStep=S; for(let i=0;i<N;i++){const t=frameTilt[i%8],sign=i%2?-1:1,rz=t[0]*sign,rx=t[1]*sign,ry=t[2]*sign;tfCache[i]=`translate(-50%,-50%) translateY(${i*S}px) translateZ(${DEPTH_Z[i]}px) rotateZ(${rz}deg) rotateX(${(rx*.5).toFixed(2)}deg) rotateY(${ry}deg)`;} };
  function draw({progress=0,nowMs=performance.now(),reduced=false,aperture=null,bridgeProgress=1}={}){
    // [104] reduced 일 때도 스크롤을 따라간다. 다만 정거장 단위로 끊어 '흐르는 움직임'은 만들지 않는다.
    const raw=clamp(progress), inShaft=reduced&&raw<ERA_END;
    const shaftEnter=inShaft&&liveTarget!==mount&&liveTarget.offsetHeight>innerHeight*1.2?Math.min(.5,innerHeight/liveTarget.offsetHeight):0;
    const p=reduced?stepProgress(raw,shaftEnter):raw, bridge=reduced?1:clamp(bridgeProgress);
    const portalFilter=applyPortal(mount,aperture,bridge,reduced);
    // [8] 읽기를 쓰기보다 먼저. 아래 층 16장을 건드린 뒤에 읽으면 그 자리에서 배치를 다시 계산하느라 한 프레임이 통째로 날아간다
    const correction=bridge===1?-mount.getBoundingClientRect().top:0;
    // ---- vertical shaft: era frames stacked downward, camera descends with the falling character ----
    const Ucam=clamp(p/ERA_END), camAcc=Math.pow(Ucam,1.75), camDec=1-Math.pow(1-Ucam,2.6), camMix=smooth(.62,1,Ucam);
    // [104] reduced 에서는 카메라를 정거장(사진 한 장)에 딱 세우고, 통로에 있는 동안 사진을 100% 로 켠다.
    //       (평소의 서서히 밝아짐·어두워짐 구간은 16칸 가운데 앞뒤 몇 장을 안 보이게 만들어 버린다)
    const camFrac=reduced?stepStation(raw,shaftEnter)/(N-1):lerp(camAcc,camDec,camMix);
    const S=innerHeight*1.0, camY=camFrac*(N-1)*S, eraFade=reduced?(inShaft?1:0):(1-smooth(.58,.66,p))*smooth(.11,.23,p);
    const suck=reduced?0:Math.pow(Ucam,1.18);
    const vortexDeg=reduced?0:-774*Math.pow(Ucam,1.12);
    const spinRad=vortexDeg*Math.PI/180,cAbs=Math.abs(Math.cos(spinRad)),sAbs=Math.abs(Math.sin(spinRad));
    const cover=reduced?1:Math.max(1.08,cAbs+(9/16)*sAbs,(16/9)*sAbs+cAbs)*1.05;
    const hxO=reduced?0:(1-smooth(.58,.70,p));
    sv(hx,'opacity',hxO>=.9995?'1':hxO.toFixed(4));
    sv(hx,'visibility',hxO>.01?'visible':'hidden');
    if(hxVid){
      // 2026-09-12 #N02: 낙하 구간이 아직 화면 근처에 오지도 않았는데 첫 화면에서 바로 play() 가 불려
      // 10MB(webm)/21MB(mp4) 영상을 통째로 내려받고 있었다(실측: 첫 로드 전송 1위 10,075KB).
      // videoOn 은 #drop 이 '진짜로 화면에 걸쳐 있을 때'만 참이다(rootMargin 0).
      // (예전에는 여기서 is-live 를 직접 붙여 관찰자를 건너뛰었다)
      const wantPlay=!reduced&&hxO>.02&&videoOn;
      if(wantPlay){
        if(hxVid.paused&&hxVid.currentTime<Math.max(0,(hxVid.duration||8)-.08))hxVid.play().catch(()=>{});
        const rate=0.94+suck*0.18;
        if(Math.abs((hxVid.playbackRate||1)-rate)>.08)hxVid.playbackRate=rate;
      }else if(!hxVid.paused)hxVid.pause();
      if(p<.02&&hxVid.currentTime>0.05){try{hxVid.currentTime=0;}catch(_){}}
    }
    sv(hxSpin,'transform',reduced?'none':`scale(${cover.toFixed(3)}) rotate(${vortexDeg.toFixed(2)}deg)`);
    const topCalc=`calc(50% + ${correction}px)`;sv(landing,'top',topCalc);sv(cushion,'top',topCalc);
    const wide=innerWidth/innerHeight>=1.25,roomWidth=Math.max(innerWidth,innerHeight*1672/941),roomHeight=roomWidth*941/1672,roomDX=0,roomDY=0,roomLeft=(innerWidth-roomWidth)*.5+roomDX,roomTop=(innerHeight-roomHeight)*.5+correction+roomDY,sitWidth=roomWidth*.198,sitHeight=sitWidth;
    const cubeCX=roomLeft+roomWidth*.622, cubeCY=roomTop+roomHeight*.352;
    const STAND_ASPECT=698/1086, standH=roomHeight*.50, standW=standH*STAND_ASPECT;
    const feetX=roomLeft+roomWidth*.508, feetY=roomTop+roomHeight*.708;
    const standLeft=feetX-standW*.50, standTop=feetY-standH;
    const targetX=feetX, targetY=feetY, sitFinalCaseX=feetX, sitFinalCaseY=feetY;
    svar(mount,'--sofa-room-width',`${roomWidth}px`);
    // ---- shaft choreography v2: the character falls AWAY from the camera (shrinking the whole way),
    //      lands small on the far sofa at the shaft bottom, then the camera dollies in to the room ----
    const U=clamp(p/ERA_END);
    const ph=2*Math.PI*1.35*Math.pow(U,1.2);
    const sway=Math.sin(ph)*(1-.25*U);
    const swayVel=Math.cos(ph);
    const breathe=1-.10*Math.sin(ph)*(1-smooth(.50,.64,p));
    const recoil=Math.sin(Math.PI*clamp(p/.12));
    const f=clamp((p-ROOM_IN)/(IMPACT-ROOM_IN));
    const gravity=.22*f+.78*f*f;
    const zoom=1;
    const s=1;
    const cx=innerWidth*.5, cy=innerHeight*.5+correction;
    const toScreen=(x,y)=>[cx+(x-cx)*s, cy+(y-cy)*s];
    const away=smooth(.60,ROOM_IN,p), awayPersp=1-Math.pow(1-away,2.2);    // long dark: falls away fast at first, then slowly
    const holeScale=lerp(1.16,.045,Math.pow(U,1.22));
    const orbit=innerWidth*.20*(1-Math.pow(U,1.1));
    const ang=spinRad-1.05;
    const passageScale=holeScale*breathe;
    const passageCaseX=cx+Math.cos(ang)*orbit;
    const passageCaseY=cy+Math.sin(ang)*orbit*.56;
    const burst=1-Math.pow(1-f,1.55);
    const popArc=Math.sin(Math.PI*f)*roomHeight*.028;
    const rCaseX=lerp(cubeCX,feetX,burst);
    const rCaseY=lerp(cubeCY,feetY,burst)-popArc;
    const [mCaseX,mCaseY]=toScreen(rCaseX,rCaseY);
    const roomScale=lerp(.24,1,burst);
    const drawHeight=p<ROOM_IN?sitWidth*passageScale:standH*roomScale;
    const drawWidth=p<ROOM_IN?drawHeight:standW*roomScale;
    const caseX=p<ROOM_IN?passageCaseX:mCaseX, caseY=p<ROOM_IN?passageCaseY:mCaseY;
    const roomFade=smooth(ROOM_IN,ROOM_IN+ROOM_FADE,p),roomFadeS=roomFade.toFixed(4);sv(landing,'opacity',roomFadeS);sv(cushion,'opacity',roomFadeS);sv(underlay,'opacity',roomFadeS);
    const q=clamp((p-IMPACT)/(1-IMPACT));
    if(p>=IMPACT&&!impactAt&&!reduced)impactAt=nowMs; if(p<IMPACT-.01)impactAt=0;
    const k=impactAt?clamp((nowMs-impactAt)/1900):0;
    const thump=impactAt?Math.exp(-k*9)*Math.sin(Math.PI*clamp(k*4.5)):0;
    const rebound=impactAt?Math.sin(Math.PI*clamp((k-.18)/.30))*(k>.18&&k<.48?1:0):0;
    const wiggle=impactAt?Math.sin((k-.35)*Math.PI*6)*(1-k)*(k>.35?1:0):0;
    const settle=reduced?0:((-rebound*roomHeight*.012)+(wiggle*roomHeight*.003))*s;
    const squash=reduced?0:thump*.06;
    const stretch=reduced||impactAt?0:.05*smooth(.08,.55,f)*(1-smooth(.55,.88,f));
    if(impactAt&&k<1)requestAnimationFrame(wake);
    const goyaPerch=smooth(IMPACT-.02,IMPACT+.05,p);
    const pose=reduced?'stand':p<ROOM_IN?(U<.22?'surprise':away>.45?'mid':'flail'):f<.48?'flail':'stand';
    const seatedNow=pose==='stand';
    const roll=reduced?0:p<ROOM_IN?vortexDeg*1.08+10*Math.sin(ph):seatedNow?0:lerp(18,0,burst)+wiggle*4;
    const pitch=reduced?0:p<ROOM_IN?8*sway*(1-U)+10*awayPersp:seatedNow?0:lerp(12,0,burst);
    const yaw=reduced?0:p<ROOM_IN?-6*swayVel*(1-U):0;
    const zDepth=reduced?0:p<ROOM_IN?lerp(140,-760,Math.pow(U,1.05)):lerp(-70,0,burst);
    const goyaX=caseX;
    const aPh=2*Math.PI*(.62+1.15*U)+.4;
    const bPh=2*Math.PI*(1.08+.55*U)+2.2;
    const cardTravel=0;
    const cardDrop=0;
    cardImpactAt=0;
    const dropEase=0;
    const cardThump=0;
    const cubeX=cubeCX, cubeTop=roomTop+roomHeight*.326;
    const slotW=roomWidth*.024;
    const flightW=Math.min(innerWidth*.14,innerHeight*.18)*lerp(1.02,.72,U);
    const cardW=lerp(flightW,slotW,cardTravel), cardH=cardW*1.58;
    const hoverBottom=cubeTop+cardH*.02;
    const insert=0.58;
    const slotBottom=cubeTop+cardH*insert;
    const cardBottomY=cardTravel<1
      ? lerp(cy+innerHeight*(p<ROOM_IN?.12:.04)*Math.sin(aPh*1.1),hoverBottom,cardTravel)
      : hoverBottom+(slotBottom-hoverBottom)*dropEase+cardThump*roomHeight*.006;
    const cardAX=lerp(cx+innerWidth*(p<ROOM_IN?.24:.06)*Math.sin(aPh),cubeX,cardTravel);
    const goyaDepth=Math.sin(ph);
    const aDepth=Math.sin(aPh);
    const cardARot=lerp(10*Math.sin(aPh*.5),0,cardTravel);
    const cardAPitch=lerp(16*aDepth,lerp(-6,0,dropEase),cardTravel);
    const cardO=0;
    const aScale=lerp(.88+.1*(aDepth*.5+.5),1,cardTravel);
    const aZed=lerp(aDepth*120,6,cardTravel);
    const clipA=cardDrop>.02?lerp(6,insert*100,Math.pow(cardDrop,1.25)):0;
    const goyaZ=seatedNow?10:7;
    const aZ=seatedNow?11:8;
    sv(camera,'transform',`translateX(${(-sway*innerWidth*.04).toFixed(2)}px) translateY(${(-camY).toFixed(2)}px) scale(${(1+Ucam*.16).toFixed(3)})`);
    rig.draw(p,reduced,pose);
    const ox=p<ROOM_IN?.5:.50, oy=p<ROOM_IN?.5:(seatedNow?.97:.5);
    sv(seated,'width',`${drawWidth}px`);sv(seated,'height',`${drawHeight}px`);    sv(seated,'transformOrigin',`${ox*100}% ${oy*100}%`);
    sv(seated,'transform',`translate3d(${(goyaX-drawWidth*ox).toFixed(2)}px,${(caseY-drawHeight*oy+settle).toFixed(2)}px,${zDepth.toFixed(1)}px) rotateX(${pitch.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg) rotateZ(${roll.toFixed(2)}deg) scale(${(1+squash*.6-stretch*.5).toFixed(4)},${(1-squash+stretch).toFixed(4)})`);
    sv(seated,'opacity','1');sv(seated,'zIndex',String(goyaZ));
    sv(card,'width',`${cardW}px`);sv(card,'height',`${cardH}px`);sv(card,'transformOrigin','50% 100%');
    sv(card,'clipPath',clipA>1?`inset(0 0 ${clipA.toFixed(1)}% 0)`:'none');
    sv(card,'transform',`translate3d(${(cardAX-cardW*.5).toFixed(2)}px,${(cardBottomY-cardH).toFixed(2)}px,${aZed.toFixed(1)}px) rotateX(${cardAPitch.toFixed(2)}deg) rotateZ(${cardARot.toFixed(2)}deg) scale(${aScale.toFixed(4)})`);
    sv(card,'opacity',cardO.toFixed(4));sv(card,'zIndex',String(aZ));
    card.classList.toggle('is-slotted', cardDrop>.82);
    if(cardImpactAt&&cardThump)requestAnimationFrame(wake);
    if(vortex.canvas&&!vortex.canvas.hidden)vortex.draw({ p, now: nowMs, reduced });
    sv(actor,'opacity',((1-handoff)*(p>0.015?1:0)).toFixed(4));
    const [shX,shY]=toScreen(targetX,targetY);
    const shadowO=smooth(.80,IMPACT,p)*(1-handoff);sv(shadow,'opacity',shadowO.toFixed(4));
    if(shadowO>.0015)sv(shadow,'transform',`translate(${shX.toFixed(1)}px,${shY.toFixed(1)}px) scale(${((.45+.35*smooth(.80,IMPACT,p))*s).toFixed(3)})`);
    // ---- sofa landing effects: cushion squash, short shake, ink dust puffs (all in room space, mapped by s) ----
    const impact=(thump+cardThump*.55)*(1-handoff);
    sv(landing,'transformOrigin','50% 50%');
    sv(landing,'transform',`translate(calc(-50% + ${roomDX}px),calc(-50% + ${roomDY}px)) translateY(${(impact*roomHeight*.016*Math.sin(k*70)*s).toFixed(2)}px) scale(${(s*(1+impact*.006)).toFixed(4)},${(s*(1-impact*.018)).toFixed(4)})`);
    const dent=0, spring=0;
    sv(cushion,'transform',`translate(calc(-50% + ${roomDX}px),calc(-50% + ${roomDY}px)) scale(${s.toFixed(4)},${(s*(1-.024*dent+.008*spring)).toFixed(4)})`);
    const rush=reduced||impactAt?0:smooth(.05,.22,f)*(1-smooth(.48,.78,f))*(1-handoff);
    const glow=reduced||p<ROOM_IN?0:(1-smooth(.04,.28,f))*smooth(0,.06,f)*(1-handoff);
    sv(burstGlow,'opacity',glow.toFixed(4));
    if(glow>.0015)sv(burstGlow,'transform',`translate(${cubeCX.toFixed(1)}px,${cubeCY.toFixed(1)}px) translate(-50%,-50%) scale(${(1.05+glow*2.4).toFixed(3)})`);
    if(rush<=.0015)sv(streakLayer,'visibility','hidden');
    else{
      sv(streakLayer,'visibility','visible');
      const rushO=(rush*.85).toFixed(4);
      const trailDx=cubeCX-caseX, trailDy=cubeCY-caseY;
      const trailAng=Math.atan2(trailDy,trailDx)*180/Math.PI-90;
      speed.forEach((el,i)=>{
        const off=(i-2.5)*drawWidth*.07;
        const len=drawHeight*(.7+.45*((i*7)%3)/2)*rush;
        sv(el,'opacity',rushO);
        sv(el,'height',`${len.toFixed(1)}px`);
        sv(el,'transform',`translate(${caseX.toFixed(1)}px,${caseY.toFixed(1)}px) rotate(${trailAng.toFixed(1)}deg) translate(${off.toFixed(1)}px,0)`);
      });
    }
    const puff=0;
    // [8] 먼지도 착지 순간에만 보인다 — 그 밖에는 7개를 건너뛴다
    if(puff<=.0015)sv(dustLayer,'visibility','hidden');
    else{sv(dustLayer,'visibility','visible');const puffO=puff.toFixed(4);dust.forEach((d,i)=>{const a=Math.PI*(.08+.84*i/(dust.length-1)),r=roomWidth*(.05+.03*(i%3))*Math.sqrt(clamp(k*2.6));const [dx,dy]=toScreen(targetX-roomWidth*.02+Math.cos(a)*r,targetY+roomWidth*.01-Math.sin(a)*r*.75);sv(d,'opacity',puffO);sv(d,'transform',`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${(((.5+.6*clamp(k*2.6))*(1-k*1.6))*s).toFixed(3)})`);});}
    const signal=reduced?0:p<.05?p/.05:p<.60?1:p<ROOM_IN?lerp(1,.85,smooth(.60,ROOM_IN,p)):(!impactAt?.85:lerp(.85,.42,smooth(.10,.55,k)));
    const signalGlitch=impactAt?Math.max(0,1-k*9)*(k<.12?1:0):0;
    veil.set(vortex.webgl?0:signal*(1-handoff), vortex.webgl?0:signalGlitch); veil.setLanding(vortex.webgl?0:.42);
    sv(mount,'filter',vortex.webgl?(bridge<.999?portalFilter:'none'):((!reduced&&bridge>=.999)?`blur(${(.65*signal).toFixed(2)}px) contrast(${(1-.03*signal).toFixed(3)}) saturate(${(1-.06*signal).toFixed(3)})`:portalFilter));
    typeBlock.classList.toggle('is-in', !!(impactAt&&k>=.42&&!reduced)||(reduced&&p>=IMPACT)); if(p<IMPACT-.01)typeBlock.classList.remove('is-in');
    const opticalVisibility=1-smooth(.60,.64,p)+smooth(.70,.76,p);
    sv(grain,'opacity',(.16*(1-smooth(.88,1,p))*opticalVisibility).toFixed(4));sv(mask,'opacity',((1-smooth(.88,1,p))*opticalVisibility).toFixed(4));
    sd(mount,'progress',p.toFixed(4));sd(mount,'phase',p<.60?'passage':p<ROOM_IN?'away':p<IMPACT?'burst':'stand');sd(mount,'actorScale',(drawHeight/standH).toFixed(4));sd(mount,'actorY',caseY.toFixed(2));sd(mount,'settled',String(p>=SETTLED));sv(mount,'opacity',(1-handoff).toFixed(4));
  }
  function drawArrival(progress=0,reduced=false){handoff=reduced?(clamp(progress)>=.2?1:0):smooth(0,.2,progress);sv(mount,'opacity',(1-handoff).toFixed(4));}
  function setHandoffProgress(progress=0){handoff=clamp(progress);sv(mount,'opacity',(1-handoff).toFixed(4));}
  return {draw,drawArrival,resize(){vortex.resize();},getCharacterRect(){return null;},setCharacterHidden(){},setHandoffProgress,dispose(){liveWatcher?.disconnect();videoWatcher?.disconnect();hxVid.pause();vortex.dispose();mount.closest('#drop')?.classList.remove('sofa-journey-ready');mount.replaceChildren();mount.classList.remove('sofa-journey','is-live');}};
}

export const createRoomEntryScene=createSofaJourneyScene;
