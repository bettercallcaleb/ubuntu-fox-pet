import assert from "node:assert/strict";
import {gradePetStroke,isBallFree,stepRollingBall,throwVelocity} from "./physical-interaction-v21.js";
import {NAV_INFO} from "./navigation-v13.js";

const options={room:NAV_INFO.room,obstacles:NAV_INFO.obstacles,radius:.205};
assert.equal(gradePetStroke({duration:100,distance:300,contact:90}).accepted,false);
assert.equal(gradePetStroke({duration:400,distance:180,contact:100}).accepted,false);
const stroke=gradePetStroke({duration:340,distance:160,contact:300});
assert.ok(stroke.accepted&&stroke.joy>=3&&stroke.bond>=1);
assert.equal(isBallFree(1.15,2.44,.205,options.room,options.obstacles),false);
assert.equal(isBallFree(0,1.2,.205,options.room,options.obstacles),true);

const ball={x:0,z:2.44,vx:4.2,vz:0};
let hits=0;
for(let i=0;i<300;i++){
 const next=stepRollingBall(ball,1/60,options);
 hits+=next.contacts;
 assert.ok(Number.isFinite(ball.x)&&Number.isFinite(ball.z)&&Number.isFinite(ball.vx)&&Number.isFinite(ball.vz));
 assert.ok(isBallFree(ball.x,ball.z,.205-1e-3,options.room,options.obstacles),"Ball crossed furniture or wall");
}
assert.ok(hits>0,"Expected collision with room boundary or obstacle");
assert.ok(Math.hypot(ball.vx,ball.vz)<.12,"Ball should settle under friction");
const wall={x:options.room.maxX-.27,z:2.8,vx:3.2,vz:0};
stepRollingBall(wall,.08,options);
assert.ok(wall.vx<0&&wall.x<=options.room.maxX-.205,"Wall should bounce instead of tunneling");

const v=throwVelocity([{x:0,z:0,time:0},{x:.45,z:.12,time:60},{x:.8,z:.15,time:100}]);
assert.ok(v.speed>0&&v.speed<=4.80001);
const zero=throwVelocity([{x:0,z:0,time:0}]);
assert.equal(zero.speed,0);
let stressSteps=0;
for(let i=0;i<100;i++){
 const x=-4.1+i*8.2/99,z=-2.8+(i*29%101)*5.5/101;
 if(!isBallFree(x,z,.205,options.room,options.obstacles))continue;
 const b={x,z,vx:Math.sin(i*7)*4.5,vz:Math.cos(i*11)*4.5};
 for(let j=0;j<500;j++){
  stepRollingBall(b,1/60,options);stressSteps++;
  assert.ok(isBallFree(b.x,b.z,.204,options.room,options.obstacles),"Ball crossed an obstacle at scenario "+i+" frame "+j);
 }
}
console.log(JSON.stringify({status:"PASS",stroke,collisions:hits,stressSteps,finalBall:ball,wall,throw:v}));
