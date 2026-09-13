import * as THREE from './vendor/three.module.js';
import {
  createHuman,
  disposeHuman,
  poseHumanConversation,
  poseHumanIdle,
  poseHumanWalk,
} from './ending-humans-r13.js';
import { createMascot, createDesk } from './ending-props-r15.js?v=quality-r59.hef418068';
import { updateCat, updateWalker, catHeading } from './ending-cat-walker-r28.js?v=quality-r59.h0a8e3f85';

const clamp01=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=v=>{const t=clamp01(v);return t*t*(3-2*t)};
const smoother=v=>{const t=clamp01(v);return t*t*t*(t*(t*6-15)+10)};
const segment=(v,a,b)=>smooth((v-a)/(b-a));
const ISO_TILT=Math.PI/6; // 30° elevation → 2:1 dimetric, the same projection as the Sims-style room plate
const USE_SPRITE_MASCOT=true; // Goya sprite replaces the 3D TVA CRT mascot; walk ends in a reach toward the finished product on the shelf
// world distance one stance covers = footZ sweep (±.34 rig units) * hero.group scale (.65) / stance fraction (.62) — but the
// hero walks facing the walk-quaternion's yaw (.95 rad), not straight down world +X, so the local stepping (local Z) only
// projects a fraction of its length onto world X. STRIDE_PROJECTION is that fraction; it is measured at runtime (below,
// from the actual walkQuaternion) rather than hardcoded, and the naive (unprojected) value is kept here only as a comment:
// naive = (2*.34*.65)/.62 ≈ 0.713 — this alone left the planted foot's world X drifting ~0.04-0.07 per stance (see foot-trace.mjs).
const ICON_SPIN=2*Math.PI*(27.5/6); // ~1 turn per 6s of a 27.5s progress timeline, expressed as radians per unit of p
const BALLOON_Z=1.2; // shared world z for every need-balloon group; icons are placed in front of it (see iconZOffset, r23)

// ---- r32: Sims-like alternating conversation timing for chatA/chatB (motion-defect fix — see render()'s conversation
// block). CONV_PERIOD/CONV_BLEND define how long each speaker holds the floor and how long the crossfade between
// speaker/listener takes; INTERACT_CYCLE/LISTEN_CYCLE are how fast the Interact and Idle_Neutral clips loop while
// driven this way, all keyed off real elapsed scene seconds `t=p*27.5` rather than the old saturating `establish`.
const CONV_PERIOD=3.4,CONV_BLEND=.45,CONV_CYCLE=CONV_PERIOD*2,INTERACT_CYCLE=2.5,LISTEN_CYCLE=4.1,CONV_NOD_AMPLITUDE=6*Math.PI/180;
function speakWeightA(t){
  // 1 while chatA holds the floor, 0 while chatB does, with a smooth CONV_BLEND-second ramp at every turn change
  // (both edges of the [0,CONV_PERIOD) window), continuous across the CONV_CYCLE wrap-around.
  const local=((t%CONV_CYCLE)+CONV_CYCLE)%CONV_CYCLE;
  if(local>=CONV_PERIOD)return 0;
  const rampUp=segment(local,0,CONV_BLEND),rampDown=1-segment(local,CONV_PERIOD-CONV_BLEND,CONV_PERIOD);
  return Math.min(rampUp,rampDown);
}

function loadTexture(url){return new Promise((resolve,reject)=>new THREE.TextureLoader().load(url,t=>{t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;resolve(t)},undefined,reject))}
function box(w,h,d,r=.12){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:5})}
function add(parent,geometry,material,position=[0,0,0]){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);parent.add(mesh);return mesh}
function mat(color,soft=true){return new THREE.MeshPhongMaterial({color,flatShading:true,shininess:soft?5:28})}
function woodTexture(){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const context=canvas.getContext('2d');
  context.fillStyle='#5a341d';context.fillRect(0,0,256,128);
  for(let y=5;y<128;y+=9){context.strokeStyle=y%18?'rgba(35,16,8,.24)':'rgba(225,156,84,.16)';context.lineWidth=1.5;context.beginPath();context.moveTo(0,y);for(let x=0;x<=256;x+=16)context.lineTo(x,y+Math.sin(x*.07+y)*2.4);context.stroke()}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2.5,1.25);return texture;
}
function plasticTexture(base='#c9b78a',speck='rgba(70,50,20,.18)',light='rgba(255,250,235,.16)'){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const context=canvas.getContext('2d');
  context.fillStyle=base;context.fillRect(0,0,128,128);
  for(let i=0;i<900;i++){context.fillStyle=i%3?speck:light;context.fillRect(Math.random()*128,Math.random()*128,1.4,1.4)}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2,2);return texture;
}
function shadow(scene,x,y,width=.65){
  const material=new THREE.MeshBasicMaterial({color:0x24190f,transparent:true,opacity:.22,depthWrite:false});
  const mesh=add(scene,new THREE.CircleGeometry(.5,24),material,[x,y,-.05]);mesh.scale.set(width,.22,1);return mesh;
}

// r23: measures a human's actual head size and vertical "head top" offset directly off the skinned mesh geometry
// (the vertices whose dominant skin weight is the head bone), instead of a single hand-tuned per-owner constant.
// width = the world-space diameter of the bounding sphere of those vertices (rotation-invariant, so it stays valid
// even though root.rotation.x=ISO_TILT is applied); topDelta = world-space Y distance from the head bone's own
// origin up to the highest of those vertices, measured once at setup (root translates afterward but never re-rotates,
// so a constant delta stays correct for the whole timeline — see HEAD_TOP_DELTA below).
function measureHead(human){
  const headWorld=human.head.getWorldPosition(new THREE.Vector3());
  // r23: accumulate head-weighted vertices across every SkinnedMesh part of the rig into ONE box (a rig can be split
  // into body/hair/accessory meshes) instead of measuring each part separately and letting the last one win — a
  // small accessory mesh with only a handful of head-weighted vertices was overwriting the real body measurement.
  const box=new THREE.Box3(),v=new THREE.Vector3();let count=0;
  const getters=['getX','getY','getZ','getW'];
  human.model.traverse(obj=>{
    if(!obj.isSkinnedMesh)return;
    const bones=obj.skeleton.bones,headIndex=bones.indexOf(human.head);
    const posAttr=obj.geometry.attributes.position,skinIndexAttr=obj.geometry.attributes.skinIndex,skinWeightAttr=obj.geometry.attributes.skinWeight;
    if(headIndex<0||!posAttr||!skinIndexAttr||!skinWeightAttr)return;
    obj.updateMatrixWorld(true);
    for(let i=0;i<posAttr.count;i++){
      let bestWeight=-1,bestBone=-1;
      for(let k=0;k<4;k++){const w=skinWeightAttr[getters[k]](i);if(w>bestWeight){bestWeight=w;bestBone=skinIndexAttr[getters[k]](i)}}
      if(bestBone!==headIndex||bestWeight<.5)continue;
      v.fromBufferAttribute(posAttr,i);obj.applyBoneTransform(i,v);v.applyMatrix4(obj.matrixWorld);
      box.expandByPoint(v);count++;
    }
  });
  if(count<=4)return{width:.5,topDelta:.3}; // sane fallback if a rig ever lacks skin data
  const sphere=new THREE.Sphere();box.getBoundingSphere(sphere);
  return{width:sphere.radius*2,topDelta:box.max.y-headWorld.y};
}


// ---- r22: Sims-style need balloons with real thickness — an extruded rounded-rect/oval white body (thin dark
// BackSide outline shell behind it), plus either a pointed triangular "talk" tail or two small trailing "thought"
// spheres, matching sims-reference/balloon_02_speech_conversation_and_sofa.jpg. The old canvas-cloud-texture path
// (bubbleTexture/PIXEL_ICONS/drawPixelIcon) is retired entirely — every balloon is now real 3D geometry.
function roundedOvalShape(w,h,r){
  const s=new THREE.Shape(),x=-w/2,y=-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  return s;
}
function talkTailShape(w,h){
  // a small triangular notch hanging off the bottom-centre of the balloon, pointing down toward the speaker's head
  const s=new THREE.Shape();
  s.moveTo(-w*.5,h*.02);s.lineTo(w*.5,h*.02);s.lineTo(0,-h);s.closePath();
  return s;
}
function buildBalloon(width,kind){
  // r22: each balloon gets its own material instances (not a shared singleton) so its pop-in/pop-out opacity
  // animation never bleeds into any other balloon on screen.
  const white=new THREE.MeshPhongMaterial({color:0xffffff,flatShading:true,shininess:8,transparent:true});
  const outlineMat=new THREE.MeshBasicMaterial({color:0x2a2f3a,side:THREE.BackSide,transparent:true});
  const group=new THREE.Group();
  const height=width*.75,thickness=.12,radius=Math.min(width,height)*.32; // r23: height≈.75×width per the Sims-reference measurement (was .72)
  const bodyShape=roundedOvalShape(width,height,radius);
  const bodyGeo=new THREE.ExtrudeGeometry(bodyShape,{depth:thickness,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:thickness*.18,bevelThickness:thickness*.18,curveSegments:10});
  bodyGeo.translate(0,0,-thickness/2);
  const body=new THREE.Mesh(bodyGeo,white);group.add(body);
  const outline=new THREE.Mesh(bodyGeo,outlineMat);outline.scale.set(1.07,1.07,1.15);group.add(outline);
  if(kind==='talk'){
    const tailW=width*.22,tailH=height*.34;
    const tailGeo=new THREE.ExtrudeGeometry(talkTailShape(tailW,tailH),{depth:thickness*.72,bevelEnabled:false,curveSegments:6});
    tailGeo.translate(0,0,-thickness*.36);
    const tail=new THREE.Mesh(tailGeo,white);tail.position.set(-width*.18,-height/2,0);group.add(tail);
    const tailOutline=new THREE.Mesh(tailGeo,outlineMat);tailOutline.scale.set(1.14,1.1,1.3);tail.add(tailOutline);
  }else{
    const dropPositions=[[-width*.28,-height*.62,.02,width*.09],[-width*.42,-height*.86,.01,width*.055]];
    for(const [dx,dy,dz,r] of dropPositions){
      const drop=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),white);drop.position.set(dx,dy,dz);group.add(drop);
      const dropOutline=new THREE.Mesh(drop.geometry,outlineMat);dropOutline.scale.setScalar(1.16);drop.add(dropOutline);
    }
  }
  group.rotation.x=-.08; // slight billboard-ish bias toward the camera, matching the reference's near-frontal balloons
  // r23: the lowest point of whichever tail this balloon has, measured down from group.position.y — a 'talk' tail's
  // triangular tip sits at -height*(.5+.34), a 'thought' balloon's lowest trailing drop sits at its center y minus its
  // own radius. Bubbles use this (see tailOffset in the bubbles map below) to plant the tail exactly .05 above the head.
  const tailBottomDrop=kind==='talk'?height*.84:height*.86+width*.055;
  // r43 QA fix: the X (horizontal) counterpart of tailBottomDrop above — every tail/trailing-drop shape here is built
  // hanging off the LEFT of the balloon body (tail.position.x=-width*.18 for 'talk'; the nearest/smallest trailing
  // drop sits at dx=-width*.42 for 'thought'), so the group's own origin is NOT above the tail tip, it's offset to
  // the tail tip's right by this much. The old per-bubble bx=head.x+ox code (see the bubbles map + per-frame loop
  // below) only ever offset the BODY's origin from the head, never compensating for this built-in tail droop —
  // so the visible tail end up to ~width*.42 further from the head than intended (owner feedback: "말풍선 위치 안
  // 맞음", the sofa reader's and beige-shirt woman's balloons landing well off to the side of their heads, tails
  // pointing away rather than in). Bubbles now subtract this offset so the tail TIP — not the body's own origin —
  // is what lands at headX+sideLean (see tailOffset usage below).
  const tailTipX=kind==='talk'?-width*.18:-width*.42;
  return{group,body,white,outlineMat,width,height,thickness,tailBottomDrop,tailTipX,materials:[white,outlineMat]};
}

// ---- r18: small live 3D need-bubble icons, built from primitives in the same cel-shaded (flat MeshPhong) look as the room props ----
function heartShapePath(){
  const s=new THREE.Shape();
  s.moveTo(0,-.35);
  s.bezierCurveTo(0,-.35,-.5,-.9,-.9,-.4);
  s.bezierCurveTo(-1.3,.1,-.6,.6,0,1.0);
  s.bezierCurveTo(.6,.6,1.3,.1,.9,-.4);
  s.bezierCurveTo(.5,-.9,0,-.35,0,-.35);
  return s;
}
function zShapePath(size){
  const t=size*.22,w=size/2,h=size/2;
  const s=new THREE.Shape();
  s.moveTo(-w,h);s.lineTo(w,h);s.lineTo(w,h-t);
  s.lineTo(-w+t,-h+t);s.lineTo(w,-h+t);s.lineTo(w,-h);
  s.lineTo(-w,-h);s.lineTo(-w,-h+t);s.lineTo(w-t,h-t);
  s.lineTo(-w,h-t);s.closePath();
  return s;
}
function outlineShell(mesh,scale=1.08,color=0x1c1712){
  const shell=new THREE.Mesh(mesh.geometry,new THREE.MeshBasicMaterial({color,side:THREE.BackSide}));
  shell.scale.setScalar(scale);mesh.add(shell);return shell;
}
function build3DIcon(type){
  const group=new THREE.Group();
  switch(type){
    case 'plate':{
      const plate=add(group,new THREE.CylinderGeometry(.42,.42,.05,20),mat(0xdfe6ea),[0,-.16,0]);outlineShell(plate,1.06);
      const bunB=add(group,new THREE.CylinderGeometry(.24,.26,.09,14),mat(0xe8b23d),[0,-.08,0]);outlineShell(bunB,1.08);
      add(group,new THREE.CylinderGeometry(.22,.22,.06,14),mat(0x8a3b2a),[0,-.015,0]);
      const cheese=add(group,new THREE.BoxGeometry(.32,.02,.32),mat(0xf4d35e),[0,.02,0]);cheese.rotation.y=Math.PI/8;
      const bunT=add(group,new THREE.SphereGeometry(.23,14,10,0,Math.PI*2,0,Math.PI/2),mat(0xe8b23d),[0,.05,0]);outlineShell(bunT,1.08);
      break;
    }
    case 'heart':{
      const geo=new THREE.ExtrudeGeometry(heartShapePath(),{depth:.22,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,curveSegments:12});
      geo.scale(.42,.42,.42);geo.center();
      const heart=add(group,geo,mat(0xe0455a,false),[0,0,0]);heart.rotation.z=Math.PI;outlineShell(heart,1.08);
      break;
    }
    case 'tv':{
      const body=add(group,box(.78,.6,.24,.09),mat(0x6b4fa0),[0,0,0]);outlineShell(body,1.06);
      add(group,new THREE.PlaneGeometry(.56,.38),mat(0x141a22,false),[0,.02,.125]);
      for(const sx of [-1,1]){const ant=add(group,new THREE.CylinderGeometry(.018,.018,.34,6),mat(0x241f1a),[sx*.16,.44,0]);ant.rotation.z=sx*.5}
      break;
    }
    case 'note':{
      const paper=add(group,new THREE.SphereGeometry(.26,14,12),mat(0xf3efe1),[0,0,0]);paper.scale.set(1,1.1,.32);outlineShell(paper,1.08);
      const stem=add(group,new THREE.CylinderGeometry(.028,.028,.42,6),mat(0x4a4f5a),[.17,-.2,.06]);stem.rotation.z=-.55;
      break;
    }
    case 'book':{
      add(group,new THREE.BoxGeometry(.4,.05,.52),mat(0xf1eadb),[-.21,0,0]).rotation.set(0,.08,.2);
      add(group,new THREE.BoxGeometry(.4,.05,.52),mat(0xe4d9be),[.21,0,0]).rotation.set(0,-.08,-.2);
      add(group,new THREE.BoxGeometry(.06,.06,.52),mat(0x6f4930),[0,.01,0]);
      break;
    }
    case 'zzz':{
      [.44,.33,.24].forEach((size,i)=>{
        const geo=new THREE.ExtrudeGeometry(zShapePath(size),{depth:.06,bevelEnabled:false,curveSegments:2});geo.center();
        const z=add(group,geo,mat(0x3d4250),[.22*i-.22,.3-i*.28,-.05*i]);z.rotation.z=-.1;
      });
      break;
    }
    case 'talk':{
      [[-.2,.1,0,.16],[0,-.03,.06,.13],[.2,-.14,0,.1]].forEach(([x,y,z,r])=>{
        const sph=add(group,new THREE.SphereGeometry(r,12,10),mat(0x4a4f5a),[x,y,z]);outlineShell(sph,1.1);
      });
      break;
    }
    case 'computer':{
      const body=add(group,box(.5,.42,.4,.08),mat(0xcdb887),[0,0,0]);outlineShell(body,1.06);
      add(group,new THREE.PlaneGeometry(.32,.24),mat(0x2c4a34,false),[0,.03,.205]);
      add(group,new THREE.BoxGeometry(.34,.05,.32),mat(0x917342),[0,-.235,.02]);
      break;
    }
    case 'cup':{
      // r20: was a wide-at-top / narrow-at-bottom cylinder in the heart's red — read as an overflowing bucket, not a mug.
      // Straight-sided (equal top/bottom radius) cylinder in the room mug's warm yellow (matches the plate bun/desk
      // housing tones) so it reads as a small mug; fitIconScale below still normalizes it to the shared ≈45% fit.
      const mugYellow=0xe8b23d,mugYellowDark=0xc99a2e;
      const body=add(group,new THREE.CylinderGeometry(.12,.12,.22,16),mat(mugYellow),[0,0,0]);outlineShell(body,1.08);
      const rim=add(group,new THREE.TorusGeometry(.12,.014,8,16),mat(mugYellowDark),[0,.11,0]);rim.rotation.x=Math.PI/2;
      const handle=add(group,new THREE.TorusGeometry(.075,.02,8,16,Math.PI*1.3),mat(mugYellow),[.13,0,0]);handle.rotation.y=Math.PI/2;
      break;
    }
    default: break; // 'none' → cloud only, no 3D icon
  }
  return group;
}
function fitIconScale(group,target){
  const box=new THREE.Box3().setFromObject(group);const size=new THREE.Vector3();box.getSize(size);
  const maxDim=Math.max(size.x,size.y,size.z)||1;return target/maxDim;
}

// ---- fun beats: plumbob, typed farewell screen, primitive cat ----
function makePlumbob(){const geo=new THREE.OctahedronGeometry(.26,0);geo.scale(1,1.7,1);const mat=new THREE.MeshPhongMaterial({color:0x5ee36a,emissive:0x1f7a2a,shininess:60,transparent:true,opacity:.92});const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=false;return mesh}
function typedScreenTexture(){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=288;const c=canvas.getContext('2d');const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;
  const draw=(count,cursor)=>{c.fillStyle='#0b1410';c.fillRect(0,0,512,288);c.fillStyle='rgba(120,200,140,.08)';for(let y=0;y<288;y+=4)c.fillRect(0,y,512,1);c.fillStyle='#7ff09a';c.font='700 46px ui-monospace,Menlo,monospace';const text='see you again.'.slice(0,Math.max(0,Math.round(count)));c.fillText(text+(cursor?'_':''),40,150);c.fillStyle='#4f9a63';c.font='700 18px ui-monospace,Menlo,monospace';c.fillText('beam://home',40,60);texture.needsUpdate=true};
  draw(0,true);return{texture,draw}}
function makeCat(){const black=new THREE.MeshPhongMaterial({color:0x1d1b1f,shininess:8}),white=new THREE.MeshPhongMaterial({color:0xf2eee6,shininess:8}),pink=new THREE.MeshPhongMaterial({color:0xd98a8a});const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.14,.42,4,10),black);torso.rotation.z=Math.PI/2;torso.position.set(0,.26,0);body.add(torso);
  const chest=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),white);chest.position.set(.16,.2,0);chest.scale.set(1,.8,.9);body.add(chest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.13,12,10),black);head.position.set(.34,.36,0);body.add(head);
  const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),white);muzzle.position.set(.43,.31,0);body.add(muzzle);
  for(const sx of [-1,1]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.045,.1,6),black);ear.position.set(.32,.49,sx*.07);body.add(ear);const inner=new THREE.Mesh(new THREE.ConeGeometry(.02,.06,6),pink);inner.position.set(.33,.48,sx*.07);body.add(inner)}
  const legs=[];for(const [x,z] of [[.2,.07],[.2,-.07],[-.18,.07],[-.18,-.07]]){const leg=new THREE.Group();leg.position.set(x,.2,z);const shin=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.2,6),x>0?white:black);shin.position.y=-.1;leg.add(shin);body.add(leg);legs.push(leg)}
  const tail=new THREE.Group();tail.position.set(-.3,.32,0);body.add(tail);let seg=tail;for(let i=0;i<4;i++){const piece=new THREE.Mesh(new THREE.CylinderGeometry(.03,.035,.13,6),black);piece.rotation.z=Math.PI/2;piece.position.x=-.06;const g=new THREE.Group();g.add(piece);g.position.x=i?-.12:0;seg.add(g);seg=g}
  root.traverse(o=>{if(o.isMesh)o.castShadow=true});
  return{root,body,legs,tail,walk(phase,speed=1){const t=phase*Math.PI*2;legs.forEach((leg,i)=>leg.rotation.z=Math.sin(t+(i%2?Math.PI:0)+(i>1?.6:0))*.55*speed);body.position.y=Math.abs(Math.sin(t))*.03*speed;let g=tail;for(let i=0;i<4;i++){g.rotation.z=.35+Math.sin(t*.5+i*.7)*.25;g=g.children.find(c=>c.isGroup)||g}}}}
function createBeamProduct(faceMap){
  const root=new THREE.Group();
  const metal=new THREE.MeshPhongMaterial({color:0x4b4e54,shininess:90,specular:0xb0b6be});
  const dark=new THREE.MeshPhongMaterial({color:0x2c2e32,shininess:50,specular:0x777777});
  const glass=faceMap
    ? new THREE.MeshBasicMaterial({map:faceMap})
    : new THREE.MeshPhongMaterial({color:0x3a3c40,shininess:120,specular:0x99a0aa});
  root.add(new THREE.Mesh(new THREE.BoxGeometry(.92,.92,.86),metal));
  for(let i=0;i<8;i++){
    const rib=new THREE.Mesh(new THREE.BoxGeometry(.08,.86,.07),dark);
    rib.position.set(.48,0,-.31+i*.09);
    root.add(rib);
  }
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(.78,.78),glass);
  screen.position.set(0,.03,.435);
  root.add(screen);
  return {root,screen,screenMat:glass};
}
function makeNamePlate(text){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const c=canvas.getContext('2d');
  c.clearRect(0,0,1024,256);
  c.fillStyle='#1a1713';
  c.font='800 176px Cinzel, "Times New Roman", serif';
  c.textAlign='center';c.textBaseline='middle';
  c.fillText(String(text||'').toUpperCase(),512,128);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.72,.43),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
  const group=new THREE.Group();group.add(mesh);group.userData.texture=texture;return group;
}
function makeServerCabinet(){
  const root=new THREE.Group();
  const chassis=new THREE.MeshPhongMaterial({color:0x2a3038,shininess:55,specular:0x7a8490});
  const dark=new THREE.MeshPhongMaterial({color:0x121417,shininess:20});
  const rail=new THREE.MeshPhongMaterial({color:0x3b424c,shininess:40});
  const ledG=new THREE.MeshPhongMaterial({color:0x3ee08a,emissive:0x146b38});
  const ledA=new THREE.MeshPhongMaterial({color:0xe8b23d,emissive:0x6a4a10});
  const shell=new THREE.Mesh(new THREE.BoxGeometry(.92,1.95,.78),chassis);shell.position.y=.98;root.add(shell);
  for(let i=0;i<10;i++){
    const u=new THREE.Mesh(new THREE.BoxGeometry(.66,.11,.52),rail);u.position.set(0,.28+i*.15,.08);root.add(u);
    const face=new THREE.Mesh(new THREE.BoxGeometry(.62,.09,.03),dark);face.position.set(0,.28+i*.15,.4);root.add(face);
    const light=new THREE.Mesh(new THREE.BoxGeometry(.03,.025,.02),i%4?ledG:ledA);light.position.set(.26,.28+i*.15,.42);root.add(light);
  }
  const footL=new THREE.Mesh(new THREE.BoxGeometry(.9,.06,.74),dark);footL.position.y=.03;root.add(footL);
  root.rotation.x=ISO_TILT;return root;
}
function makeWorkshopDesk(){
  const root=new THREE.Group();
  const wood=new THREE.MeshPhongMaterial({color:0x8a5a32,shininess:18});
  const steel=new THREE.MeshPhongMaterial({color:0x3a414a,shininess:40,specular:0x889099});
  const top=new THREE.Mesh(new THREE.BoxGeometry(1.85,.08,.78),wood);top.position.y=.78;root.add(top);
  for(const [x,z] of [[-.78,.28],[-.78,-.28],[.78,.28],[.78,-.28]]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.08,.78,.08),steel);leg.position.set(x,.39,z);root.add(leg);
  }
  const apron=new THREE.Mesh(new THREE.BoxGeometry(1.7,.07,.62),steel);apron.position.y=.72;root.add(apron);
  root.rotation.x=ISO_TILT;return root;
}
function makeLabComputerDesk(){
  const root=new THREE.Group();
  const black=new THREE.MeshPhongMaterial({color:0x1b1e24,shininess:35});
  const silver=new THREE.MeshPhongMaterial({color:0x8b939c,shininess:70,specular:0xc5ced6});
  const glass=new THREE.MeshBasicMaterial({color:0x163044});
  const makeMonitor=(x,yaw)=>{
    const g=new THREE.Group();g.position.set(x,.36,0);g.rotation.y=yaw;
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(.03,.045,.2,10),silver);neck.position.y=-.16;g.add(neck);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.11,.12,.03,10),silver);base.position.y=-.27;g.add(base);
    const bezel=new THREE.Mesh(new THREE.BoxGeometry(.52,.32,.04),black);bezel.position.y=.06;g.add(bezel);
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(.46,.26),glass);panel.position.set(0,.06,.025);g.add(panel);
    root.add(g);return g;
  };
  makeMonitor(-.24,.1);makeMonitor(.24,-.08);
  const kbd=new THREE.Mesh(new THREE.BoxGeometry(.38,.02,.13),black);kbd.position.set(0,.02,.22);root.add(kbd);
  root.rotation.x=ISO_TILT;return root;
}
function makeOfficeChair(){
  const root=new THREE.Group();
  const black=new THREE.MeshPhongMaterial({color:0x2a2e34,shininess:25});
  const steel=new THREE.MeshPhongMaterial({color:0x6a727c,shininess:50,specular:0x9aa3ab});
  const seat=new THREE.Mesh(new THREE.BoxGeometry(.46,.07,.44),black);seat.position.y=.54;root.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(.42,.52,.07),black);back.position.set(0,.82,-.2);root.add(back);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.52,8),steel);pole.position.y=.26;root.add(pole);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.045,8),steel);base.position.y=.03;root.add(base);
  root.rotation.x=ISO_TILT;return root;
}
function makeReport(){
  const root=new THREE.Group();
  const board=new THREE.Mesh(new THREE.BoxGeometry(.22,.3,.012),mat(0xb08958));
  const paper=new THREE.Mesh(new THREE.BoxGeometry(.19,.26,.005),mat(0xf6f0e4));paper.position.z=.01;
  const clip=new THREE.Mesh(new THREE.BoxGeometry(.2,.034,.018),mat(0x4a5560));clip.position.set(0,.135,.014);
  root.add(board,paper,clip);
  for(let i=0;i<5;i++){
    const line=new THREE.Mesh(new THREE.BoxGeometry(.145,.007,.002),mat(0x8e9aa6));
    line.position.set(0,.08-i*.042,.014);root.add(line);
  }
  return root;
}
function tintHuman(human,look){
  human.model.traverse(object=>{
    if(!object.isMesh)return;
    const mats=Array.isArray(object.material)?object.material:[object.material];
    for(const material of mats){
      const name=String(material.name||object.name||'').toLowerCase();
      if(look.skin&&name.includes('skin'))material.color.setHex(look.skin);
      if(look.hair&&(name.includes('hair')||name.includes('eyebrow')))material.color.setHex(look.hair);
    }
  });
}
function inspectReportPose(human,t,side=1){
  if(!human._inspectBase){
    human._inspectBase={head:human.head.quaternion.clone()};
  }
  const scan=Math.sin(t*1.4)*.025;
  human.body.quaternion.copy(human.neutralBodyQuaternion);
  human.body.rotateX(.05);
  human.body.rotateY(-.08*side);
  human.head.quaternion.copy(human._inspectBase.head);
  human.head.rotateX(.2+scan);
  human.head.rotateY(-.1*side);
  aimBoneLocal(human,human.leftArm.upper,new THREE.Vector3(.12*side,-.52,.58));
  aimBoneLocal(human,human.rightArm.upper,new THREE.Vector3(-.1*side,-.48+scan,.6));
  aimBoneLocal(human,human.leftArm.fore,new THREE.Vector3(.05,-.16,.78));
  aimBoneLocal(human,human.rightArm.fore,new THREE.Vector3(-.04,-.22+scan,.76));
}
function cropFace(source){const canvas=document.createElement('canvas');canvas.width=640;canvas.height=510;canvas.getContext('2d').drawImage(source.image,420,245,410,320,0,0,640,510);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;return texture}
// thoughtTexture() (atlas-keyed cup/computer thought clouds) retired in r18 — replaced by the unified 3D-icon bubble system (build3DIcon).

function mascot(face){const m={case:mat(0xcdb887),dark:mat(0x917342),ink:mat(0x17140e),limb:mat(0x4c2a18),red:mat(0xc92318,false),glove:mat(0xf0dfb6),face:new THREE.MeshBasicMaterial({map:face})};const group=new THREE.Group(),rig=new THREE.Group();group.add(rig);const housing=add(rig,box(1.48,1.82,.85,.16),m.case,[-.74,.46,-.57]);housing.geometry.translate(.74,.91,0);const base=add(rig,box(1.37,.25,.5,.06),m.dark,[-.685,.43,-.24]);base.geometry.translate(.685,.125,0);const bezel=add(rig,box(1.18,.94,.055,.13),m.dark,[-.59,1.23,.278]);bezel.geometry.translate(.59,.47,0);add(rig,new THREE.PlaneGeometry(1.04,.79),m.face,[0,1.7,.375]);const badge=add(rig,box(.28,.12,.035,.025),m.red,[-.48,.82,.302]);badge.geometry.translate(.14,.06,0);add(rig,new THREE.BoxGeometry(.55,.055,.045),m.ink,[.3,.91,.335]);for(let i=0;i<4;i++)add(rig,new THREE.BoxGeometry(.27,.027,.04),m.ink,[.45,.62-i*.075,.325]);const backPlate=add(rig,box(1.24,1.42,.03,.12),m.dark,[-.62,.62,-.6]);backPlate.geometry.translate(.62,.71,0);for(let i=0;i<6;i++)add(rig,new THREE.BoxGeometry(.7,.03,.02),m.ink,[0,1.85-i*.09,-.605]);add(rig,new THREE.BoxGeometry(.26,.12,.03),m.ink,[-.36,.86,-.605]);add(rig,new THREE.BoxGeometry(.12,.12,.03),m.ink,[.34,.86,-.605]);const limbs={};for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.35,.48,0);rig.add(leg);add(leg,new THREE.CylinderGeometry(.095,.105,.48,9),m.limb,[0,-.23,0]);const knee=new THREE.Group();knee.position.y=-.46;leg.add(knee);add(knee,new THREE.CylinderGeometry(.09,.1,.43,9),m.limb,[0,-.2,0]);const cuff=add(knee,new THREE.TorusGeometry(.14,.045,7,12),m.red,[0,-.405,.015]);cuff.rotation.x=Math.PI/2;const shoe=add(knee,new THREE.SphereGeometry(.23,10,7),m.red,[side*.02,-.49,.095]);shoe.scale.set(1.08,.58,1.48);const arm=new THREE.Group();arm.position.set(side*.79,1.72,0);rig.add(arm);add(arm,new THREE.CylinderGeometry(.075,.09,.42,9),m.limb,[0,-.19,0]);const elbow=new THREE.Group();elbow.position.y=-.38;arm.add(elbow);add(elbow,new THREE.CylinderGeometry(.07,.078,.34,9),m.limb,[0,-.15,0]);const hand=add(elbow,new THREE.SphereGeometry(.18,10,7),m.glove,[0,-.37,.02]);hand.scale.set(1.08,1.08,.82);limbs[side<0?'leftLeg':'rightLeg']={upper:leg,lower:knee,shoe};limbs[side<0?'leftArm':'rightArm']={upper:arm,lower:elbow,hand}}return{group,rig,materials:m,...limbs}}
function refineMascot(mascot){
  for(const arm of [mascot.leftArm,mascot.rightArm]){
    const palm=arm.hand;
    for(let index=0;index<3;index++){
      const finger=add(palm,new THREE.CapsuleGeometry(.032,.12,3,6),mascot.materials.glove,[(-.065+index*.065),-.16,.02]);
      finger.rotation.z=(-.18+index*.18);
    }
    const thumb=add(palm,new THREE.CapsuleGeometry(.038,.1,3,6),mascot.materials.glove,[.14,-.04,.01]);
    thumb.rotation.z=-.75;
  }
  for(const leg of [mascot.leftLeg,mascot.rightLeg]){
    const sole=add(leg.shoe,new THREE.SphereGeometry(.2,10,6),mascot.materials.ink,[0,-.15,.035]);
    sole.scale.set(1.05,.22,1.38);
  }
}
function poseMascotLeg(leg,phase,settle,hipDrop=0){
  const step=((phase%1)+1)%1,stance=step<.62,part=stance?step/.62:(step-.62)/.38;
  const footZ=stance?lerp(.34,-.34,part):lerp(-.34,.34,smooth(part)),lift=stance?0:Math.sin(part*Math.PI)*.2;
  // while the hips bob (hipDrop, r18), a planted stance foot must stay fixed in world space: raise its
  // local target by the same amount the hips rise so the world-space foot position doesn't move.
  const targetZ=lerp(footZ,0,settle),targetY=-.9+lift*(1-settle)+(stance?hipDrop*(1-settle):0),upper=.46,lower=.43;
  const distance=Math.min(upper+lower-.002,Math.max(.12,Math.hypot(targetZ,targetY)));
  const knee=Math.acos(Math.max(-1,Math.min(1,(distance*distance-upper*upper-lower*lower)/(2*upper*lower))));
  const target=Math.atan2(targetZ,-targetY),hip=-target+Math.atan2(lower*Math.sin(knee),upper+lower*Math.cos(knee));
  leg.upper.rotation.x=hip;leg.lower.rotation.x=-knee;
  // r22: during the first half of the swing (just after toe-off, part<.5) the heel lifts clear of the ground before
  // the leg swings through — a small extra forward rotation on the foot itself (on top of the IK's own flat-foot
  // angle) reads as the heel coming up rather than the whole foot staying rigidly parallel to the shin. It fades to
  // zero by mid-swing and is zero throughout the whole stance window, so it never touches the planted foot's contact
  // angle or its world position (poseMascotLeg's hip/knee solve, which foot-trace.mjs verifies, is unchanged).
  const heelLift=stance?0:Math.sin(part*Math.PI)*(1-part)*.22*(1-settle);
  leg.shoe.rotation.x=-(hip-knee)-heelLift;
}
// r18: down at mid-stance, rising toward push-off/heel-strike — one dip per leg's own stance window (.62 of `phase`),
// so at any instant only the currently-planted leg pulls the hips down and the crossover (double support) reads as the rise.
function stanceDip(phase){
  const step=((phase%1)+1)%1;if(step>=.62)return 0;
  return Math.sin((step/.62)*Math.PI);
}
function walkMascot(m,phase,settle,accelNorm=0){
  const hipDrop=.045*(stanceDip(phase)+stanceDip(phase+.5));
  poseMascotLeg(m.leftLeg,phase,settle,hipDrop);poseMascotLeg(m.rightLeg,phase+.5,settle,hipDrop);
  const swing=Math.sin(phase*Math.PI*2)*(1-settle);
  m.leftArm.upper.rotation.x=-swing*.7;m.rightArm.upper.rotation.x=swing*.7;
  // r18: the old hip-roll (rig.rotation.z) is retired — because the hero walks facing the walk-quaternion's yaw rather than
  // straight along world X, any whole-rig roll couples through that yaw into the stance foot's world X (measured with
  // foot-trace.mjs: it alone pushed the worst-case stance-foot drift from ~0.017 to ~0.025, over the 0.02 tolerance).
  m.rig.rotation.z=0;
  // r22: forearm bend now LAGS the upper-arm swing by a fixed phase offset instead of doubling the upper-arm's own
  // frequency (the old Math.abs(swing) term bent-and-unbent the elbow twice per stride, once per swing direction,
  // which read as a rigid single-segment flail rather than a believable elbow follow-through). A phase-delayed sine
  // at the SAME frequency as the upper-arm swing, mirrored the same way left/right, gives each forearm its own lagged
  // trailing motion — most bent shortly after the upper arm passes through its extreme, echoing real arm-swing physics.
  const ARM_LAG=.16; // fraction of a stride the forearm swing trails the upper-arm swing by
  const forearmSwingL=-Math.sin((phase-ARM_LAG)*Math.PI*2)*(1-settle);
  const forearmSwingR=Math.sin((phase-ARM_LAG)*Math.PI*2)*(1-settle);
  m.leftArm.lower.rotation.x=-.12-Math.max(0,forearmSwingL)*.22;m.rightArm.lower.rotation.x=-.12-Math.max(0,forearmSwingR)*.22;
  m.rig.position.y=-hipDrop*(1-settle);
  // tiny lateral sway of the body — kept small on purpose so it doesn't read as foot slip in a stance-foot trace
  m.rig.position.x=Math.sin(phase*Math.PI*2)*.008*(1-settle);
  // r22: small constant forward lean while actually walking (on top of the existing accel-based lean, which leans
  // further forward while speeding up and back while slowing down) so the case reads as leaning into the walking
  // direction throughout the stride, not just during the accel/decel bursts at the ends of the walk. Kept small —
  // like the accel term, this is consumed as an extra local-X pitch on hero.group and couples into the stance foot's
  // world X through the walk yaw, so it stays well under the margin foot-trace.mjs measured for the accel term alone.
  m.walkLeanAngle=(accelNorm*.02+.012)*(1-settle);
}
// r22: slow ±1° (~.017rad) standing weight-shift sway, applied only while the mascot is genuinely standing still
// (gated by the caller to the pre-walk idle window) — never touches rig.rotation.z while walking/settling, which is
// the axis foot-trace.mjs found couples into stance-foot world X through the walk yaw.
function idleWeightShift(p,periodStart){return Math.sin((p-periodStart)*14)*(1*Math.PI/180)}

function desk(home){
  const root=new THREE.Group();
  const grain=woodTexture();
  const wood=new THREE.MeshPhongMaterial({color:0xd9b28c,map:grain,shininess:18,specular:0x553322});
  const plastic=plasticTexture(),keys=plasticTexture('#2b2a24','rgba(0,0,0,.35)','rgba(255,255,255,.12)');const woodDark=new THREE.MeshPhongMaterial({color:0x352218,shininess:12}),cream=new THREE.MeshPhongMaterial({color:0xffffff,map:plastic,shininess:6}),dark=new THREE.MeshPhongMaterial({color:0xffffff,map:keys,shininess:10}),metal=mat(0x8e8068,false),blue=new THREE.MeshPhongMaterial({color:0x2c4666,shininess:4});

  const top=add(root,box(3.15,.18,1.47,.07),wood,[-1.575,1.16,-.65]);
  top.geometry.translate(1.575,.09,0);
  for(const x of [-1.35,1.35])for(const z of [-.42,.42])add(root,new THREE.BoxGeometry(.16,1.25,.16),woodDark,[x,.62,z]);

  const drawers=add(root,box(.82,.82,.92,.055),wood,[.61,.34,-.46]);
  drawers.geometry.translate(.41,.41,0);
  for(let index=0;index<3;index++){
    add(root,new THREE.BoxGeometry(.69,.025,.02),woodDark,[1.02,.53+index*.22,.475]);
    add(root,new THREE.BoxGeometry(.25,.045,.045),metal,[1.02,.55+index*.22,.5]);
  }

  const computer=new THREE.Group();
  computer.position.set(.72,1.32,-.06);
  root.add(computer);
  const housing=add(computer,box(1.05,.92,.55,.1),cream,[-.525,0,-.34]);
  housing.geometry.translate(.525,.46,0);
  const bezel=add(computer,box(.91,.59,.05,.08),dark,[-.455,.205,.275]);
  bezel.geometry.translate(.455,.295,0);
  const screenMat=new THREE.MeshBasicMaterial({map:home});
  const screen=add(computer,new THREE.PlaneGeometry(.78,.439),screenMat,[0,.5,.4]);
  add(computer,new THREE.BoxGeometry(.56,.055,.025),metal,[0,.085,.305]);
  add(computer,new THREE.BoxGeometry(1.18,.08,.58),cream,[0,-.04,.3]);

  add(root,box(.92,.07,.5,.035),dark,[-.46,1.345,.4]).geometry.translate(.46,.035,0);
  for(let row=0;row<4;row++)for(let col=0;col<9;col++){
    add(root,box(.07,.025,.055,.008),dark,[-.205+col*.08,1.414,.48+row*.065]);
  }

  const chair=new THREE.Group();
  chair.position.set(.05,.2,1);
  root.add(chair);
  const seat=add(chair,box(.9,.15,.75,.07),blue,[-.45,.425,-.375]);
  seat.geometry.translate(.45,.075,0);
  const back=add(chair,box(.9,1.1,.14,.08),blue,[-.45,.47,.18]);
  back.geometry.translate(.45,.55,0);
  add(chair,new THREE.CylinderGeometry(.07,.07,.45,8),dark,[0,.22,0]);
  for(let i=0;i<5;i++){
    const spoke=add(chair,new THREE.BoxGeometry(.06,.06,.65),dark,[0,.02,0]);
    spoke.rotation.y=i*Math.PI*2/5;
  }
  return{root,screenMat,screen,textures:[grain,plastic,keys]};
}
function disposeTree(root){root.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose?.()})}

// ---- r19: sofa-reader pose, implemented here (not in ending-humans-r13.js) using only the bones that module exposes
// (human.body/head, leftArm/rightArm {upper,fore,hand}, leftLeg/rightLeg {upper,lower,shoe}). Same aim-bone technique
// the old poseHumanReader used internally, reimplemented locally since that helper isn't exported.
function aimBoneLocal(human,bone,direction){
  human.model.updateMatrixWorld(true);
  const worldDirection=direction.clone().normalize();
  worldDirection.applyQuaternion(human.model.getWorldQuaternion(new THREE.Quaternion()));
  const parentWorld=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  worldDirection.applyQuaternion(parentWorld).normalize();
  bone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),worldDirection);
  bone.updateMatrixWorld(true);
}
function placeFootAtCalfLocal(leg,footQuaternion){
  const endpoint=leg.lower.localToWorld(new THREE.Vector3(0,.43,0));
  leg.shoe.position.copy(leg.shoe.parent.worldToLocal(endpoint));
  leg.shoe.quaternion.copy(footQuaternion);
  leg.shoe.updateMatrixWorld(true);
}

// ---- r32: independent per-action time driving for continuous, non-frozen animation loops (conversation loop +
// walker idle). Every AnimationAction keeps its own `.time`; setting it directly then calling mixer.update(0)
// reapplies the pose at exactly that time without touching any other action on the same human. This is deliberately
// NOT selectClip/poseHumanConversation's approach (ending-humans-r13.js): those call mixer.setTime(phase*duration),
// which zeroes EVERY action's time on that human and resyncs them to one shared clock — fine for a single static
// pose, but it's exactly why the old conversation code froze: once its one shared "phase" argument saturated (at
// p=.3, from `establish`), mixer.setTime kept being re-called with that same frozen value forever (QA r29 f008..f026).
function driveHumanAction(human,name,timeSeconds,weight){
  const action=human.actions&&human.actions[name];
  if(!action)return;
  if(weight<=1e-4){action.weight=0;return}
  action.enabled=true;action.paused=false;
  const duration=action.getClip().duration||1;
  action.time=((timeSeconds%duration)+duration)%duration;
  action.weight=weight;
}
function silenceHumanActions(human,keep){
  for(const [name,action] of Object.entries(human.actions||{}))if(!keep.includes(name))action.weight=0;
}
// Natural seated pose: hips on the cushion, thighs horizontal along the seat, shins vertical with shoes on the floor,
// back against the backrest (slight recline), head tilted down to read, both hands at chest height holding the book.
// `p` (the ending's overall 0..1 progress) drives a subtle breathing sway, an occasional small head nod, and a slow
// page-turn-ish hand drift so the pose doesn't read as a frozen statue.
function poseReaderSeated(human,p){
  poseHumanIdle(human,.18);
  if(!human._seatedBase){
    human._seatedBase={
      bodyPosition:human.body.position.clone(),
      bodyQuaternion:human.body.quaternion.clone(),
      headQuaternion:human.head.quaternion.clone(),
      leftFootQuaternion:human.leftLeg.shoe.quaternion.clone(),
      rightFootQuaternion:human.rightLeg.shoe.quaternion.clone(),
    };
  }
  const base=human._seatedBase;
  human.body.position.copy(base.bodyPosition);
  human.body.quaternion.copy(base.bodyQuaternion);
  human.head.quaternion.copy(base.headQuaternion);
  human.body.position.y-=.24;
  human.body.rotateX(-.09);
  aimBoneLocal(human,human.leftLeg.upper,new THREE.Vector3(-.08,-.06,.97));
  aimBoneLocal(human,human.rightLeg.upper,new THREE.Vector3(.08,-.06,.97));
  aimBoneLocal(human,human.leftLeg.lower,new THREE.Vector3(-.02,-.99,-.05));
  aimBoneLocal(human,human.rightLeg.lower,new THREE.Vector3(.02,-.99,-.05));
  placeFootAtCalfLocal(human.leftLeg,base.leftFootQuaternion);
  placeFootAtCalfLocal(human.rightLeg,base.rightFootQuaternion);
  const pageTurn=Math.sin(p*46)*.02,breathe=Math.sin(p*10.5)*.012;
  aimBoneLocal(human,human.leftArm.upper,new THREE.Vector3(.18+pageTurn,-.45,.72));
  aimBoneLocal(human,human.rightArm.upper,new THREE.Vector3(-.18-pageTurn,-.45,.72));
  aimBoneLocal(human,human.leftArm.fore,new THREE.Vector3(.28,-.12,.92));
  aimBoneLocal(human,human.rightArm.fore,new THREE.Vector3(-.28,-.12,.92));
  const nod=((p*7.3)%1)>.92?Math.sin(p*640)*.05:0;
  human.head.rotateX(.24+nod+breathe*.6);
  human.body.position.y+=breathe;
}

export async function createEndingScene(canvas){
  if(!(canvas instanceof HTMLCanvasElement))throw new TypeError('createEndingScene(canvas) requires a canvas element.');
  const [roomTexture,sourceMascot,homeTexture,spriteIdle,spriteWave1,spriteWave2,spriteRun1,spriteRun2,spriteRun3,spriteRun4,spriteRun5,spriteRun6,spriteReach]=await Promise.all([
    loadTexture('./assets/ending/r10-image-first/room-lab-v1.webp?v=eternal-beam-r74'),loadTexture('./assets/ending/r10-image-first/character-original-v3/01-front.webp'),loadTexture('./assets/hero/beam-device-1920x1080.png?v=eternal-beam-r31'),
    loadTexture('./assets/goya/idle.png?v=eb-20260914'),loadTexture('./assets/goya/idle.png?v=eb-20260914'),loadTexture('./assets/goya/sit.png?v=eb-20260914'),
    loadTexture('./assets/goya/walk-a.png?v=eb-20260914'),loadTexture('./assets/goya/walk-b.png?v=eb-20260914'),loadTexture('./assets/goya/walk-a.png?v=eb-20260914'),loadTexture('./assets/goya/walk-b.png?v=eb-20260914'),loadTexture('./assets/goya/walk-a.png?v=eb-20260914'),loadTexture('./assets/goya/walk-b.png?v=eb-20260914'),
    loadTexture('./assets/goya/present.png?v=eb-20260914'),
  ]);
  const face=cropFace(sourceMascot);
  // r18: USE_SPRITE_MASCOT=false — the drawn-sprite walk cycle below is fully retired. The 3D hero (createMascot)
  // is the only mascot rendered; SPRITE_CELS/setSpriteCel are kept only as inert data so nothing else has to change shape.
  // ---- drawn-sprite mascot (disabled, r18): bottom-of-feet + horizontal-centre registration measured per cel with PIL (see measure-mascot-cels.py) ----
  const SPRITE_CELS={
    idle:{texture:spriteIdle,aspect:1331/1182,feetBottom:.9814,centerX:.5083},
    wave1:{texture:spriteWave1,aspect:700/698,feetBottom:1,centerX:.5},
    wave2:{texture:spriteWave2,aspect:652/700,feetBottom:1,centerX:.4992},
    run1:{texture:spriteRun1,aspect:690/700,feetBottom:1,centerX:.5},
    run2:{texture:spriteRun2,aspect:700/683,feetBottom:1,centerX:.5207},
    run3:{texture:spriteRun3,aspect:681/700,feetBottom:1,centerX:.5},
    run4:{texture:spriteRun4,aspect:696/700,feetBottom:.9957,centerX:.5},
    run5:{texture:spriteRun5,aspect:650/700,feetBottom:1,centerX:.5},
    run6:{texture:spriteRun6,aspect:700/699,feetBottom:1,centerX:.5136},
    reach:{texture:spriteReach,aspect:1,feetBottom:.985,centerX:.48},
  };
  // Humans are normalized to 2.5 units ≈ 170cm adult. The photo Eternal Beam cube is 25cm,
  // so standing height should be 170/25 = 6.8 cubes. Workbench face height in this plate is
  // ~2.05 world units ≈ 90cm, which sets 1 unit ≈ 44cm → adult scale 170/44/2.5 ≈ 1.55.
  const HUMAN_SCALE=1.55;
  const SPRITE_HEIGHT=2.15;
  const SPRITE_FLOOR_OFFSET=.46;
  const GOYA_WALK_END={x:3.58,y:-1.48};
  const spriteAnchor=travel=>({x:lerp(-1.75,GOYA_WALK_END.x,travel),floorY:lerp(-3.1,GOYA_WALK_END.y,travel)-SPRITE_FLOOR_OFFSET});
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x3a3832);const camera=new THREE.OrthographicCamera(-7.5,7.5,5,-5,.1,40);camera.position.set(0,0,10);
  roomTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy?.()||1);
  const backdrop=add(scene,new THREE.PlaneGeometry(15,10),new THREE.MeshBasicMaterial({map:roomTexture}),[0,0,-4]);scene.add(new THREE.HemisphereLight(0xfff6ea,0x4a4538,.95));const key=new THREE.DirectionalLight(0xfff1d8,.95);key.position.set(-1.6,3.2,12);scene.add(key);renderer.shadowMap.enabled=false;const castAll=root=>root.traverse(o=>{if(o.isMesh)o.castShadow=false});
  const workDesk=createDesk(THREE,homeTexture,{woodTexture,plasticTexture,box,add,mat});
  workDesk.macCaseMesh.visible=true;
  const diveFace=new THREE.Mesh(new THREE.PlaneGeometry(.9,.9),new THREE.MeshBasicMaterial({visible:false}));
  diveFace.position.set(4.72,.04,.32);
  diveFace.rotation.set(ISO_TILT,-.5,0,'XYZ');
  scene.add(diveFace);
  // r38 QA fix (superseded by r46, see below): ending-desk-computer-r35.js's
  // KBD_FRONT_Z grew (.86->1.05) so the keyboard deck read as a real, solid
  // keyboard from the ending camera instead of a sliver pulled back under the
  // chin. That pushed workDesk.macCaseMesh's own bounding box forward enough
  // to overlap the seated hero's case box (measured overlapCaseMac ~.074 at
  // p=.74/.78/.82 with the chair unmoved — QA_Evidence/tva-claude-20260909/
  // kbd38v2.json). Moving the chair straight back by CHAIR_BACK_DELTA cleared
  // it — since seatTarget below is derived from the chair's own seat-cushion
  // top (workDesk.getSeatTop(), which reads workDesk.chair.position live),
  // this one line moves the seated hero back with it, keeping seat contact
  // automatically. Landed on .14 (overlapCaseMac=0 with a small margin at
  // p=.74/.78/.82 — QA_Evidence/tva-claude-20260909/kbd38v6.json).
  //
  // r46 owner decision: the keyboard deck itself (and its keycap panel) is
  // now deleted from ending-desk-computer-r35.js — CRT head + chin only, no
  // keyboard, dims unchanged (see that file's r46 comment). With no keyboard
  // deck reaching forward past the chin any more, the case's own bounding box
  // is back to its pre-r38 (keyboard-less) footprint, so the chair no longer
  // needs the full .14 push-back to clear it — reduced to .04 so the mascot
  // sits naturally close to the desk again, re-verified with
  // measure-desk-boxes-r27.mjs nokbd46 (overlapCaseChair 0, backrest gap
  // >=.03, seat contact unchanged — see QA_Evidence/tva-claude-20260909/
  // nokbd46*.json for the measured numbers this run).
  //
  // r51 owner defect ("팔이 없다" -> "의자 개입" -> now a white glove BLOB peeking over the top edge of the
  // case, evidence QA_Evidence/tva-claude-20260909/nokbd46-crops/nokbd46-peek-078.png). Root cause measured,
  // not guessed: the DESK TOP's own desk-local z range is -.685..+.855 (inspectPose().boxes.deskTopBox) while
  // the seated hero's shoulders sat at desk-local z=1.26/1.40 (measured, seat51-base.json). The 2-bone arm's
  // max reach is .748 rig units = .748*.65/.82 = .593 DESK-LOCAL units, and dropping from shoulder height
  // (desk-local y=1.81) to desk-top height (y=1.375) already spends .435 of that, leaving only ~.40 of
  // horizontal budget. From z=1.26 the closest reachable point was z≈.87 and from z=1.40 it was z≈1.01 — i.e.
  // the desk top was PHYSICALLY OUT OF REACH for both arms, which is why every previous round had to park the
  // gloves in mid-air in front of the desk edge (z=1.04/1.34, off the desk) and then raise one of them to
  // y=2.2 just to get it out from behind the torso. That raised hand IS the blob the owner is seeing.
  //
  // The fix is therefore to move the whole seat toward the desk instead of contorting the arms: a NEGATIVE
  // CHAIR_BACK_DELTA slides the chair (and, because seatTarget is derived live from workDesk.getSeatTop(),
  // the seated hero with it, so seat contact and overlapCaseChair/caseChairGapZ are untouched — both scale
  // off the same workDesk.chair.position.z) .34 desk-local units closer to the desk. Limit: the case's own
  // desk-local box must stay clear of deskTopBox.max.z=.855, and the case's z footprint grows with the seat
  // yaw (its AABB depth ≈ caseWidth*|sin yaw| + caseDepth*|cos yaw| ≈ 1.172*|sin|+.186*|cos|), so -.30 was
  // chosen together with SEAT_EXTRA_YAW=-11° below to keep ≥.03 clearance. Verified with
  // measure-desk-boxes-r27.mjs seat51 (overlapCaseDesk/Mac/Chair 0, hand errors < .05).
  const CHAIR_BACK_DELTA=-.30;
  workDesk.chair.position.z+=CHAIR_BACK_DELTA;
  // the portal plane shows the same cover-cropped HOME image the desk screen shows, on its own cloned
  // texture, so there's no visible re-crop pop when the dive hands off from the in-scene screen to the portal plane
  const homePortalTexture=homeTexture.clone();homePortalTexture.needsUpdate=true;
  const portalMaterial=new THREE.MeshBasicMaterial({map:homePortalTexture,transparent:true,opacity:0,depthTest:false,depthWrite:false});
  const homePortal=add(scene,new THREE.PlaneGeometry(1,1),portalMaterial,[0,0,8]);homePortal.renderOrder=100;homePortal.visible=false;
  const setPortalRound=()=>{};
  const portalBackingMaterial=new THREE.MeshBasicMaterial({color:0x050606,transparent:true,opacity:0,depthTest:false,depthWrite:false});
  const portalBacking=add(scene,new THREE.PlaneGeometry(1,1),portalBackingMaterial,[0,0,7]);portalBacking.renderOrder=99;
  workDesk.root.position.set(-4.05,-1.72,0);workDesk.root.scale.setScalar(.42);workDesk.root.rotation.set(ISO_TILT,.35,0,'XYZ');workDesk.root.visible=false;scene.add(workDesk.root);castAll(workDesk.root);
  if(workDesk.chair)workDesk.chair.visible=false;
  const labDesk=makeLabComputerDesk();labDesk.position.set(-2.72,-1.62,.35);labDesk.scale.setScalar(1.35);scene.add(labDesk);
  const labChair=makeOfficeChair();labChair.position.set(-3.35,-2.85,.22);labChair.scale.setScalar(1.35);labChair.rotation.y=-.25;scene.add(labChair);
  const hero=createMascot(THREE,face,{sourceMascot,box,add,mat});hero.group.scale.setScalar(.65);hero.group.rotation.x=ISO_TILT;hero.group.visible=false;scene.add(hero.group);castAll(hero.group);
  const spriteMaterial=new THREE.MeshBasicMaterial({map:spriteIdle,transparent:true,depthWrite:true});
  const mascotSprite=USE_SPRITE_MASCOT?add(scene,new THREE.PlaneGeometry(1,1),spriteMaterial,[-1.75,-3.485,.45]):null;
  if(mascotSprite)mascotSprite.renderOrder=5;
  const setSpriteCel=(key,anchorX,floorY,z)=>{
    if(!mascotSprite)return;
    const cel=SPRITE_CELS[key];if(!cel)return;
    if(spriteMaterial.map!==cel.texture){spriteMaterial.map=cel.texture;spriteMaterial.needsUpdate=true}
    const width=SPRITE_HEIGHT*cel.aspect;
    mascotSprite.scale.set(width,SPRITE_HEIGHT,1);
    mascotSprite.position.set(anchorX-(cel.centerX-.5)*width,floorY+SPRITE_HEIGHT/2-(1-cel.feetBottom)*SPRITE_HEIGHT,z);
  };
  const [walker,chatA,chatB]=await Promise.all([createHuman('manCasual'),createHuman('manHoodie'),createHuman('womanCasual')]);
  tintHuman(walker,{skin:0xe0b48a,hair:0x1a120c});
  tintHuman(chatA,{skin:0x4a2a18,hair:0x140e0a});
  tintHuman(chatB,{skin:0x53301c,hair:0x140e0a});
  for(const h of [walker,chatA,chatB]){h.root.scale.setScalar(HUMAN_SCALE);h.root.rotation.x=ISO_TILT;scene.add(h.root)}
  // ANTHONEY + ROSARIA inspect reports together; MAN sits coding at the left photo bench
  chatA.root.position.set(.08,-2.55,.2);chatA.root.rotation.y=.45;
  chatB.root.position.set(1.28,-2.62,.18);chatB.root.rotation.y=-.45;
  walker.root.position.set(-3.28,-2.92,.22);walker.root.rotation.y=-.2;
  const reportA=makeReport();chatA.leftArm.hand.add(reportA);reportA.position.set(.06,-.08,.18);reportA.rotation.set(-1.05,.35,.12);
  const reportB=makeReport();chatB.leftArm.hand.add(reportB);reportB.position.set(.06,-.08,.18);reportB.rotation.set(-1.05,.35,.12);
  const chatAShadow=shadow(scene,.08,-2.85,.78),chatBShadow=shadow(scene,1.28,-2.92,.78);
  const walkerShadow=shadow(scene,-3.28,-3.12,.78),heroShadow=shadow(scene,-1.75,-3.23,.7);

  // r23: every owner's head is measured for real (see measureHead above and the hero case-box measurement below)
  // instead of a single hand-tuned constant — HEAD_WIDTH feeds the 1.5x balloon-width rule, HEAD_TOP_DELTA feeds the
  // "tail bottom sits .05 above the head top" placement rule used in the per-frame bubble loop further down.
  for(const h of [walker,chatA,chatB])h.root.updateMatrixWorld(true);
  const HEAD={walker:measureHead(walker),chatA:measureHead(chatA),chatB:measureHead(chatB)};
  const HEAD_TOP_DELTA={walker:HEAD.walker.topDelta,chatA:HEAD.chatA.topDelta,chatB:HEAD.chatB.topDelta};
  hero.group.updateMatrixWorld(true);
  const heroCaseMesh=hero.rig.children[0]; // housing mesh, first child added to rig in createMascot() (see the caseBox comment further down)
  const heroCaseWidthWorld=(()=>{const b=new THREE.Box3().setFromObject(heroCaseMesh);return b.max.x-b.min.x})();
  // the mascot's "head" is its screen/case, estimated as 65% of the case's actual (already-.65-scaled) world width —
  // matching the human head measurement above so every owner's balloon is derived the same way.
  const heroHeadWidth=heroCaseWidthWorld*.65;
  // measured in hero.group's own LOCAL frame (inverse of hero.group.matrixWorld) rather than world space, so it stays
  // correct re-applied through hero.group.localToWorld() every frame even though hero walks and later turns to sit
  // (its world position and rotation both change over the timeline, unlike the humans' static roots above).
  const heroCaseTopLocalY=(()=>{
    const rel=new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(hero.group.matrixWorld).invert(),heroCaseMesh.matrixWorld);
    const pos=heroCaseMesh.geometry.attributes.position,v=new THREE.Vector3();let maxY=-Infinity;
    for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(rel);if(v.y>maxY)maxY=v.y}
    return maxY;
  })();
  const HEAD_WIDTH={walker:HEAD.walker.width,chatA:HEAD.chatA.width,chatB:HEAD.chatB.width,hero:heroHeadWidth};

  // need bubbles: [owner, icon, start, end, xOffset]
  // r22: each balloon is a real extruded rounded-rect body (buildBalloon) sized to ~1.5x its owner's head width,
  // with either a pointed "talk" tail or two small trailing "thought" spheres. The shared canvas-cloud texture path
  // is fully retired (see buildBalloon above); every bubble owns its own balloon group plus a live 3D icon mesh.
  // r43: how far (world units) the balloon leans to whichever side its table row picks, measured from directly
  // above the head — see the tailTipX cancellation just below, which makes sure that lean is measured from the
  // TAIL's tip, not the body's own origin.
  const BALLOON_SIDE_LEAN=.25;
  const bubbles=[
    ['chatA','name',.18,.80,-.2,'ANTHONEY'],
    ['chatB','name',.20,.80,.15,'ROSARIA'],
    ['walker','name',.22,.80,-.35,'MAN'],
  ].map(([owner,icon,start,end,ox,label])=>{
    const balloonWidth=icon==='name'?1.22:1.5*(HEAD_WIDTH[owner]||.5);
    const balloon=buildBalloon(balloonWidth,'talk');
    scene.add(balloon.group);balloon.group.position.set(0,0,BALLOON_Z);
    // icon fits inside ~55% of the balloon's own HEIGHT (r23: was balloonWidth*.55 — the balloon is noticeably
    // shorter than it is wide, so sizing off width alone over-filled the body), centered toward the camera-facing side.
    const iconMesh=icon==='name'?makeNamePlate(label):build3DIcon(icon);
    const iconScale=icon==='name'?Math.min(balloon.width*.88/1.72,balloon.height*.5/.43):fitIconScale(iconMesh,balloon.height*.55);scene.add(iconMesh);
    const flatIcon=icon==='name'||icon==='note'||icon==='zzz'||icon==='book'||icon==='heart'; // r23: heart moved here too — a full 360° spin necessarily passes edge-on, which is exactly when it punched through the balloon's front face (see iconZOffset below)
    // r23: the icon's own local half-extents (pre iconScale), used to guarantee the icon clears the balloon's front
    // face at its *worst-case* rotation, not just at rest. A flat, wide mesh tilted by the wobble sweeps further along
    // its own local Z than its resting thickness alone (width*sin25° + depth*cos25°); a fully-spinning icon passes
    // through every angle, so its worst case is the full diagonal (hypot of the two half-extents).
    const iconBox=new THREE.Box3().setFromObject(iconMesh);
    const halfX=(iconBox.max.x-iconBox.min.x)/2,halfZ=(iconBox.max.z-iconBox.min.z)/2;
    const maxTiltHalfDepthLocal=flatIcon?halfX*Math.sin(25*Math.PI/180)+halfZ*Math.cos(25*Math.PI/180):Math.hypot(halfX,halfZ);
    const iconZOffset=balloon.thickness/2+maxTiltHalfDepthLocal*iconScale+.05; // icon center z = balloon front z + icon half-depth + .05
    const tailOffset=balloon.tailBottomDrop+.05; // group.position.y = headTop + tailOffset plants the tail bottom .05 above the head top
    // keep the icon in the same transparent draw pass as the balloon body (renderOrder after it) so it always paints
    // over the balloon regardless of geometry depth, exactly as the old cloud+icon pairing relied on (r20 note kept
    // for context: icons are opaque-by-default meshes, so without forcing transparent=true they'd sort into the
    // earlier opaque pass and let the balloon's own depth test occlude parts of them).
    iconMesh.traverse(o=>{if(o.isMesh){o.renderOrder=21;o.material.transparent=true}});
    // r43 QA fix: `ox` from the table above used to be applied directly to the balloon GROUP's own origin, which
    // (per the tailTipX comment in buildBalloon) sits offset from the visible tail tip by up to width*.42 — so a
    // small hand-tuned ox like -.1 never actually landed the tail near the head, it just moved an already-offset
    // body further along. Keep each row's ORIGINAL SIGN (its intended left/right lean, still giving every bubble
    // some side variety instead of stacking them all dead-centre) but fix the magnitude to a single BALLOON_SIDE_LEAN
    // (~.25 world units, per owner note) and then cancel out the tail's own built-in droop (-balloon.tailTipX) so
    // the tail TIP itself — not the body's origin — ends up sitting at headX ± BALLOON_SIDE_LEAN, pointing at the head.
    const sideLean=(ox<0?-1:1)*BALLOON_SIDE_LEAN;
    const groupOffsetX=sideLean-balloon.tailTipX;
    return{owner,icon,start,end,ox:groupOffsetX,balloon,iconMesh,iconScale,flatIcon,iconZOffset,tailOffset};
  });
  bubbles.forEach(b=>{b.balloon.group.traverse(o=>{if(o.isMesh)o.renderOrder=20});b.balloon.group.visible=false;b.iconMesh.visible=false});

  const plumbob=makePlumbob();plumbob.visible=false;scene.add(plumbob);
  const typed=typedScreenTexture();
  const cat=makeCat();cat.root.scale.setScalar(.92);cat.root.rotation.x=ISO_TILT;scene.add(cat.root);const catShadow=shadow(scene,0,0,.38);
  // r56 defect fix: "cat pops into existence" — the module (ending-cat-walker-r28.js, read-only here) only
  // drives/shows the cat for p in (.32,.62) (its own walk-across-the-rug window). Instead the cat must be in
  // the room from the very first room-phase frame (p≈.16, see `establish=segment(p,.16,.3)` above), sitting at
  // the module's own CAT_START (mirrored here since the module doesn't export it) with the same "look at the
  // camera" yaw offset (+.9 rad) the module itself uses for its mid-path pause-and-look beat, tail swaying via
  // cat.walk(phase,0). CAT_START/CAT_END values copied from the module's own constants (see its comments) —
  // duplicated, not imported, since the module exports functions, not these internal constants.
  const CAT_START={x:3.0,y:-2.45},CAT_END={x:-2.3,y:-2.0};
  const catBaseHeading=catHeading(THREE,CAT_START,CAT_END); // = module's own travel heading (no camera turn)
  const catSitHeading=catBaseHeading+.9; // matches the module's own pause "look toward camera" turn amount
  const CAT_WAKE_START=.32,CAT_WAKE_END=.34; // matches the module's own CAT_PATH_START, so the handoff lands exactly where the module starts moving the cat
  const CAT_SETTLE_START=.60,CAT_SETTLE_END=.64; // matches the module's own CAT_PATH_END..just past its visibility cutoff (.62)
  workDesk.root.updateMatrixWorld(true);diveFace.updateMatrixWorld(true);
  const idleQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(ISO_TILT,0,0,'XYZ'));
  const walkQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(ISO_TILT,.95,0,'XYZ'));
  // r18: STRIDE_WORLD accounts for the walk yaw — the hero's local forward (local Z) only projects part of its length onto
  // world X while walking at this yaw, so the naive footZ-sweep/scale/stance-fraction ratio alone left the planted foot
  // sliding ~0.04-0.07 world units per stance (measured with foot-trace.mjs). Multiplying by that projection fixed it to <0.02.
  const STRIDE_PROJECTION=Math.abs(new THREE.Vector3(0,0,1).applyQuaternion(walkQuaternion).x);
  const STRIDE_WORLD=(2*.34*.65*STRIDE_PROJECTION)/.62;
  // r36: item — owner feedback "왼손이 어깨 위로 들려 있다" (seated, the LEFT hand floats above the shoulder instead of
  // resting on the desk): deskHandTargets[1] (hero.rightArm, root-local x=-1.0) had been raised to y=2.05 (r34) purely
  // to dodge the case's silhouette from THIS seat yaw — at desk height (y~1.44-1.5) that hand's shoulder-to-target line
  // stayed hidden behind the case. Rather than keep compensating with height, SEAT_EXTRA_YAW turns the seated hero an
  // extra 6° further around (on top of the existing workDesk-yaw+180 flip) so the scene camera reads more of the
  // mascot's side/back — this both clears the case silhouette for a desk-level target AND shortens this arm's reach
  // (see deskHandTargets below), so the target no longer needs the y=2.05 workaround.
  // r51: SEAT_EXTRA_YAW goes NEGATIVE (+6° -> -11°). Two measured reasons:
  // (a) +6° was turning the mascot AWAY from both the monitor and the camera. The monitor's own desk-local
  //     centre is (.14,~2.15,-.08) and the seated hero sits at desk-local (.05,.89,~.88), so the yaw that
  //     points the rig's forward (+Z, mapped to desk-local by Ry(π+yaw)) straight at the screen is about
  //     -4.6°, NOT +6°. And the camera-facing direction in desk-local is (1,0,1)/√2, so d(dot)/dyaw < 0 for
  //     any yaw below 45° — every positive degree turned the mascot further away from the lens.
  // (b) An occlusion scan (case modelled as its real slab: 1.172 wide x .186 deep x .997 tall in desk-local,
  //     ray-cast toward the camera from candidate hand/elbow points) found NO yaw >= -8° at which both hands
  //     can sit on the desk top unoccluded — every feasible (chair-delta, yaw) pair came out in the -9°..-13°
  //     band. -11° is the middle of that band and still only ~6° off dead-on to the screen, so it still reads
  //     as "typing at the computer" while the camera now sees the mascot's near side and BOTH arms.
  // Cost check (the r36 failure mode, re-measured): the case's desk-local z footprint grows with |yaw|, so
  // this is paid for out of the same budget as CHAIR_BACK_DELTA above — -11° with -.30 keeps overlapCaseDesk 0.
  const SEAT_EXTRA_YAW=-11*Math.PI/180;
  const seatQuaternion=workDesk.root.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI+SEAT_EXTRA_YAW));
  // r19: seatTarget is derived from the chair's own seat-cushion top (workDesk.getSeatTop(), a debug getter on the
  // chair group) instead of the old hardcoded (.05,.72,.12) - which, measured against the actual chair mesh (chair
  // group sits at root-local z=1, cushion centre at root-local z~.625), was scooted so far toward the desk it no
  // longer matched the chair at all and put the seated hero partly inside the computer housing, hidden by its now-much
  // larger opaque case (verified with a hide-the-desk debug render). SEAT_Y_OFFSET nudges up for the fact that
  // hero.group's own origin sits a bit above the mascot's case-bottom sample point (group-local (0,-.11,0)), so the
  // case bottom ends up resting ON the cushion instead of floating above or clipping through it.
  // r43: nudged from .085 to .11 as part of the defect-A chair-overlap fix above — the cushion mesh's own bevel
  // padding (roundedBox's bevelSize/bevelThickness, ~.035) raises the MEASURED top of chairSeatBox slightly above
  // the flat seat surface getSeatTop() actually targets, so the case was measured sinking ~.025 into the cushion's
  // rounded top edge (overlapCaseChair's seat-box component wasn't quite 0 at .085). +.025 clears that measurement
  // margin; re-verified overlapCaseChair=0 (both the backrest and the seat-box-minus-top-.02 components) at
  // p=.74/.78/.82 with no visible float above the cushion (see QA_Evidence/tva-claude-20260909/scene43-crops/).
  const SEAT_Y_OFFSET=.11;
  // r36: tried SEAT_EXTRA_YAW values up to 16-20° (swings the case's own front corner enough to overlap the desk
  // box — measured overlapCaseDesk .005-.006 at 16°+ — and drives deskHandTargets[1]'s reach error well past .05);
  // 6° measured overlapCaseDesk=0 and reach error ~.02-.03 across p=.74-.82 (see
  // QA_Evidence/tva-claude-20260909/seat36-final.json) with the cushion-top seatTarget left untouched — no seat
  // position shift was needed once deskHandTargets[1]'s x was also brought in from -1.0 toward the Mac's own
  // centre (see deskHandTargets below), so this fix is yaw-only.
  const seatCushionLocal=workDesk.root.worldToLocal(workDesk.getSeatTop().clone());
  // r51: SEAT_FORWARD slides the seated hero a hair forward ON the cushion (desk-local -z = toward the desk),
  // independently of the chair. It is NOT a duplicate of CHAIR_BACK_DELTA: moving the chair moves the backrest
  // WITH the case and so can never change the case-to-backrest gap (r43 measured exactly that), it only trades
  // the gap in front. Moving the hero relative to the chair is the only lever that re-centres the case inside
  // the corridor between the desk top (desk-local z .855) and the backrest front face (1.309). Measured before
  // this nudge: desk gap .056 / backrest gap .007-.020 — lopsided, and under the owner's ">= .03 backrest gap"
  // bar. -.025 splits it roughly evenly. It is well inside the cushion (depth .82), so seat contact — which is
  // a Y relationship, caseBottom vs chairSeatTop — is untouched.
  const SEAT_FORWARD=-.025;
  const seatTarget=workDesk.root.localToWorld(new THREE.Vector3(seatCushionLocal.x,seatCushionLocal.y+SEAT_Y_OFFSET,seatCushionLocal.z+SEAT_FORWARD));
  const monitorTarget=new THREE.Vector3();
  const monitorScale=new THREE.Vector3();
  const monitorQuaternion=new THREE.Quaternion();
  const refreshMonitor=()=>{
    diveFace.updateMatrixWorld(true);
    diveFace.getWorldPosition(monitorTarget);
    diveFace.getWorldScale(monitorScale);
    diveFace.getWorldQuaternion(monitorQuaternion);
  };
  refreshMonitor();
  // r24: item-1 — the desk keyboard is gone, so the mascot's gloves rest directly on the desk surface in front
  // of the Mac instead of on keycaps, close together rather than spread across a keyboard's width. Root-local
  // x=.25/-.15 (spread .4, straddling the Mac's own x=.14) at z=1.0 (well inside the desk-top's own z-range,
  // in front of the Mac's front face at root-local z~.21). This spot was reached by measurement, not by eye:
  // the 2-bone arm IK below only converges to <.05 hand error (see inspectPose().handErrors) inside a fairly
  // narrow reachable pocket given this rig's fixed shoulder offsets — the originally tried tighter spread
  // (~.18, matching a literal keycap-sized target) and a spot right at the Mac's front face (z~.56, only .35
  // in front of it) both measured hand errors of .08-.44, i.e. visibly short/floating hands. This position
  // measured a max hand error of .036 across the whole .74-.84 typing window (see
  // QA_Evidence/tva-claude-20260909/measure-r24-z100-40.json).
  //
  // r28: widened from .25/-.15 (spread .4) to .55/-1.0 alongside the wider
  // shoulder anchors in createMascot (ending-props-r15.js). Debugging the
  // 2-bone IK (QA_Evidence/tva-claude-20260909/debug-arm-height.mjs) showed
  // the arm was already stretched to its .748 max reach with the OLD narrow
  // spread (height — the elbow's bend radius — measured ~.027, i.e. an
  // almost perfectly straight shoulder-to-hand line with no visible outward
  // bow at all, regardless of shoulder position or which way the elbow's
  // bend-plane faces). Reaching this far inward-and-down was the real
  // reason the arms read as invisible: a nearly straight line from a wide
  // shoulder to a narrow, central hand target passes back through the
  // case's own silhouette for most of its length. Widening the spread
  // shortens the reach back to a normal working distance, restoring real
  // elbow bend (see the pole-vector bias just below).
  //
  // The two targets are NOT symmetric (first at y=1.44, resting on the desk;
  // second raised to y=1.85): the seated camera view is not a mirror of
  // itself (see the shoulder-anchor comment in createMascot for why), and
  // projecting screen coordinates (QA_Evidence/tva-claude-20260909/
  // inspect-arms-r28.mjs) showed the second arm's entire shoulder-to-hand
  // path stays hidden behind the case's own top face at any nearby desk-
  // level (y~1.44) target — raising just that hand clears it into the open
  // space beside the case, so both gloves are visible at once instead of
  // only one.
  // r34: item — owner feedback "앉았을 때 팔이 없다" (seated, an arm is missing): from the scene camera behind the
  // mascot, the deskHandTargets[1] glove (hero.rightArm) still read as only a thin sliver peeking above the case's
  // own top edge (screen-space margin measured at just ~14px out of 720px tall — see
  // QA_Evidence/tva-claude-20260909/inspect-arms-r28.mjs projections). Widening x further outward (tried -1.15,
  // -1.25, -1.5) actually makes it WORSE, not better: this arm's shoulder anchor sits on the OPPOSITE side (rig-local
  // x=+.81/.89, see createMascot in ending-props-r15.js) from this target's negative x, so pushing x more negative
  // increases the required reach distance fast and blows straight through the 2-bone arm's .748 max length (measured
  // handErrors of .15-.29 at x=-1.25..-1.5 — see arms34/arms34c/arms34.json), while barely moving the screen
  // position at all (the desk root's -45° yaw compresses most of that x change into depth, not screen breadth). The
  // real lever is Y (raising the hand clears the case's top edge in screen space) combined with the .08 shoulder
  // move allowed below (createMascot) to buy back enough reach budget to raise it further before maxing out: x kept
  // at the original -1.0, y raised from 1.85->2.05 (reach .666, comfortably under .748 — was .787+ and failing at
  // y>=2.05 with the OLD un-widened shoulder). This measured a ~26px clear margin above the case top at p=.78
  // (vs. ~14px before), and z stays at 1.0 (unchanged — z does not move the target off the desk-height reach
  // budget the way x/y do).
  // r36: both targets now sit at desk level (y=1.44-1.5), roughly symmetric about the Mac's own root-local x~.14,
  // instead of index1 being raised to y=2.05 to dodge the case silhouette (see SEAT_EXTRA_YAW above, which now does
  // that job by turning the seat instead of lifting the hand). Values re-measured against the new seat yaw with
  // measure-desk-boxes-r27.mjs (see QA_Evidence/tva-claude-20260909/seat36*.json) rather than guessed.
  // r38 QA fix (superseded by r46, see below): re-fit for the grown keyboard
  // deck (ending-desk-computer-r35.js KBD_FRONT_Z .86->1.05) plus the
  // CHAIR_BACK_DELTA seat move above. z was 1.0+CHAIR_BACK_DELTA (moves
  // forward WITH the chair, by the same amount, instead of staying fixed) —
  // moving the target by the same delta as the chair keeps the
  // shoulder-to-target geometry constant regardless of the chair's own
  // position, which is why that same "z=BASE+CHAIR_BACK_DELTA" shape is kept
  // below. y was the sloped deck-top height at that z (≈1.43/1.45).
  //
  // r46 owner decision: the keyboard deck is gone (ending-desk-computer-
  // r35.js, CRT head + chin only), so the gloves now rest on the real DESK
  // TOP (workDesk.deskTopMesh, ending-props-r15.js: a flat roundedBox at
  // root-local y=1.25, height .18 -> top surface root-local y=1.34) instead
  // of the former sloped keyboard-deck surface. Target x is SYMMETRIC about
  // the computer's own root-local x=.14 (ending-props-r15.js:
  // computer.position.x=.14) with a .35 half-spread each side (.49 / -.21)
  // per the owner's spec, narrowed in from the old .41 half-spread
  // (.55/-.27) now that there is no keyboard silhouette to reach around. z
  // keeps the proven "BASE+CHAIR_BACK_DELTA" shape (moves the target forward
  // WITH the chair by the same amount, preserving the shoulder-to-target
  // reach this rig's 2-bone IK was tuned against) so both land between the
  // chin front (root-local z~.25) and the chair's own new closer position.
  // index0 (hero.leftArm) sits right at desk-top-height+.02 (1.36) with a
  // measured handError of ~.013 across p=.74/.78/.82 — the desk-top height
  // works cleanly for this arm, AND it is genuinely visible resting on the
  // desk beside the case in every capture below.
  //
  // index1 (hero.rightArm) is this rig's documented "narrow reachable
  // pocket" arm (see the r28/r34/r36 history above — it has needed a raised
  // target to clear the case/torso silhouette ever since the case grew large
  // enough to occlude a desk-level target from this camera). Two separate
  // problems here, solved independently:
  // (1) REACH: flat desk-top+.02 (y=1.36-1.38, the same z base as index0)
  //     measured handError .095-.10 (over the .05 budget) — pushing z out to
  //     1.3+CHAIR_BACK_DELTA (vs index0's 1.0+CHAIR_BACK_DELTA, i.e. moving
  //     the target itself, not just the shoulder, further toward the camera/
  //     away from the seat) brought it back down to ~.013-.015 at y=1.52.
  // (2) VISIBILITY: even with handError fixed, y=1.52 (still desk-level-ish)
  //     rendered with the glove fully hidden behind the mascot's own torso —
  //     confirmed by an isolated swap test (temporarily driving each target
  //     to an extreme y one at a time and watching which glove moved in the
  //     capture) that this is genuinely occlusion by the torso volume, not a
  //     z-fighting/measurement artifact: the torso sits closer to camera
  //     (larger world z) than this hand at every y up to ~1.9 (still hidden
  //     at that test value). y=2.5 read as clearly visible (peeking well
  //     past the torso's own top edge) but sits noticeably high/uncanny; 2.2
  //     is the value kept — a small but readable glove/finger silhouette
  //     resting on the torso's own top-back corner (see
  //     QA_Evidence/tva-claude-20260909/nokbd46-crops/nokbd46-peek-078.png),
  //     with handError still only .013-.015 across p=.74/.78/.82 (see
  //     QA_Evidence/tva-claude-20260909/nokbd46.json for this run's exact
  //     numbers). All overlaps (overlapCaseDesk/overlapCaseMac/
  //     overlapCaseChair) measured 0 at p=.74/.78/.82 with these values
  //     (same file).
  //
  // r51: both gloves now genuinely rest ON the desk top, so the targets are DESK-relative absolutes and no
  // longer carry the "+CHAIR_BACK_DELTA" (chair-relative) term — a hand resting on a table does not move when
  // the chair moves. deskTopBox measures desk-local y 1.125..1.375 (top surface 1.375) and z -.685..+.855
  // (front edge .855), with the computer occupying x -.346..+.626, z -.424..+.270. So:
  //   y = 1.44  — the hand BONE origin; the glove's own radius (~.06 desk-local, measured off the render at
  //               2.4x crop scale) puts the glove's underside at ≈1.38, i.e. sitting ON the 1.375 surface.
  //   z = .80 / .56 — both between the computer's front face (.270) and the desk's front edge (.855), i.e.
  //               genuinely in front of the computer, on the wood.
  //   x = .70 / -.42 — SYMMETRIC about the computer's own root-local centre x=.14 (±.56), i.e. one glove
  //               either side of the machine, and both at .55/.47 desk-local from their shoulder — about
  //               79-93% of the .593 max, which is what leaves a REAL elbow bend (IK bend height .13-.22 rig
  //               units) instead of the straight, invisible arms of r28-r46.
  //
  // What this does NOT achieve, measured rather than hand-waved (see the report for this round): the FAR
  // glove (index1) still cannot be seen from this camera, and no combination of the levers available here
  // can change that. The mascot's visible body measures ~1.10 world units wide on screen (measured by
  // diffing a seated frame against a frame with the hero elsewhere), while a whole arm — shoulder to hand —
  // only spans .748 rig = .486 world. The far shoulder itself projects .32 world INSIDE the body's own left
  // silhouette edge, so the far hand can at absolute full stretch reach screen x 3.700 against a body edge
  // at 3.669: a ~3px margin, at zero elbow bend, with the glove hanging over the desk's front lip. Turning
  // the seat further toward the camera does not fix it either: the seated case has to fit in the .454-wide
  // desk-local corridor between the desk top (z .855) and the chair backrest (z 1.309), and the case's own
  // z footprint grows as 1.172*|sin yaw| + .16*|cos yaw|, which caps |SEAT_EXTRA_YAW| at about 15° — while
  // the yaw that would actually square the shoulders to the lens (both arms flanking the body, the classic
  // over-the-shoulder read) is +45°, needing a ~1.0-wide corridor. So index1 is placed where it is correct
  // in 3D (on the desk, symmetric, no clipping) rather than stretched sideways to buy a 3px sliver — the
  // owner has already rejected slivers twice (r34's 14px, r46's 26px "peek").
  const deskHandTargets=[
    workDesk.root.localToWorld(new THREE.Vector3(.70,1.44,.68)),
    workDesk.root.localToWorld(new THREE.Vector3(-.42,1.44,.68))
  ];
  refreshMonitor();
  const screenW=diveFace.geometry.parameters.width,screenH=diveFace.geometry.parameters.height;
  let baseWidth=15,baseHeight=10,portrait=false,homeNarrow=false;
  // ---------------------------------------------------------------------------------------------------
  // r57 — BEZEL-COVERAGE GATE for the final dive.
  //
  // r54 made the portal plane BE the monitor's window (same rounded outline, same world size) while
  // flatten===0, then lerped it out to the viewport-filling HOME framing over a hardcoded p .90-.955.
  // The defect the owner caught ("이건 또 뭐니"): .90 is a number, not a fact. At most viewport aspects
  // the camera has NOT pushed the bezel off-screen by p=.90 — the case, the chin and the floppy slot are
  // all still on screen — so for ~.90-.94 the image grew past the window and hung over the bezel with its
  // corners half-straightened. It read as a mis-placed sticker, not as diving into the screen.
  //
  // The invariant this block enforces instead, at every frame and every viewport:
  //   while ANY part of the bezel is visible, the portal is EXACTLY the window — no growth, no
  //   corner straightening. The flatten may only start once the window's own projected outline fully
  //   covers the viewport (i.e. the bezel has left the frame on all four sides).
  //
  // "Fully covers" is MEASURED, not assumed. The desk sits at yaw -45° with an iso tilt, so the window
  // projects as a rotated parallelogram with rounded corners — nothing the old coverK formula (which
  // treated screenW*monitorScale.x as an on-screen width) could account for, and the main reason the
  // zoom fell short. windowInsetAt() below inverts the quad's own projected 2x2 basis to put a world
  // point into the window's local frame and returns its signed distance inside that rounded rect;
  // coverageFor() takes the worst of the four viewport corners and normalises it to viewport widths.
  // coverage >= COVER_MARGIN  =>  every viewport corner is inside the window, i.e. bezel is off-screen.
  const DIVE_START=.86,FLATTEN_END=.955,FLATTEN_FLOOR=.90,COVER_TARGET_P=.93,COVER_MARGIN=.02;
  const windowRadius=workDesk.screen.geometry.parameters.radius||0;
  const windowMatrix=new THREE.Matrix4().compose(monitorTarget,monitorQuaternion,monitorScale);
  // The camera is a z-aligned orthographic one, so projection just drops z: the window's projected outline
  // is the affine image of its local rounded rect under the top-left 2x2 of that world matrix.
  const wme=windowMatrix.elements,wa00=wme[0],wa10=wme[1],wa01=wme[4],wa11=wme[5];
  const wdet=wa00*wa11-wa01*wa10;
  const wScaleMin=Math.min(Math.hypot(wa00,wa10),Math.hypot(wa01,wa11)); // local units -> world, conservatively
  const windowInsetAt=(wx,wy)=>{
    const dx=wx-monitorTarget.x,dy=wy-monitorTarget.y;
    const lx=Math.abs((wa11*dx-wa01*dy)/wdet),ly=Math.abs((wa00*dy-wa10*dx)/wdet);
    const a=screenW/2,b=screenH/2,r=Math.max(0,Math.min(windowRadius,a,b));
    if(lx>a-r&&ly>b-r)return r-Math.hypot(lx-(a-r),ly-(b-r)); // inside the corner fillet's quadrant
    return Math.min(a-lx,b-ly);
  };
  // Single source of truth for the dive camera's frustum, shared by render() and the solver below so the
  // gate can never drift away from the camera it is measuring.
  const frustumFor=(scaleValue,cx,cy)=>{
    const vwHalf=baseWidth/2/scaleValue,vhHalf=baseHeight/2/scaleValue;
    return{vwHalf,vhHalf,ccx:Math.max(-7.5+vwHalf,Math.min(7.5-vwHalf,cx)),ccy:Math.max(-5+vhHalf,Math.min(5-vhHalf,cy))};
  };
  const diveCenterAt=(pv,actionCenterV)=>{const travel=segment(pv,.82,.88);return{x:lerp(actionCenterV,monitorTarget.x,travel),y:lerp(0,monitorTarget.y,travel)}};
  const coverageFor=(scaleValue,center)=>{
    const f=frustumFor(scaleValue,center.x,center.y);
    let worst=Infinity;
    for(const vx of[f.ccx-f.vwHalf,f.ccx+f.vwHalf])for(const vy of[f.ccy-f.vhHalf,f.ccy+f.vhHalf])worst=Math.min(worst,windowInsetAt(vx,vy));
    return worst*wScaleMin/(2*f.vwHalf);
  };
  const focusScaleFor=(pv,finalScaleV)=>Math.exp(Math.log(finalScaleV)*smoother(segment(pv,DIVE_START,FLATTEN_END)));
  let diveFinalScale=1,flattenStart=COVER_TARGET_P,diveGate={};
  // Recomputed on every resize (it depends on the viewport's baseWidth/baseHeight/portrait/homeNarrow).
  const solveDive=()=>{
    const coverK=homeNarrow?1.907:Math.max(1,(baseHeight*16/9)/baseWidth)*1.02;
    const baseFinal=coverK*baseWidth/(screenW*monitorScale.x); // r54's zoom target, kept as a floor
    // walkingX is pinned at 3.75 from p=.5231 and actionCenter saturates at p=.6077 (r60 sped the character
    // up 1.3x; both were .59/.7 before), so over the whole dive window the camera's pre-dive centre is this
    // constant — same expression render() uses. The dive window itself (.82-.88) was NOT moved, so this
    // assumption only got safer: both saturate even earlier now.
    const actionCenterV=portrait?lerp(-.7,3.75,1):0;
    const endCenter=diveCenterAt(1,actionCenterV);
    // 1) smallest camera zoom at which the window covers the viewport (+margin). Coverage is monotonic in
    //    zoom, so bisect for it.
    let lo=1,hi=Math.max(4,baseFinal),guard=0;
    while(coverageFor(hi,endCenter)<COVER_MARGIN&&guard++<80)hi*=1.5;
    for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(coverageFor(mid,endCenter)>=COVER_MARGIN)hi=mid;else lo=mid}
    const coverScale=hi;
    // 2) make sure that zoom is actually reached by COVER_TARGET_P, so the flatten always has a real
    //    .93-.955 window to run in. focusScale = finalScale^dive(p), so finalScale = coverScale^(1/dive(P)).
    //    The end state is unaffected: portalWidth/portalHeight are expressed in viewport units, so a deeper
    //    finalScale changes how far the camera travels, not what the last frame looks like.
    diveFinalScale=Math.max(baseFinal,Math.pow(coverScale,1/smoother(segment(COVER_TARGET_P,DIVE_START,FLATTEN_END))));
    // 3) the measured p at which the bezel actually leaves the frame — the gate the flatten waits on.
    let coverP=FLATTEN_END;
    for(let pv=DIVE_START;pv<=FLATTEN_END+1e-9;pv+=.0005){
      if(coverageFor(focusScaleFor(pv,diveFinalScale),diveCenterAt(pv,actionCenterV))>=COVER_MARGIN){coverP=pv;break}
    }
    flattenStart=Math.min(Math.max(FLATTEN_FLOOR,coverP),FLATTEN_END-.005);
    diveGate={viewport:[baseWidth,baseHeight],portrait,homeNarrow,coverK,margin:COVER_MARGIN,
      baseFinalScale:baseFinal,coverScale,finalScale:diveFinalScale,coverP,flattenStart,
      coverageAtFlattenStart:coverageFor(focusScaleFor(flattenStart,diveFinalScale),diveCenterAt(flattenStart,actionCenterV)),
      coverageAtEnd:coverageFor(diveFinalScale,endCenter),
      coverageAtBaseline90:coverageFor(focusScaleFor(.90,baseFinal),diveCenterAt(.90,actionCenterV))};
  };
  const render=value=>{
    // r20 sit timeline (r60 numbers — the whole character performance runs 1.3x faster, see the block below;
    // the r20 values it replaced are in brackets): turn to face the desk .5231-.5423 [.59-.615] (turnIn, below),
    // move HORIZONTALLY to directly above the seat .5423-.5692 [.615-.65] (`horiz`, standing height, knees
    // straight, small forward lean), then descend STRAIGHT DOWN onto the cushion .5692-.6077 [.65-.70]
    // (`descend`, knees bending, feet reach the floor) - no more diagonal pass through the chair back.
    // Hands reach the desk surface in front of the Mac .6077-.6385 [.70-.74] (`sit`), typing bob
    // .6385-.7154 [.74-.84] (`typing`).
    // r60 (2026-09-12 사장님 요청 "마지막 애니메이션은 캐릭터만 조금 더 빨리"): 걸어와 앉고 타이핑하는
    // 연기 전체를 1.3배 빠르게. 걷기 시작점(.30)은 그대로 두고, 그 뒤의 모든 캐릭터 창을 같은 한 가지 식으로
    // 앞당겼다 —  T(x) = .30 + (x - .30) / 1.3  (소수 넷째 자리 반올림).
    // 단계 사이 간격의 비율이 그대로 유지되므로 동작이 끊기거나 겹치지 않는다. 걸음 위상은 시간이 아니라
    // 간 거리(distanceTravelled/STRIDE_WORLD, 아래)에 묶여 있어서, 이 압축은 "발 포즈 ↔ 월드 위치" 관계를
    // 전혀 바꾸지 않는다 — 즉 발 미끄러짐은 그대로다(실측: 같은 거리 지점에서 발 위치 최대 차이 0.0002 이하).
    // 이 파일 안에서 이 캐릭터 창들과 짝을 이루는 값들(turnIn·기울기·팔 정렬·세로 중심이동·화면 글자/밝기)도
    // 전부 같은 T 로 옮겼다. 아래 주석에 원래 값을 함께 남긴다. 모니터 다이브(.82~.88, DIVE_START=.86)와
    // 대화/고양이/통행인(별도 모듈) 타이밍은 캐릭터 연기가 아니므로 건드리지 않았다.
    //   travel .3~.59 -> .3~.5231 | align .59~.64 -> .5231~.5615 | horiz .615~.65 -> .5423~.5692
    //   descend .65~.70 -> .5692~.6077 | sit .70~.74 -> .6077~.6385 | typing .74~.84 -> .6385~.7154
    const p=clamp01(value),establish=segment(p,.16,.3),travel=segment(p,.3,.5231),align=segment(p,.5231,.5615),horiz=segment(p,.5423,.5692),descend=segment(p,.5692,.6077),sit=segment(p,.6077,.6385),typing=segment(p,.6385,.7154);
    // ---- r32: continuous Sims-like conversation loop (defect 1 fix). The old poseHumanConversation(chatA,
    // establish*.82) call froze both talkers from p≈.3 onward because `establish` saturates at .3 and
    // poseHumanConversation/selectClip re-feeds mixer.setTime() that same frozen value every frame (QA r29
    // f008..f026: identical poses f008-f026). chatA/chatB now alternate speaking turns every CONV_PERIOD seconds of
    // real elapsed scene time `t` (independent of `establish`), each crossfading over CONV_BLEND seconds: the
    // speaker plays Interact, the listener plays Idle_Neutral with a small sinusoidal head nod, and bodies stay
    // locked to neutralBodyQuaternion so they keep facing each other throughout.
    const t=p*27.5;
    const convGate=segment(p,.16,.22); // fades the loop in as the talkers "arrive" at the conversation (was the old establish window's start)
    const aSpeak=speakWeightA(t),bSpeak=1-aSpeak;
    const waveWeight=segment(p,.33,.36)*(1-segment(p,.40,.43)); // r32: smooth in/out — was a hard weight snap to 1/0 at .33/.43
    const interactPhase=t/INTERACT_CYCLE,listenPhase=t/LISTEN_CYCLE;

    driveHumanAction(chatA,'Idle_Neutral',listenPhase,1);
    silenceHumanActions(chatA,['Idle_Neutral']);
    chatA.mixer.update(0);
    inspectReportPose(chatA,t,1);

    driveHumanAction(chatB,'Idle_Neutral',listenPhase+.17,1);
    silenceHumanActions(chatB,['Idle_Neutral']);
    chatB.mixer.update(0);
    inspectReportPose(chatB,t,-1);

    // MAN sits at the left desk and types
    walker.root.position.set(-3.28,-2.92,.22);
    walker.root.rotation.x=ISO_TILT;
    walker.root.rotation.y=-.2;
    walker.root.rotation.z=0;
    poseReaderSeated(walker,p);
    const typePulse=Math.sin(t*9.5)*.045;
    aimBoneLocal(walker,walker.leftArm.upper,new THREE.Vector3(.16+typePulse,-.62,.58));
    aimBoneLocal(walker,walker.rightArm.upper,new THREE.Vector3(-.18-typePulse,-.6,.6));
    aimBoneLocal(walker,walker.leftArm.fore,new THREE.Vector3(.14,-.2,.9));
    aimBoneLocal(walker,walker.rightArm.fore,new THREE.Vector3(-.12,-.16,.92));
    if(walker.head){walker.head.rotateX(.38+Math.sin(t*3.1)*.04);walker.head.rotateY(.18)}
    walkerShadow.position.set(-3.28,-3.12,-.05);

    const walkT=segment(p,.18,.80);
    const reachT=smoother(segment(p,.80,.86));
    const walkingX=lerp(-1.75,GOYA_WALK_END.x,walkT),baseY=lerp(-3.15,GOYA_WALK_END.y,walkT);
    const pass=(()=>{const t=(walkingX-.55)/1.55;return t*t>=1?0:.7*(1-t*t);})();
    const walkingY=baseY-pass;
    const touchX=walkingX,touchY=walkingY;
    const turnIn=segment(p,.5231,.5423),horizEase=smoother(horiz),descendEase=smoother(descend);
    hero.group.position.set(touchX,touchY,.45);
    heroShadow.position.set(touchX,touchY-.16,-.05);heroShadow.material.opacity=.22;
    hero.group.quaternion.copy(idleQuaternion).slerp(walkQuaternion,segment(p,.18,.24));
    hero.group.visible=false;

    if(USE_SPRITE_MASCOT&&mascotSprite){
      const strideWorld=1;
      const runPhase=((walkingX-(-1.75))/strideWorld%1+1)%1;
      const reaching=p>=.80;
      const spriteKey=reaching?'reach':'run'+(Math.floor(runPhase*6)%6+1);
      const spriteVisible=p>=.16&&p<.92;
      mascotSprite.visible=spriteVisible;
      if(spriteVisible){
        setSpriteCel(spriteKey,touchX,touchY-SPRITE_FLOOR_OFFSET,.45);
        spriteMaterial.opacity=1-smoother(segment(p,.86,.92));
      }
    }else if(mascotSprite){
      mascotSprite.visible=false;
    }
    const heroFadeIn=segment(p,.155,.175); // hero.group.visible must be true from .16 onward (r18) — a very quick fade-in, no more crossfade with a sprite
    for(const arm of [hero.leftArm,hero.rightArm]){arm.upper.rotation.set(0,0,0);arm.lower.rotation.set(0,0,0)}
    // r18: the walk-cycle phase is a function of DISTANCE travelled (not time), so the planted foot doesn't slide —
    // STRIDE_WORLD is the world distance one stance covers (see the constant's comment + foot-trace.mjs verification).
    const distanceTravelled=walkingX-(-1.75),walkPhase=distanceTravelled/STRIDE_WORLD;
    // slight forward lean while accelerating into the walk / leaning back while decelerating out of it — gated to the
    // walking window only, so it never perturbs the hero before p=.295 or after the turn begins at p=.575-.6.
    const leanWindow=segment(p,.2962,.3154)*(1-segment(p,.5115,.5308)); // r60: 원래 .295~.32 / .575~.6
    const accelNorm=Math.max(-1,Math.min(1,(6-12*travel)/6))*leanWindow;
    walkMascot(hero,walkPhase+align*.9,Math.max(align*.7,segment(p,.4923,.5308)*.6),accelNorm); // r60: 팔 정렬 창 원래 .55~.6
    if(hero.walkLeanAngle)hero.group.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),hero.walkLeanAngle));
    const typeBob=Math.sin(typing*Math.PI*10)*.012*typing;
    // r20: a small forward lean (horizEase*.04) eases in while moving to the seat spot (knees still straight), then
    // grows into the full seated lean (descendEase*.1) once the vertical descent begins.
    const bodyLean=descendEase*.1+horizEase*.04*(1-descendEase);
    // r60: 서 있을 때의 잔떨림이 사라지는 창 — 원래 .27~.31, 위 T 로 .2769~.3077
    hero.rig.rotation.x=-bodyLean-typeBob*1.5;hero.rig.position.y=lerp(0,-.57,descendEase)+typeBob+(1-segment(p,.2769,.3077))*Math.abs(Math.sin(p*60))*.02;hero.rig.rotation.y=(1-segment(p,.2769,.3077))*Math.sin(p*38)*.12;
    // r22: standing weight-shift sway — only while genuinely idle (before the walk-turn/settle motion begins), so it
    // never adds to hero.rig.rotation.z during the walk (foot-trace.mjs measured that axis coupling into stance-foot
    // world X through the walk yaw) or while seated. idleGate fades to 0 by p=.16, right as the hero starts moving.
    const idleGate=1-segment(p,.14,.16);
    hero.rig.rotation.z=idleWeightShift(p,0)*idleGate;
    // r22: gentle breathing — the case housing (rig's first child, see inspectPose's caseBox comment) scales on Y by
    // ~±1.5% at a slow period. Scaling only the housing mesh (not the whole rig, which also parents the legs/arms)
    // keeps the leg IK's own foot-planting math in poseMascotLeg completely unaffected.
    //
    // r43 QA fix (defect A — "의자 개입이 아직도 심함", owner evidence kbd38-078.png: the seated backrest still
    // passes through the case). The chair's cushion-front-edge (where the case is required to rest, per
    // getSeatTop()) sits a FIXED .525 root-local units in front of the backrest's own front face — fixed because
    // both scale off the same workDesk.chair.position.z, so CHAIR_BACK_DELTA moves cushion+case AND backrest back
    // together and never changes this gap (confirmed by measurement: overlapCaseChair stayed ~.29-.30 across
    // p=.74/.78/.82 regardless of CHAIR_BACK_DELTA). And the cushion depth leaves ~0 room to slide the mascot
    // further forward on it either (measured seatTarget already sits within .035 of the cushion's own front edge).
    // The case's own desk-local Z depth once seated (~.95 units, hero.rig.children[0]'s real footprint at this
    // near-180°+6° seat rotation — NOT a rotation-inflation artifact, verified the rotation stays axis-aligned
    // enough that AABB ≈ true extent) is simply bigger than that .525 gap. Since the isometric camera views this
    // seated case almost face-on, its Z (front-to-back) depth barely reads on screen at all (verified: full-frame
    // screenshots before/after this scale are visually indistinguishable — see QA_Evidence/tva-claude-20260909/
    // scene43-crops/), so squeezing that unseen depth down while SEATED (blended in by `sit`, so standing/walking
    // is completely unaffected) recovers clearance with no visible silhouette change. Iterated .55/.3/.2/.12 while
    // re-measuring overlapCaseChair each time (measure-desk-boxes-r27.mjs, now reporting chairBackBox/chairSeatBox/
    // overlapCaseChair — see inspectPose below): .12 is the first value that reaches overlapCaseChair=0 with a
    // >=.03 gap at p=.74/.78/.82 (gap .039-.052) while keeping overlapCaseDesk/overlapCaseMac at 0 and hand errors
    // well under .05 (arm IK targets the hand bones directly, independent of this housing-mesh-only scale).
    // r51: .12 -> .085. The seated case now has to fit inside a NARROWER corridor than r43's: it still has to
    // clear the chair backrest behind it (unchanged, the backrest moves with the chair), but CHAIR_BACK_DELTA
    // has also brought it up against the desk top in front, and SEAT_EXTRA_YAW=-11° inflates the case's own
    // desk-local z footprint (AABB depth ≈ 1.172*|sin yaw| + caseDepth*|cos yaw|, so the width term alone eats
    // .224 of it). Measured at .12 the corridor slack was only ~.04 total and overlapCaseChair came back
    // non-zero at p=.74/.82 (caseChairGapZ -.002/-.007). .085 buys back ~.06 of depth. This is still the same
    // invisible axis r43 established: at this near-face-on seat angle the case's front-to-back depth projects
    // to only a few pixels (the difference between .12 and .085 is ~4px of side sliver on a 1280-wide frame),
    // and it only applies while SEATED (blended by `sit`), so standing/walking is untouched.
    const housingMesh=hero.rig.children[0];if(housingMesh){housingMesh.scale.y=1+.015*Math.sin(p*24);housingMesh.scale.z=lerp(1,.085,sit);}
    const walkLeftHip=hero.leftLeg.upper.rotation.x,walkRightHip=hero.rightLeg.upper.rotation.x;
    const walkLeftKnee=hero.leftLeg.lower.rotation.x,walkRightKnee=hero.rightLeg.lower.rotation.x;
    const tuck=Math.max(sit,descendEase);hero.leftLeg.upper.rotation.x=lerp(walkLeftHip,-1.25,tuck);hero.rightLeg.upper.rotation.x=lerp(walkRightHip,-1.25,tuck);
    hero.leftLeg.lower.rotation.x=lerp(walkLeftKnee,1.5,tuck);hero.rightLeg.lower.rotation.x=lerp(walkRightKnee,1.5,tuck);
    hero.leftLeg.upper.rotation.z=-.08*sit;hero.rightLeg.upper.rotation.z=.08*sit;
    hero.leftLeg.lower.rotation.z=.1*sit;hero.rightLeg.lower.rotation.z=-.1*sit;
    for(const [arm,side] of [[hero.leftArm,-1],[hero.rightArm,1]]){
      const walkingArm=arm.upper.rotation.x;
      arm.upper.rotation.x=lerp(walkingArm,-.68,sit);arm.upper.rotation.z=lerp(side*.12,.72,sit);
      arm.lower.rotation.x=lerp(-.12,-.48,sit);arm.lower.rotation.z=lerp(0,-.58,sit)+Math.sin(typing*Math.PI*10+side)*.075*typing;
    }
    if(sit>0){
      hero.group.updateMatrixWorld(true);
      const down=new THREE.Vector3(0,-1,0);
      for(const [arm,target,index] of [[hero.leftArm,deskHandTargets[0],0],[hero.rightArm,deskHandTargets[1],1]]){
        const localTarget=hero.rig.worldToLocal(target.clone());
        localTarget.y+=Math.sin(typing*Math.PI*10+index*Math.PI)*.025*typing;
        const reach=localTarget.sub(arm.upper.position),distance=Math.min(.748,Math.max(.08,reach.length()));
        const direction=reach.clone().normalize(),along=(.38*.38-.37*.37+distance*distance)/(2*distance);
        const height=Math.sqrt(Math.max(0,.38*.38-along*along));
        // r28: the elbow's bend PLANE around the shoulder->target axis is a free
        // choice for a 2-bone IK — rotating it around that axis never moves the
        // hand off-target (height/along above already fix the triangle), it only
        // changes which way the elbow bows out. The old fixed (0,0,1)x direction
        // swing-plane happened to keep the elbow tucked in against the case from
        // this camera angle (feedback: "arms not visible at all" once seated).
        // Biasing the swing-plane toward a point out to the body's own side (and
        // a bit forward/up) makes the upper arm visibly bow out beside the case —
        // per side (leftArm=index0 sits on the -x side) — with zero cost to hand
        // accuracy, since it's the same free rotation, not a new reach distance.
        const sideSign=index===0?-1:1;
        // r34: index1 gets a slightly wider outward+back push (1.1/0.2 vs the original 0.9/0.1) than index0's
        // unchanged bias — a small nudge on top of the target/shoulder change above, keeping the elbow bowing
        // toward the body's own side rather than straight up now that the target sits higher (y=2.05).
        // r51: both hands now sit at desk height (y=1.44) instead of one being lifted to y=2.2, so the pole
        // hint no longer needs the big +Y ("elbow up") bias that used to keep the raised hand's elbow out of
        // the torso. A typing pose wants the elbows OUT to the sides and slightly BACK (rig-local -Z is
        // behind the mascot, toward the chair — verified: Ry(π+yaw) maps rig +Z to desk-local -z, i.e. toward
        // the monitor), which is also exactly the direction that pushes the elbow outside the case's
        // silhouette from this camera. Kept mild on -Z (-.35) so the elbow never reaches the backrest
        // (caseChairGapZ is only ~.05).
        const poleHint=new THREE.Vector3(sideSign*1.25,0.55,-0.35);
        let perpendicular=poleHint.sub(direction.clone().multiplyScalar(poleHint.dot(direction)));
        if(perpendicular.lengthSq()<1e-6)perpendicular=new THREE.Vector3(0,0,1).cross(direction);
        perpendicular.normalize().multiplyScalar(height);
        const elbowDirection=direction.clone().multiplyScalar(along).add(perpendicular).normalize();
        const upperTarget=new THREE.Quaternion().setFromUnitVectors(down,elbowDirection);
        arm.upper.quaternion.slerp(upperTarget,sit);
        const foreDirection=direction.multiplyScalar(distance).sub(elbowDirection.clone().multiplyScalar(.38)).normalize();
        const foreLocal=foreDirection.applyQuaternion(arm.upper.quaternion.clone().invert());
        const lowerTarget=new THREE.Quaternion().setFromUnitVectors(down,foreLocal);
        arm.lower.quaternion.slerp(lowerTarget,sit);
      }
    }

    // r43 QA fix: owner feedback "말풍선 위치 안 맞음" (balloons float away from their owners, e.g. the sofa reader's
    // balloon appearing far left near the window, and the beige-shirt woman's balloon sitting left of her head).
    // Root cause: only chatA.root got an explicit per-frame updateMatrixWorld() here — walker/reader/chatB.root
    // never did. getWorldPosition() below reads each object's cached .matrixWorld rather than recomputing it, so
    // for a standalone render(p) call (exactly what the QA/capture scripts do — one isolated frame, no prior
    // frame's renderer.render() autoUpdate to lean on) walker/reader/chatB's heads{} stayed frozen at their
    // one-time setup pose (line ~544, sampled at the idle bind pose before poseReaderSeatedV2/etc ever ran),
    // while the body meshes themselves still rendered in the correct animated pose (renderer.render()'s own
    // autoUpdate fixes the DRAWN geometry, just too late for this frame's already-computed balloon position).
    // Updating every owner's root here (not just chatA's) makes heads{} match the pose actually drawn this frame.
    for(const h of [walker,chatA,chatB])h.root.updateMatrixWorld(true);
    hero.group.updateMatrixWorld(true);
    const chatHead=chatA.head.getWorldPosition(new THREE.Vector3());
    // r18: plumbob/bubble head positions derive from the 3D hero again — no more sprite-head lerp
    const heroHead=hero.group.localToWorld(new THREE.Vector3(0,2.55,0));

    // Sims-style need bubbles: pop in, bob, pop out; each follows its owner's head. Every bubble (including the former
    // thoughtA/thoughtB cup+computer clouds) shares one cloud-only backdrop plus a small live 3D icon mesh in front of it.
    const heads={walker:walker.head.getWorldPosition(new THREE.Vector3()),chatA:chatHead,chatB:chatB.head.getWorldPosition(new THREE.Vector3()),hero:heroHead};
    for(const b of bubbles){
      const life=segment(p,b.start,b.start+.03)*(1-segment(p,b.end-.03,b.end));
      const pop=life<1&&p<b.start+.03?1+.25*Math.sin(Math.PI*segment(p,b.start,b.start+.03)):1;
      const visible=life>0.001;
      b.balloon.group.visible=visible;
      for(const m of b.balloon.materials)m.opacity=life;
      const h=heads[b.owner];const bob=Math.sin(p*95+b.start*40)*.05;
      // r23: headTopY is the actual measured top of the owner's head (not just the head-bone origin used for heads[]
      // above) — hero re-derives it every frame via localToWorld (hero.group rotates/translates through the timeline);
      // the humans' roots never rotate after setup, so a constant per-owner delta stays valid for them.
      const headTopY=b.owner==='hero'?hero.group.localToWorld(new THREE.Vector3(0,heroCaseTopLocalY,0)).y:h.y+HEAD_TOP_DELTA[b.owner];
      const bx=h.x+b.ox,by=headTopY+b.tailOffset+bob;
      b.balloon.group.position.set(bx,by,BALLOON_Z);b.balloon.group.scale.setScalar(Math.max(.001,life*pop));
      b.iconMesh.visible=visible;
      b.iconMesh.position.set(bx,by-b.balloon.height*.08,BALLOON_Z+b.iconZOffset); // fully in front of the balloon's front face, clear at its worst-case wobble/spin (see iconZOffset above)
      if(b.flatIcon){
        // gentle ±25° wobble around Y plus a slight tilt, so note/zzz/book keep facing the camera instead of spinning edge-on
        b.iconMesh.rotation.y=Math.sin(p*ICON_SPIN*.5)*(25*Math.PI/180);
        b.iconMesh.rotation.x=Math.sin(p*ICON_SPIN*.33)*.1;
      }else{
        b.iconMesh.rotation.y=p*ICON_SPIN;
      }
      b.iconMesh.scale.setScalar(Math.max(.001,b.iconScale*life*pop));
    }

    // plumbob: spins and bobs over the mascot, fades once the camera approaches the desk
    // r43 QA fix (defect C — owner: the gem sits too close to the head): the old anchor (a fixed rig-local point at
    // y=2.75, +.25 more) was tuned by eye against the STANDING idle pose and never re-checked against the case's
    // own actual top — it read as sitting almost on top of the case's lid in every capture (see the pre-fix
    // desk-078 crop in QA_Evidence/tva-claude-20260909/kbd38-crops/). Anchoring instead to heroCaseTopLocalY (the
    // same real, per-frame-measured top of the case housing already used for the hero's own speech-bubble anchor
    // just above) means this now tracks the case's TRUE top through every pose (walk/turn/sit all reuse the same
    // hero.group.localToWorld of one rig-local point, so no separate per-phase tuning is needed), instead of a
    // standing-pose guess. PLUMBOB_HALF_HEIGHT is the octahedron's own half-height (makePlumbob: base radius .26,
    // Y-scaled 1.7 -> half-height .26*1.7=.442) so the requested ".35 above the case top" is measured to the
    // gem's BOTTOM TIP, not its center — position.y is the center, so it needs the half-height added back on top
    // of the .35 gap. Bob animation (+-.06) kept unchanged.
    hero.group.updateMatrixWorld(true);
    const caseTopWorld=hero.group.localToWorld(new THREE.Vector3(0,heroCaseTopLocalY,0));
    const PLUMBOB_HALF_HEIGHT=.26*1.7;
    const PLUMBOB_GAP=.35; // bottom tip sits this far above the case top
    plumbob.position.set(caseTopWorld.x,caseTopWorld.y+PLUMBOB_GAP+PLUMBOB_HALF_HEIGHT+Math.sin(p*70)*.06,1.1);plumbob.rotation.y=p*40;plumbob.material.opacity=0;plumbob.visible=false;
    // wave hello before setting off (moved earlier, r18: .20-.25) then a "thought of the computer" bubble at .255-.30
    // gives a visible reason before the walk starts at .30 (right arm up, small oscillation)
    const wave=segment(p,.20,.2125)*(1-segment(p,.2375,.25));
    hero.rightArm.upper.rotation.z+=wave*2.6;hero.rightArm.lower.rotation.z+=wave*(.5+Math.sin(p*260)*.45);
    // the mascot types the farewell on the desk screen, then the screen becomes the real HOME picture
    // r60: 타이핑 창 끝과 같이 앞당김 — 원래 p<.84 였다(typing 창이 .74~.84 이던 시절의 짝).
    if(workDesk.screenMat.map!==workDesk.homeScreenTexture){workDesk.screenMat.map=workDesk.homeScreenTexture;workDesk.screenMat.needsUpdate=true}
    // a cat crosses the rug from the bookshelf side to the sofa side, pausing once to look around. r56: the
    // cat is present for the WHOLE room phase (p>=.16), not just the module's own .32-.62 walk window — it
    // sits at CAT_START (facing the camera) before the walk starts, and sits at CAT_END (facing the camera)
    // after the walk ends, with a short eased blend at each boundary so the handoff to/from the module's own
    // updateCat() output has no position/heading jump (see .319 vs .321 in the QA scrub).
    let catState;
    if(p<.16){
      cat.root.visible=false;catState={x:CAT_START.x,y:CAT_START.y,visible:false};
    }else if(p<CAT_WAKE_END){
      // sitting at the rug's edge from the first room frame, tail swaying; the camera-facing sit yaw eases
      // down into the module's own pre-walk heading across .32-.34 (module's own output for p<=.34 is
      // position=CAT_START, heading=catBaseHeading exactly — travel is still 0 there — so at p=.34 this
      // lines up exactly with what updateCat() itself would already be drawing).
      const wake=smooth(segment(p,CAT_WAKE_START,CAT_WAKE_END));
      cat.root.position.set(CAT_START.x,CAT_START.y,.25);
      cat.root.rotation.y=lerp(catSitHeading,catBaseHeading,wake);
      cat.root.visible=true;
      cat.walk(p*14,0);
      catState={x:CAT_START.x,y:CAT_START.y,visible:true};
    }else if(p<CAT_SETTLE_START){
      catState=updateCat(THREE,cat,p,{lerp,segment,smooth});
      // r58: the walker now stops at (.55,-2.28), which sits on the cat's straight (3.0,-2.45)->(-2.3,-2.0)
      // line — the cat used to walk straight through the walker's feet (p~.55). Bow the path toward the
      // camera around the walker's x (bell of half-width .55, depth .5) so the cat trots in front of the
      // walker's feet. The bell is zero at the cat's pause spot (x~1.09) and at both path ends, so the
      // pause pose, the arrival pose and the mascot crossing (which happens while the cat is paused) are
      // unchanged.
      const catDetour=(()=>{const t=(catState.x-.55)/.7;return t*t>=1?0:.5*(1-t*t);})();
      cat.root.position.y-=catDetour;catState={...catState,y:catState.y-catDetour};
    }else{
      // module freezes the cat at CAT_END from .60 and hides it at .62; instead keep it visible, easing the
      // yaw from the arrival heading into the camera-facing sit pose and the legs from the (now frozen) walk
      // pose into the continuous tail-sway idle, so it reads as "sat down to watch", not a frozen mid-stride
      // pose or a hard cut. Stays like this until the dive fades/zooms past the room.
      updateCat(THREE,cat,Math.min(p,CAT_SETTLE_START),{lerp,segment,smooth}); // pins position/base heading at the arrival pose
      const settle=smooth(segment(p,CAT_SETTLE_START,CAT_SETTLE_END));
      cat.root.rotation.y=lerp(catBaseHeading,catSitHeading,settle);
      cat.walk(p*14,1-settle);
      cat.root.visible=true;
      catState={x:CAT_END.x,y:CAT_END.y,visible:true};
    }
    catShadow.position.set(catState.x,catState.y-.12,-.05);catShadow.material.opacity=.16*(catState.visible?1:0);
    const syncShadow=(actor,actorShadow)=>{
      actor.root.updateMatrixWorld(true);
      const left=actor.leftLeg.shoe.getWorldPosition(new THREE.Vector3()),right=actor.rightLeg.shoe.getWorldPosition(new THREE.Vector3());
      actorShadow.position.set((left.x+right.x)/2,Math.min(left.y,right.y)-.035,-.05);
    };
    syncShadow(chatA,chatAShadow);syncShadow(chatB,chatBShadow);syncShadow(walker,walkerShadow);
    const actionCenter=portrait?lerp(-.7,walkingX,segment(p,.2769,.6077)):0; // r60: 캐릭터를 따라가는 세로화면 중심이동 — 원래 .27~.7
    // r57: `flatten` no longer starts at a hardcoded .90 — it starts at `flattenStart`, the MEASURED p at
    // which the monitor window's projected outline finally covers the whole viewport (solveDive() above).
    // Before that the portal is pinned to the window exactly, because the bezel is still on screen.
    // `diveFinalScale` is likewise solved per viewport so that moment always arrives by p≈.93.
    const dive=smoother(segment(p,DIVE_START,FLATTEN_END)),flatten=smoother(segment(p,flattenStart,FLATTEN_END));const finalScale=diveFinalScale;const focusScale=Math.exp(Math.log(finalScale)*dive);const portalTravel=flatten;
    const diveCenter=diveCenterAt(p,actionCenter);
    const pull=1-smoother(segment(p,.145,.29));const tvX=(1105/1536-.5)*15,tvY=(.5-372/1024)*10;const scale=lerp(focusScale,4.4,pull),cx=lerp(diveCenter.x,tvX,pull),cy=lerp(diveCenter.y,tvY,pull);
    const {vwHalf,vhHalf,ccx,ccy}=frustumFor(scale,cx,cy);camera.position.set(0,0,10);camera.quaternion.identity();
    camera.left=ccx-vwHalf;camera.right=ccx+vwHalf;
    camera.top=ccy+vhHalf;camera.bottom=ccy-vhHalf;camera.updateProjectionMatrix();
    backdrop.scale.setScalar(1);
    homePortal.visible=false;
    portalBacking.visible=false;
    portalMaterial.opacity=0;
    portalBackingMaterial.opacity=0;
    // r60: 타이핑에 따라 책상 화면이 밝아지는 창 — 원래 .74~.84, typing 창과 같이 앞당겼다.
    const light=lerp(.72,1,segment(p,.6385,.7154));workDesk.screenMat.color.setRGB(light,light,light);
    const heroFade=segment(p,.905,.935);
    const heroOpacity=heroFadeIn*(1-heroFade);
    for(const surface of Object.values(hero.materials)){surface.transparent=true;surface.opacity=0;surface.depthWrite=false}
    hero.group.visible=false;
    renderer.render(scene,camera);
  };
  const resize=(width,height)=>{
    const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height)),aspect=w/h;renderer.setSize(w,h,false);
    portrait=aspect<.8;homeNarrow=w<=980&&aspect<=1.25;baseHeight=aspect>=1.5?15/aspect:10;baseWidth=aspect>=1.5?15:10*aspect;
    solveDive(); // r57: the bezel-coverage gate is viewport-dependent, so re-solve it before the first frame
    render(0);
  };
  const dispose=()=>{
    for(const human of [walker,chatA,chatB]){
      human.root.removeFromParent();
      disposeHuman(human);
    }
    disposeTree(scene);
    [roomTexture,sourceMascot,homeTexture,face,...workDesk.textures,typed.texture].forEach(texture=>texture.dispose());
    renderer.dispose();renderer.forceContextLoss?.();
  };
  const inspectPose=()=>{
    hero.group.updateMatrixWorld(true);workDesk.root.updateMatrixWorld(true);
    const point=object=>object.getWorldPosition(new THREE.Vector3()).toArray();
    const hands=[point(hero.leftArm.hand),point(hero.rightArm.hand)];
    return{
      shoulders:[point(hero.leftArm.upper),point(hero.rightArm.upper)],
      elbows:[point(hero.leftArm.lower),point(hero.rightArm.lower)],
      hands,
      deskHandTargets:deskHandTargets.map(target=>target.toArray()),
      handErrors:hands.map((hand,index)=>new THREE.Vector3(...hand).distanceTo(deskHandTargets[index])),
      seat:{group:hero.group.position.toArray(),chairCenter:workDesk.root.localToWorld(new THREE.Vector3(.05,.7,1.22)).toArray(),caseBottom:hero.group.localToWorld(new THREE.Vector3(0,-.11,0)).toArray(),chairSeatTop:workDesk.getSeatTop().toArray(),chairBack:workDesk.getChairBack().toArray()},
      heroFeet:[point(hero.leftLeg.shoe),point(hero.rightLeg.shoe)],
      heroTop:hero.group.localToWorld(new THREE.Vector3(0,2.75,0)).toArray(),
      heroGroupPos:hero.group.position.toArray(),
      chatQuaternions:[chatA.root.quaternion.toArray(),chatB.root.quaternion.toArray()],
      // r43 QA aid: expose each balloon's current world position/visibility so an external script can check it
      // against its owner's head position (defect B: balloons floating away from their owner) without re-deriving
      // the per-frame bx/by math above.
      bubbles:bubbles.map(b=>({owner:b.owner,icon:b.icon,pos:b.balloon.group.position.toArray(),visible:b.balloon.group.visible})),
      // r43 QA aid (defect C): expose the plumbob's own current world position/visibility so an external script can
      // check its gap above the case top without re-deriving the per-frame math above.
      plumbob:{pos:plumbob.position.toArray(),visible:plumbob.visible,opacity:plumbob.material.opacity},
      // r28 QA aid: expose the orthographic camera's current frustum so an
      // external script can map world-space debug points (shoulders/hands/
      // case box) to canvas pixel coordinates without re-deriving the
      // render()-internal cx/cy/scale math. Read-only, no effect on visuals.
      cameraFrustum:{left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom},
      canvasSize:{width:canvas.width,height:canvas.height},
      // r57 QA aid: the solved bezel-coverage gate for the CURRENT viewport, plus a live coverage readout
      // for the frame just rendered (>=0 means the monitor window covers the viewport, i.e. no bezel on
      // screen, so the flatten is allowed to run). Read-only.
      diveGate:{...diveGate,liveCoverage:(()=>{
        let worst=Infinity;
        for(const vx of[camera.left,camera.right])for(const vy of[camera.bottom,camera.top])worst=Math.min(worst,windowInsetAt(vx,vy));
        return worst*wScaleMin/(camera.right-camera.left);
      })()},
      boxes:(()=>{
        // Re-express every box in the desk's OWN (unrotated) local frame — the whole scene sits under an
        // isometric tilt (ISO_TILT + a -45° yaw on workDesk.root) so comparing world-space AABBs of two
        // differently-rotated objects grossly overstates any real intersection (a rotated box's world AABB is
        // already larger than the box itself). Instead, transform each mesh's own tight LOCAL geometry box
        // straight into the desk's local frame in one step (local -> world -> desk-local collapses to one
        // combined matrix), which stays tight because it never round-trips through an intermediate world AABB.
        const deskWorldInv=new THREE.Matrix4().copy(workDesk.root.matrixWorld).invert();
        const localBoxOf=(mesh,targetInv)=>{
          mesh.geometry.computeBoundingBox();
          const combined=new THREE.Matrix4().multiplyMatrices(targetInv,mesh.matrixWorld);
          return mesh.geometry.boundingBox.clone().applyMatrix4(combined);
        };
        const groupBoxOf=(root,targetInv)=>{
          const out=new THREE.Box3();
          root.traverse(o=>{if(o.isMesh)out.union(localBoxOf(o,targetInv))});
          return out;
        };
        const caseBox=groupBoxOf(hero.rig.children[0],deskWorldInv); // housing mesh (+ its outline shell child) — first child added to rig in createMascot()
        const deskTopBox=groupBoxOf(workDesk.deskTopMesh,deskWorldInv);
        const macBox=groupBoxOf(workDesk.macCaseMesh,deskWorldInv);
        const thighBox=(()=>{const out=new THREE.Box3();out.union(groupBoxOf(hero.leftLeg.upper,deskWorldInv));out.union(groupBoxOf(hero.rightLeg.upper,deskWorldInv));return out})();
        // r43 QA fix (defect A — "의자 개입이 아직도 심함", the seated backrest still passing through the case):
        // workDesk.chair is exposed but its individual meshes (cushion/backrest/base) are not named handles — only
        // ending-props-r15.js knows the child order, and that file is owned by another worker editing it live right
        // now, so this picks the backrest/cushion out of workDesk.chair's own children by POSITION (highest and
        // 2nd-highest chair-local Y among its meshes) instead of a fragile index, so it keeps working even if that
        // file's mesh-add order changes underneath us: the backrest (chair-local y≈.98) is comfortably the tallest
        // part of the chair, the seat cushion (y≈.5) the next tallest — everything else (gas-lift cylinder, base
        // spokes/casters) sits below y≈.42.
        const chairMeshesByHeight=(()=>{const list=[];workDesk.chair.traverse(o=>{if(o.isMesh)list.push(o)});list.sort((a,b)=>b.position.y-a.position.y);return list})();
        const chairBackMesh=chairMeshesByHeight[0],chairSeatMesh=chairMeshesByHeight[1];
        const chairBackBox=chairBackMesh?groupBoxOf(chairBackMesh,deskWorldInv):new THREE.Box3();
        // seat box with its top .02 trimmed off (per the owner's ask) so the case legitimately RESTING on the
        // cushion doesn't register as an "overlap" — only real interpenetration below the cushion's surface does.
        const chairSeatBoxFull=chairSeatMesh?groupBoxOf(chairSeatMesh,deskWorldInv):new THREE.Box3();
        const chairSeatBox=chairSeatBoxFull.clone();chairSeatBox.max.y=Math.max(chairSeatBox.min.y,chairSeatBox.max.y-.02);
        const overlapVolume=(a,b)=>{
          const ox=Math.max(0,Math.min(a.max.x,b.max.x)-Math.max(a.min.x,b.min.x));
          const oy=Math.max(0,Math.min(a.max.y,b.max.y)-Math.max(a.min.y,b.min.y));
          const oz=Math.max(0,Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z));
          return ox*oy*oz;
        };
        const toObj=b=>({min:b.min.toArray(),max:b.max.toArray()});
        return{
          caseBox:toObj(caseBox),deskTopBox:toObj(deskTopBox),macBox:toObj(macBox),thighBox:toObj(thighBox),
          chairBackBox:toObj(chairBackBox),chairSeatBox:toObj(chairSeatBox),
          overlapCaseDesk:overlapVolume(caseBox,deskTopBox),
          overlapCaseMac:overlapVolume(caseBox,macBox),
          overlapCaseChair:overlapVolume(caseBox,chairBackBox)+overlapVolume(caseBox,chairSeatBox),
          overlapThighDesk:overlapVolume(thighBox,deskTopBox),
          // desk-local z gap between the case's back (max.z, after the seated 180°-Y flip the case's BACK faces
          // +z, toward the chair) and the chair backrest's front (min.z) — positive means clear, and the owner
          // asked for this to be >= .03.
          caseChairGapZ:chairBackBox.min.z-caseBox.max.z,
          // desk-local z: larger z = toward the chair/front of the desk, smaller z = toward the monitor/back.
          // The case's own z-min (its screen-facing front, after the seated 180°-Y flip) must stay >= the desk
          // top's z-min (the desk's back edge) by a margin, and the case's z-max (its back) should clear the
          // desk top's z-max (front edge) — i.e. the case should sit fully forward of (past) the desk top.
          caseZMinVsDeskZMin:caseBox.min.z-deskTopBox.min.z,
          caseZMinVsDeskZMax:caseBox.min.z-deskTopBox.max.z,
          deskTopMinY:deskTopBox.min.y,deskTopMaxY:deskTopBox.max.y,
          caseMinY:caseBox.min.y,caseMaxY:caseBox.max.y,
          // thigh clearance: how far the top of the thigh sits below the desk top's underside (positive = clear)
          thighClearance:deskTopBox.min.y-thighBox.max.y,
        };
      })(),
    };
  };
  const rect=canvas.getBoundingClientRect();resize(rect.width||canvas.width||1,rect.height||canvas.height||1);render(0);return{render,resize,dispose,inspectPose};
}
