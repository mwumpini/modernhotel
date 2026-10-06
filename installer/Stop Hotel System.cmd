@echo off
title Stop AGM Sync
cd /d "%~dp0"
"%~dp0node\node.exe" "%~dp0launcher.mjs" --stop
echo.
pause
