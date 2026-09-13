const asset=file=>{const u=new URL(`../assets/${file}`,import.meta.url);u.searchParams.set('v','eb-20260914');return u.href;};
// 2026-09-13 #G02: goya-fall-surprise / flail / mid / tuck 네 파일은 **바이트까지 같은 그림**이다
//   (md5 13a14029… 네 개 모두 동일, 첫 커밋 f2d8262 때부터 그랬다).
//   낙하 네 컷을 만들려고 이름만 넷을 두고 같은 그림을 저장한 것이라, 화면에서는 자세가 전혀
//   바뀌지 않으면서 1,774KB 짜리 같은 파일을 네 번 내려받고 있었다(첫 로드에서 5.3MB 낭비).
//   같은 파일 하나를 가리키게 바꾼다 — 이름(자세) 구분은 그대로 두었으니, 진짜 네 컷이 생기면
//   아래 세 줄의 파일 이름만 되돌리면 된다.
const GOYA={
  surprise:'goya/goya-fall-surprise.png',
  flail:'goya/goya-fall-surprise.png',   // ← goya-fall-flail.png (surprise 와 같은 그림)
  mid:'goya/goya-fall-surprise.png',     // ← goya-fall-mid.png   (동일)
  tuck:'goya/goya-fall-surprise.png',    // ← goya-fall-tuck.png  (동일)
  seated:'goya/goya-tada.png',
  stand:'goya/goya-tada.png',
};
function makeImg(className){
  const el=document.createElement('img');
  el.className=className;
  el.alt='';
  el.decoding='async';
  return el;
}
function makeCard(file, extra=''){
  const el=makeImg(`sofa-journey__sit sofa-journey__card ${extra}`.trim());
  el.src=asset(file);
  el.setAttribute('aria-hidden','true');
  return el;
}
export function createFallingActor(mount){
  const goya=makeImg('sofa-journey__sit sofa-journey__goya');
  const cardA=makeCard('goya/photocard-insert-a.png');
  mount.append(cardA,goya);
  goya.src=asset(GOYA.surprise);
  // 2026-09-12 #N05: 낙하 포즈 그림은 한 장이 1.7MB 다. 네 장을 모듈이 켜지자마자 전부 받으면
  // 첫 화면 대역을 7MB 먹는다(실측: 첫 로드 전송 상위 2~5위가 전부 이 파일들).
  // 첫 장(surprise)만 바로 받고 나머지는 브라우저가 한가할 때 받는다 — 낙하 구간은 첫 화면 다음이라 늦지 않다.
  const warm=()=>{for(const file of Object.values(GOYA)){if(file===GOYA.surprise)continue;const pre=new Image();pre.decoding='async';pre.src=asset(file);}};
  if(typeof requestIdleCallback==='function')requestIdleCallback(warm,{timeout:2500});
  else setTimeout(warm,1200);
  let current='surprise';
  mount.dataset.pose=current;
  return {
    goya,
    cards:[cardA],
    get card(){return cardA;},
    draw(p,reduced=false,pose='flail'){
      const next=reduced?'stand':(GOYA[pose]?pose:(pose==='card'?'flail':'flail'));
      if(next!==current){
        goya.src=asset(GOYA[next]);
        mount.dataset.pose=current=next;
      }
    },
  };
}
