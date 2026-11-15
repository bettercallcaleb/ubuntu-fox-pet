import assert from "node:assert/strict";

const port=Number(process.env.FOX_CDP_PORT||9262);
const pages=await(await fetch("http://127.0.0.1:"+port+"/json/list")).json();
const page=pages.find(p=>p.type==="page"&&p.url.includes("8765"));
assert.ok(page,"Desktop fox tab not found");
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener("open",r,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.addEventListener("message",event=>{
 const message=JSON.parse(event.data);
 if(message.method==="Runtime.exceptionThrown")errors.push(message.params.exceptionDetails.text);
 const p=pending.get(message.id);
 if(p){pending.delete(message.id);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);}
});
const call=(method,params={})=>new Promise((resolve,reject)=>{
 const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));
});
const js=async expression=>{
 const r=await call("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
 return r.result.value;
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mouse=(type,x,y,buttons,button="left")=>call("Input.dispatchMouseEvent",{type,x,y,button,buttons,clickCount:type==="mousePressed"||type==="mouseReleased"?1:0});
await call("Runtime.enable");
let ready=false;
for(let i=0;i<45;i++){
 ready=await js("Boolean(window.__fox3dReady&&window.__fox3d.rigged.ready&&window.__fox3dInteraction)");
 if(ready)break;
 await sleep(300);
}
assert.ok(ready,"Fox did not load");
await js("(()=>{const f=window.__fox3d;f.state.paused=false;f.state.wander=false;f.setFaceCamera(false);f.fox.target=null;f.fox.route=[];f.fox.action='idle';f.fox.faceAngleTarget=null;f.fox.pos.set(-.7,0,.65);f.fox.root.position.copy(f.fox.pos);f.fox.orientation=0;f.fox.root.rotation.y=0;document.querySelector('#wander').classList.remove('active');f.orbit.radius=11.6;f.orbit.focus.set(0,1.55,-.35);f.updateCamera();return true})()");
await sleep(180);
const coords=async kind=>js(`(()=>{
 const f=window.__fox3d, V=f.fox.pos.constructor;
 const target=${kind==="fox"?"f.fox.root.localToWorld(new V(.14,1,0))":"window.__fox3dInteraction.ball.getWorldPosition(new V())"};
 const p=target.project(f.camera),r=f.renderer.domElement.getBoundingClientRect();
 return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
})()`);
const before=await js("({bond:window.__fox3d.state.bond,joy:window.__fox3d.state.joy})");
const fox=await coords("fox");
await mouse("mouseMoved",fox.x,fox.y,0);
await mouse("mousePressed",fox.x,fox.y,1);
for(let i=1;i<=6;i++){
 await sleep(52);
 await mouse("mouseMoved",fox.x+Math.sin(i/6*Math.PI)*26,fox.y-(i/6)*48,1);
}
await mouse("mouseReleased",fox.x,fox.y-48,0);
await sleep(130);
const afterPet=await js("({bond:window.__fox3d.state.bond,joy:window.__fox3d.state.joy,action:window.__fox3d.fox.action})");
assert.ok(afterPet.bond>before.bond&&afterPet.joy>before.joy,"Petting did not register");
const ball=await coords("ball");
const destination=await js(`(()=>{const f=window.__fox3d,V=f.fox.pos.constructor,p=new V(.83,.36,1.28).project(f.camera),r=f.renderer.domElement.getBoundingClientRect();return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2}})()`);
await mouse("mouseMoved",ball.x,ball.y,0);
await mouse("mousePressed",ball.x,ball.y,1);
for(let i=1;i<=6;i++){
 await sleep(35);
 await mouse("mouseMoved",ball.x+(destination.x-ball.x)*i/6,ball.y+(destination.y-ball.y)*i/6,1);
}
await mouse("mouseReleased",destination.x,destination.y,0);
await sleep(140);
const afterThrow=await js("({ball:window.__fox3dInteraction.ball.position.toArray(),speed:window.__fox3d.state.ballVelocity.length(),fetch:window.__fox3dInteraction.fetchSession.active,mode:window.__fox3d.fox.action})");
assert.ok(afterThrow.speed>.15,"Dragged ball was not thrown");
assert.ok(afterThrow.fetch,"Fetch interaction did not start");
const foxBefore=await js("window.__fox3d.fox.pos.toArray()");
await sleep(2100);
const foxAfter=await js("window.__fox3d.fox.pos.toArray()");
const movement=Math.hypot(foxAfter[0]-foxBefore[0],foxAfter[2]-foxBefore[2]);
const final=await js("({fps:window.__fox3d.state.fps,renderer:window.__fox3d.gpuName,fetch:window.__fox3dInteraction.fetchSession,ball:window.__fox3dInteraction.ball.position.toArray(),fox:window.__fox3d.fox.pos.toArray(),counter:document.querySelector('#fr').textContent})");
assert.ok(movement>.05||final.fetch.contacts>0,"Fox did not chase or reach the ball");
assert.deepEqual(errors,[],"Uncaught JavaScript errors");
ws.close();
console.log(JSON.stringify({status:"PASS",pet:afterPet,throw:afterThrow,movement,final,errors:errors.length}));
