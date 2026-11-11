#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$HOME/.local/share/applications"
mkdir -p "$APP"
chmod +x "$ROOT/launch.sh"
cat > "$APP/ubuntu-fox-rtx4090-cinema.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=RTX 4090 — Neural Cinema
Comment=Recorded 4D Gaussian and OptiX showcase rendered on the 4090
Exec=$ROOT/launch.sh
Icon=$ROOT/../assets/icon.png
Terminal=false
Categories=Graphics;Game;
StartupNotify=true
EOF
BLENDER="$HOME/.local/opt/blender-5.3.0-linux-x64/blender"
SOURCE="$HOME/chatgpt-workspace/fox-4090-research/4d-gaussian-cat-nunchucks.blend"
if [[ -x "$BLENDER" && -s "$SOURCE" ]]; then
cat > "$APP/ubuntu-fox-rtx4090-4d-studio.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=RTX 4090 — Live 4D Studio
Comment=Real editable 4D Gaussian capture in Blender 5.3 using Vulkan RTX 4090
Exec=env MESA_VK_DEVICE_SELECT=10de:2684! VK_INSTANCE_LAYERS=VK_LAYER_MESA_device_select CUDA_VISIBLE_DEVICES=0 $BLENDER $SOURCE
Terminal=false
Categories=Graphics;3DGraphics;
StartupNotify=true
EOF
fi
echo "INSTALLED: RTX 4090 — Neural Cinema"
test -f "$APP/ubuntu-fox-rtx4090-4d-studio.desktop" && echo "INSTALLED: RTX 4090 — Live 4D Studio"
