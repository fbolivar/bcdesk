'use client'

import { useCallback, useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Loader2, Play, Power, RefreshCw, Package, Terminal } from 'lucide-react'

type Metric = { cpu_pct: number | null; ram_pct: number | null; disk_free_pct: number | null; uptime_seconds: number | null; recorded_at: string }
type Command = { id: string; command_type: string; payload: Record<string, unknown> | null; status: string; result: Record<string, unknown> | null; created_at: string; completed_at: string | null }
type Inventory = { os_version: string | null; installed_apps: { name: string; version: string }[] | null; hotfixes: string[] | null; captured_at: string } | null
type Endpoint = { id: string; hostname: string | null; os: string | null; status: string; last_seen_at: string | null; agent_version: string | null; disabled_at: string | null }

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-[#F59E0B]', done: 'text-[#10B981]', failed: 'text-[#EF4444]',
  running: 'text-[#0E9E86]', expired: 'text-[#94A3B8]',
}

export function EndpointDetail({ endpointId }: { endpointId: string }) {
  const [data, setData] = useState<{ endpoint: Endpoint; metrics: Metric[]; inventory: Inventory; commands: Command[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [serviceName, setServiceName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/endpoints/${endpointId}/metrics?range=7d`)
      const j = await res.json()
      if (res.ok) setData(j); else setError(j.error ?? 'No se pudo cargar')
    } catch { setError('Error de red') } finally { setLoading(false) }
  }, [endpointId])

  useEffect(() => { load() }, [load])

  async function runCommand(command_type: string, payload?: Record<string, unknown>) {
    setSending(command_type)
    try {
      const res = await fetch(`/api/admin/endpoints/${endpointId}/commands`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command_type, payload }),
      })
      const j = await res.json()
      if (!res.ok) setError(j.error ?? 'No se pudo encolar el comando')
      else { setServiceName(''); load() }
    } catch { setError('Error de red') } finally { setSending(null) }
  }

  async function disable() {
    if (!confirm('Deshabilitar este endpoint? El token queda invalidado y no se puede reactivar.')) return
    const res = await fetch(`/api/admin/endpoints/${endpointId}/disable`, { method: 'POST' })
    if (res.ok) load()
  }

  if (loading) return <p className="text-sm text-[#5B6B7C]">Cargando…</p>
  if (error && !data) return <p className="text-sm text-[#EF4444]">{error}</p>
  if (!data) return null

  const { endpoint, metrics, inventory, commands } = data
  const chart = metrics.map(m => ({
    t: new Date(m.recorded_at).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    CPU: m.cpu_pct, RAM: m.ram_pct, 'Disco libre': m.disk_free_pct,
  }))

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">{endpoint.hostname ?? '(sin nombre)'}</h1>
          <p className="text-xs text-[#5B6B7C]">{endpoint.os} · agente {endpoint.agent_version ?? '—'} ·{' '}
            {endpoint.disabled_at ? <span className="text-[#EF4444]">deshabilitado</span> : endpoint.status}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E6EBF2] text-[#5B6B7C] text-xs"><RefreshCw size={12} /> Actualizar</button>
          {!endpoint.disabled_at && (
            <button onClick={disable} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#EF4444]/30 text-[#EF4444] text-xs hover:bg-[#EF4444]/10"><Power size={12} /> Deshabilitar</button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-[#EF4444]">{error}</p>}

      {/* Gráfico 7 días */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-3">Métricas (7 días)</h2>
        {chart.length === 0 ? <p className="text-xs text-[#5B6B7C]">Sin métricas todavía.</p> : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6EBF2" />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94A3B8' }} minTickGap={40} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E6EBF2' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="CPU" stroke="#EF4444" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="RAM" stroke="#F59E0B" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="Disco libre" stroke="#00D4AA" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Ejecutar script (catálogo cerrado) */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#0B2545] flex items-center gap-1.5"><Terminal size={15} className="text-[#0E9E86]" /> Ejecutar script</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => runCommand('clean_temp')} disabled={!!sending || !!endpoint.disabled_at}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-xs text-[#0B2545] hover:border-[#00D4AA] disabled:opacity-50">
            {sending === 'clean_temp' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Limpiar temporales
          </button>
          <button onClick={() => runCommand('disk_check')} disabled={!!sending || !!endpoint.disabled_at}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-xs text-[#0B2545] hover:border-[#00D4AA] disabled:opacity-50">
            {sending === 'disk_check' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Chequeo de disco
          </button>
          <div className="inline-flex items-center gap-1">
            <input value={serviceName} onChange={e => setServiceName(e.target.value)} placeholder="nombre del servicio"
              className="px-2 py-1.5 bg-white border border-[#E6EBF2] rounded-lg text-xs text-[#0B2545] focus:outline-none focus:border-[#00D4AA] w-40" />
            <button onClick={() => serviceName.trim() && runCommand('restart_service', { service_name: serviceName.trim() })}
              disabled={!!sending || !serviceName.trim() || !!endpoint.disabled_at}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-xs text-[#0B2545] hover:border-[#00D4AA] disabled:opacity-50">
              {sending === 'restart_service' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Reiniciar servicio
            </button>
          </div>
        </div>
        <p className="text-[11px] text-[#94A3B8]">Catálogo cerrado, sin comandos de texto libre. El agente ejecuta y reporta el resultado.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Historial de comandos */}
        <div className="bg-white border border-[#E6EBF2] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-3">Historial de comandos</h2>
          {commands.length === 0 ? <p className="text-xs text-[#5B6B7C]">Sin comandos.</p> : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {commands.map(c => (
                <div key={c.id} className="text-xs border-b border-[#E6EBF2]/50 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#0B2545]">{c.command_type}{c.payload?.service_name ? ` (${String(c.payload.service_name)})` : ''}</span>
                    <span className={`font-medium ${STATUS_COLOR[c.status] ?? 'text-[#5B6B7C]'}`}>{c.status}</span>
                  </div>
                  <p className="text-[10px] text-[#94A3B8]">{new Date(c.created_at).toLocaleString('es-CO')}</p>
                  {c.result?.exit_code != null && <p className="text-[10px] text-[#5B6B7C]">exit {String(c.result.exit_code)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inventario */}
        <div className="bg-white border border-[#E6EBF2] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-3 flex items-center gap-1.5"><Package size={15} className="text-[#0E9E86]" /> Inventario</h2>
          {!inventory ? <p className="text-xs text-[#5B6B7C]">Sin inventario todavía.</p> : (
            <div className="space-y-2 text-xs">
              <p className="text-[#0B2545]"><b>SO:</b> {inventory.os_version ?? '—'}</p>
              <p className="text-[#5B6B7C]">{(inventory.installed_apps ?? []).length} apps · {(inventory.hotfixes ?? []).length} parches</p>
              <div className="max-h-52 overflow-y-auto space-y-0.5">
                {(inventory.installed_apps ?? []).slice(0, 100).map((a, i) => (
                  <div key={i} className="flex justify-between text-[11px]"><span className="text-[#0B2545] truncate">{a.name}</span><span className="text-[#94A3B8] ml-2 shrink-0">{a.version}</span></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
