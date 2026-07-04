@echo off
cd /d "%~dp0"
rem If the bridge isn't answering, start it silently, then open the live studio.
curl -s -o nul --max-time 2 http://localhost:3799/api/status
if errorlevel 1 (
  wscript "%~dp0fablemotion-silent.vbs"
  timeout /t 2 /nobreak >nul
)
start "" https://fablemotion.subhajitmahata.workers.dev/studio
