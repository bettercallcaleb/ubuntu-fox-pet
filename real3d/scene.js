import * as THREE from "./node_modules/three/build/three.module.js";
import {GLTFLoader} from "./node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import {buildSkinnedFur} from "./fur.js";
import {installPremiumRoom} from "./room-v8.js";

const TAU=Math.PI*2;
const scene=new THREE.Scene();
scene.background=new THREE.Color("#17141d");
scene.fog=new THREE.FogExp2("#382b2e",.018);
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance",alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.10;
document.body.prepend(renderer.domElement);

const $=x=>document.getElementById(x);
const rand=(a=1,b=0)=>b+Math.random()*(a-b);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(x)=>x*x*(3-2*x);
const materials={
 fur:new THREE.MeshStandardMaterial({color:"#bc582a",roughness:.95}),
 furLight:new THREE.MeshStandardMaterial({color:"#d87638",roughness:.96}),
 furDark:new THREE.MeshStandardMaterial({color:"#4a2825",roughness:.91}),
 cream:new THREE.MeshStandardMaterial({color:"#e4ccb0",roughness:.98}),
 creamLight:new THREE.MeshStandardMaterial({color:"#f8ecda",roughness:.93}),
 ear:new THREE.MeshStandardMaterial({color:"#7e4945",roughness:.91,side:THREE.DoubleSide}),
 nose:new THREE.MeshStandardMaterial({color:"#151820",roughness:.35,metalness:.02}),
 eyes:new THREE.MeshPhysicalMaterial({color:"#775329",roughness:.15,clearcoat:1,clearcoatRoughness:.07}),
 black:new THREE.MeshStandardMaterial({color:"#1d2028",roughness:.85}),
 warmwood:new THREE.MeshStandardMaterial({color:"#714731",roughness:.84}),
 darkwood:new THREE.MeshStandardMaterial({color:"#3d2a26",roughness:.85}),
 oak:new THREE.MeshStandardMaterial({color:"#987151",roughness:.89}),
 bronze:new THREE.MeshStandardMaterial({color:"#9e6644",metalness:.7,roughness:.32}),
 stone:new THREE.MeshStandardMaterial({color:"#c1b6a4",roughness:.94}),
 purple:new THREE.MeshStandardMaterial({color:"#573c50",roughness:.96}),
 brass:new THREE.MeshStandardMaterial({color:"#c99a5a",metalness:.78,roughness:.26}),
 linen:new THREE.MeshStandardMaterial({color:"#c5a98b",roughness:1}),
 orange:new THREE.MeshStandardMaterial({color:"#d57d3f",roughness:.87}),
 leaf:new THREE.MeshStandardMaterial({color:"#4b6944",roughness:.91,side:THREE.DoubleSide}),
 floor:new THREE.MeshStandardMaterial({color:"#9c6b49",roughness:.88})
};

function box(parent,x,y,z,w,h,d,mat,cast=true){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
 m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;
}
function sphere(parent,x,y,z,sx,sy,sz,mat,segments=24){
 const m=new THREE.Mesh(new THREE.SphereGeometry(1,segments,Math.max(12,segments>>1)),mat);
 m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function cyl(parent,x,y,z,rb,rt,h,mat,seg=16){
 const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);
 m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function group(parent,x=0,y=0,z=0){
 const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;
}
function woodTexture(base="#8a6246",seed=1){
 let k=seed;const rng=()=>{k=(k*1664525+1013904223)>>>0;return k/4294967296};
 const canvas=document.createElement("canvas");canvas.width=512;canvas.height=512;
 const ctx=canvas.getContext("2d");ctx.fillStyle=base;ctx.fillRect(0,0,512,512);
 for(let j=0;j<1400;j++){
  const y=rng()*512,x=rng()*512,w=rng()*420+25,alpha=rng()*.18+.015;
  ctx.strokeStyle=rng()>.5?"rgba(252,191,127,"+alpha+")":"rgba(50,24,19,"+alpha+")";
  ctx.lineWidth=rng()*2+.2;ctx.beginPath();ctx.moveTo(x,y);
  ctx.bezierCurveTo(x+w*.3,y+rng()*4-2,x+w*.7,y+rng()*5-2,x+w,y+rng()*3-1.5);ctx.stroke();
 }
 for(let i=0;i<15;i++){
  const x=rng()*512,y=rng()*512;
  ctx.strokeStyle="rgba(37,20,14,.13)";ctx.lineWidth=.6;
  ctx.beginPath();ctx.ellipse(x,y,18+rng()*18,3+rng()*8,rng()*.7,0,TAU);ctx.stroke();
 }
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
 return t;
}
const cedar=woodTexture("#78523d",1234),spruce=woodTexture("#ab7d59",2345);
const woodMat=(color,texture)=>new THREE.MeshStandardMaterial({color,map:texture,roughness:.83,metalness:0});
const floorMat=woodMat("#d9c3a9",cedar),oakMat=woodMat("#d2b89c",spruce);
const pbrLoader=new THREE.TextureLoader();
function pbrTexture(file,srgb=false){
 const texture=pbrLoader.load("./assets/textures/"+file);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 if(srgb)texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}
const woodPBR=new THREE.MeshStandardMaterial({
 map:pbrTexture("WoodFloor051_Color.jpg",true),
 normalMap:pbrTexture("WoodFloor051_NormalGL.jpg"),
 roughnessMap:pbrTexture("WoodFloor051_Roughness.jpg"),
 color:"#c5a890",roughness:.86,metalness:0,normalScale:new THREE.Vector2(.33,.33)
});
const plasterPBR=new THREE.MeshStandardMaterial({
 map:pbrTexture("Plaster001_Color.jpg",true),
 normalMap:pbrTexture("Plaster001_NormalGL.jpg"),
 roughnessMap:pbrTexture("Plaster001_Roughness.jpg"),
 color:"#cbb7a6",roughness:.97,metalness:0,normalScale:new THREE.Vector2(.18,.18)
});
const wallMat=plasterPBR;
const fabric=new THREE.MeshStandardMaterial({color:"#774959",roughness:1});
const blanket=new THREE.MeshStandardMaterial({color:"#e0c4a4",roughness:1});
const metal=new THREE.MeshStandardMaterial({color:"#29292c",metalness:.68,roughness:.37});
const grey=new THREE.MeshStandardMaterial({color:"#626b6d",roughness:.82});

scene.add(new THREE.HemisphereLight("#dbebff","#654031",1.05));
const sun=new THREE.DirectionalLight("#fff0d7",2.15);sun.position.set(4.5,9,6.2);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;
sun.shadow.camera.near=.1;sun.shadow.camera.far=28;sun.shadow.bias=-.00025;sun.shadow.normalBias=.025;sun.shadow.radius=3;
scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight("#9badff",.7);fill.position.set(-5,4,1);scene.add(fill);
const lampLight=new THREE.PointLight("#ffc88e",47,7,2);lampLight.position.set(2.55,2.18,-2.85);scene.add(lampLight);
const fairy=new THREE.PointLight("#ffbc81",12,6,2);fairy.position.set(-1,3.7,-2.9);scene.add(fairy);

const habitat=group(scene);
box(habitat,0,-.28,-.25,10.7,.55,8.1,materials.darkwood);
for(let i=0;i<14;i++){
 const z=-4.04+i*.58;box(habitat,0,.015,z,10.53,.08,.565,woodPBR);
}
box(habitat,0,2.3,-4.35,10.7,4.7,.18,wallMat);
box(habitat,-5.27,2.28,-.25,.23,4.7,8.18,wallMat);
box(habitat,5.26,.55,-.25,.15,1.1,8.1,wallMat);
for(const x of [-5.12,-3.4,-.9,1.7,4.95])box(habitat,x,2.3,-4.20,.14,4.58,.19,oakMat);
for(const y of [.12,4.33]){
 box(habitat,0,y,-4.17,10.6,.18,.19,materials.darkwood);
 box(habitat,-5.09,y,-.28,.16,.18,8.1,materials.darkwood);
}
for(const z of [-4.2])box(habitat,0,4.58,z,10.55,.19,.18,materials.warmwood);
box(habitat,0,-.58,3.65,10.8,.37,.23,materials.warmwood);
box(habitat,5.26,-.4,-.23,.27,.38,8.2,materials.warmwood);

const skycanvas=document.createElement("canvas");skycanvas.width=512;skycanvas.height=512;
const sk=skycanvas.getContext("2d");let grad=sk.createLinearGradient(0,0,0,512);
grad.addColorStop(0,"#547498");grad.addColorStop(.48,"#c48a9a");grad.addColorStop(1,"#edb48d");
sk.fillStyle=grad;sk.fillRect(0,0,512,512);
for(let i=0;i<4;i++){
 sk.fillStyle=["#a78b91","#746b80","#5d6578","#485468"][i];
 sk.beginPath();sk.moveTo(-15,512);
 for(let x=-5;x<530;x+=18){const h=306+i*55+44*Math.sin(x*.023+i*.9)+25*Math.sin(x*.08+i);sk.lineTo(x,h)}
 sk.lineTo(530,512);sk.closePath();sk.fill();
}
const skyt=new THREE.CanvasTexture(skycanvas);skyt.colorSpace=THREE.SRGBColorSpace;
const windowGlass=new THREE.Mesh(new THREE.CircleGeometry(.87,48),new THREE.MeshBasicMaterial({map:skyt,side:THREE.DoubleSide}));
windowGlass.position.set(-1.65,2.42,-4.225);habitat.add(windowGlass);
const rim=new THREE.Mesh(new THREE.TorusGeometry(.91,.075,16,64),materials.brass);rim.position.copy(windowGlass.position);rim.position.z+=.04;habitat.add(rim);
for(const a of [0,Math.PI/2]){
 box(habitat,-1.65,2.42,-4.155,a===0?1.77:.065,a===0?.067:1.76,.06,materials.warmwood);
}
const windowGlow=new THREE.PointLight("#fbb9a9",3.0,5,2);windowGlow.position.set(-1.65,2.42,-3.8);scene.add(windowGlow);
function lightbulb(x,z){
 const node=group(habitat,x,4.23,z);
 cyl(node,0,.035,0,.055,.065,.12,materials.brass,10);
 sphere(node,0,-.09,0,.065,.11,.065,new THREE.MeshStandardMaterial({color:"#ffdfae",emissive:"#ffaa57",emissiveIntensity:2.3,roughness:.5}),12);
}
for(let i=0;i<19;i++)lightbulb(-4.65+i*.50,-3.83+.18*Math.sin(i*.36));

const clickables=[];
const targets={
 bed:new THREE.Vector3(-3.25,0,1.25),
 ball:new THREE.Vector3(.2,0,1.35),
 food:new THREE.Vector3(2.4,0,1.58),
 desk:new THREE.Vector3(2.05,0,-.76),
 window:new THREE.Vector3(-1.6,0,-2.1),
 tower:new THREE.Vector3(3.3,0,.8)
};

function interactive(g,task){g.userData.task=task;clickables.push(g);return g}

const bed=interactive(group(habitat,-3.25,0,1.4),"bed");
box(bed,0,.22,0,2.30,.36,1.64,materials.purple);
for(const x of [-1.05,1.05])for(const z of [-.7,.7])box(bed,x,.32,z,.23,.4,.25,fabric);
box(bed,0,.44,0,1.91,.23,1.36,blanket);
for(const z of [-.52,.52])box(bed,-.66,.65,z,.58,.27,.45,materials.cream);
const bedding=sphere(bed,.2,.63,.12,.81,.16,.49,new THREE.MeshStandardMaterial({color:"#8e5361",roughness:.98}),32);
bedding.rotation.y=-.08;
for(let i=0;i<80;i++){
 const x=-1.02+i%20*.106,z=-.51+Math.floor(i/20)*.30;
 cyl(bed,x,.50,z,.007,.008,.013,new THREE.MeshStandardMaterial({color:i%3?"#f1d9b9":"#b68e83",roughness:1}),5);
}
for(let i=0;i<4;i++)box(bed,-1+i*.68,.16,.85,.19,.28,.14,materials.warmwood);

const work=interactive(group(habitat,2.45,0,-2.58),"desk");
for(const x of [-1.08,1.08])for(const z of [-.49,.49])box(work,x,.52,z,.13,1.04,.14,materials.warmwood);
box(work,0,1.09,0,2.44,.16,1.15,oakMat);
box(work,0,.54,-.49,2.14,.68,.13,materials.warmwood);
box(work,-.72,.70,.35,.45,.4,.08,materials.darkwood);
const monitor=group(work,-.05,1.72,-.33);
box(monitor,0,0,0,1.16,.74,.10,metal);
const screen=new THREE.MeshStandardMaterial({color:"#141721",emissive:"#0b1a2b",emissiveIntensity:.85,roughness:.22});
box(monitor,0,0,.065,1.04,.61,.022,screen,false);
const monospace=document.createElement("canvas");monospace.width=400;monospace.height=200;
const terminal=monospace.getContext("2d");terminal.fillStyle="#101722";terminal.fillRect(0,0,400,200);
terminal.fillStyle="#a9dab4";terminal.font="21px monospace";
terminal.fillText("$ fox --watch",27,60);terminal.fillStyle="#90b0d4";
terminal.fillText("> all systems nominal",27,99);
terminal.fillStyle="#cfad87";terminal.fillText(">_ ",27,138);
const terminalTex=new THREE.CanvasTexture(monospace);terminalTex.colorSpace=THREE.SRGBColorSpace;
const overlay=new THREE.Mesh(new THREE.PlaneGeometry(.97,.50),new THREE.MeshBasicMaterial({map:terminalTex,transparent:false,side:THREE.DoubleSide}));
overlay.position.set(0,0,.084);monitor.add(overlay);
box(monitor,0,-.52,-.04,.11,.28,.11,metal);
box(monitor,0,-.65,0,.5,.07,.3,metal);
const keyboard=box(work,.04,1.2,.37,.88,.045,.31,materials.darkwood);
for(let i=0;i<45;i++){
 const px=-.34+(i%9)*.085,pz=.24+Math.floor(i/9)*.055;
 box(work,px,1.227,pz,.064,.012,.042,i%7?grey:materials.brass,false);
}
const chair=group(habitat,2.1,0,-.86);
cyl(chair,0,.38,0,.075,.085,.75,materials.darkwood);
cyl(chair,0,.73,0,.46,.42,.12,materials.purple);
box(chair,0,1.11,-.37,.8,.87,.14,materials.purple);
for(const i of [0,1,2,3,4]){
 const angle=i*TAU/5;
 box(chair,Math.cos(angle)*.33,.06,Math.sin(angle)*.33,.58,.075,.1,materials.darkwood).rotation.y=-angle;
}
const lamp=group(work,.97,1.27,-.34);
cyl(lamp,0,0,0,.18,.14,.09,metal);
cyl(lamp,0,.34,0,.025,.025,.6,materials.brass);
const neck=cyl(lamp,-.16,.65,-.08,.024,.024,.63,materials.brass);neck.rotation.z=-.45;
const shade=new THREE.Mesh(new THREE.CylinderGeometry(.11,.27,.22,16,1,true),new THREE.MeshStandardMaterial({color:"#caa074",emissive:"#ffb276",emissiveIntensity:.52,side:THREE.DoubleSide}));
shade.position.set(-.3,.88,-.13);shade.rotation.z=-.25;lamp.add(shade);
for(let i=0;i<5;i++){
 box(work,.95+i*.077,1.35,-.14,.05,.39-i*.035,.24,new THREE.MeshStandardMaterial({color:["#a06461","#5b4b68","#d5aa7c","#81665c","#847a80"][i],roughness:.9}));
}

const tower=interactive(group(habitat,4.03,0,.56),"tower");
box(tower,0,.14,0,1.61,.23,1.55,materials.warmwood);
for(const [x,z,h] of [[-.5,-.35,2.35],[.52,.25,3.05],[-.45,.55,1.35]]){
 cyl(tower,x,.21+h/2,z,.13,.13,h,materials.linen,14);
 const rope=new THREE.Group();tower.add(rope);
 for(let j=0;j<Math.min(55,h*20);j++){
  const y=.27+j*.051;
  const r=.142;
  const bead=sphere(rope,x+Math.cos(j*.8)*r,y,z+Math.sin(j*.8)*r,.032,.016,.032,materials.oak,8);
 }
}
for(const [x,z,y] of [[-.5,-.3,2.52],[.5,.25,3.28],[-.45,.55,1.58]]){
 box(tower,x,y,z,1.36,.18,1.19,materials.purple);
 box(tower,x,y+.12,z,1.23,.09,1.05,new THREE.MeshStandardMaterial({color:"#a87989",roughness:1}));
}
const catBox=group(tower,.50,1.45,.19);
cyl(catBox,0,0,0,.38,.38,.68,materials.purple,32);
const darkOpening=new THREE.Mesh(new THREE.CircleGeometry(.26,30),new THREE.MeshStandardMaterial({color:"#2d2434",side:THREE.DoubleSide}));
darkOpening.position.set(0,.02,.397);catBox.add(darkOpening);
const catToy=sphere(tower,-.22,2.08,.33,.19,.18,.19,materials.orange);
cyl(tower,-.22,2.35,.33,.012,.012,.41,materials.linen,7);

const food=interactive(group(habitat,2.3,0,1.72),"food");
const bowlMat=new THREE.MeshPhysicalMaterial({color:"#ddd9d1",metalness:.02,roughness:.21,clearcoat:.8});
const outside=new THREE.Mesh(new THREE.LatheGeometry([
 new THREE.Vector2(.08,.08),new THREE.Vector2(.50,.08),new THREE.Vector2(.59,.2),new THREE.Vector2(.57,.32),
 new THREE.Vector2(.49,.34),new THREE.Vector2(.46,.22),new THREE.Vector2(.11,.19)
],36),bowlMat);outside.castShadow=true;outside.receiveShadow=true;food.add(outside);
const kibble=new THREE.MeshStandardMaterial({color:"#8c5a38",roughness:1});
for(let i=0;i<23;i++){
 const theta=i*2.399,r=.08+(i%6)*.075;
 sphere(food,Math.cos(theta)*r,.19+Math.random()*.035,Math.sin(theta)*r,.06,.033,.055,i%4?kibble:materials.oak,10);
}
const ball=interactive(group(habitat,.20,.22,1.35),"ball");
const ballMesh=sphere(ball,0,0,0,.205,.205,.205,materials.orange,32);
const stripes=new THREE.Mesh(new THREE.TorusGeometry(.21,.035,9,32),materials.creamLight);
stripes.rotation.y=Math.PI*.5;ball.add(stripes);
for(const sign of [-1,1]){
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.2,.016,8,32),materials.darkwood);
 ring.rotation.x=sign*Math.PI*.28;ball.add(ring);
}

const rug=group(habitat,-.28,0,1.0);
const rugMat=new THREE.MeshStandardMaterial({color:"#9f624c",roughness:1});
const areaRug=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.25,.055,72),rugMat);
areaRug.scale.set(1,.1,.72);areaRug.position.y=.065;areaRug.receiveShadow=true;rug.add(areaRug);
const rugEdge=new THREE.Mesh(new THREE.TorusGeometry(2.12,.065,8,88),materials.linen);
rugEdge.rotation.x=Math.PI/2;rugEdge.scale.y=.72;rugEdge.position.y=.085;rug.add(rugEdge);

function foliage(x,z){
 const p=group(habitat,x,0,z);
 cyl(p,0,.3,0,.35,.45,.58,materials.stone,12);
 let s=137;
 const rng=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let j=0;j<15;j++){
  let a=rng()*TAU,r=rng()*.55,h=.9+rng()*1.15;
  const stem=cyl(p,Math.cos(a)*r*.25,.58+h*.43,Math.sin(a)*r*.25,.018,.008,h,materials.darkwood,6);
  stem.rotation.z=Math.cos(a)*.3;
  const leaf=sphere(p,Math.cos(a)*r,.58+h,Math.sin(a)*r,.23,.11,.095,materials.leaf,12);
  leaf.rotation.z=Math.cos(a)*.5;leaf.rotation.y=a;
 }
}
foliage(-4.6,2.58);foliage(4.72,-2.92);
for(let i=0;i<7;i++)box(habitat,-3.83+i*.33,2.35,-4.04,.19,.41+Math.sin(i*.8)*.17,.28,i%3===0?materials.purple:oakMat);

const premiumRoom=installPremiumRoom({scene,habitat,bed,work,chair,tower,rug,food,renderer,sun,lampLight,fairy,windowGlass});


const foxRoot=group(scene,0,0,.65);
const torso=group(foxRoot,0,0,0);
sphere(torso,0,1.04,0,.88,.40,.36,materials.fur,48);
sphere(torso,.06,.80,0,.64,.20,.28,materials.cream,32);
sphere(torso,.54,1.08,0,.29,.37,.31,materials.furLight,32);
sphere(torso,.54,.91,0,.26,.28,.28,materials.cream,32);
sphere(torso,-.50,1.03,0,.40,.38,.35,materials.fur,32);
const head=group(torso,.67,1.32,0);
sphere(head,.16,0,0,.36,.305,.28,materials.furLight,40);
sphere(head,.36,-.17,.15,.28,.16,.17,materials.creamLight,32);
sphere(head,.36,-.17,-.15,.28,.16,.17,materials.creamLight,32);
sphere(head,.49,-.16,0,.26,.128,.175,materials.cream,32);
sphere(head,.69,-.145,0,.081,.073,.10,materials.nose,18);
sphere(head,.24,-.18,0,.18,.13,.23,materials.cream,24);

for(const side of [-1,1]){
 const ear=group(head,.055,.275,side*.196);
 const shell=cyl(ear,0,.17,0,.155,.013,.42,materials.furDark,5);
 shell.rotation.x=side*.16;shell.rotation.z=-.14;
 const inner=cyl(ear,.045,.165,side*.032,.108,.01,.29,materials.ear,5);
 inner.rotation.x=side*.16;inner.rotation.z=-.14;
 const eye=sphere(head,.395,.05,side*.215,.061,.052,.026,materials.black,24);
 const iris=sphere(head,.416,.05,side*.237,.040,.040,.016,materials.eyes,24);
 sphere(head,.435,.065,side*.247,.014,.014,.009,materials.creamLight,14);
 for(let i=0;i<3;i++){
  const line=new THREE.BufferGeometry().setFromPoints([
   new THREE.Vector3(.50,-.195,side*.13),
   new THREE.Vector3(.64+i*.045,-.21+(i-1)*.055,side*(.21+i*.05))
  ]);
  head.add(new THREE.Line(line,new THREE.LineBasicMaterial({color:"#cbc2b5",transparent:true,opacity:.55})));
 }
}
const tip=sphere(head,.704,-.14,0,.042,.028,.056,materials.black,20);
const scarf=group(torso,.52,1.15,0);
const scarfWrap=new THREE.Mesh(new THREE.TorusGeometry(.27,.063,8,30),materials.purple);
scarfWrap.rotation.y=Math.PI/2;scarf.scale.set(1,1.11,1.15);scarf.add(scarfWrap);
const knot=sphere(scarf,.05,-.12,.25,.09,.09,.07,materials.orange,16);
const scarfEnd=box(scarf,-.10,-.37,.26,.12,.38,.08,materials.purple);
scarfEnd.rotation.z=.16;

const tail1=group(torso,-.73,1.11,0);
tail1.rotation.z=-.10;
sphere(tail1,-.29,.075,0,.49,.245,.25,materials.fur,32);
const tail2=group(tail1,-.59,.10,0);
sphere(tail2,-.28,.07,0,.39,.28,.27,materials.furLight,32);
const tail3=group(tail2,-.41,.08,0);
sphere(tail3,-.20,.055,0,.31,.235,.22,materials.creamLight,32);
sphere(tail2,-.27,.07,0,.37,.29,.27,materials.fur,24);

function furInstanced(parent,origin,dimensions,count,colors,length=.05,seed=17){
 let s=seed;
 const rng=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
 const geo=new THREE.ConeGeometry(.009,.083,3);
 const mat=new THREE.MeshStandardMaterial({color:"#ffffff",roughness:1,side:THREE.DoubleSide});
 const mesh=new THREE.InstancedMesh(geo,mat,count);
 mesh.castShadow=false;mesh.frustumCulled=false;
 const dummy=new THREE.Object3D();
 const up=new THREE.Vector3(0,1,0),normal=new THREE.Vector3(),q=new THREE.Quaternion();
 const colorsArr=colors.map(x=>new THREE.Color(x));
 for(let i=0;i<count;i++){
  const u=rng()*2-1,phi=rng()*TAU,ring=Math.sqrt(1-u*u);
  const a=ring*Math.cos(phi),b=u,d=ring*Math.sin(phi);
  const x=origin[0]+a*dimensions[0],y=origin[1]+b*dimensions[1],z=origin[2]+d*dimensions[2];
  normal.set(a/dimensions[0],b/dimensions[1],d/dimensions[2]).normalize();
  normal.add(new THREE.Vector3((rng()-.5)*.14,(rng()-.5)*.14,(rng()-.5)*.14)).normalize();
  q.setFromUnitVectors(up,normal);
  dummy.position.set(x+normal.x*.014,y+normal.y*.014,z+normal.z*.014);
  dummy.quaternion.copy(q);dummy.scale.set(.7+rng()*.9,length*(.7+rng()*.8)/.083,.7+rng()*.9);
  dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  const col=colorsArr[Math.floor(rng()*colorsArr.length)].clone();
  col.offsetHSL((rng()-.5)*.022,(rng()-.5)*.04,(rng()-.5)*.075);
  mesh.setColorAt(i,col);
 }
 mesh.instanceMatrix.needsUpdate=true;
 if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 parent.add(mesh);
 return mesh;
}
furInstanced(torso,[0,1.04,0],[.875,.39,.35],2200,["#9b4826","#b8552a","#cc7339","#ae542b"],.064,1412);
furInstanced(torso,[.08,.80,0],[.62,.205,.29],350,["#c6b3a1","#dcc9b9","#eedbcb"],.048,12);
furInstanced(head,[.17,0,0],[.353,.30,.27],840,["#b35429","#c66d37","#d98548"],.049,324);
furInstanced(tail1,[-.29,.075,0],[.47,.24,.24],690,["#97502c","#ae5d31","#cc7b45"],.10,415);
furInstanced(tail2,[-.28,.07,0],[.38,.275,.25],750,["#a5542e","#bd713d","#d59a5d"],.11,569);
furInstanced(tail3,[-.18,.055,0],[.29,.22,.21],520,["#f6e7cc","#ecd9bd","#d6c7b3"],.10,771);

const legs=[];
function leg(name,x,z,side){
 const hip=group(foxRoot,x,.88,z);
 sphere(hip,0,-.055,0,.15,.20,.145,x>0?materials.furDark:materials.fur,24);
 const l1=.43,l2=.42;
 const thigh=group(hip);
 sphere(thigh,0,-l1*.47,0,.118,l1*.55,.113,x>.0?materials.furDark:materials.fur,20);
 const knee=group(thigh,0,-l1,0);
 sphere(knee,0,0,0,.093,.095,.084,materials.furDark,18);
 sphere(knee,0,-l2*.48,0,.082,l2*.54,.074,materials.furDark,20);
 const paw=group(knee,0,-l2,0);
 sphere(paw,.075,.005,0,.162,.07,.125,materials.black,18);
 for(let i=-1;i<=1;i++)sphere(paw,.182,.015,i*.060,.057,.035,.039,materials.black,12);
 legs.push({name,hip,thigh,knee,paw,l1,l2,side,x,z});
}
leg("frontNear",.59,.275,1);
leg("frontFar",.59,-.275,-1);
leg("hindNear",-.63,.26,1);
leg("hindFar",-.63,-.26,-1);

function ikLeg(L,phase,moving,bob){
 const stance=.61;
 let footX=0,footY=.085;
 if(moving){
  const t=(phase%1+1)%1;
  if(t<stance){
   footX=mix(.17,-.19,t/stance);
  }else{
   const u=(t-stance)/(1-stance);
   footX=mix(-.19,.17,smooth(u));
   footY+=.22*Math.sin(Math.PI*u);
  }
 }
 const dx=footX-(L.x>0?.075:-.04);
 const dy=footY-(L.hip.position.y);
 const d=clamp(Math.hypot(dx,dy),.03,L.l1+L.l2-.002);
 const bearing=Math.atan2(dx,-dy);
 const alpha=Math.acos(clamp((L.l1*L.l1+d*d-L.l2*L.l2)/(2*L.l1*d),-1,1));
 const bend=L.x>.0?-1:1;
 const upper=bearing+alpha*bend;
 const kx=L.l1*Math.sin(upper),ky=-L.l1*Math.cos(upper);
 const lowerWorld=Math.atan2(dx-kx,-(dy-ky));
 L.thigh.rotation.z=mix(L.thigh.rotation.z,upper,.42);
 L.knee.rotation.z=mix(L.knee.rotation.z,lowerWorld-upper,.42);
 L.paw.rotation.z=-(L.thigh.rotation.z+L.knee.rotation.z);
}

const fox={
 root:foxRoot,torso,head,tail1,tail2,tail3,legs,
 pos:new THREE.Vector3(-.7,0,.65),target:null,orientation:0,
 phase:0,isWalking:false,action:"idle",actionTime:0,eyeTimer:0
};
foxRoot.position.copy(fox.pos);
foxRoot.rotation.y=.2;

const rigged={ready:false,enabled:true,holder:group(foxRoot),root:null,mixer:null,actions:{},active:null,names:[],fur:null,furEnabled:false,variant:"enhanced",boneCount:0,loading:false};
const variants={
 enhanced:{asset:"./assets/Fox_Enhanced.glb",idle:"Look around",walk:"Walk",tail:"Tail wag",jump:"Walk",label:"Enhanced 29-bone fox",height:1.43},
 classic:{asset:"./assets/Fox.glb",idle:"Survey",walk:"Walk",tail:"Survey",jump:"Run",label:"Classic 24-bone fox",height:1.21}
};
rigged.holder.rotation.y=Math.PI/2;
function setRiggedEnabled(value){
 rigged.enabled=Boolean(value && rigged.ready);
 rigged.holder.visible=rigged.enabled;
 if(rigged.fur)rigged.fur.visible=rigged.enabled&&rigged.furEnabled;
 torso.visible=!rigged.enabled;
 legs.forEach(L=>L.hip.visible=!rigged.enabled);
 $("rig").classList.toggle("active",rigged.enabled);
 $("rig").innerHTML="<span>"+(rigged.enabled?"●":"○")+"</span>"+(rigged.enabled?"Rigged Fox":"IK Fox");
}
function setRigClip(stateName){
 if(!rigged.ready)return;
 const variant=variants[rigged.variant];
 const name=stateName==="walk"?variant.walk:stateName==="tail"?variant.tail:stateName==="jump"?variant.jump:variant.idle;
 if(rigged.active===name)return;
 const next=rigged.actions[name]||rigged.actions[variant.idle];
 if(!next)return;
 const previous=rigged.active?rigged.actions[rigged.active]:null;
 next.enabled=true;
 next.reset();
 next.setEffectiveTimeScale(stateName==="walk"?(rigged.variant==="enhanced"?1.05:1.3):1);
 next.setEffectiveWeight(1);
 next.play();
 if(previous && previous!==next)previous.crossFadeTo(next,.32,true);
 else next.fadeIn(.32);
 rigged.active=name;
}
function loadVariant(name){
 if(rigged.loading||!variants[name])return;
 rigged.loading=true;
 const desired=variants[name];
 new GLTFLoader().load(desired.asset,gltf=>{
  if(rigged.mixer)rigged.mixer.stopAllAction();
  if(rigged.root){
   rigged.holder.remove(rigged.root);
   rigged.root=null;
  }
  const model=gltf.scene;
  model.scale.setScalar(1);
  model.position.set(0,0,0);
  model.updateMatrixWorld(true);
  let bound=new THREE.Box3().setFromObject(model);
  const dims=bound.getSize(new THREE.Vector3());
  const scale=desired.height/Math.max(.01,dims.y);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  bound=new THREE.Box3().setFromObject(model);
  const center=bound.getCenter(new THREE.Vector3());
  model.position.set(-center.x,-bound.min.y,-center.z);
  rigged.holder.add(model);
  model.traverse(child=>{
   if(child.isMesh||child.isSkinnedMesh){
    child.castShadow=true;
    child.receiveShadow=true;
    if(child.material && child.material.map)child.material.map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
   }
  });
  rigged.root=model;
  rigged.fur=null;
  rigged.boneCount=0;
  model.traverse(obj=>{
   if(obj.isSkinnedMesh)rigged.boneCount=Math.max(rigged.boneCount,obj.skeleton.bones.length);
  });
  rigged.mixer=new THREE.AnimationMixer(model);
  rigged.actions={};rigged.names=[];
  for(const clip of gltf.animations){
   rigged.names.push(clip.name);
   rigged.actions[clip.name]=rigged.mixer.clipAction(clip);
   rigged.actions[clip.name].setLoop(THREE.LoopRepeat,Infinity);
  }
  rigged.variant=name;rigged.active=null;rigged.ready=true;rigged.loading=false;
  setRiggedEnabled(true);
  setRigClip("idle");
  $("variant").innerHTML="<span>◈</span>"+(name==="enhanced"?"Enhanced":"Classic");
  $("variant").classList.toggle("active",name==="enhanced");
  $("fur").disabled=name==="enhanced";
  $("fur").classList.remove("active");
  say(desired.label+" loaded, with "+rigged.names.join(" / ")+" animations.");
  $("status").textContent="GPU: "+gpuName+" · "+rigged.boneCount+" bone skinning · "+rigged.names.length+" animation clips · shadows";
  window.__fox3dRig={variant:name,animations:rigged.names,skinned:true,bones:rigged.boneCount,dimensions:bound.getSize(new THREE.Vector3()).toArray()};
 },undefined,error=>{
  console.error("3D model load error",name,error);
  rigged.loading=false;
  if(name!=="classic")loadVariant("classic");
  else {rigged.ready=false;setRiggedEnabled(false);say("Using procedural fox fallback.");}
 });
}
loadVariant("enhanced");
$("rig").addEventListener("click",()=>setRiggedEnabled(!rigged.enabled));
$("fur").addEventListener("click",()=>{
 rigged.furEnabled=!rigged.furEnabled;
 if(rigged.fur)rigged.fur.visible=rigged.enabled&&rigged.furEnabled;
 $("fur").classList.toggle("active",rigged.furEnabled);
 say(rigged.furEnabled?"20,000 skinned fur strands enabled.":"Fur overlay hidden.");
});
$("fur").classList.remove("active");
$("variant").addEventListener("click",()=>loadVariant(rigged.variant==="enhanced"?"classic":"enhanced"));
$("neural").addEventListener("click",()=>{window.location.href="./neural/";});

function updateFox(dt,t){
 const pace=rigged.variant==="enhanced"?0.75:1.16;
 if(fox.target){
  const diff=fox.target.clone().sub(fox.pos);diff.y=0;
  const distance=diff.length();
  fox.isWalking=distance>.07;
  if(distance>.07){
   const direction=diff.multiplyScalar(1/distance);
   const angle=Math.atan2(-direction.z,direction.x);
   let delta=Math.atan2(Math.sin(angle-fox.orientation),Math.cos(angle-fox.orientation));
   fox.orientation+=clamp(delta,-dt*3.3,dt*3.3);
   const fwd=new THREE.Vector3(Math.cos(fox.orientation),0,-Math.sin(fox.orientation));
   let speed=pace*clamp(1-Math.abs(delta)/3,.28,1);
   const step=Math.min(distance,speed*dt);
   fox.pos.addScaledVector(fwd,step);
   fox.pos.x=clamp(fox.pos.x,-4.62,4.5);fox.pos.z=clamp(fox.pos.z,-3.25,3.12);
  }else{
   fox.target=null;fox.isWalking=false;arrive();
  }
 }else fox.isWalking=false;
 if(rigged.ready && rigged.enabled){
  const clip=fox.isWalking?"walk":fox.action==="jump"?"jump":fox.action==="pet"||fox.action==="play"?"tail":"idle";
  setRigClip(clip);
  rigged.mixer.update(dt);
 }
 fox.root.position.copy(fox.pos);
 fox.root.rotation.y=fox.orientation;
 if(fox.isWalking)fox.phase+=dt*1.85;
 const cycle=fox.phase*TAU;
 const bob=fox.isWalking?.035*Math.sin(cycle*2):.012*Math.sin(t*2.2);
 torso.position.y=bob;
 const pitch=fox.isWalking?.027*Math.sin(cycle):.01*Math.sin(t*.75);
 torso.rotation.z=pitch;
 torso.rotation.x=fox.isWalking?.014*Math.sin(cycle*2):0;
 head.rotation.z=mix(head.rotation.z,(fox.isWalking?-.024*Math.sin(cycle):.025*Math.sin(t*.9)),.1);
 head.rotation.y=mix(head.rotation.y,.05*Math.sin(t*.6),.035);
 tail1.rotation.z=mix(tail1.rotation.z,-.08+.12*Math.sin(t*2.5-.55),.075);
 tail2.rotation.z=mix(tail2.rotation.z,.12*Math.sin(t*2.5-1.0),.055);
 tail3.rotation.z=mix(tail3.rotation.z,.14*Math.sin(t*2.5-1.55),.04);
 tail1.rotation.y=mix(tail1.rotation.y,.18*Math.sin(t*1.2),.04);
 tail2.rotation.y=mix(tail2.rotation.y,.16*Math.sin(t*1.2-.6),.04);
 for(let i=0;i<legs.length;i++){
  const L=legs[i];L.hip.position.y=.88+bob;
  const offset=i===0?0:i===1?.5:i===2?.5:0;
  ikLeg(L,fox.phase+offset,fox.isWalking,bob);
 }
 if(fox.action==="sleep"&&!fox.target){
  torso.rotation.z=mix(torso.rotation.z,-.07,.02);
  head.rotation.z=mix(head.rotation.z,.24,.02);
 }else if(fox.action==="play"&&!fox.target){
  head.rotation.z=mix(head.rotation.z,.18*Math.sin(t*7),.03);
 }
 if(fox.action==="jump"&&!fox.target){
  const local=t-fox.actionTime,progress=local/1.1;
  if(progress<1){fox.root.position.y+=Math.sin(progress*Math.PI)*.68;torso.rotation.z-=Math.sin(progress*Math.PI)*.12;}
  else fox.action="idle";
 }
}

const state={food:78,joy:84,energy:87,bond:9,paused:false,wander:true,task:null,lastTask:0,
 fps:0,frame:0,frameTimer:0,ballVelocity:new THREE.Vector3(),ballRolling:false};
try{
 const saved=JSON.parse(localStorage.getItem("ubuntu-fox-3d-state")||"{}");
 for(const key of ["food","joy","energy","bond"]){
  if(Number.isFinite(saved[key]))state[key]=clamp(saved[key],0,10000);
 }
}catch(e){}
function save(){localStorage.setItem("ubuntu-fox-3d-state",JSON.stringify({food:state.food,joy:state.joy,energy:state.energy,bond:state.bond}))}
const notes=$("note");let noteUntil=0;
function say(message){
 notes.textContent=message;notes.style.opacity="1";noteUntil=performance.now()+2400;
}
function taskTarget(name){
 const x=targets[name];
 return x?x.clone():null;
}
function walkTo(destination,name=null){
 fox.target=destination;fox.action="walk";state.task=name;
 document.querySelectorAll("[data-task]").forEach(b=>b.classList.toggle("active",b.dataset.task===name));
}
function task(name){
 if(state.paused){state.paused=false;$("pause").textContent="Ⅱ";}
 const location=taskTarget(name);
 if(!location)return;
 if(fox.action==="sleep")fox.action="idle";
 walkTo(location,name);
 const messages={
 bed:"The fox heads to its bed.",
 ball:"Watch its paws: this is a 3D walking cycle.",
 food:"Snack time. Real 3D bowl, not a picture.",
 desk:"Your little companion is on coding duty.",
 window:"Watching the mountains outside.",
 tower:"Jump time. Real body elevation and shadow."
 };
 say(messages[name]);
}
function arrive(){
 const name=state.task;
 state.task=null;
 document.querySelectorAll("[data-task]").forEach(b=>b.classList.remove("active"));
 fox.action=name||"idle";fox.actionTime=performance.now()/1000;
 if(name==="bed"){
  state.energy=clamp(state.energy+12,0,100);
  say("Resting by the warm bed.");
 }else if(name==="ball"){
  const away=new THREE.Vector3(ball.position.x-fox.pos.x,0,ball.position.z-fox.pos.z).normalize();
  if(away.lengthSq()<.1)away.set(.9,0,.4);
  state.ballVelocity.copy(away.multiplyScalar(1.7));
  state.ballVelocity.x+=.8;
  fox.action="play";state.joy=clamp(state.joy+8,0,100);state.bond+=3;
  say("The ball rolls in 3D.");
 }else if(name==="food"){
  state.food=clamp(state.food+19,0,100);state.bond+=2;
  say("A well-earned meal.");
 }else if(name==="desk"){
  state.joy=clamp(state.joy+2,0,100);state.bond++;
  say("sudo apt install happiness");
 }else if(name==="window"){
  state.joy=clamp(state.joy+4,0,100);
  say("An actual 3D room, seen through a real camera.");
 }else if(name==="tower"){
  fox.action="jump";fox.actionTime=performance.now()/1000;state.joy+=4;
  say("Jump — the whole model leaves the ground.");
 }
 save();
}
function petFox(){
 state.joy=clamp(state.joy+3,0,100);
 state.bond++;
 fox.action="pet";fox.actionTime=performance.now()/1000;
 say("Good fox. Tail and ears respond independently.");
 save();
}

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const floorPick=new THREE.Mesh(new THREE.PlaneGeometry(10.1,7.65),new THREE.MeshBasicMaterial({color:"#ffffff",transparent:true,opacity:0,depthWrite:false,colorWrite:false,side:THREE.DoubleSide}));
floorPick.rotation.x=-Math.PI/2;floorPick.position.set(0,.10,-.20);floorPick.userData.floor=true;scene.add(floorPick);
const foxClick=new THREE.Mesh(new THREE.SphereGeometry(.95,16,12),new THREE.MeshBasicMaterial({color:"#ffffff",opacity:0,transparent:true,colorWrite:false,depthWrite:false}));
foxClick.position.set(.14,1,0);foxClick.userData.fox=true;foxRoot.add(foxClick);
const picking=[foxClick,...clickables,floorPick];

const orbit={azimuth:.36,elevation:.32,radius:11.6,desiredRadius:11.6,focus:new THREE.Vector3(0,1.55,-.35)};
let drag=null;
function updateCamera(){
 const x=orbit.radius*Math.sin(orbit.azimuth)*Math.cos(orbit.elevation);
 const z=orbit.radius*Math.cos(orbit.azimuth)*Math.cos(orbit.elevation);
 const y=orbit.radius*Math.sin(orbit.elevation);
 camera.position.set(orbit.focus.x+x,orbit.focus.y+y,orbit.focus.z+z);
 camera.lookAt(orbit.focus);
}
updateCamera();
function onPointerUp(event){
 if(!drag)return;
 const wasMove=drag.moved,button=drag.button;
 drag=null;renderer.domElement.style.cursor="grab";
 if(wasMove||button!==0)return;
 const rect=renderer.domElement.getBoundingClientRect();
 pointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
 raycaster.setFromCamera(pointer,camera);
 const hits=raycaster.intersectObjects(picking,true);
 if(!hits.length)return;
 const hit=hits[0];let current=hit.object;
 while(current){
  if(current.userData.fox){petFox();return;}
  if(current.userData.task){task(current.userData.task);return;}
  if(current.userData.floor){
   const v=hit.point;
   walkTo(new THREE.Vector3(clamp(v.x,-4.55,4.52),0,clamp(v.z,-3.25,3.02)));
   say("Walking through an actual 3D space.");
   return;
  }
  current=current.parent;
 }
}
renderer.domElement.addEventListener("pointerdown",event=>{
 if(event.button>1)return;
 renderer.domElement.setPointerCapture(event.pointerId);
 drag={x:event.clientX,y:event.clientY,moved:false,button:event.button};
 renderer.domElement.style.cursor="grabbing";
});
renderer.domElement.addEventListener("pointermove",event=>{
 if(!drag)return;
 const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
 if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;
 if(drag.moved){
  orbit.azimuth=clamp(orbit.azimuth-dx*.006,-1.27,1.2);
  orbit.elevation=clamp(orbit.elevation+dy*.004,.13,.94);
  updateCamera();
 }
 drag.x=event.clientX;drag.y=event.clientY;
});
renderer.domElement.addEventListener("pointerup",onPointerUp);
renderer.domElement.style.cursor="grab";
renderer.domElement.addEventListener("contextmenu",e=>e.preventDefault());
renderer.domElement.addEventListener("wheel",e=>{
 e.preventDefault();
 orbit.radius=clamp(orbit.radius+Math.sign(e.deltaY)*.54,8.2,17.5);
 updateCamera();
},{passive:false});
document.querySelectorAll("[data-task]").forEach(b=>b.addEventListener("click",()=>task(b.dataset.task)));
$("wander").classList.add("active");
$("wander").addEventListener("click",()=>{
 state.wander=!state.wander;
 $("wander").classList.toggle("active",state.wander);
 say(state.wander?"Autonomous roaming enabled.":"Autonomous roaming paused.");
});
$("pause").addEventListener("click",()=>{
 state.paused=!state.paused;$("pause").textContent=state.paused?"▶":"Ⅱ";
});
document.addEventListener("keydown",e=>{
 if(e.target.tagName==="INPUT")return;
 if(e.code==="Space"){
  e.preventDefault();state.paused=!state.paused;$("pause").textContent=state.paused?"▶":"Ⅱ";
 }else if(/Digit[1-6]/.test(e.code)){
  task(["bed","ball","food","desk","window","tower"][Number(e.code.slice(5))-1]);
 }else if(e.code==="KeyF"){
  orbit.azimuth=.36;orbit.elevation=.32;orbit.radius=11.6;updateCamera();
 }else if(e.code==="KeyD"){
  $("debug").style.display=$("debug").style.display==="block"?"none":"block";
 }
});
window.addEventListener("resize",()=>{
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
});
function updateHUD(){
 for(const key of ["food","joy","energy"]){
  $(key+"txt").textContent=Math.round(state[key]);
  $(key+"bar").style.width=clamp(state[key],0,100)+"%";
 }
 $("bondtxt").textContent="L"+(1+Math.floor(state.bond/25));
 $("bondbar").style.width=(state.bond%25)*4+"%";
}

const gl=renderer.getContext();
const debug=gl.getExtension("WEBGL_debug_renderer_info");
const gpuName=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
const gpuVendor=debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR);
$("status").textContent="GPU: "+gpuName+" · OpenGL/WebGL 2.0 · Articulated 4-leg IK · 5,000+ fur strands";
$("debug").innerHTML="GPU: "+gpuName+"<br>Vendor: "+gpuVendor+"<br>Renderer: THREE WebGL<br>Shadowmap: 2048²<br>Frame: <span id='fr'>--</span> FPS<br>Draw calls: <span id='dc'>--</span>";
window.__fox3d={gpuName,gpuVendor,renderer,scene,camera,fox,state,task,updateFox};
window.__fox3dReady=true;

const clock=new THREE.Clock();
let t=0,lastStats=0,lastWander=0,lastPersist=0;
function frame(){
 requestAnimationFrame(frame);
 const dt=Math.min(clock.getDelta(),.07);
 if(!state.paused){
  t+=dt;
  updateFox(dt,t);
  premiumRoom.update(t);
  ball.position.addScaledVector(state.ballVelocity,dt);
  if(state.ballVelocity.lengthSq()>.0004){
   ball.rotation.z+=state.ballVelocity.length()*dt/.21;
   state.ballVelocity.multiplyScalar(Math.exp(-dt*2.4));
   ball.position.x=clamp(ball.position.x,-3.8,4.1);
   ball.position.z=clamp(ball.position.z,-2.6,2.95);
  }
  state.food=clamp(state.food-dt*.005,0,100);
  state.energy=clamp(state.energy+(fox.isWalking?-.019:.014)*dt,0,100);
  state.joy=clamp(state.joy-dt*.003,0,100);
  if(fox.action==="sleep"&&!fox.isWalking)state.energy=clamp(state.energy+dt*.028,0,100);
  if(state.wander&&!fox.target&&t-lastWander>12){
   lastWander=t;
   if(Math.random()<.58){
    const goals=[new THREE.Vector3(-1.7,0,1.1),new THREE.Vector3(.35,0,-.3),new THREE.Vector3(1,0,2.4),new THREE.Vector3(-1.9,0,-1.9)];
    walkTo(goals[Math.floor(Math.random()*goals.length)]);
   }
  }
  if(t-lastPersist>25){save();lastPersist=t}
 }
 if(performance.now()>noteUntil)notes.style.opacity="0";
 renderer.render(scene,camera);
 state.frame++;state.frameTimer+=dt;
 if(state.frameTimer>=.7){
  const fps=Math.round(state.frame/state.frameTimer);
  state.frame=0;state.frameTimer=0;
  const f=$("fr"),d=$("dc");
  if(f)f.textContent=fps;
  if(d)d.textContent=renderer.info.render.calls;
  updateHUD();
 }
}
updateHUD();
frame();
