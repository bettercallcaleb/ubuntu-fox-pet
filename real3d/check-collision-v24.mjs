import assert from "node:assert/strict";
import {route,blocked,clearLine,NAV_INFO} from "./navigation-v13.js";
import {FOX_CLEARANCE,FOX_SHAPE,bodyClear,findSafeBodyPose,moveBody,deflectBallAgainstFox} from "./body-collision-v24.js";
import {isBallFree,stepRollingBall} from "./physical-interaction-v21.js";

const {room,obstacles}=NAV_INFO;
const home={x:-.7,z:.65,yaw:0};
assert.ok(bodyClear(home.x,home.z,home.yaw,room,obstacles));
const goals=[
 {name:"bed",x:-1.7,z:1.25},{name:"ball",x:.2,z:1.35},
 {name:"food",x:1.18,z:1.66},{name:"desk",x:.94,z:-1.71},
 {name:"window",x:-1.6,z:-2.1},{name:"tower",x:2.72,z:.8}
];
let pathSamples=0,physicsSamples=0,collisions=0,reached=0,maxGap=0;
for(const goal of goals){
 const points=route(home,goal,FOX_CLEARANCE);
 assert.ok(points.length,"Unreachable "+goal.name);
 let previous=home;
 for(const next of points){
  assert.ok(!blocked(next.x,next.z,FOX_CLEARANCE),goal.name+" invalid endpoint");
  assert.ok(clearLine(previous,next,FOX_CLEARANCE),goal.name+" intersects furniture");
  const dist=Math.hypot(next.x-previous.x,next.z-previous.z);
  for(let i=0;i<=Math.ceil(dist/.03);i++){
   const p=i/Math.max(1,Math.ceil(dist/.03));
   const x=previous.x+(next.x-previous.x)*p,z=previous.z+(next.z-previous.z)*p;
   for(let j=0;j<36;j++){
    assert.ok(bodyClear(x,z,j*Math.PI*2/36,room,obstacles),goal.name+" body clips during turn");
    pathSamples++;
   }
  }
  previous=next;
 }
 maxGap=Math.max(maxGap,Math.hypot(previous.x-goal.x,previous.z-goal.z));
}
for(let seed=0;seed<80;seed++){
 let x=home.x,z=home.z,yaw=0;
 for(let i=0;i<300;i++){
  const nx=x+Math.sin(seed*11+i*.82)*(.15+i%7*.14),nz=z+Math.cos(seed*13+i*.67)*(.15+i%5*.17);
  const targetYaw=(Math.sin(seed+i*.2)*4);
  const result=moveBody({x,z,yaw},{x:nx,z:nz,yaw:targetYaw},room,obstacles);
  if(result.blocked)collisions++;
  x=result.x;z=result.z;yaw=result.yaw;
  assert.ok(bodyClear(x,z,yaw,room,obstacles),"Physics penetration trial "+seed+"/"+i);
  physicsSamples++;
 }
}
const clipped={x:2.3,z:1.72,yaw:0};
const recovery=findSafeBodyPose(clipped.x,clipped.z,clipped.yaw,room,obstacles);
assert.ok(recovery&&bodyClear(recovery.x,recovery.z,recovery.yaw,room,obstacles));
const through=moveBody(home,{x:3.8,z:.65,yaw:0},room,obstacles);
assert.ok(bodyClear(through.x,through.z,through.yaw,room,obstacles));
assert.ok(through.blocked);
const ball={x:home.x+.05,z:home.z+.01,vx:-1,vz:0};
assert.ok(deflectBallAgainstFox(ball,home));
assert.ok(Math.hypot(ball.x-home.x,ball.z-home.z)>.54);
assert.ok(isBallFree(ball.x,ball.z,.205,room,obstacles));
const rolling={x:.2,z:1.35,vx:3,vz:-1};
for(let i=0;i<900;i++){
 stepRollingBall(rolling,1/60,{room,obstacles,radius:.205});
 assert.ok(isBallFree(rolling.x,rolling.z,.204,room,obstacles),"Ball clipped furniture");
}
console.log(JSON.stringify({status:"PASS",bodyCircles:FOX_SHAPE.length,paths:goals.length,pathSamples,physicsSamples,collisions,goalClearance:FOX_CLEARANCE,maxTargetAdjustment:+maxGap.toFixed(3),recoveryDistance:+recovery.shift.toFixed(3),fastSweep:through,ballSafe:true}));
