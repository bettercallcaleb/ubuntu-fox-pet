#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON=/usr/bin/python3
PREFIX="$HOME/.local/share/ubuntu-fox-pet"
DESKTOP="$HOME/.local/share/applications/ubuntu-fox-pet.desktop"

if ! "$PYTHON" -c 'from PyQt6.QtWidgets import QApplication' >/dev/null 2>&1; then
  printf '%s\n' 'PyQt6 is missing. On Ubuntu, run: sudo apt install python3-pyqt6' >&2
  exit 1
fi

mkdir -p "$PREFIX/sprites" "$HOME/.local/share/applications"
install -m 644 "$ROOT/pet.py" "$PREFIX/pet.py"
install -m 644 "$ROOT/assets/icon.png" "$PREFIX/icon.png"
install -m 644 "$ROOT/assets/sprites/"*.png "$PREFIX/sprites/"
cat > "$PREFIX/run.sh" <<'SH'
#!/usr/bin/env bash
exec /usr/bin/python3 "$HOME/.local/share/ubuntu-fox-pet/pet.py" "$@"
SH
chmod 755 "$PREFIX/run.sh"
cat > "$DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=Ubuntu Fox Pet
Comment=Animated fox desktop companion
Exec=$PREFIX/run.sh
Icon=$PREFIX/icon.png
Terminal=false
Categories=Utility;
StartupNotify=false
EOF
chmod 644 "$DESKTOP"
printf 'Installed Ubuntu Fox Pet. Launch: %s\n' "$PREFIX/run.sh"
