'use client'

import { useState, useTransition } from 'react'
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react'
import { deleteTicket } from '@/features/tickets/services/agent.service'

/** Botón de borrado permanente de un ticket. Solo se muestra a admins.
 *  Pide escribir ELIMINAR para evitar accidentes; la acción del servidor tiene
 *  sus propias barandas (cuenta de cobro, horas facturadas) y redirige al éxito. */
export function DeleteTicketButton({ ticketId, ticketNumber }: { ticketId: string; ticketNumber: number }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const canDelete = confirm.trim().toUpperCase() === 'ELIMINAR' && !pending

  function onDelete() {
    if (!canDelete) return
    setError(null)
    startTransition(async () => {
      // En éxito, la acción redirige (lanza) y no vuelve aquí.
      const res = await deleteTicket(ticketId)
      if (res?.error) setError(res.error)
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
      >
        <Trash2 size={13} /> Eliminar ticket
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/[0.04] p-4 space-y-3 max-w-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="text-[#EF4444] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#0B2545]">Eliminar el ticket #{ticketNumber}</p>
            <p className="text-xs text-[#5B6B7C] mt-0.5">
              Se borran también sus comentarios, adjuntos y horas <b>no facturadas</b>. Esto <b>no se puede deshacer</b>.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => { setOpen(false); setConfirm(''); setError(null) }}
          className="text-[#5B6B7C] hover:text-[#0B2545]"><X size={16} /></button>
      </div>

      <div>
        <label className="block text-xs text-[#5B6B7C] mb-1">Para confirmar, escribe <b>ELIMINAR</b></label>
        <input
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="ELIMINAR"
          disabled={pending}
          className="w-full px-3 py-2 bg-white border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#EF4444] disabled:opacity-60"
        />
      </div>

      {error && (
        <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 text-white text-sm font-medium transition-colors"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        {pending ? 'Eliminando…' : 'Eliminar definitivamente'}
      </button>
    </div>
  )
}
