'use client'

import { useState } from 'react'
import { Zap, Server, TicketIcon, Building2, AlertTriangle } from 'lucide-react'
import { getAssetImpact, type ImpactResult } from '../services/impact.service'

interface AssetOption {
  id: string
  name: string
  asset_type: string | null
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-[#EF4444]', high: 'text-[#F59E0B]', medium: 'text-[#3B82F6]', low: 'text-[#64748B]',
}

export function ImpactAnalyzer({ assets }: { assets: AssetOption[] }) {
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImpactResult | null>(null)

  async function analyze() {
    if (!selected) return
    setLoading(true)
    setResult(null)
    const r = await getAssetImpact(selected)
    setResult(r)
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <label className="block text-xs font-medium text-[#64748B] mb-2">Selecciona un activo (CI)</label>
        <div className="flex gap-3">
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6]"
          >
            <option value="">— Elige un activo —</option>
            {assets.map(a => (
              <option key={a.id} value={a.id}>{a.name}{a.asset_type ? ` (${a.asset_type})` : ''}</option>
            ))}
          </select>
          <button
            onClick={analyze}
            disabled={!selected || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            <Zap size={14} /> {loading ? 'Analizando…' : 'Analizar impacto'}
          </button>
        </div>
      </div>

      {result?.error && (
        <p className="text-sm text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg px-4 py-3">{result.error}</p>
      )}

      {result && !result.error && result.root && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Stat icon={<Server size={16} className="text-[#3B82F6]" />} value={result.impacted.length} label="CIs afectados" />
            <Stat icon={<TicketIcon size={16} className="text-[#F59E0B]" />} value={result.tickets.length} label="Tickets abiertos" />
            <Stat icon={<Building2 size={16} className="text-[#8B5CF6]" />} value={result.organizationsAffected} label="Orgs afectadas" />
          </div>

          <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={15} className="text-[#F59E0B]" />
              <h2 className="text-sm font-semibold text-[#1E293B]">
                Si <span className="text-[#F59E0B]">{result.root.name}</span> falla, se afectan:
              </h2>
            </div>
            {result.impacted.length === 0 ? (
              <p className="text-sm text-[#64748B]">Ningún otro activo depende de éste. Impacto aislado. ✅</p>
            ) : (
              <div className="space-y-1.5">
                {result.impacted.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2 bg-[#F4F7FB] rounded-lg">
                    <Server size={13} className="text-[#64748B] shrink-0" />
                    <span className="text-sm text-[#1E293B] flex-1">{a.name}</span>
                    {a.asset_type && <span className="text-[10px] text-[#64748B]">{a.asset_type}</span>}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E6EBF2] text-[#64748B]">nivel {a.depth}</span>
                    {a.status && a.status !== 'active' && (
                      <span className="text-[10px] text-[#EF4444]">{a.status}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {result.tickets.length > 0 && (
            <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[#1E293B] mb-3">Tickets abiertos en los activos afectados</h2>
              <div className="space-y-1.5">
                {result.tickets.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 bg-[#F4F7FB] rounded-lg">
                    <span className="font-mono text-xs text-[#64748B]">#{t.ticket_number}</span>
                    <span className="text-sm text-[#1E293B] flex-1 truncate">{t.title}</span>
                    <span className={`text-[10px] font-medium ${PRIORITY_COLOR[t.priority] ?? 'text-[#64748B]'}`}>{t.priority}</span>
                    <span className="text-[10px] text-[#64748B]">{t.asset_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">{icon}</div>
      <p className="text-2xl font-bold text-[#1E293B]">{value}</p>
      <p className="text-xs text-[#64748B]">{label}</p>
    </div>
  )
}
