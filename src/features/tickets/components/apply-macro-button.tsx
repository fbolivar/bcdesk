'use client'

import { useState } from 'react'
import { Zap, ChevronDown, Loader2 } from 'lucide-react'
import { applyMacro } from '@/features/admin/services/macros.service'

interface Macro { id: string; name: string; actions: unknown[] }

interface Props {
  ticketId: string
  macros: Macro[]
}

export function ApplyMacroButton({ ticketId, macros }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  if (macros.length === 0) return null

  async function handleApply(macroId: string) {
    setLoading(macroId)
    setOpen(false)
    await applyMacro(macroId, ticketId)
    setLoading(null)
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#5B6B7C] hover:text-[#0B2545] text-sm font-medium transition-colors">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
        Macro
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl shadow-xl overflow-hidden">
            <p className="px-3 py-2 text-xs font-medium text-[#5B6B7C] border-b border-[#E6EBF2]">Aplicar macro</p>
            {macros.map(m => (
              <button key={m.id} onClick={() => handleApply(m.id)}
                className="w-full text-left px-3 py-2.5 text-sm text-[#5B6B7C] hover:bg-[#EEF2F7] hover:text-[#0B2545] transition-colors flex items-center gap-2">
                <Zap size={12} className="text-[#F59E0B]" />
                {m.name}
                <span className="ml-auto text-xs text-[#CBD5E1]">{m.actions.length} acc.</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
