'use client'

import { useState } from 'react'
import { Copy, Check, Webhook } from 'lucide-react'

export function EventIngestGuide({ appUrl, token }: { appUrl: string; token: string | null }) {
  const [copied, setCopied] = useState<string | null>(null)
  const endpoint = `${appUrl}/api/v1/events`
  const tk = token ?? 'TU_TOKEN'

  const firing = `curl -X POST "${endpoint}" \\
  -H "x-api-key: ${tk}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "prometheus",
    "severity": "critical",
    "host": "db-prod-01",
    "metric": "cpu_usage",
    "summary": "CPU > 95% durante 5 min",
    "description": "El nodo db-prod-01 supera el 95% de CPU.",
    "status": "firing",
    "fingerprint": "cpu-db-prod-01"
  }'`

  const resolved = `curl -X POST "${endpoint}" \\
  -H "x-api-key: ${tk}" \\
  -H "Content-Type: application/json" \\
  -d '{ "status": "resolved", "summary": "CPU normalizada", "fingerprint": "cpu-db-prod-01" }'`

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const Block = ({ title, code, k }: { title: string; code: string; k: string }) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-medium text-[#5B6B7C]">{title}</p>
        <button onClick={() => copy(code, k)}
          className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg border border-[#E6EBF2] text-[#5B6B7C] hover:text-[#0B2545] hover:border-[#00D4AA]/40 transition-colors">
          {copied === k ? <Check size={11} className="text-[#10B981]" /> : <Copy size={11} />}
          {copied === k ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="text-[11px] text-[#5B6B7C] bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg p-3 overflow-x-auto leading-relaxed">{code}</pre>
    </div>
  )

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Webhook size={15} className="text-[#0E9E86]" />
        <h2 className="text-sm font-semibold text-[#0B2545]">Webhook de eventos</h2>
      </div>
      <p className="text-xs text-[#5B6B7C]">
        Endpoint: <span className="font-mono text-[#C4B5FD]">{endpoint}</span>
        {!token && <span className="block mt-1 text-[#F59E0B]">Genera un token en Auto-descubrimiento y reemplaza TU_TOKEN.</span>}
      </p>
      <p className="text-[11px] text-[#5B6B7C]">
        Apunta el webhook de tu monitoreo (Prometheus Alertmanager, Zabbix, Grafana…) aquí.
        Alertas repetidas con el mismo <code className="text-[#5B6B7C]">fingerprint</code> se correlacionan; con <code className="text-[#5B6B7C]">status: resolved</code> se resuelve el incidente.
      </p>
      <Block title="Disparar alerta (crea/correlaciona incidente)" code={firing} k="firing" />
      <Block title="Resolver alerta (cierra el incidente)" code={resolved} k="resolved" />
    </div>
  )
}
