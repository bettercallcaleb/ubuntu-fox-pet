const TAU=Math.PI*2;
export const wrapAngle=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
export const headingTo=(from,to)=>Math.atan2(-(to.z-from.z),to.x-from.x);
export function turnToward(current,destination,maxStep){
 const delta=wrapAngle(destination-current);
 return wrapAngle(current+Math.max(-maxStep,Math.min(maxStep,delta)));
}
export const gazeOffset=(current,from,to)=>wrapAngle(headingTo(from,to)-current);
export function wrappedOrbit(current,delta){
 return wrapAngle(current+delta);
}
export function angularDistance(a,b){
 return Math.abs(wrapAngle(b-a));
}
export const FOUR_WAY=[
 {name:"east",vector:{x:1,z:0},heading:0},
 {name:"north",vector:{x:0,z:-1},heading:Math.PI/2},
 {name:"west",vector:{x:-1,z:0},heading:Math.PI},
 {name:"south",vector:{x:0,z:1},heading:-Math.PI/2}
];