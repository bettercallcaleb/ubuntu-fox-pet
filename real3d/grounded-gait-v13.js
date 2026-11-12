import * as THREE from "./node_modules/three/build/three.module.js";
import {groundHeight} from "./navigation-v13.js";
import {createLivingFoxMotion} from "./living-motion-v14.js";
import {aimBone, solveTwoBone, createPoseKit} from "./fox-rig-v15.js";
import {updateTurnContact} from "./turn-contact-v17.js";

// Four-legged gait for the realistic fox.
//  * lateral-sequence walk (LH, LF, RH, RF), stance feet stay planted in world space
//  * analytic two-bone IK per leg; hind legs also flex at the hock
//  * posture blending: feet are pulled to body-relative targets when lying, sitting,
//    crouching to eat/play and during jumps
//  * contact shadows follow the real toe positions

const STRIDE = .5;       // distance travelled per full gait cycle (matches scene.js phase update)
const DUTY = .7;         // fraction of the cycle a foot is on the ground
const BASE_DROP = .03;   // normal stance keeps the legs slightly bent
const FLOOR_OFFSET = .02;
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const damp = (x, y, k, dt) => THREE.MathUtils.damp(x, y, k, dt);
const ease = x => x * x * (3 - 2 * x);

function contactTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(48, 48, 0, 48, 48, 47);
  g.addColorStop(0, "rgba(21,14,15,.49)");
  g.addColorStop(.45, "rgba(27,19,17,.24)");
  g.addColorStop(1, "rgba(27,19,17,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 96, 96);
  return new THREE.CanvasTexture(c);
}

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const forward = new THREE.Vector3(), bend = new THREE.Vector3(), dirFoot = new THREE.Vector3();
const K = new THREE.Vector3(), E = new THREE.Vector3(), H = new THREE.Vector3(), Ta = new THREE.Vector3();
const ft = new THREE.Vector3(), dirTmp = new THREE.Vector3(), tgt = new THREE.Vector3(), sideAxis = new THREE.Vector3();
const flexQ = new THREE.Quaternion(), parentQ = new THREE.Quaternion(), axisLocal = new THREE.Vector3();

const LEGS = [["L1", 0, false, -1], ["L0", .25, true, -1], ["R1", .5, false, 1], ["R0", .75, true, 1]];

export function createGroundedGait({scene, fox, foxRoot, rigged}) {
  const texture = contactTexture();
  const shadowGeo = new THREE.PlaneGeometry(.43, .28);
  const legs = [];
  let frontHomeX = .31;
  let initialized = false, bodyY = 0, amplitude = 0, lastPhase = fox.phase || 0, cadence = 1.5, lastSettle = 0;
  let meanError = 0, maxError = 0, plantedCount = 0;
  const living = createLivingFoxMotion({fox, rigged, foxRoot});
  const kit = createPoseKit({rigged, foxRoot});
  const rootQ = new THREE.Quaternion(), desiredQ = new THREE.Quaternion(), flexRot = new THREE.Quaternion();

  function initialize() {
    if (!rigged.bones?.size) return false;
    if (initialized) return true;
    foxRoot.updateMatrixWorld(true);
    for (const [name, off, front, side] of LEGS) {
      const thigh = rigged.bones.get("thigh" + name), shin = rigged.bones.get("shin" + name);
      const foot = rigged.bones.get("foot" + name), toe = rigged.bones.get("toe" + name);
      if (!thigh || !shin || !foot || !toe) return false;
      const at = toe.getWorldPosition(new THREE.Vector3());
      const home = foxRoot.worldToLocal(at.clone());
      const l1 = thigh.getWorldPosition(v1).distanceTo(shin.getWorldPosition(v2));
      const l2 = shin.getWorldPosition(v1).distanceTo(foot.getWorldPosition(v2));
      const lt = foot.getWorldPosition(v1).distanceTo(at);
      const target = at.clone();
      target.y = groundHeight(at.x, at.z) + FLOOR_OFFSET;
      const material = new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, opacity: .85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1});
      const shadow = new THREE.Mesh(shadowGeo, material);
      shadow.rotation.x = -Math.PI / 2;
      shadow.renderOrder = 5;
      scene.add(shadow);
      legs.push({name, front, side, thigh, shin, foot, toe, home, l1, l2, lt, target, plant: target.clone(), from: target.clone(), to: target.clone(),
        shadow, swing: false, swingAt: 0, swingDuration: .25, lastCycle: -1, phaseOffset: off, error: 0, footPitch: .25, lift: 0, alpha: 0});
    }
    const fronts = legs.filter(l => l.front);
    if (fronts.length) frontHomeX = fronts.reduce((a, l) => a + l.home.x, 0) / fronts.length;
    initialized = true;
    return true;
  }

  function legHome(leg, rootPos, rot, out) {
    const h = leg.home, c = Math.cos(rot), s = Math.sin(rot);
    return out.set(rootPos.x + c * h.x + s * h.z, 0, rootPos.z - s * h.x + c * h.z);
  }
  function localToFloor(x, z, lift, out) {
    // point in fox space standing on the floor beneath the body
    foxRoot.localToWorld(out.set(x, 0, z));
    out.y = groundHeight(out.x, out.z) + FLOOR_OFFSET + lift;
    return out;
  }
  function resetLeg(leg) {
    for (const bone of [leg.thigh, leg.shin, leg.foot, leg.toe]) bone.quaternion.copy(rigged.boneRest.get(bone.name));
    leg.thigh.updateMatrixWorld(true);
  }
  function flexAroundSide(bone, angle) {
    bone.parent.getWorldQuaternion(parentQ).invert();
    axisLocal.copy(sideAxis).applyQuaternion(parentQ).normalize();
    flexQ.setFromAxisAngle(axisLocal, angle);
    bone.quaternion.premultiply(flexQ).normalize();
    bone.updateMatrixWorld(true);
  }

  // Place the toe at `T` (world) with a rigid-ish paw: two-bone IK on thigh/shin to the ankle,
  // then orient the paw.
  function solveLeg(leg, T, dt) {
    const front = leg.front;
    bend.copy(forward).multiplyScalar(front ? -1 : 1);
    leg.thigh.getWorldPosition(H);
    const swingFlex = leg.swing ? Math.sin(Math.PI * leg.alpha) : 0;
    if (front) {
      // The paw mesh points forward from the ankle: keep it flat (body-relative rest orientation)
      // instead of letting it tilt with the forearm. Solve, flatten, then correct the small toe offset.
      for (let pass = 0; pass < 2; pass++) {
        leg.foot.getWorldPosition(v1); leg.toe.getWorldPosition(v2);
        ft.subVectors(v2, v1);
        Ta.subVectors(T, ft);
        solveTwoBone(H, leg.l1, leg.l2, Ta, bend, K, E);
        aimBone(leg.thigh, leg.shin, dirTmp.subVectors(K, H).normalize());
        aimBone(leg.shin, leg.foot, dirTmp.subVectors(E, K).normalize());
        flattenFoot(leg, swingFlex);
      }
    } else {
      leg.footPitch = damp(leg.footPitch, leg.swing ? -.55 : .28, 16, dt);
      const pitch = leg.footPitch - .35 * swingFlex;
      dirFoot.set(0, -Math.cos(pitch), 0).addScaledVector(forward, Math.sin(pitch));
      Ta.copy(T).addScaledVector(dirFoot, -leg.lt);
      solveTwoBone(H, leg.l1, leg.l2, Ta, bend, K, E);
      aimBone(leg.thigh, leg.shin, dirTmp.subVectors(K, H).normalize());
      aimBone(leg.shin, leg.foot, dirTmp.subVectors(E, K).normalize());
      aimBone(leg.foot, leg.toe, dirFoot);
    }
  }

  // orient the foot to its rest orientation relative to the body, flexed by `flex` radians about the body's side axis
  function flattenFoot(leg, swingFlex) {
    const rest = kit.restQuat(leg.foot.name);
    if (!rest) return;
    foxRoot.getWorldQuaternion(rootQ);
    desiredQ.copy(rootQ).multiply(rest);
    if (swingFlex > 0) {
      flexRot.setFromAxisAngle(sideAxis, -.55 * swingFlex);
      desiredQ.premultiply(flexRot);
    }
    leg.foot.parent.getWorldQuaternion(parentQ).invert();
    leg.foot.quaternion.copy(parentQ.multiply(desiredQ));
    leg.foot.updateMatrixWorld(true);
  }

  // body-relative foot targets for non-walking postures
  function postureTarget(leg, kind, out) {
    const s = leg.side, f = leg.front;
    // front targets are relative to the rig's own front-leg home (mean of both paws) so they follow the skeleton
    const fx = frontHomeX;
    switch (kind) {
      case "lie": return f ? localToFloor(fx + .19, .09 * s, 0, out) : localToFloor(-.02, .17 * s, 0, out);
      case "sit": return f ? localToFloor(fx, .085 * s, 0, out) : localToFloor(.1, .15 * s, 0, out);
      case "crouch": return f ? localToFloor(leg.home.x + .13, leg.home.z, 0, out) : localToFloor(leg.home.x, leg.home.z, 0, out);
      default: return f ? localToFloor(fx - .02, .1 * s, .27, out) : localToFloor(-.12, .07 * s, .2, out); // air
    }
  }

  function update(dt, t) {
    if (rigged.variant !== "realistic" || !rigged.enabled || !rigged.ready || !initialize()) return;
    const turningInPlace = Boolean(fox.stepping && !fox.isWalking);
    const moving = Boolean(fox.isWalking || fox.stepping);
    amplitude = damp(amplitude, fox.isWalking ? 1 : 0, 5.7, dt);
    const phaseDelta = (fox.phase || 0) - lastPhase;
    lastPhase = fox.phase || 0;
    cadence = damp(cadence, clamp(phaseDelta / Math.max(dt, 1e-3), .9, 3.5), 8, dt);
    const speed = fox.speed || 0;

    // posture + spine / head / tail first, so the legs are solved against the final torso pose
    living.update(dt, t, amplitude);
    const P = living.posture;

    const phi = (fox.phase || 0) * Math.PI * 2;
    const bob = amplitude * .013 * Math.cos(2 * phi + .3);
    const g = groundHeight(fox.pos.x, fox.pos.z);
    const targetBody = g - .015 - BASE_DROP - P.drop + P.lift + bob;
    bodyY = damp(bodyY, targetBody, P.air > .01 || P.lift > .01 ? 28 : 10, dt);
    foxRoot.position.y = bodyY;
    forward.set(Math.cos(fox.orientation), 0, -Math.sin(fox.orientation));
    sideAxis.set(Math.sin(fox.orientation), 0, Math.cos(fox.orientation));
    foxRoot.updateMatrixWorld(true);

    const postureWeight = Math.max(P.lie, P.sit, P.crouch, P.air);
    let swinging = legs.reduce((n, l) => n + (l.swing ? 1 : 0), 0);
    plantedCount = 0; meanError = 0; maxError = 0;

    for (const leg of legs) {
      resetLeg(leg);
      const home = legHome(leg, foxRoot.position, fox.orientation, v1).clone();
      const gHome = groundHeight(home.x, home.z) + FLOOR_OFFSET;
      const p = (((fox.phase || 0) + leg.phaseOffset) % 1 + 1) % 1;
      const cycle = Math.floor((fox.phase || 0) + leg.phaseOffset);
      const distance = Math.hypot(home.x - leg.plant.x, home.z - leg.plant.z);

      const turningContact = turningInPlace && postureWeight < .05;
      if (!turningContact && !leg.swing && postureWeight < .05) {
        const due = moving && p >= DUTY && leg.lastCycle !== cycle;
        const overStretched = moving && distance > STRIDE * .62;
        const settle = !moving && distance > .09 && swinging < 1 && t - lastSettle > .14;
        if (due || overStretched || settle) {
          leg.swing = true; leg.swingAt = t; leg.alpha = 0;
          leg.swingDuration = settle ? .26 : clamp((1 - DUTY) / Math.max(cadence, .9), .15, .4);
          if (due) leg.lastCycle = cycle;
          if (settle) lastSettle = t;
          leg.from.copy(leg.plant);
          const reach = clamp(speed / .5, 0, 1) * STRIDE * DUTY * .5 + speed * leg.swingDuration;
          leg.to.set(home.x + forward.x * (settle ? 0 : reach), gHome, home.z + forward.z * (settle ? 0 : reach));
          swinging++;
        }
      }
      if (turningContact) {
        updateTurnContact(leg, home, dt, p, groundHeight, FLOOR_OFFSET);
        plantedCount++;
      } else if (leg.swing) {
        leg.alpha = clamp((t - leg.swingAt) / leg.swingDuration, 0, 1);
        const k = ease(leg.alpha);
        leg.target.lerpVectors(leg.from, leg.to, k);
        const clearance = leg.front ? .082 : .068;
        leg.target.y = groundHeight(leg.target.x, leg.target.z) + FLOOR_OFFSET + clearance * Math.pow(Math.sin(Math.PI * leg.alpha), .8);
        if (leg.alpha >= 1) {
          leg.swing = false;
          leg.target.copy(leg.to);
          leg.plant.copy(leg.to);
          swinging--;
        }
      } else {
        leg.target.copy(leg.plant);
        leg.target.y = groundHeight(leg.target.x, leg.target.z) + FLOOR_OFFSET;
        if (postureWeight < .05) plantedCount++;
      }

      // pull the foot towards body-relative targets for lying / sitting / crouching / airborne
      let tx = leg.target.x, ty = leg.target.y, tz = leg.target.z;
      const mix = [["lie", P.lie], ["sit", P.sit], ["crouch", P.crouch], ["air", P.air]];
      const total = mix.reduce((s, m) => s + m[1], 0);
      const norm = total > 1 ? 1 / total : 1;
      for (const [kind, w] of mix) {
        if (w < .002) continue;
        const target = postureTarget(leg, kind, v2);
        const a = w * norm;
        tx += (target.x - leg.target.x) * a; ty += (target.y - leg.target.y) * a; tz += (target.z - leg.target.z) * a;
      }
      tgt.set(tx, ty, tz);
      solveLeg(leg, tgt, dt);

      const actual = leg.toe.getWorldPosition(v2);
      leg.error = actual.distanceTo(tgt);
      meanError += leg.error; maxError = Math.max(maxError, leg.error);
      const floorY = groundHeight(actual.x, actual.z);
      const height = actual.y - floorY;
      const contact = clamp(1 - height / .14, 0, 1);
      leg.shadow.position.set(actual.x, floorY + .003, actual.z);
      leg.shadow.material.opacity = .08 + .64 * contact;
      leg.shadow.scale.setScalar(.66 + .34 * contact);
    }
    meanError /= legs.length;
    foxRoot.updateMatrixWorld(true);
  }

  // after teleporting the fox (or loading a saved position) put every foot back under the body
  function snap() {
    if (!initialized) return;
    foxRoot.position.set(fox.pos.x, foxRoot.position.y, fox.pos.z);
    foxRoot.updateMatrixWorld(true);
    for (const leg of legs) {
      const home = legHome(leg, foxRoot.position, fox.orientation, v1);
      leg.plant.set(home.x, groundHeight(home.x, home.z) + FLOOR_OFFSET, home.z);
      leg.target.copy(leg.plant); leg.from.copy(leg.plant); leg.to.copy(leg.plant);
      leg.swing = false;
    }
  }
  const setVisible = visible => { for (const l of legs) l.shadow.visible = Boolean(visible); };
  const diagnostics = () => ({
    ready: initialized, amplitude, bodyY, contactErrorMean: meanError, contactErrorMax: maxError, plantedCount,
    secondaryMotion: living.diagnostics(),
    legs: legs.map(l => ({name: l.name, swing: l.swing, error: l.error, toe: l.toe.getWorldPosition(new THREE.Vector3()).toArray(), goal: l.target.toArray()}))
  });
  const dispose = () => { for (const l of legs) { scene.remove(l.shadow); l.shadow.material.dispose(); } shadowGeo.dispose(); texture.dispose(); };
  return {update, diagnostics, dispose, setVisible, snap};
}
