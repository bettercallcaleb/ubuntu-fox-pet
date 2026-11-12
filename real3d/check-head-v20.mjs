import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from './node_modules/three/build/three.module.js';
import {neutralizeRealisticFoxHead} from './neutral-head-v19.js';
import {stabilizeHeadSkinning} from './head-weights-v20.js';

const raw=fs.readFileSync(new URL('./assets/Fox_Realistic_Rigged.glb',import.meta.url));
const jl=raw.readUInt32LE(12),gltf=JSON.parse(raw.subarray(20,20+jl).toString()),b0=28+jl;
const attrs=gltf.meshes[0].primitives[0].attributes,types={5126:Float32Array,5121:Uint8Array,5123:Uint16Array,5125:Uint32Array},sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function read(aid){const a=gltf.accessors[aid],v=gltf.bufferViews[a.bufferView],T=types[a.componentType],b=b0+(v.byteOffset||0)+(a.byteOffset||0);return new T(raw.buffer.slice(raw.byteOffset+b,raw.byteOffset+b+a.count*sizes[a.type]*T.BYTES_PER_ELEMENT))}
const geometry=new THREE.BufferGeometry();
for(const [input,output] of [['POSITION','position'],['NORMAL','normal'],['JOINTS_0','skinIndex'],['WEIGHTS_0','skinWeight'],['TEXCOORD_0','uv']]){const a=gltf.accessors[attrs[input]];geometry.setAttribute(output,new THREE.BufferAttribute(read(attrs[input]),sizes[a.type]))}
const idx=read(gltf.meshes[0].primitives[0].indices);
geometry.setIndex(new THREE.BufferAttribute(idx,1));
const skin=gltf.skins[0],boneNodes=skin.joints,byNode=new Map(),bones=boneNodes.map(n=>{const v=gltf.nodes[n],b=new THREE.Bone();b.name=v.name;b.position.fromArray(v.translation||[0,0,0]);b.quaternion.fromArray(v.rotation||[0,0,0,1]);b.scale.fromArray(v.scale||[1,1,1]);byNode.set(n,b);return b});
const roots=[];
for(const n of boneNodes){const b=byNode.get(n);let hasParent=false;for(const [p,parent]of byNode){if(gltf.nodes[p].children?.includes(n)){parent.add(b);hasParent=true;break}}if(!hasParent)roots.push(b)}
const matrices=read(skin.inverseBindMatrices),inverses=bones.map((b,i)=>new THREE.Matrix4().fromArray(matrices,i*16));
const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());
roots.forEach(root=>mesh.add(root));
mesh.bind(new THREE.Skeleton(bones,inverses),new THREE.Matrix4());
mesh.updateMatrixWorld(true);mesh.skeleton.update();
const bindPosition=geometry.getAttribute('position'),originalWeights=geometry.getAttribute('skinWeight').array.slice();
neutralizeRealisticFoxHead(mesh);
const old=mesh.geometry.clone();
const fixed=stabilizeHeadSkinning(mesh,bindPosition),newG=mesh.geometry;
const bhead=bones.find(b=>b.name==='head'),rest=bhead.quaternion.clone(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
const origZ=bindPosition.array;
const samples=[];
for(let t=0;t<idx.length;t+=51){const a=idx[t],b=idx[t+1],c=idx[t+2];if(a===undefined||b===undefined||c===undefined)continue;const ids=[a,b,c];if(ids.every(i=>origZ[i*3+2]>.34&&origZ[i*3+1]>.41))samples.push(ids);if(samples.length>=12000)break}
assert.ok(samples.length>400,'insufficient head triangles');
function stretch(g,yaw){mesh.geometry=g;mesh.skeleton.pose();bhead.quaternion.copy(rest).multiply(q.setFromAxisAngle(up,yaw));mesh.updateMatrixWorld(true);mesh.skeleton.update();const pos=g.getAttribute('position'),cache=new Map();const deform=i=>{if(cache.has(i))return cache.get(i);const v=mesh.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(pos,i));cache.set(i,v);return v};const relative=[];for(const tri of samples){for(let n=0;n<3;n++){const i=tri[n],j=tri[(n+1)%3],rest=new THREE.Vector3().fromBufferAttribute(pos,i).distanceTo(new THREE.Vector3().fromBufferAttribute(pos,j));if(rest<.0003)continue;relative.push(Math.abs(deform(i).distanceTo(deform(j))/rest-1))}}relative.sort((a,b)=>a-b);return {count:relative.length,p95:relative[Math.floor(relative.length*.95)],p99:relative[Math.floor(relative.length*.99)],max:relative.at(-1)}}
const out={changedVertices:fixed.changedVertices,rigidSkullVertices:fixed.rigidSkullVertices,sampleFaces:samples.length,poses:{}};
for(const yaw of [-.9,-.5,.5,.9])out.poses[yaw]={v19:stretch(old,yaw),v20:stretch(newG,yaw)};
mesh.geometry=newG;
const joints=newG.getAttribute('skinIndex'),weights=newG.getAttribute('skinWeight');
for(let i=0;i<weights.count;i+=17){let sum=0;for(let k=0;k<4;k++){const id=joints.getComponent(i,k),w=weights.getComponent(i,k);assert.ok(id>=0&&id<bones.length&&w>=0&&Number.isFinite(w),'invalid skin weights');sum+=w}assert.ok(Math.abs(sum-1)<1e-5,'non-normalized skin weights')}
const group=new Set(['head','earL','earR'].map(name=>bones.findIndex(b=>b.name===name)));
for(let i=0;i<bindPosition.count;i+=13){const z=bindPosition.getZ(i),y=bindPosition.getY(i);if(z>.35&&y>.41){let w=0;for(let k=0;k<4;k++)if(group.has(joints.getComponent(i,k)))w+=weights.getComponent(i,k);assert.ok(w>.999,'non-rigid face core: '+i+' '+w)}}
for(const [yaw,metrics] of Object.entries(out.poses))assert.ok(metrics.v20.p95<=metrics.v19.p95*.7+1e-6,'skull distortion not significantly reduced at yaw '+yaw);
console.log(JSON.stringify(out));
