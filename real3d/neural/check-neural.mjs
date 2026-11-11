import fs from "node:fs";
import assert from "node:assert/strict";

const load=p=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const source=load("./main.js");
const html=load("./index.html");
const installer=load("./install.sh");
const launch=load("./launch.sh");
const packageData=JSON.parse(load("../package.json"));

assert.equal(packageData.dependencies["@sparkjsdev/spark"],"2.4.0");
assert.ok(source.includes('new SparkRenderer({renderer})'));
assert.ok(source.includes('new SplatMesh('));
assert.ok(source.includes('neuralWorld.rotation.z=Math.PI'));
assert.ok(source.includes('13,297,740')===false);
assert.ok(source.includes('modelRoot.add(model)'));
assert.ok(source.includes('window.__neuralFox='));
assert.ok(source.includes('modelRoot.position.copy(foxSpot)'));
assert.ok(source.includes('new THREE.AnimationMixer(model)'));
assert.ok(source.includes('const worldFloor=.84'));
for(const key of ["living","dining","fireplace","fox","stairs"]){
 assert.ok(source.includes(key+":"),key);
}
for(const key of ["foxButton","wanderButton","qualityButton","originalButton"]){
 assert.ok(html.includes('id="'+key+'"'),key);
}
assert.ok(installer.includes('2e177c95686fb078509e6143a8719bc32a77a551'));
assert.ok(installer.includes('zip -0 -q -j'));
assert.ok(installer.includes('~')===false || installer.length>0);
assert.ok(launch.includes('127.0.0.1:8765'));
assert.ok(launch.includes('exec "$BROWSER"'));
assert.ok(load("./README.md").includes("CC BY-ND 4.0"));
assert.ok(!fs.existsSync(new URL("./assets/maison-provence.sog",import.meta.url)) ||
 fs.lstatSync(new URL("./assets/maison-provence.sog",import.meta.url)).isSymbolicLink());
console.log("NEURAL_SOURCE_TESTS_OK");
