import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TicketCard } from '@/shared/components/ticket-card'
import { TicketFilters } from '@/features/tickets/components/ticket-filters'
import { SearchInput } from '@/shared/components/auto-submit-select'
import { Suspense } from 'react'
import type { Ticket, TicketStatus, TicketPriority, TicketCategory } from '@/lib/supabase/types'

interface PageProps {
  searchParams: Promise<{
    status?: string
    priority?: string
    category?: string
    q?: string
    search?: string
    page?: string
  }>
}

export default async function AgentTicketsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const { status, priority, category, q, search } = params
  const searchTerm = search ?? q ?? ''
  const page = Number(params.page ?? 1)
  const pageSize = 20
  const offset = (page - 1) * pageSize

  const [viewsRes] = await Promise.all([
    supabase.from('saved_views').select('*').or(`owner_id.eq.${user.id},is_shared.eq.true`),
  ])

  let query = supabase
    .from('tickets')
    .select(`*, organization:organizations(name), assigned_to_profile:profiles!assigned_to(full_name)`, { count: 'exact' })

  if (status) query = query.eq('status', status as TicketStatus)
  if (priority) query = query.eq('priority', priority as TicketPriority)
  if (category) query = query.eq('category', category as TicketCategory)
  if (searchTerm) query = query.ilike('title', `%${searchTerm}%`)

  query = query
    .order('assigned_to', { ascending: true, nullsFirst: true })
    .order('sla_resolution_due_at', { ascending: true, nullsFirst: false })
    .range(offset, offset + pageSize - 1)

  const { data: tickets, count } = await query

  const allTickets = (tickets ?? []) as Ticket[]
  const totalPages = Math.ceil((count ?? 0) / pageSize)

  function buildUrl(updates: Record<string, string>) {
    const p = { ...params, ...updates }
    const qs = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `/agent/tickets${qs ? '?' + qs : ''}`
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Todos los tickets</h1>
        <p className="text-sm text-[#5B6B7C] mt-1">
          {count ?? 0} ticket{(count ?? 0) !== 1 ? 's' : ''}
        </p>
      </div>

      <Suspense>
        <TicketFilters
          savedViews={viewsRes.data ?? []}
          currentUserId={user.id}
        />
      </Suspense>

      {allTickets.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <p className="text-[#5B6B7C] text-sm">No hay tickets que coincidan con los filtros.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              href={`/agent/tickets/${ticket.id}`}
              showOrg
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={buildUrl({ page: String(page - 1) })} className="px-3 py-1.5 rounded-lg text-xs bg-[#FFFFFF] border border-[#E6EBF2] text-[#5B6B7C] hover:text-[#0B2545]">
              ← Anterior
            </Link>
          )}
          <span className="text-xs text-[#5B6B7C]">Pág {page} de {totalPages}</span>
          {page < totalPages && (
            <Link href={buildUrl({ page: String(page + 1) })} className="px-3 py-1.5 rounded-lg text-xs bg-[#FFFFFF] border border-[#E6EBF2] text-[#5B6B7C] hover:text-[#0B2545]">
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
