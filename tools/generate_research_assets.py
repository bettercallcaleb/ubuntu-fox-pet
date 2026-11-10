#!/usr/bin/env python3
import argparse
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path

PROMPT_VERSION = "semireal-fox-v1"
BASE = Path.home() / "chatgpt-workspace/ubuntu-fox-pet-research"
MODEL = Path.home() / "chatgpt-workspace/models/Qwen-Image-2.1-Turbo"
SIGMAS = [1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568]

JOBS = [
    {
        "id": "fox_master",
        "seed": 260411,
        "width": 1024,
        "height": 1024,
        "prompt": (
            "A high-end physically based 3D render of one small red fox with believable natural fox anatomy, "
            "realistic mammalian proportions, medium-size amber eyes, elongated narrow muzzle, triangular furry ears, "
            "four anatomically plausible paws, exquisite individual guard hairs and thick underfur, long full brush tail. "
            "Rich russet orange fur, ivory chest and muzzle, deeper maroon-brown ear tips and legs, subtle dark burgundy neck scarf "
            "with a very narrow plain burnt-orange stripe, no visible brand logo. "
            "Standing in a relaxed three-quarter pose, full body entirely in frame, face toward the viewer, grounded and coherent. "
            "Photorealistic wildlife CGI with the polished quality of a high-budget 3D film creature, "
            "global illumination, physically plausible soft area lighting, microfibers, detailed PBR materials, natural eye reflections. "
            "Single subject isolated on a perfectly uniform vivid chroma key green #00FF00 studio backdrop, evenly lit, "
            "no environment, no props, no added floor, no motion blur, no drawings, no text. "
            "Important: not chibi, not anime, not plush doll, not illustration, not enlarged eyes, not oversized head, not a mascot."
        ),
    },
    {
        "id": "room_empty",
        "seed": 260412,
        "width": 1312,
        "height": 736,
        "prompt": (
            "A photorealistic 3D cutaway miniature cedar cabin room for a small pet fox, 16:9 landscape environment asset, "
            "premium architectural visualization, warm naturally aged wood and authentic fine textures. "
            "The room is an elegant open-front diorama showing three-quarter perspective and a large visible open central floor space. "
            "LEFT: soft burgundy fabric pet bed and small woven wool blanket. "
            "CENTER BACK: deep round window revealing distant misty mountains at twilight, physically correct glazing. "
            "RIGHT: small wood workstation with realistic compact monitor showing only a generic blank black terminal, cozy desk lamp, books. "
            "MID RIGHT: handcrafted wooden cat climbing tower with rope-wrapped pillars. "
            "FRONT RIGHT: shallow ceramic water and food bowl and one leather ball toy. "
            "Natural linen upholstery, real wood pores, subtle scratches, brushed metal, fabric fibers, sophisticated warm tungsten light "
            "versus cool dusk skylight, realistic reflections, contact shadows, filmic color grading, high-end game environment render, "
            "clearly navigable floor area reserved for an independently animated fox. "
            "Absolutely NO fox, NO animal, NO pet, NO people, NO character, NO painting of fox, "
            "NO text, NO buttons, NO game HUD, NO labels, NO poster, NO flat art, NO cartoon, NO anime, NO exaggerated colors. "
            "Camera orthographic-like isometric 3/4 from slightly above, all furniture entirely visible, front wall removed."
        ),
    },
    {
        "id": "sleep_pose",
        "seed": 260414,
        "width": 1024,
        "height": 1024,
        "prompt": (
            "An anatomically realistic adult red fox sleeping deeply, curled up in a comfortable compact oval, "
            "eyes gently closed, muzzle resting on its front paws, full fluffy tail wrapping around the flank. "
            "Fine photographic orange and white guard hairs, black lower legs, realistic ear fur and natural body proportions. "
            "High-budget physically based 3D wildlife creature render, exact same orange-red and ivory fox identity, "
            "fixed front 3/4 camera, entire body fully visible, no cut-off paws or tail, soft shadows and natural fur. "
            "Isolated against a perfectly solid vivid chroma green #00FF00 seamless background, no cast shadows, "
            "no scenery, no text, no watermarks, no extra objects, no cartoons, no anime, no chibi, no oversize eyes."
        ),
    },
    {
        "id": "walk_sheet",
        "seed": 260413,
        "width": 1312,
        "height": 736,
        "prompt": (
            "A production animation contact sheet, precisely 4 columns and 2 rows of 8 equal-sized square-ish cells, "
            "featuring the EXACT SAME realistic small red fox character with slender real-fox anatomy, detailed reddish fur, "
            "ivory muzzle/chest, dark maroon lower legs, long brush tail and subtle thin maroon neck scarf with burnt orange stripe. "
            "Eight sequential side-on keyframes of a realistic quadrupedal walk cycle, no changes in identity or camera viewpoint. "
            "Frames in reading order from top-left to bottom-right: first contact, first down, first passing, first up, "
            "opposite contact, opposite down, opposite passing, opposite up. "
            "Physically convincing four-leg gait cycle with proper foot planting, correct alternating legs, believable shoulder/hip rotation "
            "and tail follow-through; fox body centered at exactly the same position and same scale in every cell. "
            "Fixed orthographic side view, high-quality physically based 3D CGI, coherent fur and shadows. "
            "Every cell contains ONE COMPLETE fox, fully within boundaries, identical color grading and lighting, "
            "solid vivid chroma key green #00FF00 background in every cell, no borders, no lines, no captions, no numbers, no text. "
            "No chibi, anime, cartoon, illustration, oversized eyes, deformed paws, additional limbs, or camera changes."
        ),
    },
]

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def main():
    parser=argparse.ArgumentParser()
    global BASE, MODEL
    parser.add_argument("--only", choices=[j["id"] for j in JOBS], nargs="*")
    parser.add_argument("--model-dir", type=Path, default=MODEL)
    parser.add_argument("--out-dir", type=Path, default=BASE)
    args=parser.parse_args()
    BASE=args.out_dir.expanduser().resolve()
    MODEL=args.model_dir.expanduser().resolve()
    jobs=[j for j in JOBS if not args.only or j["id"] in args.only]
    BASE.mkdir(parents=True,exist_ok=True)
    import torch, diffusers, transformers
    from diffusers import QwenImage21Pipeline
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA unavailable")
    print("CHECK", torch.cuda.get_device_name(0), "jobs", [x["id"] for x in jobs], flush=True)
    model_index=sha(MODEL/"model_index.json")
    print("LOADING", MODEL, flush=True)
    pipe=QwenImage21Pipeline.from_pretrained(str(MODEL),dtype=torch.bfloat16,local_files_only=True)
    pipe.enable_model_cpu_offload(gpu_id=0)
    pipe.vae.enable_tiling()
    pipe.set_progress_bar_config(disable=True)
    print("LOADED",flush=True)
    for job in jobs:
        start=time.monotonic()
        out=BASE/f'{job["id"]}.png'
        print("GENERATING",job["id"],job["width"],job["height"],"seed",job["seed"],flush=True)
        with torch.inference_mode():
            im=pipe(prompt=job["prompt"], width=job["width"],height=job["height"], true_cfg_scale=1.0,
                    num_inference_steps=8,sigmas=SIGMAS,use_kv_cache=True,
                    generator=torch.Generator("cpu").manual_seed(job["seed"])).images[0]
        im.save(out)
        record={
            "schema":"ubuntu-fox.asset-experiment.v1",
            "asset_id":job["id"],
            "created_at":datetime.now(timezone.utc).isoformat(),
            "model":"Qwen-Image-2.1-Turbo",
            "model_license":"Qwen Research License; non-commercial research/evaluation; review before redistribution",
            "model_index_sha256":model_index,
            "seed":job["seed"],
            "prompt":job["prompt"],
            "size":list(im.size),
            "steps":8,
            "sigmas":SIGMAS,
            "true_cfg_scale":1,
            "use_kv_cache":True,
            "cpu_offload":True,
            "torch":torch.__version__,
            "diffusers":diffusers.__version__,
            "transformers":transformers.__version__,
            "output_sha256":sha(out),
            "seconds":round(time.monotonic()-start,1),
            "ready_for_release":False,
        }
        (BASE/f'{job["id"]}.json').write_text(json.dumps(record,indent=2)+"\n")
        print("DONE",job["id"],out,im.size,"time",record["seconds"],"sha",record["output_sha256"][:16],flush=True)
    print("PIPELINE_COMPLETE",flush=True)

if __name__=="__main__":
    main()
