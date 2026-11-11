import * as THREE from "./node_modules/three/build/three.module.js";
import {groundHeight} from "./navigation-v13.js";
import {createLivingFoxMotion} from "./living-motion-v14.js";

const UP=new THREE.Vector3(0,1,0);
const gaitQuat=new THREE.Quaternion();
const v1=new THREE.Vector3(),v2=new THREE.Vector3(),v3=new THREE.Vector3();
const side=new THREE.Vector3(),forward=new THREE.Vector3();
const worldParent=new THREE.Quaternion(),localAxis=new THREE.Vector3();
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const damp=(x,y,k,dt)=>THREE.MathUtils.damp(x,y,k,dt);
const ease=x=>x*x*(3-2*x);

function contactTexture(){
 const c=document.createElement("canvas");
 c.width=c.height=96;
 const ctx=c.getContext("2d");
 const g=ctx.createRadialGradient(48,48,0,48,48,47);
 g.addColorStop(0,"rgba(21,14,15,.49)");
 g.addColorStop(.45,"rgba(27,19,17,.24)");
 g.addColorStop(1,"rgba(27,19,17,0)");
 ctx.fillStyle=g;ctx.fillRect(0,0,96,96);
 return new THREE.CanvasTexture(c);
}
export function createGroundedGait({scene,fox,foxRoot,rigged}){
 const texture=contactTexture();
 const shadowGeo=new THREE.PlaneGeometry(.43,.28);
 const legs=[];
 let initialized=false,bodyY=0,amplitude=0,bodyBreathe=0;
 const living=createLivingFoxMotion({fox,rigged});
 let meanError=0,maxError=0,plantedCount=0;
 const initialFootNames=["L0","R0","L1","R1"];

 function worldPoint(bone,out=new THREE.Vector3()){
  return bone.getWorldPosition(out);
 }
 function rotateAroundWorld(bone,axis,angle){
  bone.parent.getWorldQuaternion(worldParent);
  localAxis.copy(axis).applyQuaternion(worldParent.invert()).normalize();
  gaitQuat.setFromAxisAngle(localAxis,angle);
  bone.quaternion.premultiply(gaitQuat).normalize();
  bone.updateWorldMatrix(false,true);
 }
 function correctJoint(joint,tip,target,ax,weight=1){
  worldPoint(joint,v1);worldPoint(tip,v2);
  v2.sub(v1);v3.copy(target).sub(v1);
  v2.addScaledVector(ax,-v2.dot(ax));
  v3.addScaledVector(ax,-v3.dot(ax));
  if(v2.lengthSq()<1e-7||v3.lengthSq()<1e-7)return;
  v2.normalize();v3.normalize();
  const cross=new THREE.Vector3().crossVectors(v2,v3);
  const delta=Math.atan2(ax.dot(cross),clamp(v2.dot(v3),-1,1));
  rotateAroundWorld(joint,ax,clamp(delta*weight,-.14,.14));
  const limit=joint.name.startsWith("thigh")?.38:joint.name.startsWith("shin")?.32:.10;
  const rest=rigged.boneRest.get(joint.name);
  const off=joint.quaternion.angleTo(rest);
  if(off>limit)joint.quaternion.slerp(rest,1-limit/off);
  joint.updateWorldMatrix(false,true);
 }
 function initialize(){
  if(!rigged.bones?.size)return false;
  if(initialized)return true;
  foxRoot.updateMatrixWorld(true);
  for(const [i,name] of initialFootNames.entries()){
   const thigh=rigged.bones.get("thigh"+name);
   const shin=rigged.bones.get("shin"+name);
   const foot=rigged.bones.get("foot"+name);
   const toe=rigged.bones.get("toe"+name);
   if(!thigh||!shin||!foot||!toe)return false;
   const at=worldPoint(toe).clone();
   const home=foxRoot.worldToLocal(at.clone());
   const target=at.clone();
   target.y=groundHeight(at.x,at.z)+.02;
   const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:.85,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
   const shadow=new THREE.Mesh(shadowGeo,material);
   shadow.rotation.x=-Math.PI/2;
   shadow.renderOrder=5;
   scene.add(shadow);
   legs.push({name,thigh,shin,foot,toe,home,target,plant:target.clone(),from:target.clone(),to:target.clone(),shadow,swing:false,swingAt:0,swingDuration:.27,lastCycle:-1,phaseOffset:i===0||i===3?0:.5,error:0});
  }
  initialized=true;
  return true;
 }
 function legHome(leg,rootPos,rot){
  const h=leg.home;
  const c=Math.cos(rot),s=Math.sin(rot);
  return new THREE.Vector3(rootPos.x+c*h.x+s*h.z,0,rootPos.z-s*h.x+c*h.z);
 }
 function resetLegRotations(leg){
  for(const bone of [leg.thigh,leg.shin,leg.foot,leg.toe]){
   bone.quaternion.copy(rigged.boneRest.get(bone.name));
  }
 }
 function update(dt,t){
  if(rigged.variant!=="realistic"||!rigged.enabled||!rigged.ready||!initialize())return;
  amplitude=damp(amplitude,fox.isWalking?1:0,5.7,dt);
  const tired=fox.action==="sleep"&&!fox.target;
  const activeAction=fox.action==="play"||fox.action==="pet"||fox.action==="food";
  const seconds=Math.max(0,performance.now()/1000-fox.actionTime);
  if((fox.action==="pet"||fox.action==="food"||fox.action==="play")&&seconds>2.6)fox.action="idle";
  const bob=amplitude*(.016*Math.sin(fox.phase*Math.PI*4))+(1-amplitude)*.008*Math.sin(t*3.1);
  bodyBreathe=damp(bodyBreathe,tired?-.075:0,3.5,dt);
  const targetBody=groundHeight(fox.pos.x,fox.pos.z)-.015+bob+bodyBreathe;
  bodyY=damp(bodyY,targetBody,11,dt);
  foxRoot.position.y=bodyY;
  forward.set(Math.cos(fox.orientation),0,-Math.sin(fox.orientation));
  side.set(Math.sin(fox.orientation),0,Math.cos(fox.orientation));
  foxRoot.updateMatrixWorld(true);
  plantedCount=0;meanError=0;maxError=0;

  for(const leg of legs){
   resetLegRotations(leg);
   const home=legHome(leg,foxRoot.position,fox.orientation);
   const g=groundHeight(home.x,home.z)+.02;
   const phase=fox.phase+leg.phaseOffset;
   const cycle=Math.floor(phase);
   const fraction=phase-cycle;
   const wantStep=fox.isWalking&&fraction>=.57&&leg.lastCycle!==cycle;
   const distance=Math.hypot(home.x-leg.plant.x,home.z-leg.plant.z);
   const settle=!fox.isWalking&&!leg.swing&&distance>.11&&leg.lastCycle!==Math.floor(t*2)+10000;
   if((wantStep&&distance>.075)||settle){
    leg.swing=true;
    leg.swingAt=t;
    leg.swingDuration=settle?.31:.245;
    leg.lastCycle=settle?Math.floor(t*2)+10000:cycle;
    leg.from.copy(leg.target);
    leg.to.set(home.x+forward.x*(fox.isWalking?.11:0),g,home.z+forward.z*(fox.isWalking?.11:0));
   }
   if(leg.swing){
    const alpha=clamp((t-leg.swingAt)/leg.swingDuration,0,1);
    const k=ease(alpha);
    leg.target.lerpVectors(leg.from,leg.to,k);
    leg.target.y=groundHeight(leg.target.x,leg.target.z)+.02+.075*Math.sin(Math.PI*alpha);
    if(alpha>=1){
     leg.swing=false;
     leg.target.copy(leg.to);
     leg.plant.copy(leg.to);
    }
   }else{
    if(fox.isWalking&&distance>.125){
     const k=(distance-.125)/distance;
     leg.plant.x+=(home.x-leg.plant.x)*k;
     leg.plant.z+=(home.z-leg.plant.z)*k;
    }
    leg.target.copy(leg.plant);
    leg.target.y=groundHeight(leg.target.x,leg.target.z)+.02;
    plantedCount++;
   }

   leg.thigh.updateWorldMatrix(true,true);
   for(let pass=0;pass<3;pass++){
    correctJoint(leg.shin,leg.toe,leg.target,side);
    correctJoint(leg.thigh,leg.toe,leg.target,side);
   }
   const actual=worldPoint(leg.toe);
   leg.error=actual.distanceTo(leg.target);
   meanError+=leg.error;
   maxError=Math.max(maxError,leg.error);

   leg.shadow.position.set(actual.x,groundHeight(actual.x,actual.z)+.003,actual.z);
   leg.shadow.material.opacity=leg.swing?.22:.72;
   leg.shadow.scale.setScalar(leg.swing?.68:1);
  }
  meanError/=legs.length;

  living.update(dt,t,amplitude);
 }
 const setVisible=visible=>{for(const l of legs)l.shadow.visible=Boolean(visible)};
 const diagnostics=()=>({ready:initialized,amplitude,bodyY,contactErrorMean:meanError,contactErrorMax:maxError,plantedCount,secondaryMotion:living.diagnostics(),legs:legs.map(l=>({name:l.name,swing:l.swing,error:l.error,toe:l.toe.getWorldPosition(new THREE.Vector3()).toArray(),goal:l.target.toArray()}))});
 const dispose=()=>{for(const l of legs){scene.remove(l.shadow);l.shadow.material.dispose()}shadowGeo.dispose();texture.dispose()};
 return {update,diagnostics,dispose,setVisible};
}
