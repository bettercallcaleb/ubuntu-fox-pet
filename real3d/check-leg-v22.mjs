import assert from "node:assert/strict";
import * as THREE from "three";
import {solveTwoBone} from "./fox-rig-v15.js";

const hip=new THREE.Vector3(0,.68,0),bendFront=new THREE.Vector3(-1,0,0),bendHind=new THREE.Vector3(1,0,0);
let tests=0;
for(const limit of [160,170,173]){
 for(const direction of [bendFront,bendHind]){
  for(const x of [-.28,-.14,0,.14,.28]){
   for(const targetY of [.09,.16,.24,.35]){
    const target=new THREE.Vector3(x,targetY,0),knee=new THREE.Vector3(),ankle=new THREE.Vector3();
    solveTwoBone(hip,.23,.28,target,direction,knee,ankle,limit*Math.PI/180);
    const a=hip.clone().sub(knee).normalize(),b=ankle.clone().sub(knee).normalize();
    const angle=Math.acos(THREE.MathUtils.clamp(a.dot(b),-1,1))*180/Math.PI;
    assert.ok(Number.isFinite(angle));
    assert.ok(angle<=limit+.0002,`Joint overextended to ${angle} > ${limit}`);
    assert.ok(hip.distanceTo(knee)<.23002);
    assert.ok(knee.distanceTo(ankle)<.28002);
    tests++;
   }
  }
 }
}
const rest=new THREE.Vector3();
solveTwoBone(hip,.23,.28,new THREE.Vector3(.1,.18,0),bendFront,new THREE.Vector3(),rest);
assert.ok(Number.isFinite(rest.x));
console.log(JSON.stringify({status:"PASS",cases:tests,limits:[160,170,173]}));
