import * as THREE from "./node_modules/three/build/three.module.js";

export function buildMicroFur(source,count=36000,seed=4137){
 const geo=source.geometry;
 const pos=geo.getAttribute("position");
 const nor=geo.getAttribute("normal");
 const uv=geo.getAttribute("uv");
 const bones=geo.getAttribute("skinIndex");
 const weights=geo.getAttribute("skinWeight");
 if(!pos||!nor||!bones||!weights)return null;
 let pixels=null,w=0,h=0;
 const image=source.material?.map?.image;
 if(image){
  try{
   const canvas=document.createElement("canvas");
   canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext("2d",{willReadFrequently:true});
   ctx.drawImage(image,0,0);
   pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   w=canvas.width;h=canvas.height;
  }catch(_){}
 }
 let state=seed>>>0;
 const rnd=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const verts=new Float32Array(count*9);
 const normal=new Float32Array(count*9);
 const color=new Float32Array(count*9);
 const skinIdx=new Uint16Array(count*12);
 const skinW=new Float32Array(count*12);
 const p=new THREE.Vector3(),n=new THREE.Vector3();
 const tangent=new THREE.Vector3(),tip=new THREE.Vector3();
 const shade=new THREE.Color();
 let made=0;
 for(let tries=0;made<count&&tries<count*5;tries++){
  const i=Math.floor(rnd()*pos.count);
  p.fromBufferAttribute(pos,i);
  n.fromBufferAttribute(nor,i).normalize();
  if(p.y<.13||n.lengthSq()<.8)continue;
  if(p.y>.49&&p.z>.1)continue;
  const length=.0025+rnd()*.004;
  const width=length*(.06+rnd()*.10);
  tangent.set(n.z,0,-n.x);
  if(tangent.lengthSq()<.005)tangent.set(1,0,0);
  tangent.normalize();
  tip.copy(p).addScaledVector(n,length*.56);
  tip.y-=length*.16;
  tip.z-=length*.17;
  if(pixels&&uv){
   const u=((uv.getX(i)%1+1)%1),v=((uv.getY(i)%1+1)%1);
   const tx=Math.min(w-1,Math.floor(u*w));
   const ty=Math.min(h-1,Math.floor((1-v)*h));
   const o=4*(ty*w+tx);
   shade.setRGB(pixels[o]/255,pixels[o+1]/255,pixels[o+2]/255,THREE.SRGBColorSpace);
  }else shade.set("#ae6a42");
  shade.multiplyScalar(.87+rnd()*.16);
  const hair=[
   p.clone().addScaledVector(n,.0006).addScaledVector(tangent,-width),
   p.clone().addScaledVector(n,.0006).addScaledVector(tangent,width),
   tip.clone()
  ];
  for(let j=0;j<3;j++){
   const k=made*9+j*3;
   verts.set(hair[j].toArray(),k);
   normal.set(n.toArray(),k);
   color[k]=shade.r; color[k+1]=shade.g;color[k+2]=shade.b;
   for(let b=0;b<4;b++){
    const s=made*12+j*4+b;
    skinIdx[s]=bones.getComponent(i,b);
    skinW[s]=weights.getComponent(i,b);
   }
  }
  made++;
 }
 if(!made)return null;
 const geom=new THREE.BufferGeometry();
 geom.setAttribute("position",new THREE.Float32BufferAttribute(verts.slice(0,made*9),3));
 geom.setAttribute("normal",new THREE.Float32BufferAttribute(normal.slice(0,made*9),3));
 geom.setAttribute("color",new THREE.Float32BufferAttribute(color.slice(0,made*9),3));
 geom.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(skinIdx.slice(0,made*12),4));
 geom.setAttribute("skinWeight",new THREE.Float32BufferAttribute(skinW.slice(0,made*12),4));
 geom.computeBoundingSphere();
 const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:0,side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false});
 const mesh=new THREE.SkinnedMesh(geom,mat);
 mesh.name="LivingFox_MicroFur";
 mesh.position.copy(source.position);
 mesh.quaternion.copy(source.quaternion);
 mesh.scale.copy(source.scale);
 mesh.frustumCulled=false;
 mesh.castShadow=false;
 mesh.receiveShadow=false;
 mesh.bindMode=source.bindMode;
 source.parent.add(mesh);
 mesh.bind(source.skeleton,source.bindMatrix);
 return mesh;
}
