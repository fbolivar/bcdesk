'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Plus, Trash2, Loader2 } from 'lucide-react'

type Rule = {
  id: string
  metric: 'cpu_pct' | 'ram_pct' | 'disk_free_pct' | 'offline'
  operator: string
  threshold: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  action: 'create_ticket' | 'notify'
  cooldown_minutes: number
  is_active: boolean
}

const METRIC_LABEL: Record<string, string> = {
  cpu_pct: 'CPU %', ram_pct: 'RAM %', disk_free_pct: 'Disco libre %', offline: 'Sin reportar (min)',
}
const SEV_COLOR: Record<string, string> = {
  low: 'text-[#10B981]', medium: 'text-[#F59E0B]', high: 'text-[#EF4444]', critical: 'text-[#B91C1C]',
}

export function AlertRulesPanel({ organizationId }: { organizationId: string }) {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  // formulario de alta
  const [nm, setNm] = useState<Rule['metric']>('cpu_pct')
  const [nop, setNop] = useState('>')
  const [nth, setNth] = useState('85')
  const [nsev, setNsev] = useState<Rule['severity']>('medium')
  const [ncd, setNcd] = useState('60')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/alert-rules`)
      const j = await res.json()
      if (res.ok) setRules(j.rules ?? []); else setError(j.error ?? 'Error al cargar')
    } catch { setError('Error de red') } finally { setLoading(false) }
  }, [organizationId])

  useEffect(() => { load() }, [load])

  async function patch(id: string, patchBody: Partial<Rule>) {
    setSaving(id); setError(null)
    try {
      const res = await fetch(`/api/admin/alert-rules/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patchBody),
      })
      const j = await res.json()
      if (res.ok) setRules(rs => rs.map(r => r.id === id ? { ...r, ...j.rule } : r))
      else { setError(j.error ?? 'No se pudo guardar'); load() }
    } catch { setError('Error de red') } finally { setSaving(null) }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta regla de alerta?')) return
    const res = await fetch(`/api/admin/alert-rules/${id}`, { method: 'DELETE' })
    if (res.ok) setRules(rs => rs.filter(r => r.id !== id))
  }

  async function add() {
    setError(null)
    const res = await fetch(`/api/admin/organizations/${organizationId}/alert-rules`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric: nm, operator: nop, threshold: Number(nth), severity: nsev, action: 'create_ticket', cooldown_minutes: Number(ncd) }),
    })
    const j = await res.json()
    if (res.ok) { setRules(rs => [...rs, j.rule]); setNth(nm === 'disk_free_pct' ? '15' : '85') }
    else setError(j.error ?? 'No se pudo crear')
  }

  return (
    <details className="rounded-xl border border-[#E6EBF2] p-3">
      <summary className="cursor-pointer text-sm font-semibold text-[#0B2545] flex items-center gap-1.5">
        <Bell size={15} className="text-[#0E9E86]" /> Reglas de alerta {rules.length > 0 && <span className="text-xs font-normal text-[#94A3B8]">({rules.length})</span>}
      </summary>

      <div className="mt-3 space-y-3">
        {error && <p className="text-xs text-[#EF4444]">{error}</p>}
        {loading ? <p className="text-xs text-[#5B6B7C]">Cargando…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-[#5B6B7C] border-b border-[#E6EBF2]">
                  <th className="px-2 py-1.5">Métrica</th><th className="px-2 py-1.5">Cond.</th>
                  <th className="px-2 py-1.5">Umbral</th><th className="px-2 py-1.5">Severidad</th>
                  <th className="px-2 py-1.5">Cooldown (min)</th><th className="px-2 py-1.5">Activa</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id} className="border-b border-[#E6EBF2]/50">
                    <td className="px-2 py-1.5 text-[#0B2545]">{METRIC_LABEL[r.metric]}</td>
                    <td className="px-2 py-1.5 text-[#5B6B7C]">{r.operator}</td>
                    <td className="px-2 py-1.5">
                      <input type="number" defaultValue={r.threshold} onBlur={e => { const v = Number(e.target.value); if (v !== r.threshold) patch(r.id, { threshold: v }) }}
                        className="w-16 px-1.5 py-1 bg-[#F4F7FB] border border-[#E6EBF2] rounded text-[#0B2545] text-xs" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={r.severity} onChange={e => patch(r.id, { severity: e.target.value as Rule['severity'] })}
                        className={`px-1.5 py-1 bg-[#F4F7FB] border border-[#E6EBF2] rounded text-xs font-medium ${SEV_COLOR[r.severity]}`}>
                        <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" defaultValue={r.cooldown_minutes} onBlur={e => { const v = Number(e.target.value); if (v !== r.cooldown_minutes) patch(r.id, { cooldown_minutes: v }) }}
                        className="w-16 px-1.5 py-1 bg-[#F4F7FB] border border-[#E6EBF2] rounded text-[#0B2545] text-xs" />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => patch(r.id, { is_active: !r.is_active })} disabled={saving === r.id}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.is_active ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-[#E6EBF2] text-[#5B6B7C]'}`}>
                        {saving === r.id ? '…' : r.is_active ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button onClick={() => remove(r.id)} className="p-1 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Alta de regla */}
        <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-[#E6EBF2]">
          <select value={nm} onChange={e => { const m = e.target.value as Rule['metric']; setNm(m); setNop(m === 'disk_free_pct' ? '<' : '>'); setNth(m === 'disk_free_pct' ? '15' : m === 'offline' ? '15' : '85') }}
            className="px-2 py-1.5 bg-[#F4F7FB] border border-[#E6EBF2] rounded text-xs text-[#0B2545]">
            <option value="cpu_pct">CPU %</option><option value="ram_pct">RAM %</option><option value="disk_free_pct">Disco libre %</option><option value="offline">Sin reportar (min)</option>
          </select>
          <select value={nop} onChange={e => setNop(e.target.value)} className="px-2 py-1.5 bg-[#F4F7FB] border border-[#E6EBF2] rounded text-xs text-[#0B2545]">
            <option value="&gt;">&gt;</option><option value="&gt;=">&gt;=</option><option value="&lt;">&lt;</option><option value="&lt;=">&lt;=</option>
          </select>
          <input type="number" value={nth} onChange={e => setNth(e.target.value)} className="w-16 px-2 py-1.5 bg-[#F4F7FB] border border-[#E6EBF2] rounded text-xs text-[#0B2545]" />
          <select value={nsev} onChange={e => setNsev(e.target.value as Rule['severity'])} className="px-2 py-1.5 bg-[#F4F7FB] border border-[#E6EBF2] rounded text-xs text-[#0B2545]">
            <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option>
          </select>
          <input type="number" value={ncd} onChange={e => setNcd(e.target.value)} title="cooldown (min)" className="w-16 px-2 py-1.5 bg-[#F4F7FB] border border-[#E6EBF2] rounded text-xs text-[#0B2545]" />
          <button onClick={add} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-xs font-medium">
            <Plus size={12} /> Agregar
          </button>
        </div>
      </div>
    </details>
  )
}
