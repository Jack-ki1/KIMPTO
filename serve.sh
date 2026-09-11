#!/usr/bin/env bash
# serve.sh — local preview before you push to GitHub Pages.
#
# Kimpto's JS is written as ES modules (import/export), which browsers
# refuse to load over a plain file:// double-click for security reasons.
# This spins up a tiny local web server instead so you can preview changes
# at http://localhost:8000 exactly as they'll behave once hosted for real.
# Needs nothing but Python 3, which macOS and most Linux distros already
# have.

cd "$(dirname "$0")"
PORT="${PORT:-8000}"

echo "Serving Kimpto at http://localhost:${PORT}  (Ctrl+C to stop)"

( sleep 1
  if command -v open >/dev/null 2>&1; then open "http://localhost:${PORT}"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:${PORT}"
  fi
) &

python3 -m http.server "$PORT"
