#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT=8765
URL="http://127.0.0.1:$PORT/"
if [[ ! -f "$ROOT/node_modules/three/build/three.module.js" ]]; then
  echo "Run npm ci inside $ROOT first" >&2
  exit 2
fi
if curl -fsS --max-time 1 "$URL" | grep -q 'FOX / 03'; then
  :
elif curl -fsS --max-time 1 "$URL" >/dev/null 2>&1; then
  echo "Port $PORT is used by another application" >&2
  exit 3
else
  nohup python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" > "$HOME/.cache/ubuntu-fox-real3d-server.log" 2>&1 < /dev/null &
  for i in $(seq 1 25); do
    curl -fsS --max-time 1 "$URL" >/dev/null 2>&1 && break
    sleep .1
  done
fi
BROWSER="$(command -v google-chrome || command -v chromium || true)"
if [[ -z "$BROWSER" ]]; then
  echo "Chrome or Chromium required for accelerated WebGL rendering" >&2
  exit 4
fi
exec "$BROWSER" --no-first-run --no-default-browser-check --user-data-dir="$HOME/.cache/ubuntu-fox-real3d-browser" --window-size=1300,820 --app="$URL"
