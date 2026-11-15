import assert from "node:assert/strict";
const port=process.env.FOX_CDP_PORT||9264;
const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==="page"&&p.url.includes(process.env.FOX_PAGE_PORT||"8765"));
assert.ok(page,"Fox browser tab unavailable");
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener("open",r,{once:true}));
const pending=new Map(),errors=[];let seq=0;
ws.onmessage=e=>{const x=JSON.parse(e.data);if(x.method==="Runtime.exceptionThrown")errors.push(x.params.exceptionDetails.text);const p=pending.get(x.id);if(p){pending.delete(x.id);x.error?p.reject(Error(x.error.message)):p.resolve(x.result)}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
const evaluate=async expression=>{const result=await call("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result?.value};
await call("Runtime.enable");
await call("Page.reload",{ignoreCache:true});
let ready=false;
for(let i=0;i<50;i++){ready=await evaluate("Boolean(window.__fox3dRig?.variant==='realistic'&&window.__fox3d?.rigged.ready&&window.__fox3dGait.diagnostics().ready)");if(ready)break;await new Promise(r=>setTimeout(r,200))}
assert.ok(ready,"Realistic fox did not initialize");
const tests=[
 {name:"east",start:[-1,.8],end:[.5,.8]},
 {name:"west",start:[.5,.8],end:[-1,.8]},
 {name:"north",start:[-.7,.75],end:[-.7,-.55]},
 {name:"south",start:[-.7,-.55],end:[-.7,.75]}
];
const results=[];
for(const test of tests){
 const data=await evaluate(`(()=>{
  const f=window.__fox3d,g=window.__fox3dGait,V=f.fox.pos.constructor;
  f.state.paused=true;f.state.wander=false;f.setFaceCamera(false);
  f.fox.target=null;f.fox.route=[];f.fox.action='idle';f.fox.faceAngleTarget=null;
  f.fox.pos.set(${test.start[0]},0,${test.start[1]});f.fox.phase=0;f.fox.speed=0;
  f.fox.orientation=Math.atan2(-((${test.end[1]})-(${test.start[1]})),((${test.end[0]})-(${test.start[0]})));
  f.fox.root.rotation.y=f.fox.orientation;f.fox.root.position.copy(f.fox.pos);
  g.snap();f.walkTo(new V(${test.end[0]},0,${test.end[1]}));
  let maxAngle=0,maxError=0,supportSum=0,supportN=0,maxSwing=0;
  for(let i=0;i<260;i++){
   f.updateFox(1/60,i/60);
   const d=g.diagnostics();
   maxSwing=Math.max(maxSwing,d.legs.filter(x=>x.swing).length);
   for(const leg of d.legs){
    if(!leg.swing&&f.fox.isWalking){supportSum+=leg.error;supportN++;maxError=Math.max(maxError,leg.error);}
   }
   for(const n of ['L0','R0','L1','R1']){
    const bones=f.rigged.bones;
    const hip=bones.get('thigh'+n).getWorldPosition(new V()),knee=bones.get('shin'+n).getWorldPosition(new V()),ankle=bones.get('foot'+n).getWorldPosition(new V());
    const a=hip.sub(knee).normalize(),b=ankle.sub(knee).normalize();
    const ang=Math.acos(Math.max(-1,Math.min(1,a.dot(b))))*180/Math.PI;
    maxAngle=Math.max(maxAngle,ang);
   }
  }
  return{destination:${JSON.stringify(test.end)},position:[f.fox.pos.x,f.fox.pos.z],maxAngle,maxError,meanError:supportSum/Math.max(1,supportN),maxSwing,legs:g.diagnostics().legs.length};
 })()`);
 results.push({name:test.name,...data});
 assert.ok(data.legs===4,"Missing legs "+test.name);
 assert.ok(data.maxAngle<174,"Overextended knee "+test.name+" "+data.maxAngle);
 assert.ok(data.maxSwing<=2,"Too many legs swinging "+test.name);
 assert.ok(data.meanError<.03,"Planted paws sliding "+test.name+" "+data.meanError);
 assert.ok(data.maxError<.14,"Excessive foot mismatch "+test.name+" "+data.maxError);
 assert.ok(Math.hypot(test.end[0]-data.position[0],test.end[1]-data.position[1])<.12,"Did not reach destination "+test.name);
}
const repose=await evaluate(`(()=>{
 const f=window.__fox3d,g=window.__fox3dGait,V=f.fox.pos.constructor;
 f.fox.target=null;f.fox.route=[];f.fox.action='sleep';f.fox.faceAngleTarget=null;
 for(let i=0;i<180;i++)f.updateFox(1/60,5+i/60);
 const sleep=g.diagnostics().secondaryMotion.posture;
 f.fox.action='idle';
 for(let i=0;i<180;i++)f.updateFox(1/60,9+i/60);
 const idle=g.diagnostics().secondaryMotion.posture;
 f.fox.faceAngleTarget=f.fox.orientation+Math.PI;
 let turnError=0;
 for(let i=0;i<180;i++){f.updateFox(1/60,13+i/60);turnError=Math.max(turnError,g.diagnostics().contactErrorMax)}
 return{sleep:sleep.lie,idle:idle.lie,turnError,orientation:f.fox.orientation,fps:document.querySelector('#fr')?.textContent};
})()`);
assert.ok(repose.sleep>.8&&repose.idle<.1,"Unable to transition from sleeping to standing");
assert.ok(repose.turnError<.15,"Turning contact instability");
assert.deepEqual(errors,[],"Browser errors occurred");
console.log(JSON.stringify({status:"PASS",directions:results,posture:repose,exceptions:errors.length}));
ws.close();
