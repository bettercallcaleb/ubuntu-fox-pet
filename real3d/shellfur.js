import * as THREE from "./node_modules/three/build/three.module.js";

// Skinned shell fur: N extruded copies of the skinned mesh that share the skeleton.
// Each shell discards pixels outside a procedural strand pattern, so silhouettes and
// surfaces get real volumetric fur that deforms with the animation.

function perVertexAttributes(geo, bones, spacing) {
  const pos = geo.getAttribute("position"), uv = geo.getAttribute("uv");
  const si = geo.getAttribute("skinIndex"), sw = geo.getAttribute("skinWeight");
  const n = pos.count;
  const scale = new Float32Array(n), weight = new Float32Array(n);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  const idx = geo.index;
  const tris = (idx ? idx.count : n) / 3;
  for (let t = 0; t < tris; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    const area3 = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * .5;
    const e1x = uv.getX(i1) - uv.getX(i0), e1y = uv.getY(i1) - uv.getY(i0);
    const e2x = uv.getX(i2) - uv.getX(i0), e2y = uv.getY(i2) - uv.getY(i0);
    const areaUv = Math.abs(e1x * e2y - e1y * e2x) * .5;
    if (areaUv < 1e-12 || area3 < 1e-12) continue;
    const k = Math.sqrt(area3 / areaUv) / spacing;
    for (const i of [i0, i1, i2]) { scale[i] += k * area3; weight[i] += area3; }
  }
  let fallback = 0, cnt = 0;
  for (let i = 0; i < n; i++) if (weight[i] > 0) { scale[i] /= weight[i]; fallback += scale[i]; cnt++; }
  fallback /= Math.max(1, cnt);
  for (let i = 0; i < n; i++) if (!(weight[i] > 0)) scale[i] = fallback;
  // Length multiplier by dominant bone region (tail longest, ears/feet short).
  const regionLen = name => {
    const s = name.toLowerCase();
    if (s.includes("tail")) return s.includes("tail3") ? 1.5 : 1.35;
    if (s.includes("ear")) return .35;
    if (s.includes("toe") || s.includes("foot")) return .4;
    if (s.includes("head")) return .75;
    if (s.includes("neck") || s.includes("chest")) return 1.35;
    return 1;
  };
  const lenByBone = bones.map(bone => regionLen(bone.name || ""));
  const len = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let l = 0, w = 0;
    for (let k = 0; k < 4; k++) { const ww = sw.getComponent(i, k); l += ww * (lenByBone[si.getComponent(i, k)] ?? 1); w += ww; }
    len[i] = w > 0 ? l / w : 1;
  }
  // Smooth lengths across neighbours a little so region borders do not step.
  return { scale, len };
}

function makeShellMaterial(base, uniforms) {
  const m = base.clone();
  m.transparent = false;
  m.alphaTest = .5;
  m.alphaToCoverage = true;
  m.side = THREE.FrontSide;
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
attribute float aUvScale;
attribute float aLen;
uniform float uLayer, uLen, uTime;
uniform vec3 uGravity;
varying vec2 vFurUv;
varying float vFurD;`)
      .replace("#include <skinning_vertex>", `#include <skinning_vertex>
{
 float l = uLen * aLen * uLayer;
 vec3 nrm = normalize(objectNormal);
 float sway = sin(uTime * 1.7 + position.x * 23.0 + position.z * 19.0) * .12 * uLayer;
 transformed += nrm * l + uGravity * l * uLayer * .55 + cross(nrm, vec3(0.0,1.0,0.0)) * l * sway * .3;
 vFurUv = uv; vFurD = aUvScale;
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uLayer;
varying vec2 vFurUv;
varying float vFurD;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
      .replace("#include <map_fragment>", `#include <map_fragment>
{
 vec2 cell = vFurUv * vFurD;
 vec2 id = floor(cell);
 vec2 f = fract(cell) - .5;
 float r = h21(id), r2 = h21(id + 7.7), r3 = h21(id + 3.1);
 vec2 jit = (vec2(r2, r3) - .5) * .45;
 float d = length(f - jit);
 float strandH = .35 + .65 * r;
 float rad = .52 * (1.0 - uLayer / strandH);
 float cov = (uLayer < strandH ? 1.0 : 0.0) * smoothstep(rad, rad * .6, d);
 if (uLayer < .01) cov = 1.0;
 float shade = mix(.62, 1.15, pow(uLayer, .7)) * (.88 + .24 * r2);
 diffuseColor.rgb *= shade;
 diffuseColor.a = cov;
}`);
  };
  return m;
}

export function addShellFur(src, opts = {}) {
  const { layers = 28, length = .034, spacing = 1 / 190, gravity = .5 } = opts;
  const geo = src.geometry;
  if (!geo.getAttribute("uv") || !geo.getAttribute("skinIndex")) return null;
  geo.computeBoundingBox();
  const size = geo.boundingBox.getSize(new THREE.Vector3());
  const ref = Math.max(size.x, size.y, size.z);
  const attrs = perVertexAttributes(geo, src.skeleton.bones, ref * spacing);
  geo.setAttribute("aUvScale", new THREE.BufferAttribute(attrs.scale, 1));
  geo.setAttribute("aLen", new THREE.BufferAttribute(attrs.len, 1));
  // Undercoat: darken the base mesh so the fur has depth.
  if (src.material.color) src.material.color.multiplyScalar(.78);
  const group = new THREE.Group();
  group.name = "shellFur";
  const grav = new THREE.Vector3(), inv = new THREE.Matrix4();
  const shells = [];
  for (let i = 1; i <= layers; i++) {
    const uniforms = {
      uLayer: { value: i / layers }, uLen: { value: ref * length },
      uTime: { value: 0 }, uGravity: { value: new THREE.Vector3(0, -gravity, 0) }
    };
    const mat = makeShellMaterial(src.material, uniforms);
    mat.color.copy(src.material.color).multiplyScalar(1 / .78);
    const shell = new THREE.SkinnedMesh(geo, mat);
    shell.bindMode = src.bindMode;
    shell.bind(src.skeleton, src.bindMatrix);
    shell.frustumCulled = false;
    shell.castShadow = false;
    shell.receiveShadow = true;
    shell.renderOrder = 1;
    shell.onBeforeRender = () => {
      // world-down expressed in the mesh's local space
      inv.copy(src.matrixWorld).invert();
      grav.set(0, -1, 0).transformDirection(inv).multiplyScalar(gravity);
      uniforms.uGravity.value.copy(grav);
      uniforms.uTime.value = performance.now() / 1000;
    };
    shells.push(shell);
    group.add(shell);
  }
  src.add(group);
  return group;
}
