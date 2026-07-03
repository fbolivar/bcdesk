'use client'

import { useState } from 'react'
import { Copy, Check, Terminal } from 'lucide-react'

export function DiscoveryAgent({ appUrl, token }: { appUrl: string; token: string | null }) {
  const [copied, setCopied] = useState(false)
  const endpoint = `${appUrl}/api/v1/inventory`
  const tk = token ?? 'TU_TOKEN'

  const script = `# Agente de inventario BCDesk (Windows PowerShell)
# Ejecutar en cada endpoint (idealmente vía GPO o tarea programada).
$endpoint = "${endpoint}"
$token    = "${tk}"

$os   = Get-CimInstance Win32_OperatingSystem
$cs   = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
$cpu  = Get-CimInstance Win32_Processor | Select-Object -First 1
$net  = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=True" | Select-Object -First 1

$software = @(
  Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
                   'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName } | Select-Object -ExpandProperty DisplayName -Unique
)

$body = @{
  hostname      = $env:COMPUTERNAME
  serial_number = $bios.SerialNumber
  asset_type    = "hardware"
  manufacturer  = $cs.Manufacturer
  model         = $cs.Model
  os            = "$($os.Caption) $($os.Version)"
  cpu           = $cpu.Name
  ram_gb        = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
  mac           = $net.MACAddress
  ip            = ($net.IPAddress | Select-Object -First 1)
  software      = $software
} | ConvertTo-Json

Invoke-RestMethod -Uri $endpoint -Method Post -ContentType "application/json" \`
  -Headers @{ "x-api-key" = $token } -Body $body`

  async function copy() {
    await navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Terminal size={15} className="text-[#3B82F6]" />
        <h2 className="text-sm font-semibold text-[#F1F5F9]">Agente de inventario (Windows)</h2>
        <button
          onClick={copy}
          className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[#334155] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#3B82F6]/40 transition-colors"
        >
          {copied ? <Check size={12} className="text-[#10B981]" /> : <Copy size={12} />}
          {copied ? 'Copiado' : 'Copiar script'}
        </button>
      </div>
      <p className="text-xs text-[#94A3B8]">
        Endpoint: <span className="font-mono text-[#C4B5FD]">{endpoint}</span>
        {!token && <span className="block mt-1 text-[#F59E0B]">Genera un token abajo y reemplaza TU_TOKEN.</span>}
      </p>
      <pre className="text-[11px] text-[#94A3B8] bg-[#0F172A] border border-[#334155] rounded-lg p-3 overflow-x-auto max-h-72 leading-relaxed">
        {script}
      </pre>
    </div>
  )
}
