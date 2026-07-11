'use client'

import { useTransition, useState } from 'react'
import { updateTicketStatus, updateTicketPriority } from '@/features/tickets/services/agent.service'
import type { TicketStatus, TicketPriority } from '@/lib/supabase/types'

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Abierto' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'waiting_client', label: 'Esperando cliente' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'cancelled', label: 'Cancelado' },
]

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'critical', label: 'Crítica' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
]

interface TicketActionsProps {
  ticketId: string
  currentStatus: TicketStatus
  currentPriority: TicketPriority
}

export function TicketActions({ ticketId, currentStatus, currentPriority }: TicketActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleStatus(e: React.ChangeEvent<HTMLSelectElement>) {
    const status = e.target.value as TicketStatus
    setError(null)
    startTransition(async () => {
      try {
        await updateTicketStatus(ticketId, status)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al actualizar estado')
      }
    })
  }

  function handlePriority(e: React.ChangeEvent<HTMLSelectElement>) {
    const priority = e.target.value as TicketPriority
    setError(null)
    startTransition(async () => {
      try {
        await updateTicketPriority(ticketId, priority)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al actualizar prioridad')
      }
    })
  }

  const selectClass = "w-full bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00D4AA] disabled:opacity-50 cursor-pointer"

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-[#5B6B7C] mb-1.5">Estado</label>
        <select
          className={selectClass}
          defaultValue={currentStatus}
          onChange={handleStatus}
          disabled={isPending}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-[#5B6B7C] mb-1.5">Prioridad</label>
        <select
          className={selectClass}
          defaultValue={currentPriority}
          onChange={handlePriority}
          disabled={isPending}
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {isPending && <p className="text-xs text-[#0E9E86]">Guardando...</p>}
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}
