'use client'

import { useEffect, useState, useCallback } from 'react'
import { Server, Plus, X, Loader2 } from 'lucide-react'
import { getTicketAssets, linkAssetToTicket, unlinkAssetFromTicket } from '../services/asset.service'

interface LinkedAsset { id: string; name: string; asset_type: string; status: string }
interface AvailAsset { id: string; name: string }

const TYPE_LABEL: Record<string, string> = { hardware: 'Hardware', software: 'Software', network: 'Red', service: 'Servicio', other: 'Otro' }
const STATUS_DOT: Record<string, string> = { active: '#10B981', inactive: '#94A3B8', maintenance: '#F59E0B', retired: '#EF4444' }

export function TicketAssetsPanel({ ticketId }: { ticketId: string }) {
  const [linked, setLinked] = useState<LinkedAsset[]>([])
  const [available, setAvailable] = useState<AvailAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState('')

  const load = useCallback(async () => {
    const res = await getTicketAssets(ticketId)
    setLinked(res.linked ?? [])
    setAvailable(res.available ?? [])
    setLoading(false)
  }, [ticketId])

  useEffect(() => { load() }, [load])

  async function add() {
    if (!sel) return
    setBusy(true)
    await linkAssetToTicket(ticketId, sel)
    setSel('')
    await load()
    setBusy(false)
  }

  async function remove(assetId: string) {
    setBusy(true)
    await unlinkAssetFromTicket(ticketId, assetId)
    await load()
    setBusy(false)
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
      <p className="text-sm font-semibold text-[#0B2545] mb-3 flex items-center gap-1.5">
        <Server size={15} className="text-[#1789FC]" /> Activos afectados (CMDB)
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[#5B6B7C] py-2"><Loader2 size={14} className="animate-spin" /> Cargando…</div>
      ) : (
        <>
          {linked.length > 0 ? (
            <div className="space-y-1.5 mb-3">
              {linked.map(a => (
                <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F4F7FB]">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_DOT[a.status] ?? '#94A3B8' }} />
                  <span className="text-sm text-[#0B2545] flex-1 truncate">{a.name}</span>
                  <span className="text-[10px] text-[#5B6B7C]">{TYPE_LABEL[a.asset_type] ?? a.asset_type}</span>
                  <button onClick={() => remove(a.id)} disabled={busy} title="Desvincular"
                    className="p-1 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 disabled:opacity-40">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#94A3B8] mb-3">Ningún activo vinculado a este ticket.</p>
          )}

          {available.length > 0 ? (
            <div className="flex gap-2">
              <select value={sel} onChange={e => setSel(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
                <option value="">Vincular un activo…</option>
                {available.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button onClick={add} disabled={!sel || busy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium disabled:opacity-40">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Vincular
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-[#CBD5E1]">No hay más activos de esta organización para vincular.</p>
          )}
        </>
      )}
    </div>
  )
}
