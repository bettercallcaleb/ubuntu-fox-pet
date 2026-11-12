// Regression test: the realistic fox skeleton must actually sit inside the mesh and the skin weights must be anatomical.
// (The shipped asset used to be a banana-shaped mid-stride mesh with a straight skeleton beside it.)
import assert from "node:assert/strict";
import fs from "node:fs";
const buf=fs.readFileSync(new URL("./assets/Fox_Realistic_Rigged.glb",import.meta.url));
const jl=buf.readUInt32LE(12),j=JSON.parse(buf.slice(20,20+jl).toString()),b0=20+jl+8;
const view=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView],o=b0+(v.byteOffset||0)+(a.byteOffset||0);
 const n={VEC3:3,VEC4:4,MAT4:16}[a.type];const T={5126:Float32Array,5121:Uint8Array}[a.componentType];
 const ab=buf.buffer.slice(buf.byteOffset+o,buf.byteOffset+o+a.count*n*T.BYTES_PER_ELEMENT);return {d:new T(ab),n,count:a.count}};
const prim=j.meshes[0].primitives[0],A=prim.attributes;
const P=view(A.POSITION),J=view(A.JOINTS_0),W=view(A.WEIGHTS_0),IBM=view(j.skins[0].inverseBindMatrices);
const names=j.skins[0].joints.map(n=>j.nodes[n].name);
const bind=names.map((_,k)=>{const m=IBM.d.slice(k*16,k*16+16); // column-major inverse -> bone world position of the bind pose
 const det=m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2]);
 // solve world translation t from inverse matrix: t = -R^T * m_t when rotation/scale ~ orthonormal
 const tx=m[12],ty=m[13],tz=m[14];return [-(m[0]*tx+m[1]*ty+m[2]*tz),-(m[4]*tx+m[5]*ty+m[6]*tz),-(m[8]*tx+m[9]*ty+m[10]*tz)]});
const B=Object.fromEntries(names.map((n,k)=>[n,bind[k]]));
// 1. straight body: slice centres stay on the skeleton's x=0 axis
let worst=0;
for(let z0=-.35;z0<.35;z0+=.05){let lo=9,hi=-9,c=0;
 for(let i=0;i<P.count;i++){const z=P.d[i*3+2],y=P.d[i*3+1];if(z>=z0&&z<z0+.05&&y>.2&&y<.5){const x=P.d[i*3];lo=Math.min(lo,x);hi=Math.max(hi,x);c++}}
 if(c>300)worst=Math.max(worst,Math.abs((lo+hi)/2))}
assert.ok(worst<.03,"mesh body is not centred on the skeleton axis: "+worst.toFixed(3));
// 2. weights sum to one, joints valid
let badSum=0;for(let i=0;i<P.count;i++){let s=0;for(let k=0;k<4;k++){s+=W.d[i*4+k];assert.ok(J.d[i*4+k]<names.length)}if(Math.abs(s-1)>1e-3)badSum++}
assert.equal(badSum,0,"weights not normalised");
// 3. leg bones: both sides populated, no leg influence on the back/other side, vertices near their own bone
const legBones=names.filter(n=>/^(thigh|shin|foot|toe)[LR][01]$/.test(n));
const count={};let backLeak=0,farVerts=0,sideLeak=0,legVerts=0;
for(let i=0;i<P.count;i++){const x=P.d[i*3],y=P.d[i*3+1],z=P.d[i*3+2];
 for(let k=0;k<4;k++){const w=W.d[i*4+k];if(w<.2)continue;const n=names[J.d[i*4+k]];if(!legBones.includes(n))continue;
  legVerts++;count[n]=(count[n]||0)+1;
  if(y>.4)backLeak++;
  if((n[5]==="L"&&x<-.03)||(n[5]==="R"&&x>.03))sideLeak++;
  const b=B[n];if(Math.hypot(x-b[0],y-b[1],z-b[2])>.45)farVerts++;}}
for(const n of legBones)assert.ok((count[n]||0)>150,"leg bone barely skinned: "+n+" "+(count[n]||0));
assert.equal(backLeak,0,"leg bones influence the back");
assert.equal(sideLeak,0,"leg bones influence the opposite side");
assert.equal(farVerts,0,"leg weights on far-away vertices");
// 4. each foot bone chain really stands under its body: toe joint within 0.08 of the lowest vertices on that side
for(const leg of ["L0","L1","R0","R1"]){const toe=B["toe"+leg];let low=9,cx=0,cz=0,c=0;
 for(let i=0;i<P.count;i++){const x=P.d[i*3],y=P.d[i*3+1],z=P.d[i*3+2];if(y<.04&&Math.sign(x)===(leg[0]==="L"?1:-1)&&Math.abs(z-toe[2])<.12&&Math.abs(x-toe[0])<.06){cx+=x;cz+=z;c++;low=Math.min(low,y)}}
 assert.ok(c>50,"no paw geometry near "+leg+" toe joint");
 assert.ok(Math.hypot(cx/c-toe[0],cz/c-toe[2])<.08,"toe joint "+leg+" is away from its paw");}
console.log(JSON.stringify({status:"PASS",bodyAxisOffset:+worst.toFixed(4),legWeightedVertices:legVerts,perBone:count}));
