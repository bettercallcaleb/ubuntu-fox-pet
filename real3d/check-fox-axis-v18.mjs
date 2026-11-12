import assert from "node:assert/strict";
import fs from "node:fs";
import {REALISTIC_MOUNT_YAW,REALISTIC_NEUTRAL_HEAD_YAW} from "./fox-axis-v18.js";
import {FOUR_WAY} from "./fox-facing-v16.js";
const raw=fs.readFileSync(new URL("./assets/Fox_Realistic_Rigged.glb",import.meta.url));
const length=raw.readUInt32LE(12),gltf=JSON.parse(raw.subarray(20,20+length).toString());
const binStart=28+length;
const skin=gltf.skins[0],acc=gltf.accessors[skin.inverseBindMatrices],view=gltf.bufferViews[acc.bufferView];
const off=binStart+(view.byteOffset||0)+(acc.byteOffset||0);
const ibm=new Float32Array(raw.buffer.slice(raw.byteOffset+off,raw.byteOffset+off+acc.count*16*4));
const bones=Object.fromEntries(skin.joints.map((id,k)=>{
 const m=ibm.subarray(k*16,k*16+16);
 const t=[m[12],m[13],m[14]];
 return[gltf.nodes[id].name,[-(m[0]*t[0]+m[1]*t[1]+m[2]*t[2]),-(m[4]*t[0]+m[5]*t[1]+m[6]*t[2]),-(m[8]*t[0]+m[9]*t[1]+m[10]*t[2])]];
}));
const body={x:bones.head[0]-bones.hips[0],z:bones.head[2]-bones.hips[2]};
const length2d=Math.hypot(body.x,body.z);
assert.ok(body.z>.2&&Math.abs(body.x)<.06,"Realistic GLB must have local +Z as its anatomical forward");
assert.ok(Math.abs(REALISTIC_MOUNT_YAW-Math.PI/2)<1e-9,"Fox model must be rotated +90 degrees into the runtime's +X forward");
const results=[];
for(const {name,heading} of FOUR_WAY){
 const mountX=Math.cos(REALISTIC_MOUNT_YAW)*body.x+Math.sin(REALISTIC_MOUNT_YAW)*body.z;
 const mountZ=-Math.sin(REALISTIC_MOUNT_YAW)*body.x+Math.cos(REALISTIC_MOUNT_YAW)*body.z;
 const worldX=Math.cos(heading)*mountX+Math.sin(heading)*mountZ;
 const worldZ=-Math.sin(heading)*mountX+Math.cos(heading)*mountZ;
 const aligned=(worldX*Math.cos(heading)-worldZ*Math.sin(heading))/length2d;
 assert.ok(aligned>.995,"Anatomical fox forward disagrees with gait: "+name+" "+aligned);
 results.push({name,dot:+aligned.toFixed(6)});
}
assert.ok(bones.toeL0[2]>bones.toeL1[2]&&bones.toeR0[2]>bones.toeR1[2],"Both front paws must be ahead of both rear paws");
assert.ok(bones.toeL0[0]>bones.toeR0[0],"Glb left and right leg labels reversed");
assert.ok(REALISTIC_NEUTRAL_HEAD_YAW.neck>=.25&&REALISTIC_NEUTRAL_HEAD_YAW.neck<=.5);
assert.ok(REALISTIC_NEUTRAL_HEAD_YAW.head>=.25&&REALISTIC_NEUTRAL_HEAD_YAW.head<=.5);
const code=fs.readFileSync(new URL("./scene.js",import.meta.url),"utf8");
assert.ok(code.includes("rigged.holder.rotation.y=REALISTIC_MOUNT_YAW"),"Runtime must use measured anatomical forward mount");
assert.ok(code.includes("Object.entries(REALISTIC_NEUTRAL_HEAD_YAW)"),"Runtime neutral head correction is disconnected");
console.log(JSON.stringify({status:"PASS",glbModelForward:"+Z",runtimeForward:"+X",axisMountDegrees:90,headNeutralDegrees:Math.round((REALISTIC_NEUTRAL_HEAD_YAW.head+REALISTIC_NEUTRAL_HEAD_YAW.neck)*180/Math.PI),directions:results}));
