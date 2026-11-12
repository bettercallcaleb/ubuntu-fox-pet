import assert from "node:assert/strict";
import * as THREE from "./node_modules/three/build/three.module.js";
import {createLivingFoxMotion} from "./living-motion-v14.js";

const names=["hips","spine0","spine1","chest","neck","head","earL","earR","tail0","tail1","tail2","tail3"];
const bones=new Map(names.map(name=>[name,new THREE.Bone()]));
const boneRest=new Map([...bones].map(([name,bone])=>[name,bone.quaternion.clone()]));
const fox={phase:0,action:"idle",target:null,orientation:0};
const rigged={ready:true,enabled:true,variant:"realistic",bones,boneRest};
const motion=createLivingFoxMotion({fox,rigged});
const extrema={head:0,neck:0,tail:0,chest:0};
const states=new Set();
for(let tick=1;tick<=1000;tick++){
 const t=tick/60;
 if(tick===390)fox.action="play";
 if(tick===525){fox.action="idle";fox.orientation=.45;}
 if(tick===610){fox.action="food";}
 if(tick===720)fox.action="sleep";
 if(tick===835){fox.action="idle";fox.phase+=.025;}
 if(tick===880)fox.action="desk";
 if(tick===940)fox.action="jump";
 const locomotion=tick>=520&&tick<610?1:0;
 if(locomotion)fox.phase+=.026;
 motion.update(1/60,t,locomotion);
 const info=motion.diagnostics();
 states.add(info.state);
 for(const [name,bone] of bones){
  assert.ok(bone.quaternion.toArray().every(Number.isFinite),name+" quaternion diverged");
  assert.ok(Math.abs(bone.quaternion.lengthSq()-1)<.0001,name+" quaternion invalid");
  assert.ok(bone.quaternion.angleTo(boneRest.get(name))<1,name+" bone exceeded realistic bound");
 }
 for(const kind of Object.keys(extrema)){
  const bone=bones.get(kind==="tail"?"tail3":kind);
  extrema[kind]=Math.max(extrema[kind],bone.quaternion.angleTo(boneRest.get(kind==="tail"?"tail3":kind)));
 }
}
for(const state of ["idle","walk","play","sniff","sleep","sit","jump"])assert.ok(states.has(state),"missing "+state);
assert.ok(extrema.head>.12,"head still looks static");
assert.ok(extrema.tail>.09,"tail still looks static");
assert.ok(extrema.chest>.007,"breathing torso appears frozen");
console.log(JSON.stringify({status:"PASS",states:[...states],peakBoneMotionRadians:extrema,frames:1000}));
