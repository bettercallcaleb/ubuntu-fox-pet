import assert from "node:assert/strict";
import {updateTurnContact} from "./turn-contact-v17.js";

const configs=[
 {name:"front-left",x:.43,z:.22},
 {name:"front-right",x:.43,z:-.22},
 {name:"hind-left",x:-.45,z:.21},
 {name:"hind-right",x:-.45,z:-.21}
];
const ground=(x,z)=>Math.abs(x)<.6&&Math.abs(z)<.6?.15:.05;
function point(x,z){
 return{x,y:0,z,copy(other){this.x=other.x;this.y=other.y;this.z=other.z;return this}};
}
function run(rate,sign){
 const legs=configs.map(c=>{
  const start=point(c.x,c.z);start.y=ground(start.x,start.z)+.02;
  return{name:c.name,...c,plant:start,target:point(c.x,c.z),swing:true};
 });
 let maxOffset=0,maxError=0,maxHeight=0,maxWrongSide=0;
 const steps=Math.ceil(rate*2.75);
 for(let n=1;n<=steps;n++){
  const yaw=sign*2*Math.PI*n/steps,c=Math.cos(yaw),s=Math.sin(yaw);
  for(const leg of legs){
   const home=point(c*leg.x+s*leg.z,-s*leg.x+c*leg.z);
   const error=updateTurnContact(leg,home,1/rate,n/steps,ground);
   maxError=Math.max(maxError,error);
   assert.equal(leg.swing,false);
   assert.ok(leg.target.y>=ground(leg.target.x,leg.target.z)+.02-1e-6);
   assert.ok(leg.target.y<=ground(leg.target.x,leg.target.z)+.047+1e-6);
   const localZ=s*leg.plant.x+c*leg.plant.z;
   if(Math.sign(localZ)!==Math.sign(leg.z))maxWrongSide++;
   maxOffset=Math.max(maxOffset,Math.abs(localZ-leg.z));
   maxHeight=Math.max(maxHeight,leg.target.y);
  }
 }
 assert.equal(maxWrongSide,0,"One or more feet crossed the body's midline");
 assert.ok(maxError<.12,"Stance target moved too far from the rotating hip: "+maxError);
 assert.ok(maxOffset<.1,"Foot sides drifted too far: "+maxOffset);
 return{rate,sign,maxError:+maxError.toFixed(4),maxOffset:+maxOffset.toFixed(4),maxHeight:+maxHeight.toFixed(4)};
}
const trials=[15,30,60,120].flatMap(rate=>[1,-1].map(sign=>run(rate,sign)));
console.log(JSON.stringify({status:"PASS",trials,legs:configs.length,radianSweep:2*Math.PI}));
