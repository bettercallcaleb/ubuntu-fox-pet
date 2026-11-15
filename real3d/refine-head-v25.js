import * as THREE from "./node_modules/three/build/three.module.js";

const smooth=(a,b,x)=>{
 const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);
 return t*t*(3-2*t);
};

export function refineRealisticFoxHead(mesh,{width=.78,height=.91,length=.94,ruff=.027}={}){
 const geom=mesh.geometry,pos=geom.getAttribute("position"),normal=geom.getAttribute("normal");
 if(!pos||!normal)throw new Error("Realistic head geometry needs positions and normals");
 const originalBBox=geom.boundingBox?.clone()||new THREE.Box3().setFromBufferAttribute(pos);
 let altered=0,skull=0,maxDisplacement=0,bodyChanged=0;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
  const fade=smooth(.17,.34,z)*smooth(.33,.45,y);
  const ear=smooth(.52,.59,y);
  const sx=1-(1-width)*fade*(1-.12*ear);
  const sy=1-(1-height)*fade;
  const sz=1-(1-length)*fade;
  const lip=(1-smooth(.34,.46,y))*smooth(.16,.30,z);
  const X=.012+(x-.012)*sx;
  const Y=.355+(y-.355)*sy+ruff*.28*lip;
  const Z=.245+(z-.245)*sz-ruff*lip;
  const change=Math.hypot(X-x,Y-y,Z-z);
  if(change<1e-7)continue;
  pos.setXYZ(i,X,Y,Z);
  const nx=normal.getX(i)/sx,ny=normal.getY(i)/sy,nz=normal.getZ(i)/sz;
  const inv=1/Math.max(1e-12,Math.hypot(nx,ny,nz));
  normal.setXYZ(i,nx*inv,ny*inv,nz*inv);
  altered++;if(fade>.97)skull++;maxDisplacement=Math.max(change,maxDisplacement);
  if(z<.1)bodyChanged++;
 }
 pos.needsUpdate=true;normal.needsUpdate=true;
 geom.computeBoundingBox();geom.computeBoundingSphere();
 return{alteredVertices:altered,coreVertices:skull,maxDisplacement,bodyChanged,params:{width,height,length,ruff},originalBBox};
}
