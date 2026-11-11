import bpy,sys,time,json
from pathlib import Path

argv=sys.argv[sys.argv.index("--")+1:]
name=argv[0]
frame=int(argv[1])
count=int(argv[2])
output=Path(argv[3])
width=int(argv[4])
scene=bpy.data.scenes[name]
if bpy.context.window:bpy.context.window.scene=scene
scene.frame_start=frame
scene.frame_end=frame+count-1
scene.frame_set(frame)
scene.render.resolution_x=width
scene.render.resolution_y=round(width*1920/4096)
scene.render.resolution_percentage=100
scene.render.use_file_extension=True
scene.render.filepath=str(output.with_suffix(""))
scene.render.image_settings.file_format="FFMPEG"
scene.render.ffmpeg.format="MPEG4"
scene.render.ffmpeg.codec="H264"
scene.render.ffmpeg.constant_rate_factor="HIGH"
scene.render.ffmpeg.ffmpeg_preset="REALTIME"
scene.render.fps=24
if scene.render.engine=="CYCLES":
 pref=bpy.context.preferences.addons["cycles"].preferences
 pref.compute_device_type="OPTIX"
 pref.get_devices()
 for d in pref.devices:d.use=(d.type=="OPTIX" and "4090" in d.name)
 scene.cycles.device="GPU"
 scene.cycles.samples=12
 scene.cycles.use_denoising=True
 print("RTX4090_SELECTED",[d.name for d in pref.devices if d.use],flush=True)
else:
 print("EEVEE_GPU_BACKEND",bpy.context.preferences.system.gpu_backend,flush=True)
print("MOVIE_CFG",json.dumps({"scene":scene.name,"frames":[scene.frame_start,scene.frame_end],"resolution":[scene.render.resolution_x,scene.render.resolution_y],"engine":scene.render.engine,"format":scene.render.image_settings.file_format,"output":scene.render.filepath}),flush=True)
start=time.monotonic()
bpy.ops.render.render(animation=True,scene=scene.name)
print("MOVIE_DONE",json.dumps({"duration_sec":round(time.monotonic()-start,2),"bytes":output.stat().st_size if output.exists() else None}),flush=True)
