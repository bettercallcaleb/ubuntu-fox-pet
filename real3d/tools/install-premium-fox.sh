#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="${1:?Usage: real3d/tools/install-premium-fox.sh /path/to/licensed/fox.fbx|fox.blend|fox.glb}"
SOURCE="$(realpath "$SOURCE")"
[[ -f "$SOURCE" ]] || { echo "Source file missing: $SOURCE" >&2; exit 2; }
mkdir -p "$ROOT/assets/premium"
TEMP="$(mktemp "$ROOT/assets/premium/.candidate-XXXXXXXX.glb")"
trap 'rm -f "$TEMP"' EXIT
case "${SOURCE,,}" in
  *.glb) cp "$SOURCE" "$TEMP" ;;
  *.fbx|*.blend)
    command -v blender >/dev/null || { echo "Blender is required" >&2; exit 2; }
    blender -b --python "$ROOT/tools/convert-premium-fox.py" -- "$SOURCE" "$TEMP"
    ;;
  *) echo "Use an extracted, licensed FBX, BLEND or GLB file" >&2; exit 2 ;;
esac
node "$ROOT/tools/verify-premium-fox.mjs" "$TEMP"
mv -f "$TEMP" "$ROOT/assets/premium/fox-premium.glb"
trap - EXIT
if [[ ! -f "$ROOT/assets/premium/fox-premium.json" ]]; then
  printf '%s\n' '{"forwardAxis":"+Z","modelHeight":1.2,"walkCycleDistance":0.65}' > "$ROOT/assets/premium/fox-premium.json"
fi
echo "Installed privately: $ROOT/assets/premium/fox-premium.glb"
echo "Reload FOX / 23 and choose the Premium Fox button."
