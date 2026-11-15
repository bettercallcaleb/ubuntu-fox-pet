const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const FOX_CLEARANCE=.80;
export const FOX_SHAPE=[
 {x:.23,z:0,r:.34},
 {x:-.22,z:0,r:.34},
 {x:.52,z:0,r:.25},
 {x:-.53,z:0,r:.26}
];

export function discClear(x,z,r,room,obstacles){
 if(!Number.isFinite(x)||!Number.isFinite(z)||x-r<room.minX||x+r>room.maxX||z-r<room.minZ||z+r>room.maxZ)return false;
 return obstacles.every(o=>{
  const dx=x-clamp(x,o.minX,o.maxX),dz=z-clamp(z,o.minZ,o.maxZ);
  return dx*dx+dz*dz >= (r+1e-5)**2;
 });
}

export function bodyClear(x,z,yaw,room,obstacles,shape=FOX_SHAPE){
 if(!Number.isFinite(yaw))return false;
 const c=Math.cos(yaw),s=Math.sin(yaw);
 return shape.every(d=>discClear(x+c*d.x+s*d.z,z-s*d.x+c*d.z,d.r,room,obstacles));
}

export function findSafeBodyPose(x,z,yaw,room,obstacles,limit=3){
 if(bodyClear(x,z,yaw,room,obstacles))return{x,z,yaw,shift:0};
 const count=48;
 for(let radius=.04;radius<=limit+1e-9;radius+=.04){
  for(let i=0;i<count;i++){
   const a=i*Math.PI*2/count,px=x+radius*Math.cos(a),pz=z+radius*Math.sin(a);
   if(bodyClear(px,pz,yaw,room,obstacles))return{x:px,z:pz,yaw,shift:radius};
  }
 }
 return null;
}

function shortestAngle(a,b){
 return Math.atan2(Math.sin(b-a),Math.cos(b-a));
}
function yawCandidate(x,z,start,end,room,obstacles){
 if(bodyClear(x,z,end,room,obstacles))return end;
 const delta=shortestAngle(start,end);
 let low=0,high=1;
 for(let i=0;i<14;i++){
  const mid=(low+high)/2;
  if(bodyClear(x,z,start+delta*mid,room,obstacles))low=mid;
  else high=mid;
 }
 return start+delta*low;
}

export function moveBody(from,to,room,obstacles){
 const x=from.x,z=from.z,yaw=from.yaw;
 if(!bodyClear(x,z,yaw,room,obstacles)){
  const safe=findSafeBodyPose(x,z,yaw,room,obstacles);
  if(!safe)return{x,z,yaw,blocked:true,recovered:false,distance:0};
  return{...safe,blocked:true,recovered:true,distance:Math.hypot(x-safe.x,z-safe.z)};
 }
 let px=x,pz=z,angle=yaw,contacts=0;
 const total=Math.hypot(to.x-x,to.z-z),rotation=Math.abs(shortestAngle(yaw,to.yaw));
 const count=Math.max(1,Math.ceil(total/.035),Math.ceil(rotation/.055));
 for(let i=1;i<=count;i++){
  const nx=px+(to.x-x)/count,nz=pz+(to.z-z)/count;
  const targetYaw=yaw+shortestAngle(yaw,to.yaw)*i/count;
  const nextYaw=yawCandidate(px,pz,angle,targetYaw,room,obstacles);
  if(Math.abs(shortestAngle(nextYaw,targetYaw))>1e-4)contacts++;
  angle=nextYaw;
  if(bodyClear(nx,nz,angle,room,obstacles)){px=nx;pz=nz;continue}
  contacts++;
  if(bodyClear(nx,pz,angle,room,obstacles)){px=nx;continue}
  if(bodyClear(px,nz,angle,room,obstacles)){pz=nz;continue}
 }
 return{x:px,z:pz,yaw:angle,blocked:contacts>0,recovered:false,distance:Math.hypot(px-x,pz-z),contacts};
}

export function deflectBallAgainstFox(ball,fox,{radius=.205,bodyRadius=.34}={}){
 const dx=ball.x-fox.x,dz=ball.z-fox.z,d=Math.hypot(dx,dz),required=radius+bodyRadius;
 if(d>=required)return false;
 const nx=d>1e-6?dx/d:Math.cos(fox.yaw),nz=d>1e-6?dz/d:-Math.sin(fox.yaw);
 ball.x=fox.x+nx*(required+1e-3);
 ball.z=fox.z+nz*(required+1e-3);
 const into=ball.vx*nx+ball.vz*nz;
 if(into<0){ball.vx-=into*1.45*nx;ball.vz-=into*1.45*nz}
 else if(Math.hypot(ball.vx,ball.vz)<.03){ball.vx=nx*.12;ball.vz=nz*.12}
 return true;
}
