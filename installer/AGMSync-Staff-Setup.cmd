@echo off
setlocal
title AGM Sync Staff
echo.
echo On the office computer, look at the AGM Sync window and type the address shown there.
echo Example: http://192.168.2.224:3000
echo.
set /p ADDR=Address: 
if "%ADDR%"=="" (
  echo Type the address from the office computer.
  pause
  exit /b 1
)
echo %ADDR%| findstr /i /b "http://" >nul
if errorlevel 1 (
  echo %ADDR%| findstr /i /b "https://" >nul
  if errorlevel 1 set "ADDR=http://%ADDR%"
)

set "HOME=%LOCALAPPDATA%\AGM Sync Staff"
mkdir "%HOME%" 2>nul
copy /y "%~dp0agm-sync.ico" "%HOME%\agm-sync.ico" >nul
set "START=%APPDATA%\Microsoft\Windows\Start Menu\Programs\AGM Sync Staff"
mkdir "%START%" 2>nul
for /f "delims=" %%D in ('powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"') do set "DESKTOP=%%D"
if not defined DESKTOP set "DESKTOP=%USERPROFILE%\Desktop"

call :WriteShortcut "%DESKTOP%\AGM Sync.url"
call :WriteShortcut "%HOME%\AGM Sync.url"
call :WriteShortcut "%START%\AGM Sync.url"

echo.
echo An AGM Sync icon is on the desktop. Click it to open the hotel system.
echo The office computer must already be running AGM Sync.
pause
exit /b 0

:WriteShortcut
> "%~1" echo [InternetShortcut]
>> "%~1" echo URL=%ADDR%
>> "%~1" echo IconFile=%HOME%\agm-sync.ico
>> "%~1" echo IconIndex=0
exit /b 0
