$ErrorActionPreference = 'Stop'

function Wait-ToClose {
  Write-Host ''
  Read-Host 'Press Enter to close'
}

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  try {
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  } catch {
    Write-Host 'The installer needs administrator approval so it can open the hotel network and store the program.'
    Wait-ToClose
    exit 1
  }
  exit 0
}

$source = $PSScriptRoot
$dest = Join-Path $env:ProgramFiles 'Ghana Hotel System'
if (-not (Test-Path (Join-Path $source 'app\server.js'))) {
  Write-Host 'This folder does not contain the built hotel system.'
  Write-Host 'On the computer where the project lives, run: npm run package:hotel'
  Write-Host 'Then copy the dist\GhanaHotel folder to this PC and run Install Hotel System.cmd from there.'
  Wait-ToClose
  exit 1
}

Write-Host "Installing to $dest"
$sourceFull = [System.IO.Path]::GetFullPath($source).TrimEnd('\')
$destFull = [System.IO.Path]::GetFullPath($dest).TrimEnd('\')
if ($sourceFull -ne $destFull) {
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  & robocopy $source $dest /MIR /R:2 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) {
    Write-Host "Could not copy the program (robocopy $LASTEXITCODE)."
    Wait-ToClose
    exit 1
  }
}

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dest 'register.ps1')

function New-Shortcut($shortcutPath, $target) {
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut($shortcutPath)
  $link.TargetPath = $target
  $link.WorkingDirectory = $dest
  $link.Save()
}

$startMenu = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Ghana Hotel System'
$startup = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\StartUp'
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
$startCmd = Join-Path $dest 'Start Hotel System.cmd'
New-Shortcut (Join-Path $env:Public 'Desktop\Ghana Hotel System.lnk') $startCmd
New-Shortcut (Join-Path $startMenu 'Ghana Hotel System.lnk') $startCmd
New-Shortcut (Join-Path $startMenu 'Stop Ghana Hotel System.lnk') (Join-Path $dest 'Stop Hotel System.cmd')
New-Shortcut (Join-Path $startup 'Ghana Hotel System.lnk') $startCmd

Write-Host ''
Write-Host 'Installed. The system also starts when someone signs in to Windows on this computer.'
Write-Host 'Leave its window open while the hotel is working. Other computers use the address in that window.'
Write-Host 'The internet can be down. This computer is the one that must stay on.'
$answer = Read-Host 'Start it now? [Y/n]'
if ($answer -eq '' -or $answer -match '^[Yy]') {
  Start-Process -FilePath $startCmd -WorkingDirectory $dest
}
Wait-ToClose
