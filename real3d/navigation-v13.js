const ROOM={minX:-4.53,maxX:4.47,minZ:-3.20,maxZ:3.06};
const OBSTACLES=[
 {name:"bed",minX:-4.51,maxX:-2.00,minZ:.39,maxZ:2.42},
 {name:"desk",minX:1.13,maxX:3.78,minZ:-3.29,maxZ:-1.89},
 {name:"tower",minX:3.05,maxX:4.96,minZ:-.42,maxZ:1.48},
 {name:"food",minX:1.68,maxX:2.92,minZ:1.10,maxZ:2.33},
 {name:"chair",minX:1.43,maxX:2.78,minZ:-1.54,maxZ:-.20}
];
const STEP=.25;
const XCELLS=Math.round((ROOM.maxX-ROOM.minX)/STEP)+1;
const ZCELLS=Math.round((ROOM.maxZ-ROOM.minZ)/STEP)+1;
const inside=(a,b,c)=>a>=b&&a<=c;
export function groundHeight(x,z){
 const dx=(x+.28)/2.08,dz=(z-1.0)/1.52;
 const q=dx*dx+dz*dz;
 if(q<.94)return .158;
 if(q<1.04)return .092+(.158-.092)*Math.max(0,Math.min(1,(1.04-q)/.10));
 return .071;
}
export function blocked(x,z,extra=0){
 if(!inside(x,ROOM.minX,ROOM.maxX)||!inside(z,ROOM.minZ,ROOM.maxZ))return true;
 return OBSTACLES.some(o=>inside(x,o.minX-extra,o.maxX+extra)&&inside(z,o.minZ-extra,o.maxZ+extra));
}
const gridPoint=(x,z)=>({
 i:Math.max(0,Math.min(XCELLS-1,Math.round((x-ROOM.minX)/STEP))),
 j:Math.max(0,Math.min(ZCELLS-1,Math.round((z-ROOM.minZ)/STEP)))
});
const xyz=(i,j)=>({x:ROOM.minX+i*STEP,z:ROOM.minZ+j*STEP});
const index=(i,j)=>j*XCELLS+i;
const neighbors=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
function nearest(point){
 if(!blocked(point.x,point.z))return{x:point.x,z:point.z};
 let best=null,d=Infinity;
 for(let j=0;j<ZCELLS;j++)for(let i=0;i<XCELLS;i++){
  const p=xyz(i,j);
  if(blocked(p.x,p.z))continue;
  const distance=Math.hypot(p.x-point.x,p.z-point.z);
  if(distance<d){d=distance;best=p}
 }
 return best||{x:0,z:0};
}
export function clearLine(a,b){
 const length=Math.hypot(a.x-b.x,a.z-b.z);
 const count=Math.max(1,Math.ceil(length/.075));
 for(let k=0;k<=count;k++){
  const t=k/count;
  if(blocked(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;
 }
 return true;
}
export function route(from,to){
 const start=nearest(from),end=nearest(to);
 if(clearLine(start,end))return[end];
 const s=gridPoint(start.x,start.z),g=gridPoint(end.x,end.z);
 const first=index(s.i,s.j),last=index(g.i,g.j),N=XCELLS*ZCELLS;
 const gcost=new Float64Array(N).fill(Infinity),came=new Int32Array(N).fill(-1),seen=new Uint8Array(N);
 gcost[first]=0;
 const heuristic=(i,j)=>Math.hypot(i-g.i,j-g.j);
 const open=[{i:s.i,j:s.j,k:first,f:heuristic(s.i,s.j)}];
 let reached=false;
 while(open.length){
  let best=0;
  for(let j=1;j<open.length;j++)if(open[j].f<open[best].f)best=j;
  const node=open.splice(best,1)[0];
  if(seen[node.k])continue;
  seen[node.k]=1;
  if(node.k===last){reached=true;break}
  for(const [dx,dz] of neighbors){
   const ni=node.i+dx,nj=node.j+dz;
   if(ni<0||ni>=XCELLS||nj<0||nj>=ZCELLS)continue;
   const at=xyz(ni,nj),key=index(ni,nj);
   if(seen[key]||blocked(at.x,at.z))continue;
   if(dx&&dz&&(blocked(xyz(node.i+dx,node.j).x,xyz(node.i+dx,node.j).z)||blocked(xyz(node.i,node.j+dz).x,xyz(node.i,node.j+dz).z)))continue;
   const cost=gcost[node.k]+Math.hypot(dx,dz);
   if(cost>=gcost[key])continue;
   came[key]=node.k;gcost[key]=cost;
   open.push({i:ni,j:nj,k:key,f:cost+heuristic(ni,nj)});
  }
 }
 if(!reached)return clearLine(start,end)?[end]:[];
 const raw=[end];
 let current=last;
 while(current!==first){
  const i=current%XCELLS,j=Math.floor(current/XCELLS);
  raw.push(xyz(i,j));
  current=came[current];
  if(current<0)return[];
 }
 raw.push(start);raw.reverse();
 const simple=[];
 for(let i=0;i<raw.length-1;){
  let k=raw.length-1;
  while(k>i+1&&!clearLine(raw[i],raw[k]))k--;
  simple.push(raw[k]);i=k;
 }
 return simple.filter((p,k)=>k>0||Math.hypot(p.x-start.x,p.z-start.z)>.035);
}
export const NAV_INFO={room:ROOM,obstacles:OBSTACLES,step:STEP};
