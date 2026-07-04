@echo off
title FABLEMOTION director bridge
cd /d "%~dp0"
echo Waking the FABLEMOTION director... (leave this window open)
echo Then open https://fablemotion.subhajitmahata.workers.dev/studio
node bridge.mjs
pause
