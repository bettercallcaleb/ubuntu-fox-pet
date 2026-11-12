import * as THREE from "./node_modules/three/build/three.module.js";
import { createPoseKit } from "./fox-rig-v15.js";

// Behaviour + posture layer for the realistic fox.
//
// Decides what the animal is doing (walk / idle / sleep / sit / eat / play / pet / jump),
// blends between those postures, and drives spine, head, ears and tail with semantic
// fox-space angles. The legs and the root height are handled by the grounded gait, which
// reads `posture` from here.

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const damp = (x, y, k, dt) => THREE.MathUtils.damp(x, y, k, dt);
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const BONES = ["hips", "spine0", "spine1", "chest", "neck", "head", "earL", "earR", "tail0", "tail1", "tail2", "tail3"];

export function createLivingFoxMotion({ fox, rigged, foxRoot }) {
  const kit = createPoseKit({ rigged, foxRoot });
  const W = { lie: 0, sit: 0, eat: 0, play: 0, happy: 0 };
  const posture = { drop: 0, lift: 0, lie: 0, sit: 0, crouch: 0, air: 0, play: 0, moveGate: 1, mode: "idle" };
  const acc = Object.fromEntries(BONES.map(n => [n, [0, 0, 0]]));
  const add = (name, pitch = 0, yaw = 0, roll = 0) => { const a = acc[name]; a[0] += pitch; a[1] += yaw; a[2] += roll; };

  let lastAction = null, actionStart = 0, jumpStart = -10;
  let nextLook = 0, lookYaw = 0, lookPitch = 0, lookTargetYaw = 0, lookTargetPitch = 0, headTilt = 0;
  let nextFlickL = 2, nextFlickR = 4.5, flickL = 0, flickR = 0, flickLT = -9, flickRT = -9;
  let lastOrientation = fox.orientation, turnVelocity = 0;
  let tailSwing = 0, breathing = 0, earTwitch = 0, state = "idle";

  function update(dt, t, locomotion = 0) {
    if (!rigged.ready || !rigged.enabled || rigged.variant !== "realistic" || !rigged.bones) return;
    if (!kit.ready()) return;
    for (const n of BONES) { const a = acc[n]; a[0] = a[1] = a[2] = 0; }

    // ---- what is the animal doing -------------------------------------------------------
    if (fox.action !== lastAction) {
      lastAction = fox.action;
      actionStart = t;
      if (fox.action === "jump") jumpStart = t;
    }
    const since = t - actionStart;
    const still = !fox.target;
    const d = clamp(locomotion, 0, 1);
    const walking = d > .3;
    if (still) {
      if (fox.action === "pet" && since > 2.8) fox.action = "idle";
      else if (fox.action === "food" && since > 6.5) fox.action = "idle";
      else if (fox.action === "play" && since > 4.2) fox.action = "idle";
      else if (fox.action === "jump" && since > 1.35) fox.action = "idle";
    }
    const act = fox.action;
    const up = (w, target, k) => damp(w, target, target > w ? k : k * 1.4, dt);
    W.lie = up(W.lie, still && !walking && (act === "sleep" || act === "bed") ? 1 : 0, 2.2);
    W.sit = up(W.sit, still && !walking && (act === "desk" || act === "window") ? 1 : 0, 2.8);
    W.eat = up(W.eat, still && !walking && act === "food" ? 1 : 0, 4.2);
    W.play = up(W.play, still && !walking && act === "play" ? 1 : 0, 5);
    W.happy = up(W.happy, !walking && act === "pet" ? 1 : 0, 6);

    // jump timeline: crouch -> launch -> tucked flight -> landing compression
    let jc = 0, jl = 0, ja = 0, jp = 0;
    if (still && act === "jump") {
      const s = t - jumpStart;
      if (s < .34) { jc = smooth(s / .34); }
      else if (s < .88) {
        const u = (s - .34) / .54;
        jl = .46 * 4 * u * (1 - u);
        ja = Math.sin(Math.PI * u);
        jc = Math.max(0, 1 - (s - .34) / .1) * .8;
        jp = -.3 * Math.cos(Math.PI * u);
      } else if (s < 1.3) { jc = .85 * (1 - smooth((s - .88) / .42)); }
    }

    const sitW = W.sit, lieW = W.lie, eatW = W.eat, playW = W.play, happyW = W.happy;
    state = lieW > .5 ? "sleep" : sitW > .5 ? "sit" : eatW > .5 ? "sniff" : (playW > .5 || happyW > .5) ? "play"
      : act === "jump" && still ? "jump" : walking ? "walk" : "idle";
    const rest = clamp(1 - Math.max(lieW, sitW, eatW, playW, happyW, d, jc), 0, 1);

    // ---- locomotion terms ---------------------------------------------------------------
    const rotationDelta = Math.atan2(Math.sin(fox.orientation - lastOrientation), Math.cos(fox.orientation - lastOrientation));
    lastOrientation = fox.orientation;
    turnVelocity = damp(turnVelocity, clamp(rotationDelta / Math.max(.015, dt), -3.4, 3.4), 6, dt);
    const phi = (fox.phase || 0) * TAU;
    const s1 = Math.sin(phi + .2), s2 = Math.sin(2 * phi + .5), c1 = Math.sin(phi + .9);

    // ---- breathing + gaze ---------------------------------------------------------------
    const sleeping = lieW > .5;
    breathing = Math.sin(t * (sleeping ? 1.35 : 2.5));
    const inhale = breathing * (sleeping ? .04 : .022) * (1 - .6 * d);

    if (t >= nextLook) {
      const e = Math.floor(t * 7) + 1;
      lookTargetYaw = (hash(e) - .5) * 1.15;
      lookTargetPitch = (hash(e + 9) - .5) * .4;
      nextLook = t + 1.9 + hash(e + 3) * 3.4;
    }
    const gaze = clamp(rest * 1 + sitW * .55 + eatW * .12 + playW * .25 + d * .22, 0, 1);
    lookYaw = damp(lookYaw, lookTargetYaw * gaze, 3.2, dt);
    lookPitch = damp(lookPitch, lookTargetPitch * gaze, 2.6, dt);
    headTilt = damp(headTilt, Math.sin(Math.floor(t / 3.1) * 1.73) * .14 * gaze, 2.4, dt);

    const sniffCycle = t % 13;
    const sniffing = rest > .6 && sniffCycle > 6 && sniffCycle < 9.2
      ? Math.sin(Math.PI * (sniffCycle - 6) / 3.2) : 0;
    const chew = eatW * (.5 + .5 * Math.sin(t * 5.2)) * (.5 + .5 * Math.sin(t * 1.3));

    // ---- spine -----------------------------------------------------------------------
    const shift = rest * Math.sin(t * .31) * Math.sin(t * .17 + 1);
    add("hips",
      -.64 * sitW - .03 * lieW + .5 * jp - .12 * jc + .016 * d + .025 * d * s2,
      .068 * d * s1 + .012 * rest * Math.sin(t * .23) + .1 * happyW * Math.sin(t * 7.5) + .05 * playW * Math.sin(t * 9),
      .03 * d * c1 + .028 * shift + .03 * happyW * Math.sin(t * 7.5 + 1));
    add("spine0",
      -.1 * sitW + .02 * lieW + .12 * playW + .03 * jc + .02 * d * Math.sin(2 * phi + .9),
      -.04 * d * s1 - .05 * happyW * Math.sin(t * 7.5),
      -.012 * d * c1);
    add("spine1",
      inhale * .6 - .08 * sitW + .05 * lieW + .06 * eatW + .12 * playW + .25 * jp + .1 * jc + .018 * d * Math.sin(2 * phi + 1.2),
      -.045 * d * s1 - .06 * happyW * Math.sin(t * 7.5),
      -.012 * d * c1);
    add("chest",
      inhale - .04 * sitW + .05 * lieW + .13 * eatW + .26 * playW + .25 * jp + .16 * jc - .012 * d * s2,
      -.034 * d * s1 - .04 * happyW * Math.sin(t * 7.5),
      .01 * d * c1 - .02 * shift);

    // ---- neck + head -----------------------------------------------------------------
    const walkNod = d * .045 * Math.sin(2 * phi + 1.3);
    add("neck",
      .05 + walkNod * .6 + .3 * sitW + .3 * lieW + .62 * eatW - .26 * happyW - .14 * playW - .1 * jp - .07 * jc
        + lookPitch * .4 + .1 * sniffing,
      lookYaw * .42 + .5 * lieW * 1 + .06 * d * s1 * -1,
      headTilt * .3 + .12 * lieW);
    add("head",
      .02 * breathing * (1 - d) + walkNod * .5 + .22 * sitW + .4 * lieW + .38 * eatW + .05 * chew - .24 * happyW - .26 * playW
        + lookPitch * .7 + .12 * sniffing * Math.sin(t * 9),
      lookYaw * .78 + .3 * lieW + .055 * d * s1,
      headTilt + .035 * d * c1 + .06 * happyW * Math.sin(t * 3.2) + .25 * lieW);

    // ---- ears ------------------------------------------------------------------------
    if (t >= nextFlickL) { flickLT = t; nextFlickL = t + 2.2 + hash(Math.floor(t * 3) + 4) * 5; }
    if (t >= nextFlickR) { flickRT = t; nextFlickR = t + 2.8 + hash(Math.floor(t * 3) + 8) * 6; }
    flickL = Math.max(0, 1 - (t - flickLT) / .28) * Math.sin((t - flickLT) * 38);
    flickR = Math.max(0, 1 - (t - flickRT) / .28) * Math.sin((t - flickRT) * 38);
    earTwitch = flickL;
    const alert = clamp(d * .8 + rest * .45 + sitW * .6, 0, 1);
    const back = clamp(happyW * .9 + playW * .5 + lieW * .8 + eatW * .25, 0, 1);
    const panL = .35 * Math.sin(t * .7 + 1) * rest, panR = .35 * Math.sin(t * .83 + 3) * rest;
    add("earL", .16 * alert - .45 * back + .06 * flickL, panL * .6 + .1, -(.1 + .22 * flickL) - .12 * back);
    add("earR", .16 * alert - .45 * back + .06 * flickR, -panR * .6 - .1, (.1 + .22 * flickR) + .12 * back);

    // ---- tail ------------------------------------------------------------------------
    const idleAmp = (.14 + .05 * Math.sin(t * .4)) * rest + .08 * sitW * 0;
    const wagAmp = .6 * happyW + .5 * playW;
    const wagRate = 7.6 * happyW + 8.4 * playW;
    const curl = [.3, .5, .62, .55];
    const curlW = lieW + .5 * sitW;
    tailSwing = damp(tailSwing, -.05 * turnVelocity, 4, dt);
    for (let i = 0; i < 4; i++) {
      const lag = i * .45;
      const grow = .5 + .22 * i;
      const walkYaw = .2 * d * grow * Math.sin(phi + .4 - lag);
      const idleYaw = idleAmp * grow * Math.sin(t * 1.5 - lag);
      const wag = wagAmp * grow * Math.sin(t * wagRate - lag);
      const yawLeft = (walkYaw + idleYaw + wag + tailSwing * (1 + i * .25)) * (1 - lieW) + curl[i] * curlW;
      const lift = (.05 * d * Math.sin(2 * phi - lag) + .03 * rest * Math.sin(t * .8 - lag) + .22 * happyW + .3 * playW
        + .1 * jc - .12 * ja - .05 * lieW - .1 * sitW) * (i === 0 ? 1.3 : .8);
      add("tail" + i, lift, -yawLeft, 0);
    }

    // ---- apply -----------------------------------------------------------------------
    for (const n of BONES) { const a = acc[n]; kit.pose(n, a[0], a[1], a[2]); }

    posture.drop = .3 * sitW + .262 * lieW + .035 * eatW + .12 * jc + .12 * playW;
    posture.lift = jl;
    posture.lie = lieW;
    posture.sit = sitW;
    posture.crouch = clamp(Math.max(eatW * .55, playW * .9, jc), 0, 1);
    posture.air = ja;
    posture.play = playW;
    posture.mode = state;
    posture.moveGate = 1 - clamp(1.5 * Math.max(lieW, sitW), 0, 1);
    fox.moveGate = posture.moveGate;
  }

  function diagnostics() {
    return {
      state, lookYaw, headTilt, tailSwing, breathing, earTwitch,
      posture: { ...posture }
    };
  }
  return { update, diagnostics, posture };
}
