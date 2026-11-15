import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import {neutralizeRealisticFoxHead} from "./neutral-head-v19.js";
import {stabilizeHeadSkinning} from "./head-weights-v20.js";
import {refineRealisticFoxHead} from "./refine-head-v25.js";

const raw=fs.readFileSync(new URL("./assets/Fox_Realistic_Rigged.glb",import.meta.url));
const jsonLen=raw.readUInt32LE(12),json=JSON.parse(raw.subarray(20,20+jsonLen).toString()),base=28+jsonLen;
const attrs=json.meshes[0].primitives[0].attributes,types={5126:Float32Array,5121:Uint8Array,5123:Uint16Array,5125:Uint32Array},widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const read=id=>{const a=json.accessors[id],v=json.bufferViews[a.bufferView],T=types[a.componentType],n=widths[a.type];return new T(raw.buffer.slice(raw.byteOffset+base+(v.byteOffset||0)+(a.byteOffset||0),raw.byteOffset+base+(v.byteOffset||0)+(a.byteOffset||0)+a.count*n*T.BYTES_PER_ELEMENT))};
const geometry=new THREE.BufferGeometry();
for(const [attribute,key] of [["POSITION","position"],["NORMAL","normal"],["JOINTS_0","skinIndex"],["WEIGHTS_0","skinWeight"],["TEXCOORD_0","uv"]])geometry.setAttribute(key,new THREE.BufferAttribute(read(attrs[attribute]),widths[json.accessors[attrs[attribute]].type]));
const names=json.skins[0].joints.map(id=>json.nodes[id].name);
const mesh={geometry,skeleton:{bones:names.map(name=>({name}))}};
const bind=geometry.getAttribute("position");
neutralizeRealisticFoxHead(mesh);
const weights=stabilizeHeadSkinning(mesh,bind);
const baseline=mesh.geometry.getAttribute("position").array.slice();
const joints=mesh.geometry.getAttribute("skinIndex").array.slice(),skinWeights=mesh.geometry.getAttribute("skinWeight").array.slice(),uv=mesh.geometry.getAttribute("uv").array.slice();
const result=refineRealisticFoxHead(mesh);
const pos=mesh.geometry.getAttribute("position"),normals=mesh.geometry.getAttribute("normal");
let bodyChanged=0,moved=0,maxDelta=0,minBefore=Infinity,maxBefore=-Infinity,minAfter=Infinity,maxAfter=-Infinity,coreCount=0,badNormals=0;
for(let i=0;i<pos.count;i++){
 const x=baseline[i*3],y=baseline[i*3+1],z=baseline[i*3+2];
 const X=pos.getX(i),Y=pos.getY(i),Z=pos.getZ(i);
 const d=Math.hypot(X-x,Y-y,Z-z);
 if(d>1e-6)moved++;
 if(z<.1&&d>1e-6)bodyChanged++;
 maxDelta=Math.max(maxDelta,d);
 if(z>.355&&y>.46&&y<.56){
  coreCount++;
  minBefore=Math.min(minBefore,x);maxBefore=Math.max(maxBefore,x);
  minAfter=Math.min(minAfter,X);maxAfter=Math.max(maxAfter,X);
 }
 const normal=Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i));
 if(!Number.isFinite(X)||!Number.isFinite(Y)||!Number.isFinite(Z)||!Number.isFinite(normal)||Math.abs(normal-1)>.015)badNormals++;
}
const ratio=(maxAfter-minAfter)/(maxBefore-minBefore);
assert.ok(coreCount>1000,"Not enough skull vertices sampled");
assert.ok(ratio>.70&&ratio<.88,"Skull width not appropriately refined "+ratio);
assert.ok(moved>35000&&moved<150000,"Affected wrong number of vertices "+moved);
assert.equal(bodyChanged,0,"Body or tail shape was changed");
assert.equal(badNormals,0,"Normals or positions became invalid");
assert.ok(maxDelta<.055,"Excessive head displacement "+maxDelta);
assert.deepEqual(mesh.geometry.getAttribute("skinIndex").array,joints,"Bone indices changed");
assert.deepEqual(mesh.geometry.getAttribute("skinWeight").array,skinWeights,"Weights changed");
assert.deepEqual(mesh.geometry.getAttribute("uv").array,uv,"UVs changed");
assert.ok(weights.changedVertices>0&&result.coreVertices>1000);
console.log(JSON.stringify({status:"PASS",vertices:pos.count,changedVertices:moved,bodyChanged,coreCount,widthRatio:+ratio.toFixed(3),maxDisplacement:+maxDelta.toFixed(4),badNormals,weights:weights.changedVertices}));
