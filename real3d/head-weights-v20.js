import * as THREE from "./node_modules/three/build/three.module.js";

const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};

export function stabilizeHeadSkinning(mesh,bindPosition){
  const geometry=mesh.geometry;
  const pos=geometry.getAttribute("position");
  const joints=geometry.getAttribute("skinIndex");
  const weights=geometry.getAttribute("skinWeight");
  const names=mesh.skeleton.bones.map(b=>b.name);
  const head=names.indexOf("head"),neck=names.indexOf("neck"),chest=names.indexOf("chest"),earL=names.indexOf("earL"),earR=names.indexOf("earR");
  if([head,neck,chest,earL,earR].some(i=>i<0))throw new Error("Fox head skinning requires head, neck and chest joints");
  let changed=0,rigid=0;
  for(let i=0;i<pos.count;i++){
    const t=smooth(.20,.35,bindPosition.getZ(i))*smooth(.31,.41,bindPosition.getY(i));
    if(t<1e-6)continue;
    const candidates=new Map();
    for(let k=0;k<4;k++){
      const b=joints.getComponent(i,k),w=weights.getComponent(i,k);
      if(w>0)candidates.set(b,(candidates.get(b)||0)+w);
    }
    let body=0;
    for(const [bone,weight] of candidates){
      if(bone===head||bone===earL||bone===earR)continue;
      body+=weight;
      candidates.set(bone,weight*(1-t));
    }
    if(body<1e-6)continue;
    candidates.set(head,(candidates.get(head)||0)+t*body);
    const top=[...candidates].filter(([,w])=>w>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const norm=top.reduce((sum,[,w])=>sum+w,0);
    for(let k=0;k<4;k++){
      joints.setComponent(i,k,top[k]?.[0]??head);
      weights.setComponent(i,k,top[k]?top[k][1]/norm:0);
    }
    changed++;
    if(t>.999)rigid++;
  }
  joints.needsUpdate=true;
  weights.needsUpdate=true;
  return {changedVertices:changed,rigidSkullVertices:rigid};
}
