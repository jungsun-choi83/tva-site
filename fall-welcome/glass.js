import * as THREE from '../vendor/three.module.js';
import { sampleShard } from './fracture.mjs';

export function createGlassFragments(mount, cells) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
  catch { return { draw() {}, dispose() {} }; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  mount.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 6000);
  let sourceTexture = null;
  let sourceCanvas = null;
  const faceMaterial = new THREE.ShaderMaterial({
    uniforms:{
      source:{value:null},
      resolution:{value:new THREE.Vector2(1,1)},
      sourceReady:{value:0},
      faceOpacity:{value:.115},
      pieceOpacity:{value:1},
    },
    vertexShader:`
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = viewPosition.xyz;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader:`
      uniform sampler2D source;
      uniform vec2 resolution;
      uniform float sourceReady;
      uniform float faceOpacity;
      uniform float pieceOpacity;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      void main() {
        if (sourceReady < .5) discard;
        vec2 screenUv = gl_FragCoord.xy / resolution;
        vec3 viewDirection = normalize(-vViewPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vViewNormal), viewDirection)), 5.0);
        vec2 offset = vViewNormal.xy * mix(.003, .011, fresnel);
        vec3 refracted;
        refracted.r = texture2D(source, screenUv + offset * 1.12).r;
        refracted.g = texture2D(source, screenUv + offset).g;
        refracted.b = texture2D(source, screenUv + offset * .82).b;
        float luminance = dot(refracted, vec3(.2126, .7152, .0722));
        float backgroundClarity = mix(.62, 1.0, smoothstep(.08, .72, luminance));
        float glint = smoothstep(.92, .995, fresnel);
        vec3 specular = vec3(1.0, .995, .97) * glint;
        float alpha = faceOpacity * backgroundClarity * pieceOpacity + glint * .09;
        gl_FragColor = vec4(refracted + specular * .78, alpha);
      }
    `,
    transparent:true,
    depthWrite:false,
    side:THREE.DoubleSide,
  });
  const sideMaterial = new THREE.MeshBasicMaterial({
    color:0xe5f1ed,
    transparent:true,
    opacity:.085,
    side:THREE.DoubleSide,
    depthWrite:false,
  });
  const edgeMaterial = new THREE.ShaderMaterial({
    uniforms:{
      source:{value:null},
      resolution:{value:new THREE.Vector2(1,1)},
      sourceReady:{value:0},
      rimOpacity:{value:.3},
      pieceOpacity:{value:1},
    },
    vertexShader:`
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader:`
      uniform sampler2D source;
      uniform vec2 resolution;
      uniform float sourceReady;
      uniform float rimOpacity;
      uniform float pieceOpacity;
      void main() {
        if (sourceReady < .5) discard;
        vec3 background = texture2D(source, gl_FragCoord.xy / resolution).rgb;
        float luminance = dot(background, vec3(.2126, .7152, .0722));
        vec3 lightRim = vec3(1.0, .995, .95);
        vec3 darkRim = vec3(.075, .16, .17);
        vec3 rim = mix(lightRim, darkRim, smoothstep(.5, .72, luminance));
        gl_FragColor = vec4(rim, rimOpacity * pieceOpacity);
      }
    `,
    transparent:true,
    depthWrite:false,
    side:THREE.DoubleSide,
  });
  const pieces=cells.map(cell=>{
    const shape=new THREE.Shape();
    cell.polygon.forEach((point,index)=>{
      const x=point.x-cell.centroid.x,y=cell.centroid.y-point.y;
      if(index===0)shape.moveTo(x,y);else shape.lineTo(x,y);
    });shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:2.6,bevelEnabled:true,bevelSegments:1,bevelSize:.18,bevelThickness:.14,steps:1});
    const mesh=new THREE.Mesh(geometry,[faceMaterial,sideMaterial]);
    const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,28),edgeMaterial);
    mesh.userData.areaRatio=cell.area/(1000*625);
    mesh.onBeforeRender=(_renderer,_scene,_camera,_geometry,material)=>{
      if(material!==faceMaterial)return;
      faceMaterial.uniforms.pieceOpacity.value=mesh.userData.faceOpacity??1;
      faceMaterial.uniformsNeedUpdate=true;
    };
    edge.onBeforeRender=()=>{
      edgeMaterial.uniforms.pieceOpacity.value=mesh.userData.edgeOpacity??1;
      edgeMaterial.uniformsNeedUpdate=true;
    };
    edge.renderOrder=3;
    mesh.add(edge);
    mesh.renderOrder=2;
    scene.add(mesh);return{mesh,edge,cell};
  });
  let width=0,height=0;
  function draw({progress,pane,opacity=1,backgroundCanvas=null}) {
    const visible=progress>.001&&progress<1&&opacity>0;
    mount.style.opacity=visible?String(opacity):'0';
    if(!visible)return;
    if(width!==innerWidth||height!==innerHeight){
      width=innerWidth;height=innerHeight;renderer.setPixelRatio(Math.min(devicePixelRatio||1,width<760?1:1.35));renderer.setSize(width,height,false);
      camera.aspect=width/height;camera.position.z=height/(2*Math.tan(THREE.MathUtils.degToRad(20)));camera.updateProjectionMatrix();
      faceMaterial.uniforms.resolution.value.set(renderer.domElement.width,renderer.domElement.height);
      edgeMaterial.uniforms.resolution.value.set(renderer.domElement.width,renderer.domElement.height);
    }
    if(backgroundCanvas&&backgroundCanvas!==sourceCanvas){
      sourceTexture?.dispose();
      sourceCanvas=backgroundCanvas;
      sourceTexture=new THREE.CanvasTexture(backgroundCanvas);
      sourceTexture.colorSpace=THREE.SRGBColorSpace;
      sourceTexture.minFilter=THREE.LinearFilter;
      sourceTexture.magFilter=THREE.LinearFilter;
      sourceTexture.generateMipmaps=false;
      faceMaterial.uniforms.source.value=sourceTexture;
      edgeMaterial.uniforms.source.value=sourceTexture;
    }
    if(sourceTexture){
      sourceTexture.needsUpdate=true;
      faceMaterial.uniforms.sourceReady.value=1;
      edgeMaterial.uniforms.sourceReady.value=1;
    }else{
      faceMaterial.uniforms.sourceReady.value=0;
      edgeMaterial.uniforms.sourceReady.value=0;
    }
    const sx=pane.width/1000,sy=pane.height/625;
    pieces.forEach(({mesh,cell},index)=>{
      const motion=sampleShard(cell,progress);
      const released=Math.max(0,Math.min(1,progress));
      const spread=.88+.12*released;
      const large=Math.max(0,Math.min(1,(mesh.userData.areaRatio-.012)/.035));
      const forward=Math.max(0,Math.min(1,motion.z/280));
      mesh.userData.faceOpacity=Math.max(.45,1-large*.32-forward*.2);
      mesh.userData.edgeOpacity=Math.max(.52,.92-large*.24-forward*.16);
      mesh.position.set(
        pane.left-width/2+(cell.centroid.x+motion.x*spread)*sx,
        height/2-pane.top-(cell.centroid.y+motion.y*spread)*sy,
        Math.min(camera.position.z*.62,motion.z*.52),
      );
      mesh.scale.set(sx,sy,Math.max(.8,(sx+sy)*.5));
      const axis=motion.rotationAxis;
      mesh.quaternion.setFromAxisAngle(new THREE.Vector3(axis.x,axis.y,axis.z).normalize(),motion.rotation);
      mesh.rotateZ(motion.rotation*.16*(index%2?1:-1));
    });
    renderer.render(scene,camera);
  }
  return {draw,dispose(){pieces.forEach(({mesh})=>mesh.traverse(object=>object.geometry?.dispose()));sourceTexture?.dispose();faceMaterial.dispose();sideMaterial.dispose();edgeMaterial.dispose();renderer.dispose();renderer.domElement.remove();}};
}
