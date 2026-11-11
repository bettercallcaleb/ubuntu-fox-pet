import fs from "node:fs/promises";
import path from "node:path";

const host="http://127.0.0.1:"+(process.env.FOX_CDP_PORT||9222);
const shotsDir=process.env.FOX_CAPTURE_DIR||path.join(import.meta.dirname,"docs");
await fs.mkdir(shotsDir,{recursive:true});
const v=await (await fetch(host+"/json/version")).json();
const browser=new WebSocket(v.webSocketDebuggerUrl);
await new Promise(r=>browser.addEventListener("open",r,{once:true}));
let id=0;
const pending=new Map();
function request(ws,method,params={}){
 return new Promise((resolve,reject)=>{
  const i=++id;
  pending.set(ws===browser?"b"+i:"p"+i,{resolve,reject});
  ws.send(JSON.stringify({id:i,method,params}));
 });
}
function onMessage(ws,label,event){
 const d=JSON.parse(event.data);
 if(d.id){
  const x=pending.get(label+d.id);
  if(x){pending.delete(label+d.id);d.error?x.reject(Error(JSON.stringify(d.error))):x.resolve(d.result);}
 }
 if(d.method==="Runtime.exceptionThrown"&&label==="p"){
  const err=d.params.exceptionDetails?.exception?.description||d.params.exceptionDetails?.text;
  errors.push(err);
 }
}
const errors=[];
browser.onmessage=e=>onMessage(browser,"b",e);
const pages=await (await fetch(host+"/json/list")).json();
const pg=pages.find(x=>x.type==="page"&&x.url==="http://127.0.0.1:8765/");
const targetId=pg.id;
if(!pg)throw Error("created page not found");
const page=new WebSocket(pg.webSocketDebuggerUrl);
await new Promise(r=>page.addEventListener("open",r,{once:true}));
page.onmessage=e=>onMessage(page,"p",e);
await request(page,"Runtime.enable");
await request(page,"Page.enable");
await request(page,"Page.reload",{ignoreCache:true});
async function evalJS(expression){
 const x=await request(page,"Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
 if(x.exceptionDetails)throw Error(JSON.stringify(x.exceptionDetails));
 return x.result?.value;
}
async function screenshot(dest){
 const x=await request(page,"Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
 await fs.writeFile(dest,Buffer.from(x.data,"base64"));
}
try{
 let ready=false;
 for(let i=0;i<70;i++){
  ready=await evalJS("Boolean(window.__fox3dReady&&window.__fox3dRig?.variant==='realistic')");
  if(ready)break;
  await new Promise(r=>setTimeout(r,300));
 }
 if(!ready)throw Error("scene not ready "+JSON.stringify(await evalJS("({ready:window.__fox3dReady,rig:window.__fox3dRig,status:document.getElementById('status')?.textContent})"))+" ERRORS "+JSON.stringify(errors));
 await evalJS("(()=>{const f=window.__fox3d;f.state.paused=false;f.state.wander=false;f.fox.target=null;f.fox.route=[];f.fox.action='idle';return true})()");
 await new Promise(r=>setTimeout(r,2500));
 const idle=await evalJS("({rig:window.__fox3dRig,gait:window.__fox3dGait.diagnostics(),fps:document.querySelector('#fr')?.textContent,draw:window.__fox3d.renderer.info.render.calls})");
 await screenshot(path.join(shotsDir,"v14-living-fox-idle.png"));
 await evalJS("(()=>{const f=window.__fox3d;f.walkTo(new f.fox.pos.constructor(1.16,0,1.65));return true})()");
 await new Promise(r=>setTimeout(r,1500));
 const walking=await evalJS("({moving:window.__fox3d.fox.isWalking,gait:window.__fox3dGait.diagnostics(),fps:document.querySelector('#fr')?.textContent})");
 await screenshot(path.join(shotsDir,"v14-living-fox-walk.png"));
 await evalJS("(()=>{const f=window.__fox3d;f.fox.target=null;f.fox.route=[];f.fox.action='play';f.fox.actionTime=performance.now()/1000;return true})()");
 await new Promise(r=>setTimeout(r,550));
 const play=await evalJS("({motion:window.__fox3dGait.diagnostics().secondaryMotion,tail:window.__fox3dGait.diagnostics().secondaryMotion.tailSwing})");
 await screenshot(path.join(shotsDir,"v14-living-fox-play.png"));
 const result={status:"PASS",idle:{rig:idle.rig,gait:idle.gait.ready,furStrands:idle.rig.furStrands,fps:idle.fps,draw:idle.draw,motion:idle.gait.secondaryMotion},walking:{moving:walking.moving,contactErrorMean:walking.gait.contactErrorMean,contactErrorMax:walking.gait.contactErrorMax,amplitude:walking.gait.amplitude,fps:walking.fps,motion:walking.gait.secondaryMotion},play,errors};
 console.log(JSON.stringify(result,null,2));
 if(errors.length||!idle.rig.furStrands||!walking.moving||walking.gait.contactErrorMax>1)process.exitCode=1;
}finally{

 page.close();browser.close();
}
