#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
URL="http://127.0.0.1:8765/neural/"
ASSET="$HERE/assets/maison-provence.sog"
if [[ ! -s "$ASSET" ]]; then
  "$HERE/install.sh"
fi
if curl -fsS --max-time 1 "$URL" | grep -q "Fox Neural Habitat"; then
  :
elif curl -fsS --max-time 1 "$URL" >/dev/null 2>&1; then
  echo "Port 8765 is occupied by an unexpected service" >&2
  exit 3
else
  nohup python3 -m http.server 8765 --bind 127.0.0.1 --directory "$ROOT" > "$HOME/.cache/ubuntu-fox-real3d-server.log" 2>&1 < /dev/null &
  for i in $(seq 1 30); do
    if curl -fsS --max-time 1 "$URL" | grep -q "Fox Neural Habitat"; then break; fi
    sleep .1
  done
fi
BROWSER="$(command -v google-chrome || command -v chromium || true)"
if [[ -z "$BROWSER" ]]; then
  echo "Google Chrome or Chromium is required" >&2
  exit 4
fi
exec "$BROWSER" --no-first-run --no-default-browser-check --user-data-dir="$HOME/.cache/ubuntu-fox-neural-browser" --window-size=1360,860 --app="$URL"
