#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
npm ci --no-audit --no-fund
chmod +x "$ROOT/launch.sh"
mkdir -p "$HOME/.local/share/applications"
ICON="$(cd "$ROOT/.." && pwd)/assets/icon.png"
cat > "$HOME/.local/share/applications/ubuntu-fox-real3d.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Ubuntu Fox — Real 3D
Comment=Articulated 3D fox room with GPU accelerated lighting
Exec=$ROOT/launch.sh
Icon=$ICON
Terminal=false
Categories=Game;Graphics;
StartupNotify=true
EOF
chmod 644 "$HOME/.local/share/applications/ubuntu-fox-real3d.desktop"
echo "Installed Ubuntu Fox — Real 3D: $ROOT/launch.sh"
