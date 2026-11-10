from pathlib import Path
import argparse
import shutil
import json
import hashlib

import numpy as np
from PIL import Image, ImageFilter, ImageDraw

parser=argparse.ArgumentParser()
parser.add_argument("--input", type=Path, default=Path.home() / "chatgpt-workspace/ubuntu-fox-pet-research")
parser.add_argument("--install", action="store_true")
args=parser.parse_args()
root=args.input.expanduser().resolve()
out=root/"processed"
out.mkdir(exist_ok=True, parents=True)


def key_rgba(src, size=None):
    rgb = np.asarray(src.convert("RGB"), dtype=np.float32)
    r,g,b = rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    dominance = g-np.maximum(r,b)
    alpha = np.clip((70-dominance)/60,0,1)
    green_low = (g > r*1.24) & (g > b*1.35) & (g > 70)
    alpha[green_low] = np.minimum(alpha[green_low],np.clip((68-dominance[green_low])/48,0,1))
    alpha = np.asarray(Image.fromarray(np.uint8(alpha*255),'L').filter(ImageFilter.GaussianBlur(.45)),dtype=np.float32)/255.
    bg = np.array([8,177,4],dtype=np.float32)
    cleaned = (rgb - (1-alpha[...,None])*bg) / np.maximum(alpha[...,None],.25)
    cleaned = np.clip(cleaned,0,255).astype(np.uint8)
    return Image.fromarray(np.dstack([cleaned,np.uint8(alpha*255)]),'RGBA')


def bounds(img,padding=6,cutoff=50):
    a=np.asarray(img.getchannel('A'))
    ys,xs=np.where(a>cutoff)
    if len(xs)==0:
        raise ValueError('Empty alpha mask')
    return (max(0,int(xs.min())-padding),max(0,int(ys.min())-padding),
            min(img.width,int(xs.max())+padding+1),min(img.height,int(ys.max())+padding+1))


master = Image.open(root/"fox_master.png")
master = key_rgba(master)
bbox = bounds(master,9)
master=master.crop(bbox)
master.save(out/"master.png")
print("MASTER",master.size,"original_bbox",bbox,flush=True)

sheet = Image.open(root/"walk_sheet.png")
w,h=sheet.size
cw,ch=w//4,h//2
frames=[]
boxes=[]
for i in range(8):
    x=(i%4)*cw
    y=(i//4)*ch
    tile=sheet.crop((x+3,y+3,x+cw-3,y+ch-3))
    keyed=key_rgba(tile)
    bbox=bounds(keyed,8,45)
    boxes.append(bbox)
    frames.append(keyed)
    print("FRAME",i,"bbox",bbox,flush=True)

left=min(x[0] for x in boxes)
top=min(x[1] for x in boxes)
right=max(x[2] for x in boxes)
bottom=max(x[3] for x in boxes)
for i,fr in enumerate(frames):
    same=fr.crop((left,top,right,bottom))
    same.save(out/f"walk_{i:02}.png")
    preview_bg=Image.new("RGBA",same.size,(60,49,49,255))
    preview_bg.alpha_composite(same)
    frames[i]=preview_bg

fw,fh=frames[0].size
preview=Image.new("RGB",(fw*4,fh*2),(60,49,49))
for i,fr in enumerate(frames):
    preview.paste(fr.convert("RGB"),((i%4)*fw,(i//4)*fh))
preview.save(out/"walk_preview.png")
print("WALK",len(frames),fw,fh,flush=True)

m=Image.new("RGBA",(1280,720),(50,38,45,255))
photobg=Image.open(root/"room_empty.png").convert("RGBA").resize((1280,720),Image.Resampling.LANCZOS)
m.alpha_composite(photobg)
scaled=master.copy()
scaled.thumbnail((320,430),Image.Resampling.LANCZOS)
m.alpha_composite(scaled,(420,335))
m.convert("RGB").save(out/"room_with_fox_preview.jpg",quality=90)
manifest={
    "status":"experimental_local_assets_only",
    "original_room":"../room_empty.png",
    "master":"master.png",
    "walk_frames":[f"walk_{i:02}.png" for i in range(8)],
    "walk_fps":9,
    "alpha_processing":"green dominance chroma key; feathered matte",
    "model":"Qwen-Image-2.1-Turbo",
    "license_review_required":True,
}
(out/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
if (root/"sleep_pose.png").exists():
    im=key_rgba(Image.open(root/"sleep_pose.png"))
    im=im.crop(bounds(im,10))
    im.save(out/"sleep.png")
if args.install:
    target=Path.home()/".local/share/ubuntu-fox-pet/realistic"
    target.mkdir(parents=True,exist_ok=True)
    shutil.copy2(root/"room_empty.png",target/"room.png")
    shutil.copy2(out/"master.png",target/"idle.png")
    for i in range(8):
        shutil.copy2(out/f"walk_{i:02}.png",target/f"walk_{i:02}.png")
    if (out/"sleep.png").exists():
        shutil.copy2(out/"sleep.png",target/"sleep.png")
    print("LOCAL_ASSETS_INSTALLED",target)
print("ASSETS_DONE",out)
