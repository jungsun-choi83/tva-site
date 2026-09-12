import * as THREE from './vendor/three.module.js';
import { createHuman, poseHumanWalk, poseHumanReader } from './ending-humans.js';

const clamp01=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=v=>{const t=clamp01(v);return t*t*(3-2*t)};
const smoother=v=>{const t=clamp01(v);return t*t*t*(t*(t*6-15)+10)};
const segment=(v,a,b)=>smooth((v-a)/(b-a));

function loadTexture(url){return new Promise((resolve,reject)=>new THREE.TextureLoader().load(url,t=>{t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;resolve(t)},undefined,reject))}
function box(w,h,d,r=.12){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:5})}
function add(parent,geometry,material,position=[0,0,0]){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);parent.add(mesh);return mesh}
function mat(color,soft=true){return new THREE.MeshPhongMaterial({color,flatShading:true,shininess:soft?5:28})}
function shadow(scene,x,y,width=.65){
  const material=new THREE.MeshBasicMaterial({color:0x24190f,transparent:true,opacity:.28,depthWrite:false});
  const mesh=add(scene,new THREE.CircleGeometry(.5,24),material,[x,y,-.05]);mesh.scale.set(width,.22,1);return mesh;
}

function cropFace(source){const canvas=document.createElement('canvas');canvas.width=640;canvas.height=510;canvas.getContext('2d').drawImage(source.image,420,245,410,320,0,0,640,510);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;return texture}
function thoughtTexture(source,cell){
  const size=887,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(source.image,cell*size,0,size,size,0,0,size,size);
  const pixels=context.getImageData(0,0,size,size);
  for(let i=0;i<pixels.data.length;i+=4){
    const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2],key=Math.min(r,b)-g;
    if(r>100&&b>100&&key>45)pixels.data[i+3]=clamp01((65-key)/20)*255;
  }
  context.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;return texture;
}

function mascot(face){const m={case:mat(0xcdb887),dark:mat(0x917342),ink:mat(0x17140e),limb:mat(0x4c2a18),red:mat(0xc92318,false),glove:mat(0xf0dfb6),face:new THREE.MeshBasicMaterial({map:face})};const group=new THREE.Group(),rig=new THREE.Group();group.add(rig);const housing=add(rig,box(1.48,1.82,.85,.16),m.case,[-.74,.46,-.57]);housing.geometry.translate(.74,.91,0);const base=add(rig,box(1.37,.25,.5,.06),m.dark,[-.685,.43,-.24]);base.geometry.translate(.685,.125,0);const bezel=add(rig,box(1.18,.94,.055,.13),m.dark,[-.59,1.23,.278]);bezel.geometry.translate(.59,.47,0);add(rig,new THREE.PlaneGeometry(1.04,.79),m.face,[0,1.7,.375]);const badge=add(rig,box(.28,.12,.035,.025),m.red,[-.48,.82,.302]);badge.geometry.translate(.14,.06,0);add(rig,new THREE.BoxGeometry(.55,.055,.045),m.ink,[.3,.91,.335]);for(let i=0;i<4;i++)add(rig,new THREE.BoxGeometry(.27,.027,.04),m.ink,[.45,.62-i*.075,.325]);const limbs={};for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.35,.48,0);rig.add(leg);add(leg,new THREE.CylinderGeometry(.095,.105,.48,9),m.limb,[0,-.23,0]);const knee=new THREE.Group();knee.position.y=-.46;leg.add(knee);add(knee,new THREE.CylinderGeometry(.09,.1,.43,9),m.limb,[0,-.2,0]);const cuff=add(knee,new THREE.TorusGeometry(.14,.045,7,12),m.red,[0,-.405,.015]);cuff.rotation.x=Math.PI/2;const shoe=add(knee,new THREE.SphereGeometry(.23,10,7),m.red,[side*.02,-.49,.095]);shoe.scale.set(1.08,.58,1.48);const arm=new THREE.Group();arm.position.set(side*.79,1.72,0);rig.add(arm);add(arm,new THREE.CylinderGeometry(.075,.09,.42,9),m.limb,[0,-.19,0]);const elbow=new THREE.Group();elbow.position.y=-.38;arm.add(elbow);add(elbow,new THREE.CylinderGeometry(.07,.078,.34,9),m.limb,[0,-.15,0]);const hand=add(elbow,new THREE.SphereGeometry(.18,10,7),m.glove,[0,-.37,.02]);hand.scale.set(1.08,1.08,.82);limbs[side<0?'leftLeg':'rightLeg']={upper:leg,lower:knee,shoe};limbs[side<0?'leftArm':'rightArm']={upper:arm,lower:elbow,hand}}return{group,rig,materials:m,...limbs}}
function poseMascotLeg(leg,phase,settle){
  const step=((phase%1)+1)%1,stance=step<.62,part=stance?step/.62:(step-.62)/.38;
  const footZ=stance?lerp(.25,-.25,part):lerp(-.25,.25,smooth(part)),lift=stance?0:Math.sin(part*Math.PI)*.13;
  const targetZ=lerp(footZ,0,settle),targetY=-.9+lift*(1-settle),upper=.46,lower=.43;
  const distance=Math.min(upper+lower-.002,Math.max(.12,Math.hypot(targetZ,targetY)));
  const knee=Math.acos(Math.max(-1,Math.min(1,(distance*distance-upper*upper-lower*lower)/(2*upper*lower))));
  const target=Math.atan2(targetZ,-targetY),hip=-target+Math.atan2(lower*Math.sin(knee),upper+lower*Math.cos(knee));
  leg.upper.rotation.x=hip;leg.lower.rotation.x=-knee;leg.shoe.rotation.x=-(hip-knee);
}
function walkMascot(m,phase,settle){
  poseMascotLeg(m.leftLeg,phase,settle);poseMascotLeg(m.rightLeg,phase+.5,settle);
  const swing=Math.sin(phase*Math.PI*2)*(1-settle);
  m.leftArm.upper.rotation.x=-swing*.48;m.rightArm.upper.rotation.x=swing*.48;
  m.leftArm.lower.rotation.x=-.12;m.rightArm.lower.rotation.x=-.12;
  m.rig.position.y=Math.abs(Math.sin(phase*Math.PI*2))*.045*(1-settle);
}

function desk(home){const root=new THREE.Group(),wood=mat(0x57351f),woodDark=mat(0x352218),cream=mat(0xb8a477),dark=mat(0x25251f),blue=mat(0x263d55);add(root,new THREE.BoxGeometry(3.15,.18,1.18),wood,[0,1.25,0]);for(const x of [-1.35,1.35])for(const z of [-.42,.42])add(root,new THREE.BoxGeometry(.16,1.25,.16),woodDark,[x,.62,z]);add(root,new THREE.BoxGeometry(.82,.82,.92),wood,[1.02,.75,0]);add(root,new THREE.BoxGeometry(.67,.09,.75),woodDark,[1.02,.96,.1]);const computer=new THREE.Group();computer.position.set(.15,1.32,-.06);root.add(computer);const housing=add(computer,box(1.05,.92,.55,.1),cream,[-.525,0,-.34]);housing.geometry.translate(.525,.46,0);const screenMat=new THREE.MeshBasicMaterial({map:home});const screen=add(computer,new THREE.PlaneGeometry(.78,.439),screenMat,[0,.5,.305]);add(computer,new THREE.BoxGeometry(1.18,.08,.58),cream,[0,-.04,.3]);add(root,new THREE.BoxGeometry(.92,.06,.5),dark,[.15,1.38,.65]);for(let row=0;row<4;row++)for(let col=0;col<9;col++)add(root,new THREE.BoxGeometry(.07,.025,.055),dark,[-.17+col*.08,1.425,.51+row*.065]);const chair=new THREE.Group();chair.position.set(.05,.2,1);root.add(chair);add(chair,new THREE.BoxGeometry(.9,.15,.75),blue,[0,.5,0]);add(chair,new THREE.BoxGeometry(.9,1.1,.14),blue,[0,1.02,.32]);add(chair,new THREE.CylinderGeometry(.07,.07,.45,8),dark,[0,.22,0]);for(let i=0;i<5;i++){const spoke=add(chair,new THREE.BoxGeometry(.06,.06,.65),dark,[0,.02,0]);spoke.rotation.y=i*Math.PI*2/5}return{root,screenMat,screen}}
function disposeTree(root){root.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose?.()})}

export async function createEndingScene(canvas){
  if(!(canvas instanceof HTMLCanvasElement))throw new TypeError('createEndingScene(canvas) requires a canvas element.');
  const [roomTexture,sourceMascot,homeTexture,thoughtAtlas]=await Promise.all([loadTexture('./assets/ending/r10-image-first/room-game-render-v2.webp'),loadTexture('./assets/ending/r10-image-first/character-original-v3/01-front.webp'),loadTexture('./assets/hero/tva-hero-keyvisual-1920x1080-v1.webp'),loadTexture('./assets/ending/r12-live/thought-clouds-keyed.png')]);
  const face=cropFace(sourceMascot),cup=thoughtTexture(thoughtAtlas,0),computerThought=thoughtTexture(thoughtAtlas,1);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x22321a);const camera=new THREE.OrthographicCamera(-7.5,7.5,5,-5,.1,40);camera.position.set(0,0,10);
  const backdrop=add(scene,new THREE.PlaneGeometry(15,10),new THREE.MeshBasicMaterial({map:roomTexture}),[0,0,-4]);scene.add(new THREE.HemisphereLight(0xfff8e9,0x394228,1));const key=new THREE.DirectionalLight(0xffeed4,.7);key.position.set(-5,8,9);scene.add(key);
  const portalMaterial=new THREE.MeshBasicMaterial({map:homeTexture,transparent:true,opacity:0,depthTest:false,depthWrite:false});
  const homePortal=add(scene,new THREE.PlaneGeometry(1,1),portalMaterial,[0,0,8]);homePortal.renderOrder=100;
  const portalBackingMaterial=new THREE.MeshBasicMaterial({color:0x050606,transparent:true,opacity:0,depthTest:false,depthWrite:false});
  const portalBacking=add(scene,new THREE.PlaneGeometry(1,1),portalBackingMaterial,[0,0,7]);portalBacking.renderOrder=99;
  const workDesk=desk(homeTexture);workDesk.root.position.set(4.85,-3.18,0);workDesk.root.scale.setScalar(.82);workDesk.root.rotation.x=.48;workDesk.root.rotation.y=-.58;workDesk.root.rotation.z=-.08;scene.add(workDesk.root);
  const hero=mascot(face);hero.group.scale.setScalar(.65);hero.group.rotation.x=.48;scene.add(hero.group);
  const walker=createHuman({skin:0xb87952,hair:0x44261a,shirt:0xa0392d,trousers:0x274c6b}),reader=createHuman({skin:0xc18a62,hair:0x342118,shirt:0xe2d4b6,trousers:0x34506a}),chatA=createHuman({skin:0xa86f49,hair:0x1f1a18,shirt:0x65763c,trousers:0x394437,hairStyle:'bob'}),chatB=createHuman({skin:0xb67851,hair:0x71371f,shirt:0x5379a0,trousers:0x3d4149});
  for(const h of [walker,reader,chatA,chatB]){h.root.scale.setScalar(.88);h.root.rotation.x=.48;scene.add(h.root)}
  reader.root.position.set(-3.05,-.62,.15);poseHumanReader(reader);
  const bookMaterial=mat(0xe7ddc8),bookInk=mat(0x6f4930);
  const leftPage=add(reader.root,new THREE.BoxGeometry(.42,.32,.035),bookMaterial,[-.19,.98,.48]),rightPage=add(reader.root,new THREE.BoxGeometry(.42,.32,.035),bookMaterial,[.19,.98,.48]);
  leftPage.rotation.z=-.12;rightPage.rotation.z=.12;for(const x of [-.18,.18])for(let line=0;line<3;line++)add(reader.root,new THREE.BoxGeometry(.22,.008,.012),bookInk,[x,1.06-line*.07,.505]);
  chatA.root.position.set(-.45,-.55,.2);chatA.root.rotation.y=1.1;chatA.head.rotation.y=-.12;
  chatB.root.position.set(1.05,-.62,.15);chatB.root.rotation.y=-1.1;chatB.head.rotation.y=.12;
  const readerShadow=shadow(scene,-3.05,-1.46,.72),chatAShadow=shadow(scene,-.45,-1.72,.72),chatBShadow=shadow(scene,1.05,-1.79,.72);
  readerShadow.visible=false;
  const walkerShadow=shadow(scene,2.8,-3.22,.72),heroShadow=shadow(scene,-1.75,-3.23,.78);
  const thoughtA=add(scene,new THREE.PlaneGeometry(1.35,1.35),new THREE.MeshBasicMaterial({map:cup,transparent:true,depthWrite:false}),[.15,1.65,1]),thoughtB=add(scene,new THREE.PlaneGeometry(1.35,1.35),new THREE.MeshBasicMaterial({map:computerThought,transparent:true,depthWrite:false}),[4.25,-.45,1]);
  workDesk.root.updateMatrixWorld(true);workDesk.screen.updateMatrixWorld(true);
  const walkQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(.48,1.72,0,'XYZ'));
  const seatQuaternion=workDesk.root.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI));
  const seatTarget=workDesk.root.localToWorld(new THREE.Vector3(.05,.80,.66));
  const monitorTarget=workDesk.screen.getWorldPosition(new THREE.Vector3());
  const keyboardTargets=[
    workDesk.root.localToWorld(new THREE.Vector3(.45,1.44,.65)),
    workDesk.root.localToWorld(new THREE.Vector3(-.2,1.44,.65))
  ];
  const monitorScale=workDesk.screen.getWorldScale(new THREE.Vector3());
  const monitorQuaternion=workDesk.screen.getWorldQuaternion(new THREE.Quaternion());
  let baseWidth=15,baseHeight=10,portrait=false,homeNarrow=false;
  const render=value=>{
    const p=clamp01(value),establish=segment(p,.16,.3),travel=segment(p,.3,.59),align=segment(p,.59,.64),sit=segment(p,.64,.72),typing=segment(p,.72,.82);
    const chatter=Math.sin(establish*Math.PI*2);
    const reading=Math.sin(segment(p,.16,.82)*Math.PI*3);
    reader.head.rotation.z=reading*.035;reader.body.position.y=-.49+Math.abs(reading)*.012;
    leftPage.rotation.y=reading*.035;rightPage.rotation.y=-reading*.035;
    chatA.rightArm.upper.rotation.z=-.48*establish;chatA.rightArm.fore.rotation.x=-.55+.16*chatter;
    chatB.leftArm.upper.rotation.z=.42*establish;chatB.leftArm.fore.rotation.x=-.38-.12*chatter;chatB.head.rotation.y=-.15*chatter;

    const pass=segment(p,.18,.52);
    walker.root.position.set(lerp(2.8,1.25,pass),lerp(-3.2,-2.68,pass),.2);walker.root.rotation.y=-2.2;
    walkerShadow.position.set(walker.root.position.x,walker.root.position.y-.06,-.05);
    poseHumanWalk(walker,pass*3.15,1-segment(p,.48,.53));

    const walkingX=lerp(-1.75,3.75,travel),walkingY=lerp(-3.1,-2.72,travel);
    hero.group.position.set(lerp(walkingX,seatTarget.x,align),lerp(walkingY,seatTarget.y,align),lerp(.45,seatTarget.z,align));
    heroShadow.position.set(hero.group.position.x,lerp(walkingY-.16,seatTarget.y-.42,align),-.05);heroShadow.material.opacity=.28*(1-sit);
    hero.group.quaternion.copy(walkQuaternion).slerp(seatQuaternion,align);
    for(const arm of [hero.leftArm,hero.rightArm]){arm.upper.rotation.set(0,0,0);arm.lower.rotation.set(0,0,0)}
    walkMascot(hero,travel*5.4,align);
    hero.rig.rotation.x=-sit*.28;hero.rig.position.y=lerp(0,-.57,sit);
    const walkLeftHip=hero.leftLeg.upper.rotation.x,walkRightHip=hero.rightLeg.upper.rotation.x;
    const walkLeftKnee=hero.leftLeg.lower.rotation.x,walkRightKnee=hero.rightLeg.lower.rotation.x;
    hero.leftLeg.upper.rotation.x=lerp(walkLeftHip,-1.25,sit);hero.rightLeg.upper.rotation.x=lerp(walkRightHip,-1.25,sit);
    hero.leftLeg.lower.rotation.x=lerp(walkLeftKnee,1.5,sit);hero.rightLeg.lower.rotation.x=lerp(walkRightKnee,1.5,sit);
    hero.leftLeg.upper.rotation.z=-.3*sit;hero.rightLeg.upper.rotation.z=.3*sit;
    hero.leftLeg.lower.rotation.z=.48*sit;hero.rightLeg.lower.rotation.z=-.48*sit;
    for(const [arm,side] of [[hero.leftArm,-1],[hero.rightArm,1]]){
      const walkingArm=arm.upper.rotation.x;
      arm.upper.rotation.x=lerp(walkingArm,-.68,sit);arm.upper.rotation.z=lerp(side*.12,.72,sit);
      arm.lower.rotation.x=lerp(-.12,-.48,sit);arm.lower.rotation.z=lerp(0,-.58,sit)+Math.sin(typing*Math.PI*10+side)*.075*typing;
    }
    if(sit>0){
      hero.group.updateMatrixWorld(true);
      const down=new THREE.Vector3(0,-1,0);
      for(const [arm,target,index] of [[hero.leftArm,keyboardTargets[0],0],[hero.rightArm,keyboardTargets[1],1]]){
        const localTarget=hero.rig.worldToLocal(target.clone());
        localTarget.y+=Math.sin(typing*Math.PI*10+index*Math.PI)*.025*typing;
        const reach=localTarget.sub(arm.upper.position),distance=Math.min(.748,Math.max(.08,reach.length()));
        const direction=reach.clone().normalize(),along=(.38*.38-.37*.37+distance*distance)/(2*distance);
        const height=Math.sqrt(Math.max(0,.38*.38-along*along));
        let perpendicular=new THREE.Vector3(0,0,1).cross(direction).normalize();
        if(!Number.isFinite(perpendicular.x))perpendicular=new THREE.Vector3(1,0,0);
        perpendicular.multiplyScalar(index===0?height:-height);
        const elbowDirection=direction.clone().multiplyScalar(along).add(perpendicular).normalize();
        const upperTarget=new THREE.Quaternion().setFromUnitVectors(down,elbowDirection);
        arm.upper.quaternion.slerp(upperTarget,sit);
        const foreDirection=direction.multiplyScalar(distance).sub(elbowDirection.clone().multiplyScalar(.38)).normalize();
        const foreLocal=foreDirection.applyQuaternion(arm.upper.quaternion.clone().invert());
        const lowerTarget=new THREE.Quaternion().setFromUnitVectors(down,foreLocal);
        arm.lower.quaternion.slerp(lowerTarget,sit);
      }
    }

    thoughtA.material.opacity=segment(p,.2,.25)*(1-segment(p,.42,.47));
    thoughtB.material.opacity=segment(p,.7,.74)*(1-segment(p,.84,.88));
    chatA.root.updateMatrixWorld(true);hero.group.updateMatrixWorld(true);
    const chatHead=chatA.head.getWorldPosition(new THREE.Vector3()),heroHead=hero.group.localToWorld(new THREE.Vector3(0,2.55,0));
    thoughtA.position.set(chatHead.x-.32,chatHead.y+.62,1);thoughtB.position.set(heroHead.x+.2,heroHead.y+.42,1);
    const syncShadow=(actor,actorShadow)=>{
      actor.root.updateMatrixWorld(true);
      const left=actor.leftLeg.shoe.getWorldPosition(new THREE.Vector3()),right=actor.rightLeg.shoe.getWorldPosition(new THREE.Vector3());
      actorShadow.position.set((left.x+right.x)/2,Math.min(left.y,right.y)-.035,-.05);
    };
    syncShadow(chatA,chatAShadow);syncShadow(chatB,chatBShadow);syncShadow(walker,walkerShadow);
    const actionCenter=portrait?lerp(-.7,walkingX,segment(p,.27,.7)):0;
    const focus=segment(p,.85,.925),centerTravel=segment(p,.82,.87),portalTravel=smoother((p-.925)/.025);
    const scale=lerp(1,11,focus),cx=lerp(actionCenter,monitorTarget.x,centerTravel),cy=lerp(0,monitorTarget.y,centerTravel);
    camera.position.set(0,0,10);camera.quaternion.identity();
    camera.left=cx-baseWidth/2/scale;camera.right=cx+baseWidth/2/scale;
    camera.top=cy+baseHeight/2/scale;camera.bottom=cy-baseHeight/2/scale;camera.updateProjectionMatrix();
    backdrop.scale.setScalar(1);
    const visibleWidth=baseWidth/scale,visibleHeight=baseHeight/scale;
    const coverWidth=Math.max(visibleWidth,visibleHeight*16/9);
    homePortal.visible=p>=.922;
    portalBacking.visible=p>=.922;portalBacking.position.set(cx,cy,7);portalBacking.scale.set(visibleWidth*1.02,visibleHeight*1.02,1);portalBackingMaterial.opacity=portalTravel;
    const portalCenterX=homeNarrow?cx-visibleWidth*.372:cx;
    const portalWidth=homeNarrow?visibleWidth*1.907:coverWidth*1.02;
    const portalHeight=portalWidth*9/16;
    homePortal.position.set(lerp(monitorTarget.x,portalCenterX,portalTravel),lerp(monitorTarget.y,cy,portalTravel),8);
    homePortal.quaternion.copy(monitorQuaternion).slerp(new THREE.Quaternion(),portalTravel);
    homePortal.scale.set(lerp(.78*monitorScale.x,portalWidth,portalTravel),lerp(.439*monitorScale.y,portalHeight,portalTravel),1);
    portalMaterial.opacity=segment(p,.922,.928);
    const light=lerp(.72,1,segment(p,.74,.84));workDesk.screenMat.color.setRGB(light,light,light);
    const heroFade=segment(p,.84,.89);
    for(const surface of Object.values(hero.materials)){surface.transparent=heroFade>0;surface.opacity=1-heroFade;surface.depthWrite=heroFade===0}
    hero.group.visible=heroFade<.999;
    renderer.render(scene,camera);
  };
  const resize=(width,height)=>{
    const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height)),aspect=w/h;renderer.setSize(w,h,false);
    portrait=aspect<.8;homeNarrow=w<=980&&aspect<=1.25;baseHeight=aspect>=1.5?15/aspect:10;baseWidth=aspect>=1.5?15:10*aspect;render(0);
  };
  const dispose=()=>{
    disposeTree(scene);
    [roomTexture,sourceMascot,homeTexture,thoughtAtlas,face,cup,computerThought,...walker.textures,...reader.textures,...chatA.textures,...chatB.textures].forEach(t=>t.dispose());
    renderer.dispose();renderer.forceContextLoss?.();
  };
  const inspectPose=()=>{
    hero.group.updateMatrixWorld(true);workDesk.root.updateMatrixWorld(true);
    const point=object=>object.getWorldPosition(new THREE.Vector3()).toArray();
    const hands=[point(hero.leftArm.hand),point(hero.rightArm.hand)];
    return{
      shoulders:[point(hero.leftArm.upper),point(hero.rightArm.upper)],
      hands,
      keyboard:keyboardTargets.map(target=>target.toArray()),
      handErrors:hands.map((hand,index)=>new THREE.Vector3(...hand).distanceTo(keyboardTargets[index])),
      seat:{group:hero.group.position.toArray(),chairCenter:workDesk.root.localToWorld(new THREE.Vector3(.05,.7,1)).toArray(),caseBottom:hero.group.localToWorld(new THREE.Vector3(0,-.11,0)).toArray()}
    };
  };
  const rect=canvas.getBoundingClientRect();resize(rect.width||canvas.width||1,rect.height||canvas.height||1);render(0);return{render,resize,dispose,inspectPose};
}
