import fs from "node:fs";
import assert from "node:assert/strict";

const base=new URL(".",import.meta.url);
const read=p=>fs.readFileSync(new URL(p,base));
const txt=p=>read(p).toString("utf8");
const media=["4090-human-4dgs.mp4","4090-cat-cycles-4d.mp4","4090-panthera-optix.png","human-4dgs.png","cat-4dgs.png","gpu-telemetry.png","rtx4090-showcase.jpg"];
for(const name of media){
 const file=read("media/"+name);
 assert.ok(file.length>50000,name);
 if(name.endsWith(".mp4"))assert.equal(file.toString("ascii",4,8),"ftyp",name);
 if(name.endsWith(".png"))assert.equal(file.toString("hex",0,8),"89504e470d0a1a0a",name);
 if(name.endsWith(".jpg"))assert.equal(file.toString("hex",0,3),"ffd8ff",name);
}
const proof=JSON.parse(txt("provenance.json"));
assert.equal(proof.hardware.gpu,"NVIDIA GeForce RTX 4090");
assert.equal(proof.dynamic_humans.frames,120);
assert.equal(proof.dynamic_cat.frames,80);
assert.equal(proof.dynamic_cat.gpu4090_peak_util_pct,100);
assert.equal(proof.dynamic_humans.gpu4090_peak_util_pct,98);
const html=txt("index.html");
for(const name of media.slice(0,5))assert.ok(html.includes(name),name);
for(const key of ["data-demo=\"human\"","data-demo=\"cat\"","data-demo=\"fur\""])assert.ok(html.includes(key),key);
for(const name of ["README.md","launch.sh","install.sh","reproduce.sh","scripts/render_4d_movie.py","scripts/render_fur.py"])assert.ok(fs.existsSync(new URL(name,base)),name);
const parent=txt("../index.html");
const scene=txt("../scene.js");
assert.ok(parent.includes('id="cinema"'));
assert.ok(scene.includes('$("cinema").addEventListener'));
console.log("RTX4090_GALLERY_CHECKS_OK",JSON.stringify({media:media.length,bytes:media.reduce((s,m)=>s+read("media/"+m).length,0),demoButtons:3}));
