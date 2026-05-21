'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto', in_progress: 'En progreso', waiting_client: 'Esperando cliente',
  resolved: 'Resuelto', closed: 'Cerrado', cancelled: 'Cancelado',
}

interface Props {
  role: 'admin' | 'agent'
  userId: string
}

export function RealtimeTickets({ role, userId }: Props) {
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' }, (payload) => {
        const t = payload.new as { ticket_number: number; title: string; priority: string }
        toast(`🎫 Nuevo ticket #${t.ticket_number}`, {
          description: t.title,
          action: { label: 'Ver', onClick: () => { window.location.href = `/${role}/tickets` } },
          duration: 6000,
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, (payload) => {
        const prev = payload.old as { status?: string; assigned_to?: string }
        const next = payload.new as { ticket_number: number; title: string; status: string; assigned_to?: string; id: string }

        if (prev.status !== next.status) {
          toast(`🔄 Ticket #${next.ticket_number} → ${STATUS_LABEL[next.status] ?? next.status}`, {
            description: next.title,
            action: { label: 'Ver', onClick: () => { window.location.href = `/${role}/tickets/${next.id}` } },
            duration: 5000,
          })
        }

        if (role === 'agent' && !prev.assigned_to && next.assigned_to === userId) {
          toast(`📋 Te asignaron el ticket #${next.ticket_number}`, {
            description: next.title,
            action: { label: 'Abrir', onClick: () => { window.location.href = `/agent/tickets/${next.id}` } },
            duration: 8000,
          })
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_comments' }, (payload) => {
        const c = payload.new as { ticket_id: string; author_id: string; is_internal: boolean }
        if (c.author_id !== userId && !c.is_internal) {
          toast('💬 Nuevo comentario en ticket', {
            action: { label: 'Ver', onClick: () => { window.location.href = `/${role}/tickets/${c.ticket_id}` } },
            duration: 5000,
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [role, userId])

  return null
}
