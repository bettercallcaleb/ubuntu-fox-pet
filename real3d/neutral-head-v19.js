import * as THREE from "./node_modules/three/build/three.module.js";

const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
export function neutralizeRealisticFoxHead(mesh,yaw=1.35,centerOffset=.07){
 const geometry=mesh.geometry.clone();
 const position=geometry.getAttribute("position");
 const normal=geometry.getAttribute("normal");
 const joints=geometry.getAttribute("skinIndex");
 const weights=geometry.getAttribute("skinWeight");
 const names=mesh.skeleton.bones.map(b=>b.name);
 const indices=new Set(["head","earL","earR"].map(name=>names.indexOf(name)));
 const neck=names.indexOf("neck");
 if(indices.has(-1)||neck<0)throw new Error("Realistic fox head skeleton mismatch");
 let count=0,maxAngle=0;
 for(let i=0;i<position.count;i++){
  let influence=0;
  for(let k=0;k<4;k++){
   const n=joints.getComponent(i,k),w=weights.getComponent(i,k);
   if(indices.has(n))influence+=w;
   else if(n===neck)influence+=w*.6;
  }
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
  const factor=THREE.MathUtils.clamp(influence*smooth(.17,.34,z)*smooth(.28,.40,y),0,1);
  if(factor<.0001)continue;
  const a=yaw*factor,c=Math.cos(a),s=Math.sin(a);
  const X=x,Z=z-.25;
  position.setXYZ(i,X*c+Z*s-centerOffset*factor,y,-X*s+Z*c+.25);
  const nx=normal.getX(i),nz=normal.getZ(i);
  normal.setXYZ(i,nx*c+nz*s,normal.getY(i),-nx*s+nz*c);
  maxAngle=Math.max(maxAngle,a);
  count++;
 }
 position.needsUpdate=true;
 normal.needsUpdate=true;
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
 mesh.geometry.dispose();
 mesh.geometry=geometry;
 return {correctedVertices:count,maximumAngle:maxAngle,bbox:geometry.boundingBox};
}
