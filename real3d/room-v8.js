import * as THREE from "three";
import {RoundedBoxGeometry} from "./node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js";

const TAU=Math.PI*2;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));

export function installPremiumRoom({scene,habitat,bed,work,chair,tower,rug,food,renderer,sun,lampLight,fairy,windowGlass}){
 const loader=new THREE.TextureLoader();
 const texture=(name,srgb=false,repeat=[1,1])=>{
  const t=loader.load("./assets/textures/"+name);
  t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  return t;
 };
 const makePBR=(name,color,normal=.35,withColor=true,repeat=[1,1])=>new THREE.MeshStandardMaterial({
  color,
  map:withColor?texture(name+"_Color.jpg",true,repeat):null,
  normalMap:texture(name+"_NormalGL.jpg",false,repeat),
  roughnessMap:texture(name+"_Roughness.jpg",false,repeat),
  roughness:.92,
  metalness:0,
  normalScale:new THREE.Vector2(normal,normal)
 });
 const mat={
  walnut:makePBR("WoodFloor051","#9e7963",.24,true,[1.5,1.1]),
  walnutDark:makePBR("WoodFloor051","#775145",.26,true,[1.5,1.1]),
  paleOak:makePBR("WoodFloor051","#cdb49f",.25,true,[1.1,.75]),
  upholstery:makePBR("Fabric030","#d8bdad",.48,false,[1.6,1.2]),
  wineFabric:makePBR("Fabric030","#935c68",.6,false,[1.3,1.3]),
  oatmeal:makePBR("Fabric030","#eee0ce",.40,false,[1.7,1.2]),
  darkFabric:makePBR("Fabric030","#645d66",.48,false,[1.5,1.5]),
  rug:makePBR("Carpet011","#e1b2a4",.68,true,[1,1]),
  softLeather:makePBR("Leather037","#cbb2a3",.32,true,[1.2,1.2]),
  brass:new THREE.MeshPhysicalMaterial({color:"#bb8858",metalness:.77,roughness:.31,clearcoat:.3,clearcoatRoughness:.27}),
  ceramic:new THREE.MeshPhysicalMaterial({color:"#e7daca",roughness:.27,metalness:.02,clearcoat:1,clearcoatRoughness:.2}),
  blackSteel:new THREE.MeshStandardMaterial({color:"#27252b",metalness:.65,roughness:.36}),
  antiqueGlass:new THREE.MeshPhysicalMaterial({color:"#a9bfc4",metalness:.0,roughness:.13,transmission:.34,opacity:.7,transparent:true,thickness:.025}),
  leaf:new THREE.MeshStandardMaterial({color:"#566d56",roughness:.9,side:THREE.DoubleSide})
 };
 const grp=(parent,x=0,y=0,z=0)=>{
  const g=new THREE.Group();
  g.position.set(x,y,z);
  parent.add(g);
  return g;
 };
 const rounded=(parent,x,y,z,w,h,d,m,r=.05,shadow=true)=>{
  const rad=clamp(r,.003,Math.min(w,h,d)*.46);
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,rad),m);
  mesh.position.set(x,y,z);mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 };
 const bx=(parent,x,y,z,w,h,d,m,shadow=true)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  mesh.position.set(x,y,z);mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 };
 const orb=(parent,x,y,z,sx,sy,sz,m,segments=24)=>{
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,segments,16),m);
  mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 };
 const rod=(parent,x,y,z,r1,r2,h,m,n=20)=>{
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,n),m);
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 };
 const torus=(parent,x,y,z,radius,tube,m,rot=[0,0,0],arc=TAU)=>{
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,8,64,arc),m);
  mesh.position.set(x,y,z);mesh.rotation.set(...rot);
  mesh.castShadow=false;parent.add(mesh);return mesh;
 };
 const line=(parent,points,m,r=.012)=>{
  const curve=new THREE.CatmullRomCurve3(points.map(x=>new THREE.Vector3(...x)));
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(6,points.length*4),r,7,false),m);
  parent.add(mesh);mesh.castShadow=false;return mesh;
 };
 const radialShadow=(x,y,z,w,d,opacity=.28)=>{
  const cv=document.createElement("canvas");
  cv.width=cv.height=128;
  const ctx=cv.getContext("2d");
  const grad=ctx.createRadialGradient(64,64,0,64,64,64);
  grad.addColorStop(0,"rgba(29,18,20,"+opacity+")");
  grad.addColorStop(.5,"rgba(29,18,20,"+(opacity*.44)+")");
  grad.addColorStop(1,"rgba(29,18,20,0)");
  ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m);
  mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);habitat.add(mesh);
 };

 for(const obj of [bed,work,chair,tower,rug])obj.clear();
 renderer.toneMappingExposure=1.04;
 sun.intensity=1.73;
 sun.shadow.radius=3.8;
 sun.shadow.normalBias=.036;
 lampLight.intensity=24;
 fairy.intensity=6.2;
 scene.children.filter(c=>c.isHemisphereLight).forEach(c=>c.intensity=.85);
 scene.children.filter(c=>c.isDirectionalLight&&c!==sun).forEach(c=>c.intensity=.58);
 const bedLight=new THREE.PointLight("#ffd1a4",10.5,5,2.3);
 bedLight.position.set(-3.7,2.55,-.65);scene.add(bedLight);
 const deskFill=new THREE.PointLight("#c4c7ed",5,4.5,2.2);
 deskFill.position.set(2.8,2.0,-2.1);scene.add(deskFill);

 const frameWood=mat.walnutDark;
 for(const y of [.27,1.25,4.24]){
  rounded(habitat,.08,y,-4.135,10.25,.09,.13,mat.paleOak,.033);
  rounded(habitat,-5.03,y,-.25,.11,.09,7.89,mat.paleOak,.027);
 }
 for(const x of [-4.85,-3.47,-.60,.92,2.12,3.71,4.78]){
  rounded(habitat,x,2.76,-4.125,.060,2.90,.125,mat.walnut,.019);
 }
 for(let i=0;i<16;i++){
  const x=1.36+i*.208;
  if(x>4.72)continue;
  rounded(habitat,x,2.58,-4.004,.078,2.82,.05,mat.walnutDark,.022,false);
 }
 for(let i=0;i<15;i++){
  const z=-3.92+i*.445;
  rounded(habitat,-5.095,.94,z,.045,.78,.025,mat.paleOak,.01,false);
 }
 rounded(habitat,-5.085,1.38,-.18,.09,.08,7.5,frameWood,.025);
 rounded(habitat,-5.083,.55,-.18,.09,.09,7.5,frameWood,.025);

 radialShadow(-3.25,.108,1.48,3.2,2.5,.47);
 radialShadow(2.44,.106,-2.6,3.1,2.0,.33);
 radialShadow(3.94,.11,.65,2.5,2.0,.32);

 for(const x of [-.98,.98])for(const z of [-.65,.65]){
  const leg=rounded(bed,x,.22,z,.135,.41,.145,frameWood,.034);
  leg.rotation.z=x>0?-.038:.038;
 }
 rounded(bed,0,.36,0,2.42,.25,1.87,frameWood,.105);
 rounded(bed,0,.53,0,2.23,.27,1.64,mat.oatmeal,.128);
 const headboard=rounded(bed,-1.13,.78,0,.23,.92,1.93,mat.walnut,.095);
 rounded(bed,-.977,.91,0,.105,.54,1.62,mat.wineFabric,.047);
 for(let i=-3;i<=3;i++){
  const z=i*.205;
  orb(bed,-.913,1.04,z,.014,.014,.014,mat.brass,10);
 }
 const quilt=rounded(bed,.27,.735,0,1.65,.18,1.44,mat.oatmeal,.087);
 quilt.rotation.z=-.012;
 rounded(bed,.90,.80,0,.38,.13,1.43,mat.wineFabric,.056);
 for(const z of [-.38,.38]){
  const pillow=rounded(bed,-.69,.775,z,.61,.21,.55,mat.oatmeal,.103);
  pillow.rotation.y=z>0?.1:-.1;
  line(bed,[[-.96,.82,z-.20],[-.69,.89,z-.25],[-.41,.82,z-.21]],mat.wineFabric,.007);
 }
 line(bed,[[.97,.858,-.68],[1.08,.85,-.42],[1.08,.85,.43],[.97,.858,.68]],mat.brass,.007);
 for(let i=0;i<8;i++){
  const z=-.59+i*.16;
  line(bed,[[.97,.848,z],[1.08,.84,z]],mat.oatmeal,.009);
 }
 const headPost=rounded(bed,-1.2,.72,.83,.22,.97,.22,frameWood,.06);
 const headPost2=rounded(bed,-1.2,.72,-.83,.22,.97,.22,frameWood,.06);
 orb(bed,-1.2,1.21,.83,.10,.06,.10,mat.brass,16);
 orb(bed,-1.2,1.21,-.83,.10,.06,.10,mat.brass,16);

 const table=rounded(work,0,1.115,0,2.56,.17,1.22,mat.walnut,.062);
 const edge=rounded(work,0,1.042,.03,2.46,.052,1.14,mat.brass,.019);
 for(const x of [-1.10,1.10])for(const z of [-.48,.48]){
  const post=rounded(work,x,.54,z,.13,1.05,.14,frameWood,.032);
  const cap=rounded(work,x,.15,z,.15,.065,.16,mat.brass,.024);
 }
 rounded(work,0,.89,-.49,2.31,.27,.09,mat.walnutDark,.022);
 rounded(work,-.57,.77,-.44,1.07,.21,.13,mat.walnut,.023);
 rounded(work,.55,.77,-.44,1.07,.21,.13,mat.walnut,.023);
 for(const x of [-.57,.55]){
  rounded(work,x,.77,-.365,.33,.018,.035,mat.brass,.008,false);
 }
 const screenGroup=grp(work,-.06,1.67,-.32);
 const stand=rounded(screenGroup,0,-.37,-.015,.095,.4,.10,mat.blackSteel,.022);
 rounded(screenGroup,0,-.59,0,.43,.048,.26,mat.blackSteel,.018);
 rounded(screenGroup,0,.05,0,1.30,.78,.105,mat.blackSteel,.06);
 const screenMat=new THREE.MeshStandardMaterial({color:"#0c1623",roughness:.20,metalness:.08,emissive:"#092b33",emissiveIntensity:.62});
 rounded(screenGroup,0,.054,.062,1.14,.642,.018,screenMat,.012,false);
 const monitorCanvas=document.createElement("canvas");
 monitorCanvas.width=512;monitorCanvas.height=288;
 const ctx=monitorCanvas.getContext("2d");
 const screenGradient=ctx.createLinearGradient(0,0,512,288);
 screenGradient.addColorStop(0,"#10252b");screenGradient.addColorStop(1,"#121721");
 ctx.fillStyle=screenGradient;ctx.fillRect(0,0,512,288);
 ctx.font="19px monospace";ctx.fillStyle="#9acdc1";
 ctx.fillText("$ fox --watch",31,65);
 ctx.fillStyle="#84acb1";ctx.fillText(">> habitat ready",31,116);
 ctx.fillStyle="#e6be80";ctx.fillText(">> animation smooth",31,158);
 ctx.fillStyle="#79a6c7";ctx.fillText("_",31,217);
 const displayTex=new THREE.CanvasTexture(monitorCanvas);displayTex.colorSpace=THREE.SRGBColorSpace;
 const panel=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.60),new THREE.MeshBasicMaterial({map:displayTex,toneMapped:false}));
 panel.position.set(0,.05,.08);screenGroup.add(panel);
 rounded(work,.13,1.236,.40,.99,.055,.30,mat.blackSteel,.024,false);
 for(let i=0;i<36;i++){
  const x=-.27+(i%9)*.092,z=.30+Math.floor(i/9)*.062;
  rounded(work,x,1.271,z,.061,.013,.042,i%13===0?mat.brass:mat.darkFabric,.006,false);
 }
 const mouse=orb(work,.80,1.24,.31,.092,.054,.134,mat.blackSteel);
 rounded(work,.81,1.29,.30,.006,.009,.07,mat.brass,.003,false);
 const lamp=grp(work,.92,1.26,-.33);
 rod(lamp,0,.045,0,.16,.13,.08,mat.brass);
 const arm1=rod(lamp,0,.39,0,.023,.023,.66,mat.brass);
 const arm2=rod(lamp,-.20,.67,-.04,.022,.022,.52,mat.brass);arm2.rotation.z=-.70;
 const shade=new THREE.Mesh(new THREE.CylinderGeometry(.11,.26,.22,28,1,true),new THREE.MeshStandardMaterial({color:"#cab18d",metalness:.3,roughness:.5,side:THREE.DoubleSide}));
 shade.position.set(-.36,.83,-.04);shade.rotation.z=-.18;shade.castShadow=true;lamp.add(shade);
 orb(lamp,-.35,.735,-.045,.09,.038,.09,new THREE.MeshStandardMaterial({color:"#fff4de",emissive:"#ffc884",emissiveIntensity:1.5}),16);
 for(let i=0;i<5;i++){
  const bookMat=[mat.wineFabric,mat.paleOak,mat.darkFabric,mat.walnut,mat.oatmeal][i];
  rounded(work,.74+i*.09,1.34,-.10,.065,.34-.04*(i%3),.27,bookMat,.014);
  bx(work,.74+i*.09,1.34,.047,.05,.11,.009,mat.brass,false);
 }
 const cup=grp(work,-1,1.20,.36);
 const cupOuter=new THREE.Mesh(new THREE.LatheGeometry([
  new THREE.Vector2(.10,0),new THREE.Vector2(.12,.025),new THREE.Vector2(.12,.21),new THREE.Vector2(.109,.23),new THREE.Vector2(.10,.20)
 ],32),mat.ceramic);
 cupOuter.castShadow=true;cup.add(cupOuter);
 torus(cup,.147,.13,0,.076,.022,mat.ceramic,[0,Math.PI/2,0]);
 orb(cup,0,.196,0,.098,.008,.098,mat.walnut,20);

 const chairSeat=rounded(chair,0,.74,0,.85,.15,.74,mat.softLeather,.085);
 const stem=rod(chair,0,.40,0,.07,.08,.64,mat.blackSteel,14);
 const back=rounded(chair,0,1.20,-.35,.83,.85,.17,mat.softLeather,.081);
 back.rotation.x=-.09;
 rounded(chair,0,1.20,-.246,.69,.64,.035,mat.wineFabric,.018);
 for(let i=0;i<5;i++){
  const a=i*TAU/5;
  const leg=rounded(chair,Math.sin(a)*.28,.085,Math.cos(a)*.28,.58,.055,.105,mat.blackSteel,.02);
  leg.rotation.y=a;
  orb(chair,Math.sin(a)*.53,.062,Math.cos(a)*.53,.055,.05,.055,mat.blackSteel,12);
 }
 rounded(chair,0,.76,.01,.78,.042,.67,mat.walnutDark,.016);

 const ropeMat=new THREE.MeshStandardMaterial({color:"#bea37b",roughness:1});
 rounded(tower,0,.12,0,1.78,.21,1.77,mat.walnut,.07);
 for(const [x,z,h] of [[-.52,-.32,2.35],[.54,.27,3.03],[-.45,.54,1.40]]){
  rod(tower,x,.20+h/2,z,.125,.125,h,ropeMat,20);
  const points=[];
  const segments=Math.round(h*120);
  for(let i=0;i<=segments;i++){
   const y=.24+h*i/segments,angle=i*.46;
   points.push([x+Math.cos(angle)*.129,y,z+Math.sin(angle)*.129]);
  }
  line(tower,points,mat.oatmeal,.009);
  torus(tower,x,.26+h,z,.125,.025,mat.brass,[Math.PI/2,0,0]);
 }
 for(const [x,z,y,w] of [[-.51,-.32,2.55,1.32],[.54,.28,3.27,1.30],[-.45,.54,1.61,1.20]]){
  rounded(tower,x,y,z,w,.17,1.17,mat.walnut,.056);
  rounded(tower,x,y+.11,z,w-.10,.093,1.06,mat.wineFabric,.044);
 }
 const cave=grp(tower,.52,1.46,.17);
 rod(cave,0,0,0,.40,.40,.73,mat.wineFabric,36);
 const hole=new THREE.Mesh(new THREE.CircleGeometry(.27,40),new THREE.MeshBasicMaterial({color:"#2b1d28",side:THREE.DoubleSide}));
 hole.position.set(0,.01,.41);cave.add(hole);
 torus(cave,0,.01,.416,.29,.024,mat.brass);
 line(tower,[[.35,2.81,.27],[.34,2.59,.27],[.37,2.39,.29]],mat.oatmeal,.013);
 orb(tower,.38,2.34,.29,.11,.12,.11,mat.wineFabric,16);

 const circle=new THREE.Mesh(new THREE.CylinderGeometry(2.10,2.10,.09,96),mat.rug);
 circle.scale.set(1,1,.72);
 circle.position.y=.104;
 circle.receiveShadow=true;rug.add(circle);
 const borderMat=new THREE.MeshStandardMaterial({color:"#d8bea7",roughness:1});
 torus(rug,0,.15,0,2.04,.031,borderMat,[Math.PI/2,0,0]).scale.y=.72;
 for(let i=0;i<100;i++){
  const angle=i*TAU/100;
  const x=Math.cos(angle)*2.09,z=Math.sin(angle)*2.09*.72;
  const tx=Math.cos(angle)*2.22,tz=Math.sin(angle)*2.22*.72;
  line(rug,[[x,.102,z],[tx,.096,tz]],i%3?borderMat:mat.wineFabric,.0045);
 }

 const plaque=grp(habitat,.65,2.95,-4.035);
 rounded(plaque,0,0,0,.92,.75,.09,mat.walnutDark,.032);
 rounded(plaque,0,0,.06,.78,.61,.03,mat.paleOak,.015);
 const artCanvas=document.createElement("canvas");
 artCanvas.width=256;artCanvas.height=256;
 const ac=artCanvas.getContext("2d");
 const gradient=ac.createLinearGradient(0,0,256,256);
 gradient.addColorStop(0,"#c9c2b5");gradient.addColorStop(1,"#8b857e");
 ac.fillStyle=gradient;ac.fillRect(0,0,256,256);
 ac.fillStyle="#7b756d";ac.beginPath();ac.moveTo(0,185);ac.lineTo(87,96);ac.lineTo(155,158);ac.lineTo(211,72);ac.lineTo(256,121);ac.lineTo(256,256);ac.lineTo(0,256);ac.fill();
 ac.fillStyle="#b89982";ac.beginPath();ac.arc(190,52,25,0,TAU);ac.fill();
 const tex=new THREE.CanvasTexture(artCanvas);tex.colorSpace=THREE.SRGBColorSpace;
 const painting=new THREE.Mesh(new THREE.PlaneGeometry(.72,.56),new THREE.MeshBasicMaterial({map:tex}));
 painting.position.z=.082;plaque.add(painting);

 for(const [x,z] of [[-3.95,-3.98],[-3.35,-3.98],[-2.76,-3.98]]){
  rounded(habitat,x,2.10,z,.52,.07,.33,mat.walnut,.023);
 }
 for(let i=0;i<13;i++){
  const x=-4.07+i*.09;
  rounded(habitat,x,2.36,-3.85,.067,.41+.18*Math.sin(i*.9),.145,[mat.wineFabric,mat.oatmeal,mat.walnutDark,mat.darkFabric][i%4],.009);
 }
 const hook=rounded(habitat,-4.53,2.92,-4.016,.075,.27,.11,mat.brass,.03);
 const coat=grp(habitat,-4.52,2.72,-3.91);
 rounded(coat,0,-.12,0,.38,.4,.07,mat.wineFabric,.061);
 rounded(coat,-.13,-.21,.02,.12,.26,.055,mat.wineFabric,.026).rotation.z=-.15;

 const drapery=new THREE.MeshStandardMaterial({color:"#c4a594",roughness:1,side:THREE.DoubleSide});
 const curtain=grp(habitat,-1.65,0,-4.02);
 const curtainGroups=[];
 for(const [side,x] of [[-1,-1.16],[1,1.16]]){
  const geo=new THREE.PlaneGeometry(.43,1.75,16,20);
  const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){
   const px=pos.getX(i),py=pos.getY(i);
   pos.setZ(i,.045*Math.sin((px+.2)*32)+.025*Math.cos(py*3));
  }
  geo.computeVertexNormals();
  const fabricPanel=new THREE.Mesh(geo,drapery);
  fabricPanel.position.set(x,2.85,.05);
  fabricPanel.castShadow=true;
  curtain.add(fabricPanel);
  curtainGroups.push(fabricPanel);
 }
 rounded(curtain,0,3.79,.11,2.87,.065,.07,mat.brass,.022);

 const sconce=grp(habitat,-3.69,3.50,-3.98);
 rod(sconce,0,0,0,.105,.105,.055,mat.brass,16).rotation.x=Math.PI/2;
 rounded(sconce,0,-.33,.16,.095,.57,.095,mat.brass,.028);
 orb(sconce,0,-.67,.22,.18,.13,.18,mat.ceramic,20);
 const bulbMat=new THREE.MeshStandardMaterial({color:"#fff1d8",emissive:"#ffdca6",emissiveIntensity:2,roughness:.35});
 orb(sconce,0,-.68,.24,.085,.11,.085,bulbMat,18);

 const plant=grp(habitat,-4.45,0,1.9);
 rod(plant,0,.30,0,.34,.28,.52,mat.ceramic,20);
 const plantStem=new THREE.MeshStandardMaterial({color:"#475a43",roughness:.95});
 const leafMat=new THREE.MeshStandardMaterial({color:"#547457",roughness:.86,side:THREE.DoubleSide});
 let seed=13579;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<21;i++){
  const a=rand()*TAU,height=.75+rand()*.95,spread=.26+rand()*.45;
  const tip=[Math.cos(a)*spread,.46+height,Math.sin(a)*spread];
  line(plant,[[0,.47,0],[tip[0]*.46,.55+height*.55,tip[2]*.46],tip],plantStem,.010);
  const leaf=orb(plant,tip[0],tip[1],tip[2],.20,.05,.09,leafMat,12);
  leaf.rotation.y=a;leaf.rotation.z=-.22*Math.cos(a);
 }

 const cordMat=new THREE.MeshStandardMaterial({color:"#303035",roughness:.82});
 line(habitat,[[3.37,1.14,-2.23],[3.31,.96,-2.30],[3.35,.24,-2.23],[4.04,.15,-2.30]],cordMat,.007);
 const coaster=new THREE.Mesh(new THREE.CylinderGeometry(.145,.145,.015,36),mat.walnutDark);
 coaster.position.set(1.47,1.215,-2.24);habitat.add(coaster);

 food.traverse(child=>{
  if(child.isMesh&&child.material&&child.material.color&&child.material.color.getHexString()==="ddd9d1")child.material=mat.ceramic;
 });

 const gallery=grp(habitat,-4.995,2.77,-1.79);
 rounded(gallery,.065,0,0,.105,1.15,1.64,mat.walnutDark,.028);
 rounded(gallery,.12,0,0,.04,.99,1.49,mat.paleOak,.01);
 const galleryCanvas=document.createElement("canvas");
 galleryCanvas.width=768;galleryCanvas.height=512;
 const gc=galleryCanvas.getContext("2d");
 const sky=gc.createLinearGradient(0,0,0,512);
 sky.addColorStop(0,"#8ca3a6");sky.addColorStop(.56,"#e2cbb1");sky.addColorStop(1,"#b18a72");
 gc.fillStyle=sky;gc.fillRect(0,0,768,512);
 gc.fillStyle="rgba(238,207,150,.73)";gc.beginPath();gc.ellipse(590,136,56,51,0,0,TAU);gc.fill();
 let sd=79233;const rnd=()=>{sd=(sd*1664525+1013904223)>>>0;return sd/4294967296};
 for(let layer=0;layer<5;layer++){
  gc.fillStyle=["#b2a89c","#998d86","#82796f","#625e5c","#4b5753"][layer];
  gc.beginPath();gc.moveTo(0,512);
  for(let x=0;x<=790;x+=12){
   const y=270+layer*47+39*Math.sin(x*.008+layer*1.3)+22*Math.sin(x*.016+layer*2.6);
   gc.lineTo(x,y);
  }
  gc.lineTo(790,512);gc.fill();
 }
 for(let i=0;i<800;i++){
  gc.fillStyle=i%2?"rgba(237,222,201,.045)":"rgba(40,45,39,.06)";
  gc.fillRect(rnd()*768,rnd()*512,rnd()*4+.5,rnd()*3+.5);
 }
 const galleryTex=new THREE.CanvasTexture(galleryCanvas);
 galleryTex.colorSpace=THREE.SRGBColorSpace;
 const art=new THREE.Mesh(new THREE.PlaneGeometry(1.46,.96),new THREE.MeshBasicMaterial({map:galleryTex,side:THREE.DoubleSide}));
 art.rotation.y=Math.PI/2;
 art.position.set(.145,0,0);
 gallery.add(art);

 const shelf=grp(habitat,-5.01,1.91,-3.08);
 rounded(shelf,.18,0,0,.44,.067,1.66,mat.walnut,.025);
 for(let i=0;i<6;i++){
  const z=-.60+i*.205;
  const h=.27+.08*(i%3);
  rounded(shelf,.27,.04+h*.5,z,.15,h,.13,[mat.wineFabric,mat.paleOak,mat.darkFabric][i%3],.009);
 }
 const littlePot=grp(shelf,.25,.12,.65);
 rod(littlePot,0,.045,0,.15,.11,.18,mat.ceramic,18);
 for(let i=0;i<7;i++){
  const a=i*TAU/7;
  line(littlePot,[[0,.12,0],[Math.cos(a)*.09,.27,Math.sin(a)*.07],[Math.cos(a)*.16,.40,Math.sin(a)*.14]],mat.leaf,.012);
  orb(littlePot,Math.cos(a)*.16,.38,Math.sin(a)*.14,.075,.035,.055,mat.leaf,12).rotation.y=a;
 }

 const wallLamp=grp(habitat,-4.93,3.71,-.49);
 rounded(wallLamp,0,0,0,.06,.31,.14,mat.brass,.02);
 const glassShade=orb(wallLamp,.17,-.14,0,.19,.15,.145,mat.ceramic,24);
 const lampJoint=rod(wallLamp,.10,-.03,0,.025,.025,.25,mat.brass,10);
 lampJoint.rotation.z=Math.PI/2;
 const warmPoint=new THREE.PointLight("#ffd9aa",3.4,3.0,2);
 warmPoint.position.set(-4.59,3.51,-.49);scene.add(warmPoint);

 for(let i=0;i<11;i++){
  const x=-4.57+i*.21;
  const groove=rounded(habitat,x,.139,-4.015,.006,.012,.18,mat.brass,.003,false);
  groove.rotation.y=.12*Math.sin(i);
 }

 scene.userData.roomV8={version:8,pbrMaterials:["Fabric030","Carpet011","Leather037","WoodFloor051","Plaster001"],furnitureRebuilt:["bed","desk","chair","tower","rug"],dynamicLights:5};
 return {
  update(t){
   for(let i=0;i<curtainGroups.length;i++)curtainGroups[i].rotation.y=.02*Math.sin(t*.67+i);
   const warm=.78+.1*Math.sin(t*.6);
   bedLight.intensity=9.8*warm;
   deskFill.intensity=5.0;
  }
 };
}
