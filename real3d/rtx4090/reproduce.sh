#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
STORE="$HOME/.local/share/ubuntu-fox-pet/rtx4090"
CACHE="$STORE/downloads"
BLENDER="$HOME/.local/opt/blender-5.3.0-linux-x64/blender"
mkdir -p "$CACHE" "$ROOT/media" "$STORE/logs"

if ! nvidia-smi --query-gpu=index,name --format=csv,noheader | grep -q '^0, NVIDIA GeForce RTX 4090'; then
  echo "RTX 4090 must be GPU index 0 for this exact reproducibility script" >&2
  exit 2
fi
if [[ ! -x "$BLENDER" ]]; then
  curl -fL --retry 3 --max-time 1200 https://download.blender.org/release/Blender5.3/blender-5.3.0-linux-x64.tar.xz -o "$CACHE/blender-5.3.0-linux-x64.tar.xz"
  echo "dacb8264197a3f7fda6001285a5a506fc97ee943881261c2c3bd63c882f22e05  $CACHE/blender-5.3.0-linux-x64.tar.xz" | sha256sum -c -
  mkdir -p "$HOME/.local/opt"
  tar -xJf "$CACHE/blender-5.3.0-linux-x64.tar.xz" -C "$HOME/.local/opt"
fi

FOUR_D="$CACHE/4D_Gaussian_Splatting-Nunchucks_and_cat.blend"
LION="$CACHE/blender-5.2-splash.blend"
if [[ ! -s "$FOUR_D" ]]; then
  curl -fL --retry 3 --max-time 1800 https://download.blender.org/demo/geometry-nodes/4D_Gaussian_Splatting-Nunchucks_and_cat.blend -o "$FOUR_D"
fi
if [[ ! -s "$LION" ]]; then
  curl -fL --retry 3 --max-time 900 https://download.blender.org/demo/splash/blender-5.2-splash.blend -o "$LION"
fi
echo "924465bc39d2cc4c55f101eb924ab42357a12f5b108a851ca829f034ce8b8a62  $FOUR_D" | sha256sum -c -
echo "a48599e3c1972c70c9d4b206934871d12ba58a6dcf8b25f8c68c5baa0a747082  $LION" | sha256sum -c -

export CUDA_VISIBLE_DEVICES=0
export VK_INSTANCE_LAYERS=VK_LAYER_MESA_device_select
export MESA_VK_DEVICE_SELECT='10de:2684!'

"$BLENDER" -b "$FOUR_D" -t 12 -P "$ROOT/scripts/render_4d_movie.py" -- Nunchucks 100 120 "$STORE/human-4dgs.mp4" 1280 > "$STORE/logs/4090-human.log" 2>&1
cp "$STORE/human-4dgs0100-0219.mp4" "$ROOT/media/4090-human-4dgs.mp4"
ffmpeg -v error -y -ss 2.15 -i "$ROOT/media/4090-human-4dgs.mp4" -frames:v 1 "$ROOT/media/human-4dgs.png"

"$BLENDER" -b "$FOUR_D" -t 12 -P "$ROOT/scripts/render_4d_movie.py" -- 'The Cat' 80 80 "$STORE/cat-cycles-4d.mp4" 1152 > "$STORE/logs/4090-cat.log" 2>&1
cp "$STORE/cat-cycles-4d0080-0159.mp4" "$ROOT/media/4090-cat-cycles-4d.mp4"
ffmpeg -v error -y -ss 1.40 -i "$ROOT/media/4090-cat-cycles-4d.mp4" -frames:v 1 "$ROOT/media/cat-4dgs.png"

"$BLENDER" -b "$LION" -t 12 -P "$ROOT/scripts/render_fur.py" -- panthera 1 "$ROOT/media/4090-panthera-optix.png" 1600 > "$STORE/logs/4090-lion.log" 2>&1

for file in "$ROOT/media/4090-human-4dgs.mp4" "$ROOT/media/4090-cat-cycles-4d.mp4" "$ROOT/media/4090-panthera-optix.png"; do
  test -s "$file"
done
echo "RTX4090_4D_CINEMA_REPRODUCED"
