import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "./node_modules/three/build/three.module.js";
import {neutralizeRealisticFoxHead} from "./neutral-head-v19.js";
import {REALISTIC_MOUNT_YAW} from "./fox-axis-v18.js";

const raw=fs.readFileSync(new URL("./assets/Fox_Realistic_Rigged.glb",import.meta.url));
const jl=raw.readUInt32LE(12);
const gltf=JSON.parse(raw.subarray(20,20+jl).toString());
const base=28+jl;
const primitive=gltf.meshes[0].primitives[0];
const format={5126:Float32Array,5121:Uint8Array,5123:Uint16Array,5125:Uint32Array};
const components={VEC2:2,VEC3:3,VEC4:4,SCALAR:1};
function read(id){
 const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView];
 const type=format[a.componentType],n=components[a.type];
 const offset=base+(v.byteOffset||0)+(a.byteOffset||0),len=a.count*n*type.BYTES_PER_ELEMENT;
 return new type(raw.buffer.slice(raw.byteOffset+offset,raw.byteOffset+offset+len));
}
const source=gltf.skins[0].joints.map(id=>gltf.nodes[id].name);
const input=new THREE.BufferGeometry();
for(const [src,name] of [["POSITION","position"],["NORMAL","normal"],["JOINTS_0","skinIndex"],["WEIGHTS_0","skinWeight"],["TEXCOORD_0","uv"]]){
 const id=primitive.attributes[src],a=gltf.accessors[id];
 input.setAttribute(name,new THREE.BufferAttribute(read(id),components[a.type]));
}
const orig=input.attributes.position.array.slice();
const mesh={geometry:input,skeleton:{bones:source.map(name=>({name}))}};
const beforeUV=input.attributes.uv.array.slice();
const result=neutralizeRealisticFoxHead(mesh);
const after=mesh.geometry.attributes.position.array;
const normal=mesh.geometry.attributes.normal.array;
let moved=0,unchangedBody=0,maxHeadDelta=0,nonfinite=0,badNormals=0;
for(let i=0;i<orig.length;i+=3){
 const d=Math.hypot(after[i]-orig[i],after[i+1]-orig[i+1],after[i+2]-orig[i+2]);
 if(d>1e-4)moved++;
 if(orig[i+2]<.1){assert.ok(d<1e-6,"Tail/torso geometry was unexpectedly changed");unchangedBody++}
 if(orig[i+2]>.40&&orig[i+1]>.40)maxHeadDelta=Math.max(maxHeadDelta,d);
 const len=Math.hypot(normal[i],normal[i+1],normal[i+2]);
 if(!Number.isFinite(after[i])||!Number.isFinite(after[i+1])||!Number.isFinite(after[i+2]))nonfinite++;
 if(!Number.isFinite(len)||Math.abs(len-1)>.02)badNormals++;
}
assert.ok(result.correctedVertices>50000&&result.correctedVertices<140000,"unexpected affected head geometry");
assert.ok(moved>50000&&unchangedBody>20000,"head-only correction failed");
assert.ok(maxHeadDelta>.08&&maxHeadDelta<.3,"head deformation exceeds expected bounds");
assert.equal(nonfinite,0);
assert.equal(badNormals,0);
assert.deepEqual(mesh.geometry.attributes.uv.array,beforeUV,"texture coordinates must not move");
assert.ok(Math.abs(REALISTIC_MOUNT_YAW-Math.PI/2)<1e-9);
const scene=fs.readFileSync(new URL("./scene.js",import.meta.url),"utf8");
assert.ok(scene.indexOf("neutralizeRealisticFoxHead(realisticSkin)")<scene.indexOf("buildMicroFur(realisticSkin,36000"),"fur must be built on corrected mesh");
assert.ok(!scene.includes("REALISTIC_NEUTRAL_HEAD_YAW"),"legacy permanent joint twist must not return");
assert.ok(scene.includes("fox.orientation=headingTo(fox.pos,camera.position)"),"initial orientation must face viewer");
assert.ok(!scene.includes("setFocusMode(true);\n   setFaceCamera(true);"),"camera-follow must remain opt-in");
console.log(JSON.stringify({status:"PASS",vertexCount:after.length/3,geometryCorrected:result.correctedVertices,verticesMoved:moved,unchangedTailBody:unchangedBody,maxHeadDelta:+maxHeadDelta.toFixed(4),nonfinite,badNormals,headNeutralMethod:"baked-skin-mesh"}));
