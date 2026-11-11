import {readFileSync,statSync} from "node:fs";
import assert from "node:assert/strict";

function parseGlb(name){
 const file=readFileSync(new URL("./assets/"+name,import.meta.url));
 assert.equal(file.toString("utf8",0,4),"glTF");
 const length=file.readUInt32LE(12);
 assert.equal(file.toString("utf8",16,20),"JSON");
 return JSON.parse(file.toString("utf8",20,20+length));
}
function check(name,bones,animations){
 const model=parseGlb(name);
 const names=(model.animations||[]).map(x=>x.name);
 for(const animation of animations)assert.ok(names.includes(animation),name+": "+animation);
 assert.equal(model.skins?.[0]?.joints?.length,bones);
 assert.equal(model.meshes?.length,1);
 return {asset:name,bones,animations:names,meshes:model.meshes.length};
}
const classic=check("Fox.glb",24,["Survey","Walk","Run"]);
const enhanced=check("Fox_Enhanced.glb",29,["Look around","Tail wag","Walk"]);
const realistic=check("Fox_Realistic_Rigged.glb",29,["Look around","Tail wag","Walk"]);
const realisticRaw=parseGlb("Fox_Realistic_Rigged.glb");
const realisticVertices=realisticRaw.accessors[realisticRaw.meshes[0].primitives[0].attributes.POSITION].count;
assert.ok(realisticVertices>250000,"Realistic fox must retain high-detail fur geometry");

const enhancedRaw=parseGlb("Fox_Enhanced.glb");
const vertices=enhancedRaw.accessors[enhancedRaw.meshes[0].primitives[0].attributes.POSITION].count;
assert.ok(vertices>40000,"Enhanced fox must retain high-detail mesh");
for(const prefix of ["WoodFloor051","Plaster001","Fabric030","Carpet011","Leather037"]){
 for(const map of ["Color","NormalGL","Roughness"]){
  const filename="./assets/textures/"+prefix+"_"+map+".jpg";
  assert.ok(statSync(new URL(filename,import.meta.url)).size>100000,filename);
 }
}
const sceneSource=readFileSync(new URL("./scene.js",import.meta.url),"utf8");
const roomSource=readFileSync(new URL("./room-v8.js",import.meta.url),"utf8");
assert.ok(sceneSource.includes("installPremiumRoom")&&sceneSource.includes("premiumRoom.update(t)"));
for(const required of ["bed","desk","chair","tower","rug","Fabric030","Carpet011","Leather037"]){
 assert.ok(roomSource.includes(required),required);
}
const attribution=readFileSync(new URL("./assets/CREDITS.md",import.meta.url),"utf8");
assert.ok(attribution.includes("Bake3D")&&attribution.includes("ambientCG"));
console.log(JSON.stringify({classic,enhanced,realistic,realisticVertices,materials:"15 PBR maps",licenseAttribution:true}));
