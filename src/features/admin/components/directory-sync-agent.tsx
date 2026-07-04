'use client'

import { useState } from 'react'
import { Copy, Check, Terminal } from 'lucide-react'

export function DirectorySyncAgent({ appUrl, token }: { appUrl: string; token: string | null }) {
  const [copied, setCopied] = useState(false)
  const endpoint = `${appUrl}/api/v1/directory/sync`
  const tk = token ?? 'TU_TOKEN'

  const script = `# Sincronización de directorio BCDesk (Active Directory → BCDesk)
# Ejecutar en un servidor con el módulo ActiveDirectory (idealmente vía tarea programada).
$endpoint = "${endpoint}"
$token    = "${tk}"

Import-Module ActiveDirectory

$users = @(
  Get-ADUser -Filter * -Properties EmailAddress, Title, telephoneNumber, Enabled |
  Where-Object { $_.EmailAddress } |
  ForEach-Object {
    @{
      email       = $_.EmailAddress
      full_name   = $_.Name
      job_title   = $_.Title
      phone       = $_.telephoneNumber
      external_id = $_.ObjectGUID.ToString()
      active      = [bool]$_.Enabled
    }
  }
)

$body = @{
  users              = $users
  deactivate_missing = $true      # desactiva en BCDesk los usuarios ausentes del AD
  default_role       = "client"   # rol para usuarios nuevos
} | ConvertTo-Json -Depth 4

Invoke-RestMethod -Uri $endpoint -Method Post -ContentType "application/json" \`
  -Headers @{ "x-api-key" = $token } -Body $body`

  async function copy() {
    await navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Terminal size={15} className="text-[#3B82F6]" />
        <h2 className="text-sm font-semibold text-[#1E293B]">Script de sincronización (Active Directory)</h2>
        <button
          onClick={copy}
          className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[#E6EBF2] text-[#64748B] hover:text-[#1E293B] hover:border-[#3B82F6]/40 transition-colors"
        >
          {copied ? <Check size={12} className="text-[#10B981]" /> : <Copy size={12} />}
          {copied ? 'Copiado' : 'Copiar script'}
        </button>
      </div>
      <p className="text-xs text-[#64748B]">
        Endpoint: <span className="font-mono text-[#C4B5FD]">{endpoint}</span>
        {!token && <span className="block mt-1 text-[#F59E0B]">Genera un token en Auto-descubrimiento y reemplaza TU_TOKEN.</span>}
      </p>
      <p className="text-[11px] text-[#64748B]">
        Los usuarios nuevos se crean sin contraseña: la establecen con &quot;Olvidé mi contraseña&quot;. Los desactivados en AD se desactivan aquí.
      </p>
      <pre className="text-[11px] text-[#64748B] bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg p-3 overflow-x-auto max-h-72 leading-relaxed">
        {script}
      </pre>
    </div>
  )
}
