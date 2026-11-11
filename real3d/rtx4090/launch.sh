#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BROWSER="$(command -v google-chrome || command -v chromium || true)"
if [[ -z "$BROWSER" ]]; then
  echo "Chrome or Chromium is required to display the captured RTX 4090 gallery" >&2
  exit 2
fi
if [[ ! -s "$ROOT/media/4090-human-4dgs.mp4" || ! -s "$ROOT/media/4090-cat-cycles-4d.mp4" ]]; then
  echo "The recorded media have not been installed" >&2
  exit 3
fi
exec "$BROWSER" --no-first-run --no-default-browser-check --user-data-dir="$HOME/.cache/fox-rtx4090-cinema" --window-size=1440,970 --app="file://$ROOT/index.html"
