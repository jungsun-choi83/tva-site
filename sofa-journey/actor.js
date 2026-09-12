const asset=file=>{const u=new URL(`../assets/${file}`,import.meta.url);u.searchParams.set('v','eternal-beam-r89');return u.href;};
const GOYA={
  surprise:'goya/goya-fall-surprise.png',
  flail:'goya/goya-fall-flail.png',
  mid:'goya/goya-fall-mid.png',
  tuck:'goya/goya-fall-tuck.png',
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
  Object.values(GOYA).forEach(file=>{const preload=new Image(); preload.src=asset(file);});
  goya.src=asset(GOYA.surprise);
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
