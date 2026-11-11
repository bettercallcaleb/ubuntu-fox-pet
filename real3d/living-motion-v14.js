import * as THREE from "./node_modules/three/build/three.module.js";

const axisX=new THREE.Vector3(1,0,0);
const axisY=new THREE.Vector3(0,1,0);
const axisZ=new THREE.Vector3(0,0,1);
const qx=new THREE.Quaternion();
const qy=new THREE.Quaternion();
const qz=new THREE.Quaternion();
const damp=(x,y,k,dt)=>THREE.MathUtils.damp(x,y,k,dt);

export function createLivingFoxMotion({fox,rigged}){
 let nextLook=0;
 let lookTarget=0;
 let tiltTarget=0;
 let look=0;
 let tilt=0;
 let breathe=0;
 let tailSwing=0;
 let earTwitch=0;
 let lastTail=0;
 let lastOrientation=fox.orientation;
 let turnVelocity=0;
 let state="idle";

 function pose(name,x=0,y=0,z=0){
  const bone=rigged.bones?.get(name);
  const rest=rigged.boneRest?.get(name);
  if(!bone||!rest)return;
  qx.setFromAxisAngle(axisX,x);
  qy.setFromAxisAngle(axisY,y);
  qz.setFromAxisAngle(axisZ,z);
  bone.quaternion.copy(rest).multiply(qy).multiply(qx).multiply(qz);
 }

 function update(dt,t,locomotion=0){
  if(!rigged.ready||!rigged.enabled||rigged.variant!=="realistic"||!rigged.bones)return;
  const walking=locomotion>.3;
  const rotationDelta=Math.atan2(Math.sin(fox.orientation-lastOrientation),Math.cos(fox.orientation-lastOrientation));
  lastOrientation=fox.orientation;
  turnVelocity=damp(turnVelocity,THREE.MathUtils.clamp(rotationDelta/Math.max(.015,dt),-3.2,3.2),6,dt);
  const sleeping=fox.action==="sleep"&&!fox.target;
  const feeding=fox.action==="food"&&!fox.target;
  const joyful=fox.action==="pet"||fox.action==="play";
  state=sleeping?"sleep":feeding?"sniff":joyful?"play":walking?"walk":"idle";

  if(t>=nextLook){
   const epoch=Math.floor(t/3.7)+1;
   lookTarget=Math.sin(epoch*2.399+0.8)*0.27;
   tiltTarget=Math.sin(epoch*1.73-1.2)*0.09;
   nextLook=t+3.2+1.7*(.5+.5*Math.sin(epoch*1.41));
  }
  const gaze=walking ? .23 : sleeping ? .08 : feeding ? .19 : 1;
  look=damp(look,lookTarget*gaze,1.5,dt);
  tilt=damp(tilt,tiltTarget*gaze,1.8,dt);
  breathe=Math.sin(t*(sleeping?1.8:3.1));
  const stride=fox.phase*Math.PI*2;
  const d=walking?locomotion:0;
  const step=Math.sin(stride*2);
  const sway=Math.sin(stride);
  const inhale=breathe*(sleeping ? .013 : .01);

  pose("hips",-.015*d*step,0,.019*d*sway);
  pose("spine0",.013*d*sway,0,-.018*d*sway);
  pose("spine1",inhale*.6+.008*d*step,0,-.017*d*sway);
  pose("chest",inhale*.75-.006*d*step,0,.02*d*sway);

  const interval=t%11;
  const exploratorySniff=!walking&&!sleeping&&!feeding&&!joyful&&interval>5.5&&interval<8.8
   ? .18*Math.sin(Math.PI*(interval-5.5)/3.3):0;
  const sniff=feeding?(Math.sin(t*7)*.037):exploratorySniff*.14*Math.sin(t*8.2);
  const neckPitch=sleeping ? .25 : feeding ? .17 : walking ? .012*Math.sin(stride) : .015*breathe;
  const headPitch=sleeping ? .22 : feeding ? .24+sniff : walking ? -.02*Math.sin(stride) : .025*Math.sin(t*.77);
  pose("neck",neckPitch+exploratorySniff*.5,look*.41,tilt*.25);
  pose("head",headPitch+exploratorySniff*.8+sniff,look*.85,tilt+(.03*d*sway));

  const blinkTwitch=Math.sin(t*1.97)*Math.sin(t*1.13);
  earTwitch=(blinkTwitch>.65?(.65-blinkTwitch)*-.65:0)+(joyful ? .06 : 0);
  pose("earL",earTwitch+.044*Math.sin(t*2.6),.045*Math.sin(t*.9),.035);
  pose("earR",-earTwitch-.05*Math.sin(t*2.1+.8),-.04*Math.sin(t*1.1),-.035);

  const amplitude=joyful ? .39 : walking ? .27 : sleeping ? .045 : .145;
  const wagRate=joyful ? 6.0 : walking ? 4.1 : 2.45;
  const wag=Math.sin(t*wagRate+0.4);
  const follow=Math.sin(t*wagRate-.8);
  tailSwing=damp(tailSwing,amplitude*wag-.055*turnVelocity,4.2,dt);
  for(let i=0;i<4;i++){
   const lag=i*.36;
   const lateral=i===0 ? tailSwing : amplitude*Math.sin(t*wagRate+.4-lag)*(.75+i*.08);
   const lift=.045*Math.sin(t*1.7-lag)+.035*d*follow+(joyful ? .07 : 0);
   pose("tail"+i,lift,0,lateral);
  }
  lastTail=tailSwing;
 }

 function diagnostics(){return {state,lookYaw:look,headTilt:tilt,tailSwing:lastTail,breathing:breathe,earTwitch};}
 return {update,diagnostics};
}
