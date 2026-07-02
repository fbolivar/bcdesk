import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, ChevronRight, Building2, Ticket } from 'lucide-react'

interface ClientRow {
  id: string
  full_name: string
  email: string
  job_title: string | null
  created_at: string
  organization_id: string | null
  organization_name: string | null
  total_tickets: number
  last_ticket_at: string | null
}

export default async function AdminClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  // Get all client profiles with their organization
  const { data: clients } = await supabase
    .from('profiles')
    .select('id, full_name, email, job_title, created_at, organization_id, organizations(name)')
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  const clientList = (clients ?? []) as unknown as Array<{
    id: string
    full_name: string
    email: string
    job_title: string | null
    created_at: string
    organization_id: string | null
    organizations: { name: string } | null
  }>

  // Get ticket counts per client (created_by)
  const clientIds = clientList.map(c => c.id)
  const ticketCountsMap: Record<string, number> = {}
  const lastTicketMap: Record<string, string> = {}

  if (clientIds.length > 0) {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('created_by, created_at')
      .in('created_by', clientIds)
      .order('created_at', { ascending: false })

    tickets?.forEach(t => {
      ticketCountsMap[t.created_by] = (ticketCountsMap[t.created_by] ?? 0) + 1
      if (!lastTicketMap[t.created_by]) {
        lastTicketMap[t.created_by] = t.created_at
      }
    })
  }

  const rows: ClientRow[] = clientList.map(c => ({
    id: c.id,
    full_name: c.full_name,
    email: c.email,
    job_title: c.job_title,
    created_at: c.created_at,
    organization_id: c.organization_id,
    organization_name: c.organizations?.name ?? null,
    total_tickets: ticketCountsMap[c.id] ?? 0,
    last_ticket_at: lastTicketMap[c.id] ?? null,
  }))

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#F1F5F9]">Clientes (CRM)</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">{rows.length} contactos con rol cliente</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-12 text-center">
          <Users size={32} className="text-[#334155] mx-auto mb-3" />
          <p className="text-[#64748B] text-sm">No hay clientes registrados aún.</p>
          <p className="text-[#475569] text-xs mt-1">Los usuarios con rol "cliente" aparecerán aquí.</p>
        </div>
      ) : (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Organización</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Tickets totales</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Último ticket</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Registro</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(client => (
                <tr key={client.id} className="border-b border-[#334155]/50 hover:bg-[#263248] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#334155] flex items-center justify-center text-[#F1F5F9] text-xs font-semibold shrink-0">
                        {client.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#F1F5F9]">{client.full_name}</p>
                        {client.job_title && (
                          <p className="text-xs text-[#64748B]">{client.job_title}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{client.email}</td>
                  <td className="px-4 py-3">
                    {client.organization_name ? (
                      <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
                        <Building2 size={11} className="text-[#475569] shrink-0" />
                        {client.organization_name}
                      </span>
                    ) : (
                      <span className="text-xs text-[#475569]">Sin organización</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs">
                      <Ticket size={11} className={client.total_tickets > 0 ? 'text-[#3B82F6]' : 'text-[#475569]'} />
                      <span className={client.total_tickets > 0 ? 'text-[#F1F5F9] font-medium' : 'text-[#475569]'}>
                        {client.total_tickets}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">
                    {client.last_ticket_at ? formatDate(client.last_ticket_at) : <span className="text-[#475569]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">
                    {formatDate(client.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6] text-xs font-medium hover:bg-[#3B82F6]/20 transition-colors"
                    >
                      Ver timeline <ChevronRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
