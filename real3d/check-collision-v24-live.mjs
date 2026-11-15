import assert from "node:assert/strict";
const port=Number(process.env.FOX_CDP_PORT||9269);
const page=(await(await fetch("http://127.0.0.1:"+port+"/json/list")).json()).find(p=>p.type==="page"&&p.url.includes("8765"));
assert.ok(page,"FOX Chrome tab missing");
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener("open",r,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const x=JSON.parse(e.data);if(x.method==="Runtime.exceptionThrown")errors.push(x.params.exceptionDetails?.exception?.description||x.params.exceptionDetails.text);const p=pending.get(x.id);if(p){pending.delete(x.id);x.error?p.reject(Error(x.error.message)):p.resolve(x.result)}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
const js=async expr=>{const x=await call("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(x.exceptionDetails)throw Error(JSON.stringify(x.exceptionDetails));return x.result.value};
const sleep=t=>new Promise(r=>setTimeout(r,t));
await call("Runtime.enable");await call("Page.reload",{ignoreCache:true});
let ready=false;
for(let i=0;i<55;i++){ready=await js("Boolean(window.__fox3d?.rigged.ready&&window.__fox3dCollision&&window.__fox3dNavigation)");if(ready)break;await sleep(200)}
assert.ok(ready,"FOX renderer and collision runtime did not load");
const taskNames=["bed","food","desk","window","tower","ball"];
const results=[];
for(const taskName of taskNames){
 const result=await js(`(()=>{
 const api=window.__fox3d,c=window.__fox3dCollision,V=api.fox.pos.constructor;
 api.state.wander=false;api.setFaceCamera(false);api.state.paused=true;api.fox.target=null;api.fox.route=[];api.fox.action="idle";
 api.fox.pos.set(-.7,0,.65);api.fox.orientation=0;api.fox.root.rotation.y=0;api.fox.root.position.copy(api.fox.pos);window.__fox3dGait.snap();
 const goal=api.task("${taskName}");
 api.state.paused=true;
 const samples=480;let violations=0,first=-1,maxSpeed=0,wasWalking=false,arrived=false;
 for(let j=0;j<samples;j++){
  api.updateFox(1/60,1+j/60);
  if(!c.valid()){violations++;if(first<0)first=j}
  if(api.fox.isWalking)wasWalking=true;
  if(!api.fox.target&&!api.fox.route.length){arrived=true;break;}
 }
 return{name:"${taskName}",arrived,wasWalking,violations,first,position:api.fox.pos.toArray(),heading:api.fox.orientation,action:api.fox.action,contacts:c.state.contacts,recoveries:c.state.recoveries,blocks:c.state.blocks,replans:c.state.replans};
 })()`);
 assert.equal(result.violations,0,"Body clipped during "+taskName);
 assert.ok(result.wasWalking,"FOX did not approach "+taskName);
 results.push(result);
}
const random=await js(`(()=>{
 const a=window.__fox3d,c=window.__fox3dCollision,V=a.fox.pos.constructor;
 a.fox.pos.set(-.7,0,.65);a.fox.orientation=0;a.fox.root.position.copy(a.fox.pos);a.fox.root.rotation.y=0;window.__fox3dGait.snap();
 let samples=0,violations=0,motions=0,successes=0;
 for(let k=0;k<80;k++){
  const x=-4.0+8.0*((k*73)%83)/82,z=-2.65+5.25*((k*47)%79)/78;
  if(a.walkTo(new V(x,0,z))){successes++;}
  for(let i=0;i<150;i++){
   a.updateFox(1/60,k*3+i/60);samples++;
   if(!c.valid())violations++;
   if(a.fox.isWalking)motions++;
  }
 }
 return{samples,violations,motions,successes,contacts:c.state.contacts,recoveries:c.state.recoveries,blocks:c.state.blocks,replans:c.state.replans,position:a.fox.pos.toArray()};
})()`);
const forced=await js(`(()=>{
 const a=window.__fox3d,c=window.__fox3dCollision,V=a.fox.pos.constructor;
 a.fox.target=new V(2.1,0,-.86);a.fox.route=[];
 a.fox.pos.set(0,0,-.80);a.fox.orientation=0;
 a.fox.root.position.copy(a.fox.pos);a.fox.root.rotation.y=0;
 window.__fox3dGait.snap();
 let violations=0;
 const before=c.state.contacts;
 for(let i=0;i<300;i++){
  a.updateFox(1/60,300+i/60);
  if(!c.valid())violations++;
 }
 const stopped=[a.fox.pos.x,a.fox.pos.z],contacts=c.state.contacts-before;
 a.fox.target=null;a.fox.route=[];a.fox.action="idle";
 a.fox.pos.set(-3.25,0,1.4);a.fox.orientation=0;
 a.fox.root.position.copy(a.fox.pos);a.fox.root.rotation.y=0;
 const recoveryBefore=c.state.recoveries;
 a.updateFox(1/60,400);
 return{violations,stopped,contacts,recovery:c.state.recoveries-recoveryBefore,recoveredPosition:a.fox.pos.toArray(),validAfterRecovery:c.valid()};
})()`);
assert.equal(forced.violations,0,"Forced collision crossed chair");
assert.ok(forced.contacts>0,"Expected active contact blocking");
assert.ok(forced.recovery>0&&forced.validAfterRecovery,"Failed to recover embedded fox");
assert.equal(random.violations,0,"Unscripted sequence intersects furniture");
assert.equal(errors.length,0,"JavaScript runtime exceptions");
ws.close();
console.log(JSON.stringify({status:"PASS",tasks:results,random,forced,exceptions:errors.length}));
