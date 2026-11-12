export function updateTurnContact(leg,home,dt,phase,groundHeight,floorOffset=.02){
 const step=Math.max(0,dt);
 const factor=1-Math.exp(-step*34);
 leg.swing=false;
 leg.plant.x+=(home.x-leg.plant.x)*factor;
 leg.plant.z+=(home.z-leg.plant.z)*factor;
 leg.plant.y=groundHeight(leg.plant.x,leg.plant.z)+floorOffset;
 leg.target.copy(leg.plant);
 leg.target.y+=.027*Math.max(0,Math.sin(2*Math.PI*phase));
 return Math.hypot(leg.plant.x-home.x,leg.plant.z-home.z);
}
