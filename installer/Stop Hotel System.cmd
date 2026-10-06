@echo off
title Stop Ghana Hotel System
cd /d "%~dp0"
"%~dp0node\node.exe" "%~dp0launcher.mjs" --stop
echo.
pause
