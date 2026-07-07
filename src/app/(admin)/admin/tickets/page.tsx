import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FilterSelect, SearchInput } from '@/shared/components/auto-submit-select'
import { BulkTicketTable } from '@/features/admin/components/bulk-ticket-table'
import type { Ticket, TicketStatus, TicketPriority, TicketCategory } from '@/lib/supabase/types'
import { TICKET_CATEGORY_VALUES, TICKET_CATEGORY_LABELS } from '@/lib/tickets/categories'

interface Props {
  searchParams: Promise<{ status?: string; priority?: string; category?: string; page?: string; q?: string }>
}

export default async function AdminTicketsPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const page = Number(params.page ?? 1)
  const pageSize = 20
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('tickets')
    .select('*, organizations(name), assigned_to_profile:profiles!assigned_to(full_name)', { count: 'exact' })
    .order('sla_resolution_due_at', { ascending: true, nullsFirst: false })
    .range(offset, offset + pageSize - 1)

  if (params.status) query = query.eq('status', params.status as TicketStatus)
  if (params.priority) query = query.eq('priority', params.priority as TicketPriority)
  if (params.category) query = query.eq('category', params.category as TicketCategory)
  if (params.q) query = query.ilike('title', `%${params.q}%`)

  const [ticketsRes, agentsRes] = await Promise.all([
    query,
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'agent']).eq('is_active', true),
  ])

  const typedTickets = (ticketsRes.data ?? []) as (Ticket & {
    organizations?: { name: string } | null
    assigned_to_profile?: { full_name: string } | null
  })[]
  const count = ticketsRes.count
  const agents = agentsRes.data ?? []
  const totalPages = Math.ceil((count ?? 0) / pageSize)

  const statusOptions = ['', 'open', 'in_progress', 'waiting_client', 'resolved', 'closed', 'cancelled']
  const statusLabels: Record<string, string> = {
    '': 'Todos', open: 'Abiertos', in_progress: 'En progreso',
    waiting_client: 'Esperando', resolved: 'Resueltos', closed: 'Cerrados', cancelled: 'Cancelados',
  }
  const categoryOptions = ['', ...TICKET_CATEGORY_VALUES]
  const categoryLabels: Record<string, string> = { '': 'Todas', ...TICKET_CATEGORY_LABELS }

  function buildUrl(updates: Record<string, string>) {
    const p = { ...params, ...updates }
    const qs = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `/admin/tickets${qs ? '?' + qs : ''}`
  }

  const plainParams: Record<string, string> = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v != null) as [string, string][]
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#0B2545' }}>Tickets</h1>
          <p className="text-sm mt-0.5" style={{ color: '#5B6B7C' }}>{count ?? 0} tickets encontrados</p>
        </div>
        <Link
          href="/admin/tickets/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #1789FC 0%, #8B6FFF 100%)', boxShadow: '0 0 20px rgba(23,137,252,0.25)' }}
        >
          + Nuevo ticket
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <SearchInput
          defaultValue={params.q ?? ''}
          placeholder="Buscar por título..."
          paramName="q"
          className="px-3 py-2 rounded-xl text-xs w-48 outline-none"
          style={{
            background: '#F4F7FB',
            border: '1px solid #E6EBF2',
            color: '#0B2545',
          }}
        />
        <div className="flex gap-1.5 flex-wrap">
          {statusOptions.map(s => {
            const isActive = (params.status ?? '') === s
            return (
              <Link
                key={s}
                href={buildUrl({ status: s, page: '1' })}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={isActive ? {
                  background: 'rgba(23,137,252,0.15)',
                  color: '#1789FC',
                  border: '1px solid rgba(23,137,252,0.3)',
                } : {
                  background: '#FFFFFF',
                  color: '#5B6B7C',
                  border: '1px solid #E6EBF2',
                }}
              >
                {statusLabels[s]}
              </Link>
            )
          })}
        </div>
        <FilterSelect
          paramName="category"
          defaultValue={params.category ?? ''}
          options={categoryOptions.map(c => ({ value: c, label: categoryLabels[c] }))}
          className="px-3 py-2 rounded-xl text-xs outline-none"
          style={{
            background: '#F4F7FB',
            border: '1px solid #E6EBF2',
            color: '#5B6B7C',
          }}
        />
      </div>

      <BulkTicketTable
        tickets={typedTickets}
        agents={agents}
        page={page}
        totalPages={totalPages}
        searchParams={plainParams}
      />
    </div>
  )
}
