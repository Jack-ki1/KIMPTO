@echo off
REM run.bat - double-click launcher for Windows.
REM Creates a virtual environment on first run, installs dependencies if
REM needed, starts Kimpto, and opens it in your default browser.
REM
REM To put this on your desktop: right-click this file -> Send to ->
REM Desktop (create shortcut), then drag that shortcut onto your desktop.

cd /d "%~dp0"

if not exist ".venv" (
  echo First run - setting up a virtual environment...
  python -m venv .venv
)

call .venv\Scripts\activate.bat

echo Checking dependencies...
pip install --quiet --disable-pip-version-check -r requirements.txt

if not defined FLASK_DEBUG set FLASK_DEBUG=0
if not defined PORT set PORT=5000

echo.
echo Starting Kimpto at http://127.0.0.1:%PORT%
echo Close this window to stop it.
echo.

start "" "http://127.0.0.1:%PORT%"
python app.py

pause
