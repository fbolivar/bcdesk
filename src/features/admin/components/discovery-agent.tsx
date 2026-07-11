'use client'

import { useState } from 'react'
import { Copy, Check, Terminal } from 'lucide-react'

export function DiscoveryAgent({ appUrl, token }: { appUrl: string; token: string | null }) {
  const [copied, setCopied] = useState(false)
  const [os, setOs] = useState<'windows' | 'linux'>('windows')
  const endpoint = `${appUrl}/api/v1/inventory`
  const tk = token ?? 'TU_TOKEN'

  const windowsScript = `# Agente de inventario HexDesk (Windows PowerShell)
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

  const linuxScript = `#!/usr/bin/env bash
# Agente de inventario HexDesk (Linux). Requiere curl y python3.
set -euo pipefail
API="${endpoint}"
TOKEN="${tk}"

HOST="$(hostname)"
SERIAL="$(sudo dmidecode -s system-serial-number 2>/dev/null || true)"
MANU="$(sudo dmidecode -s system-manufacturer 2>/dev/null || true)"
MODEL="$(sudo dmidecode -s system-product-name 2>/dev/null || true)"
OS="$( . /etc/os-release 2>/dev/null; echo "\${PRETTY_NAME:-$(uname -sr)}" )"
CPU="$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2- | sed 's/^ *//')"
RAM="$(awk '/MemTotal/ {printf "%.1f", $2/1024/1024}' /proc/meminfo)"
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if command -v dpkg >/dev/null; then SW="$(dpkg-query -W -f='\${Package}\\n' | head -100)"; else SW="$(rpm -qa --qf '%{NAME}\\n' 2>/dev/null | head -100)"; fi

BODY="$(HOST="$HOST" SERIAL="$SERIAL" MANU="$MANU" MODEL="$MODEL" OS="$OS" CPU="$CPU" RAM="$RAM" IP="$IP" SW="$SW" python3 - <<'PY'
import os, json
sw=[l.strip() for l in os.environ.get("SW","").splitlines() if l.strip()]
try: ram=float(os.environ.get("RAM") or 0)
except: ram=0
print(json.dumps({"hostname":os.environ["HOST"],"serial_number":os.environ.get("SERIAL") or None,
"asset_type":"hardware","manufacturer":os.environ.get("MANU") or None,"model":os.environ.get("MODEL") or None,
"os":os.environ.get("OS") or None,"cpu":os.environ.get("CPU") or None,"ram_gb":ram,
"ip":os.environ.get("IP") or None,"software":sw}))
PY
)"

curl -s -X POST "$API" -H "x-api-key: $TOKEN" -H "Content-Type: application/json" -d "$BODY"`

  const script = os === 'windows' ? windowsScript : linuxScript

  async function copy() {
    await navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Terminal size={15} className="text-[#0E9E86]" />
        <h2 className="text-sm font-semibold text-[#0B2545]">Agente de inventario</h2>
        <div className="flex gap-1 ml-2">
          {(['windows', 'linux'] as const).map(o => (
            <button key={o} onClick={() => setOs(o)}
              className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
              style={os === o ? { background: 'rgba(0, 212, 170,0.12)', color: '#00D4AA' } : { color: '#5B6B7C' }}>
              {o === 'windows' ? 'Windows' : 'Linux'}
            </button>
          ))}
        </div>
        <button onClick={copy}
          className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[#E6EBF2] text-[#5B6B7C] hover:text-[#0B2545] hover:border-[#00D4AA]/40 transition-colors">
          {copied ? <Check size={12} className="text-[#10B981]" /> : <Copy size={12} />}
          {copied ? 'Copiado' : 'Copiar script'}
        </button>
      </div>
      <p className="text-xs text-[#5B6B7C]">
        Endpoint: <span className="font-mono text-[#8B5CF6]">{endpoint}</span>
        {!token && <span className="block mt-1 text-[#F59E0B]">Genera un token abajo y reemplaza TU_TOKEN.</span>}
        <span className="block mt-1">También tienes agentes reusables en <span className="font-mono">scripts/discovery-agent/</span> (con programación diaria).</span>
      </p>
      <pre className="text-[11px] text-[#5B6B7C] bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg p-3 overflow-x-auto max-h-72 leading-relaxed">
        {script}
      </pre>
    </div>
  )
}
