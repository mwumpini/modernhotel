$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  try {
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  } catch {
    Write-Host 'Uninstall needs administrator approval.'
    Read-Host 'Press Enter to close'
    exit 1
  }
  exit 0
}

$dest = Join-Path $env:ProgramFiles 'AGM Sync'
$unregister = Join-Path $dest 'unregister.ps1'
if (Test-Path $unregister) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $unregister
}

$shortcuts = @(
  (Join-Path $env:Public 'Desktop\AGM Sync.lnk'),
  (Join-Path $env:Public 'Desktop\Ghana Hotel System.lnk'),
  (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\StartUp\AGM Sync.lnk'),
  (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\StartUp\Ghana Hotel System.lnk')
)
foreach ($shortcut in $shortcuts) {
  if (Test-Path $shortcut) { Remove-Item -Force $shortcut }
}
$group = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\AGM Sync'
if (Test-Path $group) { Remove-Item -Recurse -Force $group }
$oldGroup = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Ghana Hotel System'
if (Test-Path $oldGroup) { Remove-Item -Recurse -Force $oldGroup }

if (Test-Path $dest) {
  Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -ArgumentList "/c timeout /t 2 >nul & rmdir /s /q `"$dest`""
}

Write-Host 'The program has been removed.'
Write-Host 'The hotel records are still in C:\ProgramData\GhanaHotel'
Read-Host 'Press Enter to close'
