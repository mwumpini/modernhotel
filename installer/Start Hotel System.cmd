@echo off
title AGM Sync
cd /d "%~dp0"
if not exist "%~dp0node\node.exe" (
  echo This copy is not complete. Double-click "Install Hotel System.cmd" from the built package.
  pause
  exit /b 1
)
"%~dp0node\node.exe" "%~dp0launcher.mjs"
echo.
echo The hotel system stopped. Press any key to close this window.
pause >nul
