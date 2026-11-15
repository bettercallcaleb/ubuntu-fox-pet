const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function gradePetStroke({distance=0,duration=0,contact=0}={}){
 const ratio=contact/Math.max(1,duration);
 if(duration<140||distance<34||ratio<.48)return{accepted:false,joy:0,bond:0,label:""};
 const intensity=clamp(distance/170,0,1);
 return{accepted:true,joy:Math.round(2+intensity*3),bond:intensity>.55?2:1,label:intensity>.7?"Long, gentle strokes":"Gentle petting"};
}

export function isBallFree(x,z,r,room,obstacles){
 if(x-r<room.minX||x+r>room.maxX||z-r<room.minZ||z+r>room.maxZ)return false;
 return !obstacles.some(o=>{
  const cx=clamp(x,o.minX,o.maxX),cz=clamp(z,o.minZ,o.maxZ);
  return (x-cx)**2+(z-cz)**2<r*r;
 });
}

function resolveObstacle(ball,o,r,bounce){
 const cx=clamp(ball.x,o.minX,o.maxX),cz=clamp(ball.z,o.minZ,o.maxZ);
 let nx=ball.x-cx,nz=ball.z-cz,d=Math.hypot(nx,nz);
 if(d>=r)return false;
 if(d<1e-8){
  const sides=[
   {distance:Math.abs(ball.x-(o.minX-r)),x:o.minX-r,z:ball.z,nx:-1,nz:0},
   {distance:Math.abs((o.maxX+r)-ball.x),x:o.maxX+r,z:ball.z,nx:1,nz:0},
   {distance:Math.abs(ball.z-(o.minZ-r)),x:ball.x,z:o.minZ-r,nx:0,nz:-1},
   {distance:Math.abs((o.maxZ+r)-ball.z),x:ball.x,z:o.maxZ+r,nx:0,nz:1}
  ];
  sides.sort((a,b)=>a.distance-b.distance);
  const s=sides[0];ball.x=s.x;ball.z=s.z;nx=s.nx;nz=s.nz;
 }else{
  nx/=d;nz/=d;ball.x+=nx*(r-d+1e-4);ball.z+=nz*(r-d+1e-4);
 }
 const into=ball.vx*nx+ball.vz*nz;
 if(into<0){ball.vx-=(1+bounce)*into*nx;ball.vz-=(1+bounce)*into*nz}
 return true;
}

export function stepRollingBall(ball,dt,{room,obstacles,radius=.205,bounce=.56,drag=1.65}){
 const d=clamp(dt,0,.1);
 const steps=Math.max(1,Math.ceil(Math.hypot(ball.vx,ball.vz)*d/(radius*.35)));
 const h=d/steps;let contacts=0,travel=0;
 for(let i=0;i<steps;i++){
  const px=ball.x,pz=ball.z;
  ball.x+=ball.vx*h;ball.z+=ball.vz*h;
  if(ball.x<room.minX+radius){ball.x=room.minX+radius;ball.vx=Math.abs(ball.vx)*bounce;contacts++}
  if(ball.x>room.maxX-radius){ball.x=room.maxX-radius;ball.vx=-Math.abs(ball.vx)*bounce;contacts++}
  if(ball.z<room.minZ+radius){ball.z=room.minZ+radius;ball.vz=Math.abs(ball.vz)*bounce;contacts++}
  if(ball.z>room.maxZ-radius){ball.z=room.maxZ-radius;ball.vz=-Math.abs(ball.vz)*bounce;contacts++}
  for(let pass=0;pass<5;pass++){
   let adjusted=false;
   for(const o of obstacles){
    if(resolveObstacle(ball,o,radius,bounce)){contacts++;adjusted=true}
   }
   if(!adjusted)break;
  }
  if(!isBallFree(ball.x,ball.z,radius-1e-5,room,obstacles)){
   ball.x=px;ball.z=pz;ball.vx=-ball.vx*bounce;ball.vz=-ball.vz*bounce;contacts++;
  }
  travel+=Math.hypot(ball.x-px,ball.z-pz);
  const attenuation=Math.exp(-h*drag);
  ball.vx*=attenuation;ball.vz*=attenuation;
 }
 if(Math.hypot(ball.vx,ball.vz)<.025){ball.vx=0;ball.vz=0}
 return{contacts,travel,speed:Math.hypot(ball.vx,ball.vz)};
}

export function throwVelocity(samples,scale=1,maxSpeed=4.8){
 if(samples.length<2)return{x:0,z:0,speed:0};
 const last=samples[samples.length-1];
 let first=samples[0];
 for(let i=samples.length-2;i>=0;i--){
  if(last.time-samples[i].time>110)break;
  first=samples[i];
 }
 const seconds=Math.max(.025,(last.time-first.time)/1000);
 let vx=(last.x-first.x)/seconds*scale,vz=(last.z-first.z)/seconds*scale;
 const speed=Math.hypot(vx,vz);
 if(speed>maxSpeed){vx*=maxSpeed/speed;vz*=maxSpeed/speed}
 return{x:vx,z:vz,speed:Math.hypot(vx,vz)};
}
