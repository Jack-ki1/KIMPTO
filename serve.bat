@echo off
REM serve.bat - local preview before you push to GitHub Pages.
REM
REM Kimpto's JS is written as ES modules (import/export), which browsers
REM refuse to load over a plain file:// double-click for security reasons.
REM This spins up a tiny local web server instead so you can preview
REM changes at http://localhost:8000 exactly as they'll behave once
REM hosted for real. Needs Python 3 installed.

cd /d "%~dp0"
if not defined PORT set PORT=8000

echo Serving Kimpto at http://localhost:%PORT%   (close this window to stop)
start "" "http://localhost:%PORT%"
python -m http.server %PORT%

pause
