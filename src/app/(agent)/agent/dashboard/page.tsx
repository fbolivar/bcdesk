import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TicketCard } from '@/shared/components/ticket-card'
import type { Ticket, TicketStatus } from '@/lib/supabase/types'

const STATUS_LABELS: Record<string, string> = {
  open: 'Abiertos',
  in_progress: 'En progreso',
  waiting_client: 'Esperando cliente',
}

export default async function AgentDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      *,
      organization:organizations(name),
      assigned_to_profile:profiles!assigned_to(full_name)
    `)
    .eq('assigned_to', user.id)
    .not('status', 'in', '("resolved","closed","cancelled")')
    .order('sla_resolution_due_at', { ascending: true, nullsFirst: false })

  const activeTickets = (tickets ?? []) as Ticket[]

  const counts = activeTickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Mi bandeja</h1>
        <p className="text-sm text-[#94A3B8] mt-1">Tickets asignados a ti, ordenados por urgencia SLA</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(['open', 'in_progress', 'waiting_client'] as TicketStatus[]).map((status) => (
          <div key={status} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
            <p className="text-xs text-[#94A3B8]">{STATUS_LABELS[status]}</p>
            <p className="text-2xl font-bold text-[#F1F5F9] mt-1">{counts[status] ?? 0}</p>
          </div>
        ))}
      </div>

      {activeTickets.length === 0 ? (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-12 text-center">
          <p className="text-[#64748B] text-sm">No tienes tickets activos asignados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              href={`/agent/tickets/${ticket.id}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
