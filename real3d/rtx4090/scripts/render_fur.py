import bpy,sys,time,json
from pathlib import Path

mode=sys.argv[sys.argv.index("--")+1]
frame=int(sys.argv[sys.argv.index("--")+2])
output=Path(sys.argv[sys.argv.index("--")+3])
out_width=int(sys.argv[sys.argv.index("--")+4])
start=time.monotonic()
scene=bpy.data.scenes.get(mode) if mode in bpy.data.scenes else bpy.context.scene
if mode=="panthera":scene=bpy.context.scene
if mode=="overgrown":scene=bpy.context.scene
if scene is None:raise SystemExit("Scene missing")

scene.frame_set(frame)
scene.render.resolution_x=out_width
base_width=4096 if mode in ("Nunchucks","The Cat") else (1000 if mode=="panthera" else 2000)
base_height=1920 if mode in ("Nunchucks","The Cat") else (500 if mode=="panthera" else 1000)
scene.render.resolution_y=round(out_width*base_height/base_width)
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.filepath=str(output)
scene.render.film_transparent=False
if scene.render.engine=="CYCLES":
    preferences=bpy.context.preferences.addons["cycles"].preferences
    preferences.compute_device_type="OPTIX"
    preferences.get_devices()
    for d in preferences.devices:
        d.use=("4090" in d.name and d.type=="OPTIX")
    scene.cycles.device="GPU"
    scene.cycles.samples=64 if mode=="panthera" else 32
    scene.cycles.use_denoising=True
    try:
        scene.cycles.max_bounces=9
    except Exception:pass
    selected=[d.name for d in preferences.devices if d.use]
    if len(selected)!=1 or "4090" not in selected[0]:raise SystemExit("Not exactly RTX 4090: "+repr(selected))
    print("RTX4090_SELECTED",selected,flush=True)
else:
    print("EEVEE_GPU_BACKEND",bpy.context.preferences.system.gpu_backend,flush=True)
print("RENDER_CONFIG",json.dumps({"scene":scene.name,"frame":frame,"width":scene.render.resolution_x,"height":scene.render.resolution_y,"samples":scene.cycles.samples if scene.render.engine=="CYCLES" else None,"engine":scene.render.engine,"output":str(output)}),flush=True)
bpy.ops.render.render(scene=scene.name,write_still=True)
print("RENDER_FINISHED",json.dumps({"seconds":round(time.monotonic()-start,2),"bytes":output.stat().st_size if output.exists() else 0}),flush=True)
