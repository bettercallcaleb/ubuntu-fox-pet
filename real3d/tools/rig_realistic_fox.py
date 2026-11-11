import bpy,sys,time
from pathlib import Path
from mathutils import Matrix

args=sys.argv[sys.argv.index("--")+1:]
source=Path(args[0])
real=Path(args[1])
dest=Path(args[2])
start=time.monotonic()
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
rig=next(o for o in bpy.context.scene.objects if o.type=="ARMATURE")
src=bpy.data.objects["model"]
print("ORIGINAL",len(src.data.vertices),[(g.name,g.index) for g in src.vertex_groups[:8]],"ACTIONS",[a.name for a in bpy.data.actions],flush=True)
bpy.ops.import_scene.gltf(filepath=str(real))
target=bpy.data.objects["fox"]
print("TARGET",len(target.data.vertices),"BEFORE",len(target.vertex_groups),flush=True)
transform=Matrix(((0,.47,0,0),(-.83,0,0,0),(0,0,.83,0),(0,0,0,1)))
target.data.transform(transform)
target.data.update()
for group in src.vertex_groups:
 target.vertex_groups.new(name=group.name)
transfer=target.modifiers.new("Transfer 29-bone skin weights","DATA_TRANSFER")
transfer.object=src
transfer.use_vert_data=True
transfer.data_types_verts={"VGROUP_WEIGHTS"}
transfer.vert_mapping="POLYINTERP_NEAREST"
transfer.layers_vgroup_select_src="ALL"
transfer.layers_vgroup_select_dst="NAME"
transfer.mix_mode="REPLACE"
bpy.ops.object.select_all(action="DESELECT")
target.select_set(True)
bpy.context.view_layer.objects.active=target
bpy.ops.object.modifier_apply(modifier=transfer.name)
print("WEIGHTS_TRANSFERRED",len(target.data.vertices),"GROUPS",len(target.vertex_groups),"seconds",round(time.monotonic()-start,1),flush=True)
arm=target.modifiers.new("Realistic fox skin","ARMATURE")
arm.object=rig
target.parent=rig
target.matrix_parent_inverse.identity()
rig.matrix_world.identity()
# Verify weights
counts=[]
for v in target.data.vertices:
 counts.append(len(v.groups))
print("GROUP_STATS",sum(1 for n in counts if n==0),"empty",sum(counts)//len(counts),"avg","MESH",sum(len(o.data.vertices) for o in bpy.context.scene.objects if o.type=="MESH"),flush=True)
bpy.data.objects.remove(src,do_unlink=True)
for obj in list(bpy.context.scene.objects):
 if obj not in (rig,target):bpy.data.objects.remove(obj,do_unlink=True)
for o in (target,rig):o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(dest),export_format="GLB",export_animations=True,export_animation_mode="ACTIONS",export_image_format="AUTO",use_selection=True)
print("REAL_FOX_EXPORT",dest.stat().st_size,"TIME",round(time.monotonic()-start,1),"ACTIONS",[a.name for a in bpy.data.actions],flush=True)
