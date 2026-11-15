import assert from "node:assert/strict";
import * as THREE from "three";
import {mapPremiumAnimations,premiumForwardYaw,anchorRootTranslation,analyzePremiumModel,createPremiumFoxController} from "./premium-fox-v23.js";

const motions=[
 {name:"Walk_RM",duration:1},
 {name:"Walk_Forward_IP",duration:1.1},
 {name:"Idle_01",duration:3},
 {name:"Sit_Start",duration:1},
 {name:"Sit_Idle",duration:3},
 {name:"Sleep_Loop",duration:4},
 {name:"Eat_Loop",duration:2},
 {name:"Jump_Loop",duration:1}
];
const semantic=mapPremiumAnimations(motions);
assert.equal(semantic.walk,"Walk_Forward_IP");
assert.equal(semantic.idle,"Idle_01");
assert.equal(semantic.sit,"Sit_Idle");
assert.equal(semantic.sleep,"Sleep_Loop");
assert.equal(semantic.eat,"Eat_Loop");
for(const axis of ["+X","-X","+Z","-Z"])assert.ok(Number.isFinite(premiumForwardYaw(axis)));
assert.throws(()=>premiumForwardYaw("+Y"));
const clip=new THREE.AnimationClip("Walk_RM",1,[
 new THREE.VectorKeyframeTrack("Root.position",[0,.5,1],[0,1,0,.5,1.1,.4,1,1.2,.6]),
 new THREE.QuaternionKeyframeTrack("Root.quaternion",[0,1],[0,0,0,1,0,.1,0,.995])
]);
const result=anchorRootTranslation(clip,new Set(["Root"]));
assert.equal(result.anchoredTracks,1);
assert.deepEqual([...result.clip.tracks[0].values].map(v=>Math.round(v*100)/100),[0,1,0,0,1.1,0,0,1.2,0]);
assert.equal(clip.tracks[0].values[3],.5);
const skeleton=new THREE.Bone();skeleton.name="Root";
const shin=new THREE.Bone();shin.name="Shin";skeleton.add(shin);
const model=new THREE.Group();model.add(skeleton);
const geometry=new THREE.BufferGeometry();
geometry.setAttribute("position",new THREE.Float32BufferAttribute([0,0,0,0,1,0,1,0,0],3));
geometry.setAttribute("skinIndex",new THREE.Uint16BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0],4));
geometry.setAttribute("skinWeight",new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());
model.add(mesh);mesh.bind(new THREE.Skeleton([skeleton,shin]));
const diagnosis=analyzePremiumModel(model,[clip]);
assert.ok(!diagnosis.ok);
assert.ok(diagnosis.errors.some(x=>x.includes("idle")));
console.log(JSON.stringify({status:"PASS",semantic,rootMotionTracks:result.anchoredTracks,bones:diagnosis.bones,validatedFailure:diagnosis.errors}));
