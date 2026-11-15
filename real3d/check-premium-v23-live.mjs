import assert from "node:assert/strict";
import fs from "node:fs/promises";

const port=process.env.FOX_CDP_PORT||9268;
const target=(await(await fetch("http://127.0.0.1:"+port+"/json/list")).json()).find(p=>p.type==="page"&&p.url.includes(":8765/"));
assert.ok(target,"FOX browser not found");
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener("open",r,{once:true}));
let id=0;const pending=new Map(),exceptions=[];
ws.onmessage=e=>{
 const data=JSON.parse(e.data);
 if(data.method==="Runtime.exceptionThrown")exceptions.push(data.params.exceptionDetails?.exception?.description||data.params.exceptionDetails?.text);
 const job=pending.get(data.id);
 if(job){pending.delete(data.id);data.error?job.reject(Error(data.error.message)):job.resolve(data.result)}
};
const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
const evaluate=async expression=>{const result=await call("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result?.value};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await call("Runtime.enable");
await call("Page.reload",{ignoreCache:true});
let ready=false;
for(let i=0;i<70;i++){
 ready=await evaluate("Boolean(window.__fox3d?.rigged.ready && window.__fox3dPremium?.available())");
 if(ready)break;
 await sleep(250);
}
assert.ok(ready,"Premium candidate not available");
const initial=await evaluate("({variant:window.__fox3d.rigged.variant,premiumButton:!document.querySelector('#premium').hidden})");
assert.equal(initial.variant,"realistic");
assert.ok(initial.premiumButton);
await evaluate("window.__fox3dPremium.load()");
for(let i=0;i<70;i++){
 if(await evaluate("window.__fox3d.rigged.variant==='premium' && !window.__fox3d.rigged.loading"))break;
 await sleep(250);
}
const premium=await evaluate("({variant:window.__fox3d.rigged.variant,info:window.__fox3dPremium.diagnostics(),bones:window.__fox3d.rigged.boneCount,clips:window.__fox3d.rigged.names,rig:window.__fox3dRig})");
assert.equal(premium.variant,"premium","Premium model did not load");
assert.ok(premium.info.ok&&premium.bones>=12);
await evaluate("(()=>{const f=window.__fox3d;f.state.wander=false;f.state.paused=false;f.setFaceCamera(false);f.fox.target=null;f.fox.route=[];f.fox.action='idle';return f.walkTo(f.fox.pos.clone().add(new f.fox.pos.constructor(.8,0,0)))})()");
await sleep(450);
const walking=await evaluate("({state:window.__fox3dPremium.diagnostics()?.activeKind,action:window.__fox3dPremium.diagnostics()?.activeName,position:window.__fox3d.fox.pos.toArray(),fps:document.querySelector('#fr')?.textContent})");
assert.equal(walking.state,"walk");
await sleep(1150);
const moved=await evaluate("({position:window.__fox3d.fox.pos.toArray(),state:window.__fox3dPremium.diagnostics()?.activeKind,transitions:window.__fox3dPremium.diagnostics()?.transitions,fps:document.querySelector('#fr')?.textContent})");
assert.ok(Math.hypot(moved.position[0]-walking.position[0],moved.position[2]-walking.position[2])>.15);
const screenshot=await call("Page.captureScreenshot",{format:"png"});
await fs.writeFile("/home/didiao1573/chatgpt-workspace/ubuntu-fox-pet-research/fox-v23-premium-surrogate.png",Buffer.from(screenshot.data,"base64"));
await evaluate("document.querySelector('#premium').click()");
for(let i=0;i<65;i++){if(await evaluate("window.__fox3d.rigged.variant==='realistic' && !window.__fox3d.rigged.loading"))break;await sleep(250)}
const fallback=await evaluate("({variant:window.__fox3d.rigged.variant,rig:window.__fox3dRig,paused:window.__fox3d.state.paused})");
assert.equal(fallback.variant,"realistic");
assert.equal(fallback.rig.bones,29);
assert.deepEqual(exceptions,[]);
ws.close();
console.log(JSON.stringify({status:"PASS",initial,premium:{bones:premium.bones,clips:premium.clips,clipMap:premium.info.semantic,active:premium.info.activeKind},walking,moved,fallback,exceptions:exceptions.length}));
