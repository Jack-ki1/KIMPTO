#!/usr/bin/env bash
# run.sh — double-click (or `./run.sh` from a terminal) launcher for macOS
# and Linux. Creates a virtual environment on first run, installs
# dependencies if needed, starts Kimpto, and opens it in your browser.
#
# To put this on your desktop: right-click this file -> Make Alias (macOS)
# or create a symlink (Linux: `ln -s /path/to/run.sh ~/Desktop/Kimpto.sh`),
# then drag the alias/symlink to your desktop. Double-clicking it opens a
# terminal window and starts the app.

set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "First run — setting up a virtual environment..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "Checking dependencies..."
pip install --quiet --disable-pip-version-check -r requirements.txt

export FLASK_DEBUG="${FLASK_DEBUG:-0}"
export PORT="${PORT:-5000}"

echo ""
echo "Starting Kimpto at http://127.0.0.1:${PORT}"
echo "Press Ctrl+C in this window to stop it."
echo ""

# Open the browser shortly after the server starts, then run the server in
# the foreground so this window stays open (and Ctrl+C stops everything).
( sleep 1.5
  if command -v open >/dev/null 2>&1; then open "http://127.0.0.1:${PORT}"       # macOS
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://127.0.0.1:${PORT}"  # Linux
  fi
) &

python3 app.py
