import * as THREE from "./node_modules/three/build/three.module.js";

export function buildSkinnedFur(source,count=24000,seed=22611){
 const geo=source.geometry;
 const position=geo.getAttribute("position");
 const uv=geo.getAttribute("uv");
 const skinIndex=geo.getAttribute("skinIndex");
 const skinWeight=geo.getAttribute("skinWeight");
 if(!position||!skinIndex||!skinWeight)return null;
 const tex=source.material?.map?.image;
 let pixels=null,texW=0,texH=0;
 if(tex){
  try{
   const canvas=document.createElement("canvas");
   canvas.width=tex.width;canvas.height=tex.height;
   const ctx=canvas.getContext("2d",{willReadFrequently:true});
   ctx.drawImage(tex,0,0);
   pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   texW=canvas.width;texH=canvas.height;
  }catch(e){console.warn("Fur texture sampling fallback",e)}
 }
 let s=seed>>>0;
 const rng=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
 const triCount=(geo.index?geo.index.count:position.count)/3;
 const triangles=new Array(triCount);
 const cum=new Float64Array(triCount);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 const cross=new THREE.Vector3();
 let total=0;
 for(let i=0;i<triCount;i++){
  const aa=geo.index?geo.index.getX(i*3):i*3;
  const bb=geo.index?geo.index.getX(i*3+1):i*3+1;
  const cc=geo.index?geo.index.getX(i*3+2):i*3+2;
  a.fromBufferAttribute(position,aa);
  b.fromBufferAttribute(position,bb);
  c.fromBufferAttribute(position,cc);
  const area=cross.copy(b).sub(a).cross(new THREE.Vector3().copy(c).sub(a)).length()*.5;
  total+=Math.max(0,area);
  cum[i]=total;
  triangles[i]=[aa,bb,cc];
 }
 const verts=new Float32Array(count*9);
 const normals=new Float32Array(count*9);
 const colors=new Float32Array(count*9);
 const indices=new Uint16Array(count*12);
 const weights=new Float32Array(count*12);
 const tangent=new THREE.Vector3(),hair=new THREE.Vector3(),center=new THREE.Vector3();
 const n=new THREE.Vector3(),v0=new THREE.Vector3(),v1=new THREE.Vector3(),v2=new THREE.Vector3();
 const white=new THREE.Color(),shade=new THREE.Color();
 for(let i=0;i<count;i++){
  const choice=rng()*total;
  let lo=0,hi=triCount-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(cum[mid]<choice)lo=mid+1;else hi=mid}
  const triangle=triangles[lo];
  v0.fromBufferAttribute(position,triangle[0]);
  v1.fromBufferAttribute(position,triangle[1]);
  v2.fromBufferAttribute(position,triangle[2]);
  const r1=Math.sqrt(rng()),r2=rng();
  const bc=[1-r1,r1*(1-r2),r1*r2];
  center.copy(v0).multiplyScalar(bc[0]).addScaledVector(v1,bc[1]).addScaledVector(v2,bc[2]);
  n.copy(v1).sub(v0).cross(new THREE.Vector3().copy(v2).sub(v0)).normalize();
  if(n.lengthSq()<.001)continue;
  tangent.set(-n.z,0,n.x);
  if(tangent.lengthSq()<.02)tangent.set(0,-n.z,n.y);
  tangent.normalize();
  const length=(.48+rng()*.88);
  const width=.075+rng()*.09;
  hair.copy(n).multiplyScalar(length).add(new THREE.Vector3(0,-.04-rng()*.075,-.09-rng()*.18));
  if(center.y>58)hair.multiplyScalar(.65);
  const p0=center.clone().addScaledVector(n,.13).addScaledVector(tangent,-width);
  const p1=center.clone().addScaledVector(n,.13).addScaledVector(tangent,width);
  const p2=center.clone().addScaledVector(n,.13).add(hair);
  const points=[p0,p1,p2];
  const skinScores=new Map();
  for(let j=0;j<3;j++){
   const index=triangle[j];
   for(let k=0;k<4;k++){
    const bone=skinIndex.getComponent(index,k);
    const weight=skinWeight.getComponent(index,k)*bc[j];
    if(weight>0)skinScores.set(bone,(skinScores.get(bone)||0)+weight);
   }
  }
  const top=Array.from(skinScores).sort((u,v)=>v[1]-u[1]).slice(0,4);
  const weightSum=top.reduce((sum,item)=>sum+item[1],0)||1;
  const colorSample=()=>{
   if(!pixels||!uv)return [174,102,57];
   const u=uv.getX(triangle[0])*bc[0]+uv.getX(triangle[1])*bc[1]+uv.getX(triangle[2])*bc[2];
   const v=uv.getY(triangle[0])*bc[0]+uv.getY(triangle[1])*bc[1]+uv.getY(triangle[2])*bc[2];
   const tx=Math.min(texW-1,Math.max(0,Math.floor(((u%1+1)%1)*texW)));
   const ty=Math.min(texH-1,Math.max(0,Math.floor(((1-v%1+1)%1)*texH)));
   const off=4*(ty*texW+tx);
   return [pixels[off],pixels[off+1],pixels[off+2]];
  };
  const [rr,gg,bb]=colorSample();
  shade.setRGB(rr/255,gg/255,bb/255,THREE.SRGBColorSpace);
  shade.multiplyScalar(1.15+rng()*.22);
  for(let j=0;j<3;j++){
   const at=i*9+j*3;
   verts[at]=points[j].x;
   verts[at+1]=points[j].y;
   verts[at+2]=points[j].z;
   normals[at]=n.x;normals[at+1]=n.y;normals[at+2]=n.z;
   const aColor=j===2?1.12:.96;
   colors[at]=Math.min(1,shade.r*aColor);
   colors[at+1]=Math.min(1,shade.g*aColor);
   colors[at+2]=Math.min(1,shade.b*aColor);
   for(let k=0;k<4;k++){
    indices[i*12+j*4+k]=top[k]?.[0]||0;
    weights[i*12+j*4+k]=(top[k]?.[1]||0)/weightSum;
   }
  }
 }
 const furGeo=new THREE.BufferGeometry();
 furGeo.setAttribute("position",new THREE.BufferAttribute(verts,3));
 furGeo.setAttribute("normal",new THREE.BufferAttribute(normals,3));
 furGeo.setAttribute("color",new THREE.BufferAttribute(colors,3));
 furGeo.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(indices,4));
 furGeo.setAttribute("skinWeight",new THREE.Float32BufferAttribute(weights,4));
 furGeo.computeBoundingSphere();
 const mat=new THREE.MeshBasicMaterial({color:"#ffffff",vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false});
 const furMesh=new THREE.SkinnedMesh(furGeo,mat);
 furMesh.bindMode=source.bindMode;
 furMesh.bind(source.skeleton,source.bindMatrix);
 furMesh.position.copy(source.position);
 furMesh.quaternion.copy(source.quaternion);
 furMesh.scale.copy(source.scale);
 furMesh.frustumCulled=false;
 furMesh.castShadow=false;
 source.parent.add(furMesh);
 return furMesh;
}
