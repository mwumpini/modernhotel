# Stops the system and removes the network rule. The hotel records stay on disk.
$ErrorActionPreference = 'Continue'
$node = Join-Path $PSScriptRoot 'node\node.exe'
$launcher = Join-Path $PSScriptRoot 'launcher.mjs'
if ((Test-Path $node) -and (Test-Path $launcher)) {
  & $node $launcher --stop
}
Get-NetFirewallRule -DisplayName 'AGM Sync' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Get-NetFirewallRule -DisplayName 'Ghana Hotel System' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Write-Host 'The hotel records are still in C:\ProgramData\GhanaHotel'
