import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Download } from 'lucide-react'
import { TicketCard } from '@/shared/components/ticket-card'
import type { Ticket, TicketStatus } from '@/lib/supabase/types'

export default async function ClientTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/client/dashboard')

  let query = supabase
    .from('tickets')
    .select('*, organizations(name), profiles!assigned_to(full_name, avatar_url)')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  if (params.status) {
    query = query.eq('status', params.status as TicketStatus)
  }

  const { data: tickets } = await query
  const typedTickets = (tickets ?? []) as Ticket[]

  const statusOptions = [
    { value: '', label: 'Todos' },
    { value: 'open', label: 'Abiertos' },
    { value: 'in_progress', label: 'En progreso' },
    { value: 'waiting_client', label: 'Esperando respuesta' },
    { value: 'resolved', label: 'Resueltos' },
    { value: 'closed', label: 'Cerrados' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[#1E293B]">Mis tickets</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{typedTickets.length} tickets encontrados</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/client/tickets/export"
            download
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#64748B] hover:text-[#1E293B] transition-colors"
            style={{ background: '#F4F7FB', border: '1px solid #E6EBF2' }}
          >
            <Download size={15} /> Exportar CSV
          </a>
          <Link
            href="/client/tickets/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Nuevo ticket
          </Link>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {statusOptions.map(opt => (
          <Link
            key={opt.value}
            href={opt.value ? `/client/tickets?status=${opt.value}` : '/client/tickets'}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              (params.status ?? '') === opt.value
                ? 'bg-[#3B82F6] text-white'
                : 'bg-[#FFFFFF] text-[#64748B] hover:text-[#1E293B] border border-[#E6EBF2]'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {typedTickets.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <p className="text-[#64748B]">No hay tickets{params.status ? ' con este estado' : ''}.</p>
          <Link href="/client/tickets/new" className="mt-3 inline-block text-sm text-[#3B82F6] hover:underline">
            Crear ticket →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {typedTickets.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} href={`/client/tickets/${ticket.id}`} />
          ))}
        </div>
      )}
    </div>
  )
}
