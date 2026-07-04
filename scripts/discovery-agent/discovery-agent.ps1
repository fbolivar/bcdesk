# BCDesk — Agente de descubrimiento CMDB (Windows)
# Reporta el hardware/software de este equipo a BCDesk.
#
# Uso:
#   .\discovery-agent.ps1 -ApiUrl "https://tu-dominio.com" -Token "TOKEN_DE_DESCUBRIMIENTO"
#
# Para inventario recurrente: crea una Tarea Programada que lo ejecute a diario.

param(
  [Parameter(Mandatory = $true)][string]$ApiUrl,
  [Parameter(Mandatory = $true)][string]$Token
)

$ErrorActionPreference = 'Stop'

$cs   = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
$os   = Get-CimInstance Win32_OperatingSystem
$cpu  = Get-CimInstance Win32_Processor | Select-Object -First 1
$net  = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled } | Select-Object -First 1

$software = @(
  Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName } |
    Select-Object -ExpandProperty DisplayName -Unique |
    Select-Object -First 100
)

$body = @{
  hostname      = $env:COMPUTERNAME
  serial_number = $bios.SerialNumber
  asset_type    = 'hardware'
  manufacturer  = $cs.Manufacturer
  model         = $cs.Model
  os            = "$($os.Caption) $($os.Version)"
  cpu           = $cpu.Name
  ram_gb        = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
  mac           = $net.MACAddress
  ip            = ($net.IPAddress | Where-Object { $_ -notmatch ':' } | Select-Object -First 1)
  software      = $software
} | ConvertTo-Json -Depth 4

$resp = Invoke-RestMethod -Uri "$ApiUrl/api/v1/inventory" -Method Post `
  -Headers @{ 'x-api-key' = $Token } -ContentType 'application/json' -Body $body

Write-Host "OK - activo reportado: $($resp.asset_id) (creado: $($resp.created))"
