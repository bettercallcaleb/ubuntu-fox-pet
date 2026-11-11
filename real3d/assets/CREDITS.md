# Model attribution

The bundled Fox.glb is from Khronos glTF Sample Assets:
https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox

- Original 3D fox mesh: PixelMannen, public domain CC0 1.0.
- Rigging and animation: tomkranis, Creative Commons Attribution 4.0 International.
- Conversion to glTF: @AsoboStudio and @scurest, Creative Commons Attribution 4.0 International.
- Source metadata: https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Fox/README.md
- CC BY 4.0 license: https://creativecommons.org/licenses/by/4.0/
- The model is included unmodified; the game applies runtime transforms, lighting, shadows and animations.

Application source is MIT-licensed. The separately attributed model retains its respective CC0 and CC BY 4.0 terms.

## Enhanced fox (v7)

- Source: [Bake3D Free 3D Models — Fox](https://bake3d.ai/free-3d-models)
- File: \`Fox_Enhanced.glb\`, cleaned using Blender 5.2.4 from the original Bake3D animated GLB.
- Author: Bake3D.
- License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); attribution required.
- Changes: removed demonstration cube, icosphere, camera and light; kept textured animal mesh, original skinning and animations. No changes to the 29-bone skeleton or the Walk, Tail wag and Look around clips.
- The original Bake3D license and model creator attribution must remain with redistributed versions.

## Physical materials (v7)

- WoodFloor051 and Plaster001: [ambientCG](https://ambientcg.com/), CC0.
- Included maps: base color, OpenGL normal and roughness in 1K JPEG resolution.
- The materials are loaded at runtime; GPU hardware and color management settings can influence their appearance.


## Atelier habitat PBR materials (v8)

All five texture sets are provided by ambientCG (https://ambientcg.com/) and released under CC0 1.0:
- Fabric030 — upholstered textiles, cushions, and soft furniture
- Carpet011 — rug fibers and micro-roughness
- Leather037 — chair upholstery
- WoodFloor051 — flooring and furniture timber
- Plaster001 — architectural plaster

Each set ships 1K color, OpenGL normal, and roughness maps.
Procedural furniture and artwork geometry are newly authored for this project.


## High-detail realistic fox (v12)

- Source: Grab3D Red Fox, https://grab3d.com/models/animals/fox/ — fox-light.glb.
- Original animal geometry, surface fur details and texture: Grab3D, CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/.
- Retargeted armature and source clips: Bake3D, CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. Attribution is required for their 29-joint skeleton included in Fox_Realistic_Rigged.glb.
- Changes: removed demonstration assets; reoriented and rescaled the mesh, transferred bone weights to 271,221 realistic vertices in Blender 5.3, and authored new procedural gait/neck/ears/tail animation.
- Reproducibility script: real3d/tools/rig_realistic_fox.py.
- RTX 4090 preview: real3d/docs/v12-fox-4090-optix.png, rendered from this exact model using Blender 5.3 Cycles GPU OptiX, 128 samples and 1800×1100 output.
