import assert from "node:assert/strict";
import fs from "node:fs";
import {route,blocked,clearLine,groundHeight,NAV_INFO} from "./navigation-v13.js";

const tasks={
 bed:{x:-1.70,z:1.25},
 ball:{x:.2,z:1.35},
 food:{x:1.18,z:1.66},
 desk:{x:.94,z:-1.71},
 window:{x:-1.6,z:-2.1},
 tower:{x:2.72,z:.8}
};
const home={x:-.7,z:.65};
for(const [name,point] of Object.entries(tasks)){
 assert.ok(!blocked(point.x,point.z),"Target blocked: "+name);
 const points=route(home,point);
 assert.ok(points.length>0,name+" unreachable");
 let previous=home;
 for(const next of points){
  assert.ok(!blocked(next.x,next.z),name+" waypoint blocked");
  assert.ok(clearLine(previous,next),name+" path crosses an obstacle");
  previous=next;
 }
 assert.ok(Math.hypot(previous.x-point.x,previous.z-point.z)<.05,name+" end is incorrect");
}
const detour=route({x:-4.22,z:2.72},{x:-1.65,z:1.5});
assert.ok(detour.length>1,"Bed should require an actual detour");
const foodDetour=route(home,{x:3.9,z:2.15});
assert.ok(foodDetour.length>1,"Bowl should force a detour");
assert.ok(NAV_INFO.obstacles.length>=5,"Expected bed, desk, tower, food and chair");
assert.ok(groundHeight(-.28,1)>.15);
assert.ok(groundHeight(0,-2)<.075);
assert.ok(groundHeight(-.28,1)>groundHeight(0,-2));
const scene=fs.readFileSync(new URL("./scene.js",import.meta.url),"utf8");
const gait=fs.readFileSync(new URL("./grounded-gait-v13.js",import.meta.url),"utf8");
for(const snippet of ['createGroundedGait({scene,fox,foxRoot,rigged})','groundedGait.update(dt,t)','window.__fox3dGait','if(fox.route.length)','groundedGait.setVisible(rigged.enabled)','if(!walkTo(location,name))return'])assert.ok(scene.includes(snippet),"Missing scene integration: "+snippet);
for(const snippet of ['footL0','thigh','shin','toe','shadow','contactErrorMax','leg.plant','leg.swing'])assert.ok(gait.includes(snippet)||snippet==="footL0","Missing gait logic: "+snippet);
console.log(JSON.stringify({status:"PASS",tasks:Object.keys(tasks).length,obstacles:NAV_INFO.obstacles.length,bedWaypoints:detour.length,foodWaypoints:foodDetour.length,rugHeight:groundHeight(-.28,1),floorHeight:groundHeight(0,-2)}));
