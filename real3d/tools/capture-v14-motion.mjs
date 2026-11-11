import fs from "node:fs/promises";
import path from "node:path";

const port=process.env.FOX_CDP_PORT||9222;
const out=process.env.FOX_FRAMES||"/tmp/fox-v14-motion-frames";
await fs.mkdir(out,{recursive:true});
const pageInfo=(await(await fetch("http://127.0.0.1:"+port+"/json/list")).json()).find(p=>p.type==="page"&&p.url.includes("8765"));
if(!pageInfo)throw Error("Fox demo browser is not open");
const ws=new WebSocket(pageInfo.webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map();
ws.onmessage=e=>{const r=JSON.parse(e.data);const p=pending.get(r.id);if(p){pending.delete(r.id);r.error?p.reject(r.error):p.resolve(r.result)}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}))});
const evalJS=async expression=>{
 const r=await call("Runtime.evaluate",{expression,returnByValue:true});
 if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
 return r.result?.value;
};
await call("Page.enable");
await evalJS("(()=>{const f=window.__fox3d;f.state.paused=false;f.state.wander=false;f.fox.pos.set(-.7,0,.65);f.fox.target=null;f.fox.route=[];f.fox.action='idle';return true})()");
const fps=10;
const frames=75;
for(let k=0;k<frames;k++){
 if(k===18)await evalJS("(()=>{const f=window.__fox3d;return f.walkTo(new f.fox.pos.constructor(1.18,0,1.68),'food')})()");
 if(k===47)await evalJS("(()=>{const f=window.__fox3d;f.fox.target=null;f.fox.route=[];f.fox.action='play';f.fox.actionTime=performance.now()/1000;return true})()");
 const img=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
 await fs.writeFile(path.join(out,"frame_"+String(k).padStart(4,"0")+".png"),Buffer.from(img.data,"base64"));
 await new Promise(r=>setTimeout(r,65));
}
ws.close();
console.log(JSON.stringify({frames,videoFps:fps,out}));
