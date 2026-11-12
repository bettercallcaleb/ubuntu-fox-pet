import assert from "node:assert/strict";
import fs from "node:fs";
import {headingTo,turnToward,angularDistance,gazeOffset,wrappedOrbit,FOUR_WAY} from "./fox-facing-v16.js";
const home={x:0,z:0};
for(const {name,vector,heading} of FOUR_WAY){
 const actual=headingTo(home,vector);
 assert.ok(angularDistance(actual,heading)<1e-9,"wrong heading "+name);
 let angle=0;
 for(let i=0;i<80;i++)angle=turnToward(angle,heading,.05);
 assert.ok(angularDistance(angle,heading)<1e-7,"failed to turn "+name);
 assert.ok(Math.abs(gazeOffset(angle,home,vector))<1e-7,"wrong gaze "+name);
}
assert.ok(angularDistance(turnToward(Math.PI-.025,-Math.PI+.025,.1),-Math.PI+.025)<1e-7,"boundary wrap failed");
let az=.36;
for(let i=0;i<48;i++)az=wrappedOrbit(az,Math.PI/12);
assert.ok(angularDistance(az,.36)<1e-7,"camera must complete a 720-degree orbit");
let inverse=.36;
for(let i=0;i<48;i++)inverse=wrappedOrbit(inverse,-Math.PI/12);
assert.ok(angularDistance(inverse,.36)<1e-7,"camera must orbit in both directions");
const source=fs.readFileSync(new URL("./scene.js",import.meta.url),"utf8");
const motion=fs.readFileSync(new URL("./living-motion-v14.js",import.meta.url),"utf8");
const index=fs.readFileSync(new URL("./index.html",import.meta.url),"utf8");
for(const str of ["lookAtPoint(point)","setFaceCamera(enabled)","wrappedOrbit(orbit.azimuth,-dx*.006)","if(button===2||(button===0&&shift))","fox.faceAngleTarget=headingTo(fox.pos,point)"]) {
 assert.ok(source.includes(str),"Missing interaction "+str);
}
assert.ok(motion.includes("gazeOffset(fox.orientation,fox.pos,point)"),"Head gaze not connected");
assert.ok(index.includes('id="face"'),"Face Me control missing");
assert.ok(!source.includes("clamp(orbit.azimuth-dx*.006,-1.27,1.2)"),"Camera still restricted");
console.log(JSON.stringify({result:"PASS",cardinalDirections:FOUR_WAY.length,cameraRotationDegrees:720,headTracking:true,faceCameraButton:true,rightClick:true,shiftClick:true}));
