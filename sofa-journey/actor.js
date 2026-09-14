const asset=file=>{const u=new URL(`../assets/${file}`,import.meta.url);u.searchParams.set('v','eb-20260914al');return u.href;};
const GOYA={
  surprise:'goya/goya-photo-fall-clothes.png',
  flail:'goya/goya-photo-fall-clothes.png',
  mid:'goya/goya-photo-fall-clothes.png',
  tuck:'goya/goya-photo-fall-clothes.png',
  seated:'goya/goya-photo-present.png',
  stand:'goya/goya-photo-present.png',
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
