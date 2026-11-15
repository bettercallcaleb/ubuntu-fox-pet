import bpy
import json
import os
import sys

args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
if len(args)!=2:
    raise SystemExit("Usage: blender -b --python tools/convert-premium-fox.py -- SOURCE.fbx|SOURCE.blend OUTPUT.glb")
source=os.path.abspath(args[0])
output=os.path.abspath(args[1])
if not os.path.isfile(source):
    raise SystemExit("Source not found: "+source)
if source.lower().endswith(".fbx"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=source,use_anim=True)
elif source.lower().endswith(".blend"):
    bpy.ops.wm.open_mainfile(filepath=source,load_ui=False)
else:
    raise SystemExit("Provide .fbx or .blend; .glb can be installed directly")

armatures=[o for o in bpy.data.objects if o.type=="ARMATURE"]
meshes=[o for o in bpy.data.objects if o.type=="MESH"]
if not armatures or not meshes:
    raise SystemExit("Model must contain both armature and mesh")
clips=[a.name for a in bpy.data.actions]
strips=[strip.name for obj in bpy.data.objects if obj.animation_data for track in obj.animation_data.nla_tracks for strip in track.strips]
if not clips and not strips:
    raise SystemExit("No animation actions or NLA strips found")
bound=[o for o in meshes if o.find_armature() in armatures]
if not bound:
    raise SystemExit("No skinned meshes connected to an armature")
keep=set(bound)
keep.update(o.find_armature() for o in bound)
bpy.ops.object.select_all(action="DESELECT")
for obj in keep:
    obj.hide_set(False)
    obj.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in keep if o.type=="ARMATURE")
os.makedirs(os.path.dirname(output),exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=output,
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_merge_animation="NONE",
    export_force_sampling=True,
    export_optimize_animation_size=True,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_skins=True,
    export_materials="EXPORT"
)
if not os.path.exists(output) or os.path.getsize(output)<1000:
    raise SystemExit("GLB conversion failed")
print(json.dumps({"status":"EXPORTED","output":output,"bytes":os.path.getsize(output),"armatures":[o.name for o in armatures],"meshes":len(meshes),"exportedMeshes":len(bound),"actions":clips,"nlaStrips":strips},ensure_ascii=False))
