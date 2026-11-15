# FOX / 23 — Licensed animated model integration

FOX / 23 supports optional locally licensed GLB fox models with native skeletal animation. It does **not** include or redistribute a commercial asset. By default, the app still starts with the existing CC0/CC BY 4.0 realistic fox, and the Premium Fox selector stays hidden until a valid local asset file is present.

## Recommended candidate (not purchased)

Radbill **Fox - Male**, TurboSquid product ID **2107378**: https://www.turbosquid.com/3d-models/3d-fox-male-model-2107378

The product listing describes 57 bones, approximately 14,500 polygons, four LOD levels, 4K textures and more than 100 animations (in-place and root-motion). Available formats are FBX, Blender 2.79 and OBJ, **not GLB**. Its polygon count is substantially smaller than the currently rendered high-resolution CC0 animal: the rationale for testing it is *native quadruped animation*, not greater vertex detail.

Alternative for higher surface detail and a direct GLB: [Red Fox - Animated 3D Model on Fab](https://www.fab.com/listings/09727441-15dd-4fed-8773-c748f0c18cc4), which advertises 43 joints, 28,607 triangles including skinned fur cards, 4K texture maps and eight animations. It lacks the breadth of the Radbill animation library, including dedicated sleep/sit routines. A more detailed FBX-only alternative is the [Nestaeric Red Fox on RenderHub](https://www.renderhub.com/nestaeric/red-fox-3d-model): about 48,534 polygons, 45,000 vertices, 22 animation tracks, 2K textures and a displayed $68 price. These are **unverified vendor claims**, not model assets installed or tested in this project.

Do not pay solely based on the claimed compatibility of FOX / 23. Confirm that the purchased package really contains the rig, walk/idle cycles, textures, and licenses you need. Preview/download terms may change.

## After acquiring and extracting the authorized asset

On Ubuntu, in the repository:

```bash
cd real3d
bash tools/install-premium-fox.sh "/path/to/licensed/fox.fbx"
```

The installer supports `.fbx`, `.blend`, and `.glb`. For FBX or Blender sources, it uses the installed Blender to export glTF 2.0 binary, preserving any compatible actions and textures. It refuses any model lacking skinned joints or identifiable walk/idle animations. It writes the resulting file to **`real3d/assets/premium/fox-premium.glb`**, outside Git and outside the project's distributable assets.

Refresh the desktop app. A **Premium Fox** button then appears below Pause. Select it to switch to the native-animation model, or select it again to return to Real Fur. The existing model-selector button also includes Premium when installed.

Tuning is optional. Edit the **ignored** local file `assets/premium/fox-premium.json`:

```json
{"forwardAxis":"+Z","modelHeight":1.2,"walkCycleDistance":0.65}
```

Choose the model's forward direction (`+X`, `-X`, `+Z`, `-Z`) after inspecting the actual FBX/GLB. `walkCycleDistance` should match the world distance per authored walk cycle; the default is a starting point, **not** a measured property of Radbill's model. Refresh after editing.

## Engineering decisions and limitations

Native animation clips are chosen from descriptive action names (walk, idle, sit, sleep, eat, play, jump and turn) with in-place animations preferred over root-motion variants. Horizontal translation on root skeleton tracks is anchored, leaving scene navigation in control of world movement. Native clips blend using Three.js `AnimationMixer`; the old hand-written 4-leg gait and 29-bone motion logic are skipped for the licensed model. Its source skeleton must be compatible with the glTF exporter; if not, the installer stops rather than silently providing a broken model.

Missing, invalid, or corrupted premium assets must not replace a successfully loaded default fox. The app does not automatically publish the licensed geometry. No commercial asset files, source texture archives, extracted textures, or license keys belong in this repository.

Validation: `node check-premium-v23.mjs` covers semantic clip selection, root-motion anchoring, joint requirements, and forward axes. The Blender conversion pipeline was exercised with a separately licensed Bake3D 29-joint/3-clip fox and independently verified as valid GLB. `node check-premium-v23-live.mjs` is an opt-in real-browser test requiring a local stand-in at the private premium asset path; the file is removed when testing finishes.

**Not yet verified:** Radbill's actual paid asset, its true action naming convention, complete 100+ clip export, fur rendering fidelity, or foot-to-floor contact. Those can only be verified from the authorized deliverable.
