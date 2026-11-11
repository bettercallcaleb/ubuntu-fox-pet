import bpy,sys,time,math,json
from pathlib import Path
from mathutils import Vector

src=Path(sys.argv[sys.argv.index("--")+1])
out=Path(sys.argv[sys.argv.index("--")+2])
start=time.monotonic()
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(src))
fox=next(o for o in bpy.context.scene.objects if o.type=="MESH" and o.name.lower().startswith("fox"))
rig=next(o for o in bpy.context.scene.objects if o.type=="ARMATURE")
for action in bpy.data.actions:
    if rig.animation_data:
        rig.animation_data.action=None
rig.data.pose_position="REST"
scene=bpy.context.scene
scene.render.engine="CYCLES"
pref=bpy.context.preferences.addons["cycles"].preferences
pref.compute_device_type="OPTIX"
pref.get_devices()
for dev in pref.devices:dev.use=(dev.type=="OPTIX" and "4090" in dev.name)
selected=[d.name for d in pref.devices if d.use]
if len(selected)!=1 or "4090" not in selected[0]:raise RuntimeError("4090 not exclusive: "+str(selected))
scene.cycles.device="GPU";scene.cycles.samples=128
scene.cycles.use_denoising=True
scene.render.resolution_x=1800;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.filepath=str(out)
scene.view_settings.view_transform="AgX"
scene.view_settings.exposure=-.38
scene.render.film_transparent=False

bpy.ops.mesh.primitive_plane_add(size=8,location=(0,0,-.035))
ground=bpy.context.object
ground.name="Studio stone floor"
mat=bpy.data.materials.new("Aged graphite plaster");mat.diffuse_color=(.21,.23,.25,1);mat.use_nodes=True
bsdf=mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value=(.23,.24,.26,1)
bsdf.inputs["Roughness"].default_value=.82
noise=mat.node_tree.nodes.new("ShaderNodeTexNoise");noise.inputs["Scale"].default_value=47
bump=mat.node_tree.nodes.new("ShaderNodeBump");bump.inputs["Strength"].default_value=.15;bump.inputs["Distance"].default_value=.015
mat.node_tree.links.new(noise.outputs["Fac"],bump.inputs["Height"])
mat.node_tree.links.new(bump.outputs["Normal"],bsdf.inputs["Normal"])
ground.data.materials.append(mat)
ground.is_shadow_catcher=False

world=bpy.data.worlds.new("Warm photography studio");scene.world=world;world.use_nodes=True
world.node_tree.nodes.get("Background").inputs["Color"].default_value=(.17,.21,.25,1)
world.node_tree.nodes.get("Background").inputs["Strength"].default_value=.55

def look_at(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
def softbox(name,pos,power,w,h,color):
    bpy.ops.object.light_add(type="AREA",location=pos)
    lamp=bpy.context.object;lamp.name=name;lamp.data.energy=power;lamp.data.color=color
    lamp.data.shape="RECTANGLE";lamp.data.size=w;lamp.data.size_y=h
    look_at(lamp,(0,0,.32))
softbox("Large cinematic key",(-1.3,-1.65,2.8),260,3.2,3.0,(1,.88,.78))
softbox("Golden rim",(.8,1.9,2.1),250,2.1,2.3,(1,.8,.63))
softbox("Cool fill",(1.9,-.85,1.35),110,2.4,2.1,(.71,.83,1))
softbox("Top glint",(-.7,.45,3.2),110,2.7,2.7,(1,1,1))

bpy.ops.object.camera_add(location=(-1.18,1.45,.96))
camera=bpy.context.object;camera.name="Hero 4090";look_at(camera,(0,-.02,.35))
camera.data.type="ORTHO";camera.data.ortho_scale=1.80
scene.camera=camera
print("RENDER_PROOF",json.dumps({"mesh_vertices":len(fox.data.vertices),"joints":len(rig.data.bones),"gpu":selected,"samples":scene.cycles.samples,"pixels":[scene.render.resolution_x,scene.render.resolution_y],"source":src.name}),flush=True)
bpy.ops.render.render(write_still=True)
print("RTX4090_REAL_FOX_RENDER_OK",round(time.monotonic()-start,2),"bytes",out.stat().st_size,flush=True)
