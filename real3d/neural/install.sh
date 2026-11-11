#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
DATA="$HOME/.local/share/ubuntu-fox-pet/neural"
ASSET="$DATA/maison-provence.sog"
SOURCE="$HOME/chatgpt-workspace/ubuntu-fox-pet-research/neural-assets/maison-provence.sog"
PIN="2e177c95686fb078509e6143a8719bc32a77a551"
mkdir -p "$DATA" "$HERE/assets" "$HOME/.local/share/applications"
if [[ ! -s "$ASSET" ]]; then
  if [[ -s "$SOURCE" ]]; then
    cp "$SOURCE" "$ASSET"
  else
    WORK="$(mktemp -d)"
    trap 'rm -rf "$WORK"' EXIT
    git clone --depth 1 https://github.com/wilsonwu-ai/open-house-studio.git "$WORK/open-house"
    if [[ "$(git -C "$WORK/open-house" rev-parse HEAD)" != "$PIN" ]]; then
      git -C "$WORK/open-house" fetch --depth 1 origin "$PIN"
      git -C "$WORK/open-house" checkout --detach "$PIN"
    fi
    SCAN="$WORK/open-house/public/assets/house"
    (
      cd "$SCAN"
      zip -0 -q -j "$ASSET.tmp.sog" meta.json means_l.webp means_u.webp quats.webp scales.webp sh0.webp
    )
    mv "$ASSET.tmp.sog" "$ASSET"
  fi
fi
test -s "$ASSET"
ln -sfn "$ASSET" "$HERE/assets/maison-provence.sog"
(
  cd "$ROOT"
  npm ci --no-audit --no-fund
)
chmod +x "$HERE/launch.sh"
cat > "$HOME/.local/share/applications/ubuntu-fox-neural.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Ubuntu Fox — Neural Habitat
Comment=RTX 3060 Gaussian Splatting and a skeletal fox
Exec=$HERE/launch.sh
Icon=$ROOT/../assets/icon.png
Terminal=false
Categories=Game;Graphics;
StartupNotify=true
EOF
echo "NEURAL_HABITAT_INSTALLED $ASSET"
echo "SOURCE_LICENSE CC-BY-ND-4.0, original capture by splatmotion3dgs, local evaluation only"
sha256sum "$ASSET"
