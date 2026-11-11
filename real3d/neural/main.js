import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {SparkRenderer,SplatMesh} from "@sparkjsdev/spark";

const $=id=>document.getElementById(id);
const savedViews={
 living:{position:[-2.6349136829,2.6399999738,-1.5312048197],target:[-1.4458299683,2.0446564022,.0765160944]},
 dining:{position:[-.6,2.3,1.8],target:[.6,2.3,3.4]},
 fireplace:{position:[-.6,2.08,1.8],target:[-2.6,2.08,-1.5]},
 fox:{position:[-2.45,1.65,-.75],target:[-.42,1.26,.32]},
 stairs:{position:[4.1454,2.64,5.6185],target:[3.8349,2.3,4.4594]}
};
const scene=new THREE.Scene();
scene.background=new THREE.Color("#11171a");
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.018,130);
camera.position.fromArray(savedViews.living.position);
const aim=new THREE.Vector3(...savedViews.living.target);
camera.lookAt(aim);
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance",alpha:false});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.0));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.13;
renderer.setClearColor("#11171a",1);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.insertBefore(renderer.domElement,document.body.firstChild);

scene.add(new THREE.HemisphereLight("#ffffff","#69717d",2.1));
const mainLight=new THREE.DirectionalLight("#ffe9d1",2.5);
mainLight.position.set(-2,8,3);
mainLight.castShadow=true;
mainLight.shadow.mapSize.set(1024,1024);
mainLight.shadow.camera.left=-5;
mainLight.shadow.camera.right=5;
mainLight.shadow.camera.top=5;
mainLight.shadow.camera.bottom=-5;
scene.add(mainLight);

const spark=new SparkRenderer({renderer});
scene.add(spark);
let neuralWorld=null;
let worldReady=false;
let modelReady=false;
let fox=null;
let mixer=null;
let actions={};
let currentClip=null;
let progress=0;
let foxVisible=true;
let autowalk=true;
let qualityMode="auto";
let movementSpeed=.68;
const fpsWindow=[];
let renderTime=0;
const movement=new THREE.Vector3();
let moving=false;
let destination=null;
const worldFloor=.84;
const foxSpot=new THREE.Vector3(-.42,worldFloor,.32);

function tell(message){
 $("notice").textContent=message;
 $("notice").style.opacity=1;
 clearTimeout(tell.timeout);
 tell.timeout=setTimeout(()=>$("notice").style.opacity=0,2600);
}
function onWorldReady(){
 worldReady=true;
 $("loadingTitle").textContent="Scene decoded";
 $("loadingFill").style.width="100%";
 $("loader").style.opacity="0";
 setTimeout(()=>$("loader").style.display="none",650);
 console.log("SPARK_WORLD_READY",neuralWorld?.numSplats);
}
function onWorldError(err){
 console.error("SPARK_WORLD_ERROR",err);
 $("loadingTitle").textContent="Neural scene failed";
 $("loadingSubtitle").textContent=String(err);
}
try{
 neuralWorld=new SplatMesh({
  url:"./assets/maison-provence.sog",
  onLoad:onWorldReady,
  onProgress:event=>{
   const fraction=event.lengthComputable ? event.loaded/event.total : Math.min(.75,event.loaded/(143*1024*1024));
   progress=Math.max(progress,fraction);
   $("loadingFill").style.width=Math.round(progress*87)+"%";
   $("loadingSubtitle").textContent="Downloading / decoding: "+Math.round(progress*100)+"%";
  }
 });
 neuralWorld.name="maison-provence-licensed-scan";
 neuralWorld.rotation.z=Math.PI;
 scene.add(neuralWorld);
}catch(e){onWorldError(e)}

const modelRoot=new THREE.Group();
modelRoot.position.copy(foxSpot);
modelRoot.rotation.y=Math.PI*.15;
scene.add(modelRoot);
const materialContact=new THREE.MeshBasicMaterial({color:"#12100e",transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide});
const contact=new THREE.Mesh(new THREE.CircleGeometry(.47,32),materialContact);
contact.rotation.x=-Math.PI/2;contact.position.y=.02;contact.scale.y=.73;
modelRoot.add(contact);

new GLTFLoader().load("../assets/Fox_Enhanced.glb",gltf=>{
 const model=gltf.scene;
 model.updateMatrixWorld(true);
 const bb=new THREE.Box3().setFromObject(model),size=bb.getSize(new THREE.Vector3());
 const factor=1.0/Math.max(.1,size.y);
 model.scale.setScalar(factor);
 model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model);
 const center=bounds.getCenter(new THREE.Vector3());
 model.position.set(-center.x,-bounds.min.y,-center.z);
 modelRoot.add(model);
 model.traverse(obj=>{
  if(obj.isMesh){
   obj.castShadow=true;
   obj.receiveShadow=true;
  }
 });
 fox=model;
 mixer=new THREE.AnimationMixer(model);
 for(const clip of gltf.animations)actions[clip.name]=mixer.clipAction(clip);
 modelReady=true;
 play("Look around");
},undefined,err=>{console.error("FOX_MODEL_FAILED",err);tell("Fox model failed to load")});

function play(name){
 if(currentClip===name||!actions[name])return;
 const next=actions[name];
 next.reset().setEffectiveTimeScale(name==="Walk"?1.0:1).setEffectiveWeight(1).fadeIn(.2).play();
 if(currentClip&&actions[currentClip])actions[currentClip].crossFadeTo(next,.25,true);
 currentClip=name;
}
function moveFox(dt,time){
 if(!modelReady)return;
 if(destination){
  const delta=destination.clone().sub(modelRoot.position);
  delta.y=0;
  if(delta.length()<.06){destination=null;moving=false;play("Look around")}
  else{
   moving=true;
   delta.normalize();
   modelRoot.position.addScaledVector(delta,dt*movementSpeed);
   const heading=Math.atan2(delta.x,delta.z);
   const direction=heading-Math.PI/2;
   let r=THREE.MathUtils.euclideanModulo(direction-modelRoot.rotation.y+Math.PI,Math.PI*2)-Math.PI;
   modelRoot.rotation.y+=THREE.MathUtils.clamp(r,-dt*3.2,dt*3.2);
   play("Walk");
  }
 }else if(autowalk&&time-lastWander>9){
  lastWander=time;
  const goals=[[-.42,0,.32],[-.05,0,.9],[-.55,0,1.5],[-1.0,0,.60]];
  const pick=goals[Math.floor(Math.random()*goals.length)];
  destination=new THREE.Vector3(pick[0],worldFloor,pick[2]);
 }
 if(mixer)mixer.update(dt);
}
let lastWander=0;
const eyeDirection=new THREE.Vector3();
const forward=new THREE.Vector3();
const right=new THREE.Vector3();
const keys=new Set();
const pickRay=new THREE.Raycaster();
const invisibleFloor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));
invisibleFloor.rotation.x=-Math.PI/2;
invisibleFloor.position.y=worldFloor;
scene.add(invisibleFloor);

let pointerDown=null;
renderer.domElement.addEventListener("pointerdown",event=>{
 pointerDown={x:event.clientX,y:event.clientY,button:event.button,moved:false};
 renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener("pointermove",e=>{
 if(!pointerDown)return;
 const dx=e.clientX-pointerDown.x,dy=e.clientY-pointerDown.y;
 pointerDown.x=e.clientX;pointerDown.y=e.clientY;
 if(Math.abs(dx)+Math.abs(dy)>0)pointerDown.moved=true;
 if(pointerDown.moved){
  eyeDirection.subVectors(aim,camera.position);
  const distance=eyeDirection.length();
  const spherical=new THREE.Spherical().setFromVector3(new THREE.Vector3().subVectors(camera.position,aim));
  spherical.theta-=dx*.005;spherical.phi=THREE.MathUtils.clamp(spherical.phi-dy*.004,.1,Math.PI-.15);
  camera.position.copy(aim).add(new THREE.Vector3().setFromSpherical(spherical));
  camera.lookAt(aim);
 }
});
renderer.domElement.addEventListener("pointerup",e=>{
 if(pointerDown&&!pointerDown.moved&&e.button===0&&modelReady){
  const ndc=new THREE.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);
  pickRay.setFromCamera(ndc,camera);
  const hits=pickRay.intersectObject(invisibleFloor);
  if(hits.length){
   const p=hits[0].point;
   if(Math.abs(p.x)<5 && Math.abs(p.z)<7){destination=new THREE.Vector3(p.x,worldFloor,p.z);autowalk=false;$("wanderButton").classList.remove("active");tell("Fox walking to target")}
  }
 }
 pointerDown=null;
});
renderer.domElement.addEventListener("wheel",e=>{
 e.preventDefault();
 camera.position.addScaledVector(new THREE.Vector3().subVectors(camera.position,aim).normalize(),THREE.MathUtils.clamp(e.deltaY,-100,100)*.011);
 camera.lookAt(aim);
},{passive:false});
window.addEventListener("keydown",event=>{
 if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.code))event.preventDefault();
 keys.add(event.code);
 if(/[Digit][1-4]/.test(event.code))setView(Object.keys(savedViews)[Number(event.code.slice(-1))-1]);
});
window.addEventListener("keyup",event=>keys.delete(event.code));
function setView(name){
 const view=savedViews[name];
 if(!view)return;
 camera.position.fromArray(view.position);
 aim.fromArray(view.target);
 camera.lookAt(aim);
 document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
}
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>setView(button.dataset.view)));
$("foxButton").addEventListener("click",()=>{
 foxVisible=!foxVisible;
 modelRoot.visible=foxVisible;
 $("foxButton").classList.toggle("active",foxVisible);
 $("foxButton").textContent="Fox · "+(foxVisible?"on":"off");
});
$("wanderButton").addEventListener("click",()=>{autowalk=!autowalk;$("wanderButton").classList.toggle("active",autowalk)});
$("resetButton").addEventListener("click",()=>setView("living"));
$("originalButton").addEventListener("click",()=>{window.location.href="../";});
$("qualityButton").addEventListener("click",()=>{
 qualityMode=qualityMode==="auto"?"performance":qualityMode==="performance"?"cinema":"auto";
 const ratio=qualityMode==="performance"?.75:qualityMode==="cinema"?1.35:1.0;
 renderer.setPixelRatio(Math.min(devicePixelRatio,ratio));
 $("qualityButton").textContent="Quality: "+qualityMode;
});
window.addEventListener("resize",()=>{
 camera.aspect=innerWidth/innerHeight;
 camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
});
const clock=new THREE.Clock();
let t=0,frameCount=0,fpsTime=0;
function updateCamera(dt){
 eyeDirection.copy(aim).sub(camera.position).setY(0).normalize();
 forward.copy(eyeDirection);
 right.set(-forward.z,0,forward.x);
 const speed=(keys.has("ShiftLeft")?3.5:1.5)*dt;
 movement.set(0,0,0);
 if(keys.has("KeyW")||keys.has("ArrowUp"))movement.add(forward);
 if(keys.has("KeyS")||keys.has("ArrowDown"))movement.sub(forward);
 if(keys.has("KeyD")||keys.has("ArrowRight"))movement.add(right);
 if(keys.has("KeyA")||keys.has("ArrowLeft"))movement.sub(right);
 if(movement.lengthSq()>0){
  movement.normalize().multiplyScalar(speed);
  aim.add(movement);camera.position.add(movement);
 }
}
function frame(){
 requestAnimationFrame(frame);
 const dt=Math.min(clock.getDelta(),.08);
 t+=dt;
 updateCamera(dt);
 moveFox(dt,t);
 renderer.render(scene,camera);
 frameCount++;fpsTime+=dt;
 if(fpsTime>=.8){
  const fps=Math.round(frameCount/fpsTime);
  frameCount=0;fpsTime=0;
  const gl=renderer.getContext();
  const gpu=gl.getExtension("WEBGL_debug_renderer_info");
  const gpuName=gpu?gl.getParameter(gpu.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  $("performance").innerHTML="<strong>"+fps+" FPS</strong><br>"+(worldReady?"NEURAL WORLD READY":"LOADING NEURAL SCENE")+"<br>"+(neuralWorld?.numSplats?.toLocaleString()||"—")+" Gaussian splats<br>"+(modelReady?"29-bone skinned fox":"Loading fox…")+"<br>"+gpuName;
 }
}
frame();
window.__neuralFox={scene,renderer,camera,spark,foxRoot:modelRoot,get worldReady(){return worldReady},get foxReady(){return modelReady},get numSplats(){return neuralWorld?.numSplats||0},get state(){return{foxPosition:modelRoot.position.toArray(),fps:frameCount/fpsTime||0}},setView,play};
