import fs from "node:fs";
import path from "node:path";
import {mapPremiumAnimations} from "../premium-fox-v23.js";

const file=process.argv[2];
if(!file||!fs.existsSync(file)){console.error("Usage: node tools/verify-premium-fox.mjs /path/to/fox.glb");process.exit(2);}
const input=fs.readFileSync(file);
if(input.length<100||input.toString("ascii",0,4)!=="glTF"||input.readUInt32LE(4)!==2)throw Error("Expected glTF 2.0 binary (.glb)");
if(input.readUInt32LE(8)!==input.length)throw Error("GLB byte length mismatch");
const length=input.readUInt32LE(12),type=input.readUInt32LE(16);
if(type!==0x4e4f534a||length+20>input.length)throw Error("Missing or invalid JSON chunk");
const data=JSON.parse(input.subarray(20,20+length).toString("utf8"));
const clips=(data.animations||[]).map(x=>({name:x.name||""}));
const semantic=mapPremiumAnimations(clips);
const skins=data.skins||[];
const bones=Math.max(0,...skins.map(x=>x.joints?.length||0));
const meshCount=(data.meshes||[]).length;
const summary={file:path.basename(file),bytes:input.length,skins:skins.length,bones,meshes:meshCount,animations:clips.length,semantic,clipNames:clips.map(x=>x.name).slice(0,150)};
const fail=[];
if(!skins.length||bones<12)fail.push("Not an articulated fox (requires 12+ skinned joints)");
if(!semantic.walk)fail.push("No walk animation");
if(!semantic.idle)fail.push("No idle animation");
if(!meshCount)fail.push("No mesh");
console.log(JSON.stringify({...summary,valid:!fail.length,issues:fail},null,2));
if(fail.length)process.exitCode=1;
