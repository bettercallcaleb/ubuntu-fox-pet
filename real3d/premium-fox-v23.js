import * as THREE from "./node_modules/three/build/three.module.js";

const tokens=name=>String(name||"").toLowerCase().replace(/([a-z])([A-Z])/g,"$1 $2").replace(/([a-z])([0-9])/g,"$1 $2").replace(/[^a-z0-9]+/g," ").trim();
const patterns={
 walk:/\bwalk\b|\bwalking\b/,
 idle:/\bidle\b|\brest\b|\bsurvey\b|\blook around\b/,
 run:/\brun\b|\btrot\b|\bgallop\b/,
 sit:/\bsit\b|\bsitting\b/,
 sleep:/\bsleep\b|\blie\b|\blying\b/,
 eat:/\beat\b|\bfeeding\b|\bdrink\b/,
 play:/\bplay\b|\btail wag\b|\bscratch\b/,
 jump:/\bjump\b|\bleap\b/,
 turn:/\bturn\b|\bpivot\b/
};
const negatives={
 walk:/\bback\b|\bbackward\b|\bside\b|\bleft\b|\bright\b|\bcrouch\b|\brun\b|\btrot\b/,
 idle:/\bhit\b|\bdeath\b|\bdie\b/,
 sit:/\bend\b|\bexit\b|\bstart\b/,
 sleep:/\bend\b|\bexit\b|\bstart\b/,
 eat:/\bend\b|\bexit\b|\bstart\b/,
 jump:/\bfly\b|\bfall\b|\bland\b|\bend\b/
};
const prefer=name=>{
 const raw=String(name||"");
 const normalized=tokens(raw);
 let score=0;
 if(/\bip\b|in[ -]?place/i.test(raw))score+=10;
 if(/\brm\b|root[ -]?motion/i.test(raw))score-=10;
 if(/\bforward\b|\bfront\b/.test(normalized))score+=3;
 if(/\bloop\b|\bcycle\b/.test(normalized))score+=3;
 if(/\bstart\b|\bend\b|\btransition\b/.test(normalized))score-=5;
 if(/\bwalk\b/.test(normalized)&&normalized==="walk")score+=5;
 if(/\bidle\b/.test(normalized)&&normalized==="idle")score+=5;
 return score;
};

export function mapPremiumAnimations(clips){
 const result={};
 for(const [kind,regex] of Object.entries(patterns)){
  const candidates=(clips||[]).filter(c=>regex.test(tokens(c.name)));
  candidates.sort((a,b)=>{
   const score=c=>prefer(c.name)-(negatives[kind]?.test(tokens(c.name))?15:0);
   return score(b)-score(a);
  });
  if(candidates.length)result[kind]=candidates[0].name;
 }
 return result;
}

export function premiumForwardYaw(axis="+Z"){
 const angles={"+X":0,"-X":Math.PI,"+Z":Math.PI/2,"-Z":-Math.PI/2};
 if(!(axis in angles))throw Error("Unsupported forward axis: "+axis);
 return angles[axis];
}

export function rootCandidates(model){
 const names=new Set();
 model.traverse(object=>{
  if(object.isBone){
   if(!object.parent?.isBone)names.add(object.name);
  }else if((object.isGroup||object.isObject3D)&&object.parent===model)names.add(object.name);
 });
 return names;
}

export function anchorRootTranslation(clip,roots){
 const result=clip.clone();
 let tracks=0;
 for(const track of result.tracks){
  if(!track.name.endsWith(".position"))continue;
  const name=track.name.slice(0,-".position".length);
  if(!roots.has(name)||track.getValueSize()!==3)continue;
  const arr=track.values;
  if(arr.length<6)continue;
  const startX=arr[0],startZ=arr[2];
  let excursion=0;
  for(let i=0;i<arr.length;i+=3)excursion=Math.max(excursion,Math.hypot(arr[i]-startX,arr[i+2]-startZ));
  if(excursion<.025)continue;
  for(let i=0;i<arr.length;i+=3){arr[i]=startX;arr[i+2]=startZ}
  tracks++;
 }
 return{clip:result,anchoredTracks:tracks};
}

export function analyzePremiumModel(model,clips){
 let bones=0,skins=0,vertices=0,triangles=0;
 model.traverse(object=>{
  if(object.isBone)bones++;
  if(object.isSkinnedMesh){skins++;bones=Math.max(bones,object.skeleton.bones.length)}
  if(object.isMesh){
   const a=object.geometry.getAttribute("position");
   vertices+=a?.count||0;
   const indices=object.geometry.index?.count??a?.count??0;
   triangles+=indices/3;
  }
 });
 const semantic=mapPremiumAnimations(clips);
 const errors=[];
 if(!skins||bones<12)errors.push("Requires an articulated skinned model with at least 12 joints");
 if(!semantic.walk)errors.push("Missing walk animation");
 if(!semantic.idle)errors.push("Missing idle animation");
 return{ok:errors.length===0,errors,bones,skins,vertices,triangles:Math.round(triangles),clipCount:clips.length,semantic};
}

export function createPremiumFoxController(model,clips,{walkCycleDistance=.65}={}){
 const diagnosis=analyzePremiumModel(model,clips);
 if(!diagnosis.ok)throw Error(diagnosis.errors.join("; "));
 const roots=rootCandidates(model);
 const mixer=new THREE.AnimationMixer(model);
 const actions=new Map();
 let anchored=0;
 for(const clip of clips){
  const {clip:safe,anchoredTracks}=anchorRootTranslation(clip,roots);
  anchored+=anchoredTracks;
  const action=mixer.clipAction(safe);
  action.enabled=true;
  action.setLoop(THREE.LoopRepeat,Infinity);
  actions.set(clip.name,action);
 }
 let activeName=null,activeKind=null,transitions=0;
 const resolve=kind=>diagnosis.semantic[kind]||diagnosis.semantic.idle;
 function switchTo(kind){
  const name=resolve(kind);
  if(name===activeName)return;
  const next=actions.get(name);
  if(!next)return;
  const previous=activeName?actions.get(activeName):null;
  next.reset().setEffectiveWeight(1).play();
  next.setEffectiveTimeScale(1);
  if(previous&&previous!==next)previous.crossFadeTo(next,kind==="walk"?.24:.32,true);
  else next.fadeIn(.25);
  activeName=name;activeKind=kind;transitions++;
 }
 function update(dt,{walking=false,stepping=false,action="idle",speed=.6}={}){
  const kind=walking?"walk":stepping&&diagnosis.semantic.turn?"turn":
   action==="sleep"?"sleep":
   action==="desk"||action==="window"?"sit":
   action==="food"?"eat":
   action==="jump"?"jump":
   action==="pet"||action==="play"?"play":"idle";
  switchTo(kind);
  if(kind==="walk"){
   const clip=actions.get(activeName)?.getClip();
   const speedRatio=speed*Math.max(.05,clip?.duration||1)/Math.max(.1,walkCycleDistance);
   actions.get(activeName)?.setEffectiveTimeScale(THREE.MathUtils.clamp(speedRatio,.55,1.8));
  }
  mixer.update(Math.min(.07,Math.max(0,dt)));
 }
 function dispose(){mixer.stopAllAction();mixer.uncacheRoot(model);actions.clear()}
 return{update,switchTo,dispose,mixer,diagnostics:()=>({...diagnosis,activeName,activeKind,transitions,anchoredRootTracks:anchored})};
}
