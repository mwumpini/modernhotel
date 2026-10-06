# Allows other computers on the hotel network to open this PC, and lets the
# signed-in staff account write the hotel records.
$ErrorActionPreference = 'Stop'
$port = 3000
$data = Join-Path $env:ProgramData 'GhanaHotel'
New-Item -ItemType Directory -Force -Path $data | Out-Null
& icacls $data /grant 'Users:(OI)(CI)M' | Out-Null

$existing = Get-NetFirewallRule -DisplayName 'Ghana Hotel System' -ErrorAction SilentlyContinue
if ($existing) { $existing | Remove-NetFirewallRule }
New-NetFirewallRule -DisplayName 'Ghana Hotel System' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -Profile Any -RemoteAddress LocalSubnet | Out-Null
Write-Host "Other computers on this network can open port $port."
Write-Host "Hotel records folder: $data"
