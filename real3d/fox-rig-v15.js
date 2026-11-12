import * as THREE from "./node_modules/three/build/three.module.js";

// Rig helpers for the 29-bone fox.
//
// 1. createPoseKit: pose bones with *semantic* fox-space angles (nose down / turn left / lean right)
//    regardless of how each bone's local axes happen to be oriented in the glTF.
// 2. aimBone / solveTwoBone: small analytic IK building blocks for the legs.
//
// Fox space: +x forward, +y up, +z the animal's right (the same frame as foxRoot).

const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion();
const qR = new THREE.Quaternion(), qDelta = new THREE.Quaternion();

export function createPoseKit({ rigged, foxRoot }) {
  let restFox = null;

  function build() {
    if (restFox) return true;
    if (!rigged.bones?.size || !rigged.boneRest) return false;
    const rootInv = new THREE.Quaternion();
    if (foxRoot) {
      foxRoot.updateMatrixWorld(true);
      foxRoot.getWorldQuaternion(rootInv);
      rootInv.invert();
    }
    // World rest orientation of every bone, built from the stored rest quaternions so the
    // result does not depend on whatever pose the skeleton is in right now.
    const cache = new Map();
    const worldRest = bone => {
      if (cache.has(bone)) return cache.get(bone);
      let parentQ;
      if (bone.parent && bone.parent.isBone) parentQ = worldRest(bone.parent);
      else if (bone.parent) {
        bone.parent.updateWorldMatrix(true, false);
        parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      } else parentQ = new THREE.Quaternion();
      const q = parentQ.clone().multiply(rigged.boneRest.get(bone.name) || bone.quaternion);
      cache.set(bone, q);
      return q;
    };
    restFox = new Map();
    for (const [name, bone] of rigged.bones) restFox.set(name, rootInv.clone().multiply(worldRest(bone)));
    return true;
  }

  // pitch > 0: front goes down / rear goes up. yaw > 0: turn left. roll > 0: lean right.
  function pose(name, pitch = 0, yaw = 0, roll = 0) {
    if (!build()) return;
    const bone = rigged.bones.get(name), rest = rigged.boneRest.get(name), qw = restFox.get(name);
    if (!bone || !rest || !qw) return;
    q1.setFromAxisAngle(AZ, -pitch);
    q2.setFromAxisAngle(AY, yaw);
    q3.setFromAxisAngle(AX, roll);
    qR.copy(q2).multiply(q1).multiply(q3);
    qDelta.copy(qw).invert().multiply(qR).multiply(qw);
    bone.quaternion.copy(rest).multiply(qDelta);
  }

  return { pose, ready: build, restQuat: name => (build() ? restFox.get(name) : null) };
}

const pa = new THREE.Vector3(), pb = new THREE.Vector3(), cur = new THREE.Vector3();
const wq = new THREE.Quaternion(), pq = new THREE.Quaternion(), arc = new THREE.Quaternion();

// Rotate `bone` (and everything below it) by the shortest arc that makes the direction
// bone -> child point along `dir` (unit, world space).
export function aimBone(bone, child, dir) {
  bone.getWorldPosition(pa);
  child.getWorldPosition(pb);
  cur.subVectors(pb, pa);
  if (cur.lengthSq() < 1e-10) return;
  cur.normalize();
  arc.setFromUnitVectors(cur, dir);
  bone.getWorldQuaternion(wq);
  wq.premultiply(arc);
  bone.parent.getWorldQuaternion(pq).invert();
  bone.quaternion.copy(pq.multiply(wq));
  bone.updateMatrixWorld(true);
}

const dv = new THREE.Vector3(), perp = new THREE.Vector3();

// Analytic two-bone solve. Writes the middle joint into outK and the (possibly clamped)
// reachable end position into outE. bend is the preferred direction for the middle joint.
export function solveTwoBone(H, l1, l2, T, bend, outK, outE) {
  dv.subVectors(T, H);
  let dist = dv.length();
  const maxR = l1 + l2 - 1e-4, minR = Math.abs(l1 - l2) + 1e-3;
  if (dist < 1e-6) dv.set(0, -1, 0), dist = 1e-6; else dv.multiplyScalar(1 / dist);
  dist = Math.min(maxR, Math.max(minR, dist));
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  perp.copy(bend).addScaledVector(dv, -bend.dot(dv));
  if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1).addScaledVector(dv, -dv.z);
  perp.normalize();
  outK.copy(H).addScaledVector(dv, a).addScaledVector(perp, h);
  outE.copy(H).addScaledVector(dv, dist);
}
