'use client'

import { useState } from 'react'
import { GitMerge, X, Search } from 'lucide-react'
import { mergeTickets } from '@/features/tickets/services/agent.service'

interface TicketOption {
  id: string
  ticket_number: number
  title: string
  status: string
}

interface Props {
  currentTicketId: string
  tickets: TicketOption[]
}

export function MergeTicketModal({ currentTicketId, tickets }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('')
  const [merging, setMerging] = useState(false)

  const filtered = tickets.filter(t =>
    t.id !== currentTicketId &&
    !['merged', 'closed', 'cancelled'].includes(t.status) &&
    (search === '' || t.title.toLowerCase().includes(search.toLowerCase()) || String(t.ticket_number).includes(search))
  )

  async function handleMerge() {
    if (!selected) return
    setMerging(true)
    await mergeTickets(currentTicketId, selected)
    setMerging(false)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#334155] text-[#64748B] hover:text-[#94A3B8] hover:border-[#475569] text-xs transition-colors"
      >
        <GitMerge size={12} /> Fusionar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-md p-5 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#F1F5F9] flex items-center gap-2">
                <GitMerge size={14} className="text-[#3B82F6]" /> Fusionar ticket
              </h3>
              <button onClick={() => setOpen(false)} className="text-[#64748B] hover:text-[#94A3B8]">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-[#64748B]">
              Este ticket se marcará como fusionado y sus comentarios pasarán al ticket destino.
            </p>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar ticket destino..."
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#3B82F6] text-sm"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filtered.length === 0 && (
                <p className="text-xs text-[#64748B] text-center py-4">No hay tickets disponibles</p>
              )}
              {filtered.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelected(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    selected === t.id
                      ? 'bg-[#3B82F6]/20 border border-[#3B82F6]/40'
                      : 'hover:bg-[#263248] border border-transparent'
                  }`}
                >
                  <span className="font-mono text-xs text-[#3B82F6] shrink-0">#{t.ticket_number}</span>
                  <span className="text-xs text-[#F1F5F9] truncate">{t.title}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setOpen(false)}
                className="flex-1 py-2 rounded-lg border border-[#334155] text-[#64748B] text-sm hover:text-[#94A3B8] transition-colors">
                Cancelar
              </button>
              <button onClick={handleMerge} disabled={!selected || merging}
                className="flex-1 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 text-white text-sm font-medium transition-colors">
                {merging ? 'Fusionando...' : 'Fusionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
