import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Ticket, Briefcase, FileText, AlertTriangle, Plus } from 'lucide-react'
import { TicketCard } from '@/shared/components/ticket-card'
import type { Ticket as TicketType, Project, Invoice } from '@/lib/supabase/types'

async function getClientData(orgId: string) {
  const supabase = await createClient()

  const [ticketsRes, projectsRes, invoicesRes] = await Promise.all([
    supabase.from('tickets')
      .select('*, organizations(name), profiles!assigned_to(full_name, avatar_url)')
      .eq('organization_id', orgId)
      .not('status', 'in', '("closed","cancelled")')
      .order('sla_resolution_due_at', { ascending: true })
      .limit(5),
    supabase.from('projects')
      .select('*')
      .eq('organization_id', orgId)
      .not('status', 'in', '("completed","cancelled")')
      .order('created_at', { ascending: false })
      .limit(4),
    supabase.from('invoices')
      .select('*')
      .eq('organization_id', orgId)
      .in('status', ['sent', 'overdue'])
      .order('due_date', { ascending: true })
      .limit(3),
  ])

  return {
    tickets: (ticketsRes.data ?? []) as TicketType[],
    projects: (projectsRes.data ?? []) as Project[],
    invoices: (invoicesRes.data ?? []) as Invoice[],
  }
}

export default async function ClientDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, full_name, organizations(name)')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle size={40} className="text-[#F59E0B] mb-4" />
        <h2 className="text-lg font-semibold text-[#F1F5F9]">Sin organización asignada</h2>
        <p className="text-sm text-[#94A3B8] mt-2">Contacta a tu administrador para completar la configuración.</p>
      </div>
    )
  }

  const { tickets, projects, invoices } = await getClientData(profile.organization_id)

  const openCount = tickets.filter(t => t.status === 'open').length
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length
  const activeProjects = projects.length
  const pendingInvoices = invoices.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Hola, {profile.full_name.split(' ')[0]} 👋</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">Resumen de tu cuenta</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tickets abiertos',   value: openCount,       icon: Ticket,    color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10' },
          { label: 'En progreso',         value: inProgressCount, icon: Ticket,    color: 'text-[#06B6D4]', bg: 'bg-[#06B6D4]/10' },
          { label: 'Proyectos activos',   value: activeProjects,  icon: Briefcase, color: 'text-[#10B981]', bg: 'bg-[#10B981]/10' },
          { label: 'Facturas pendientes', value: pendingInvoices, icon: FileText,  color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon size={18} className={stat.color} />
            </div>
            <div className="text-2xl font-bold text-[#F1F5F9]">{stat.value}</div>
            <div className="text-xs text-[#94A3B8] mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent tickets */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#F1F5F9]">Tickets recientes</h2>
            <Link href="/client/tickets/new" className="flex items-center gap-1.5 text-xs text-[#3B82F6] hover:underline">
              <Plus size={12} /> Nuevo ticket
            </Link>
          </div>
          {tickets.length === 0 ? (
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-6 text-center">
              <p className="text-sm text-[#64748B]">No tienes tickets activos</p>
              <Link href="/client/tickets/new" className="mt-3 inline-block text-sm text-[#3B82F6] hover:underline">
                Crear primer ticket
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map(ticket => (
                <TicketCard key={ticket.id} ticket={ticket} href={`/client/tickets/${ticket.id}`} />
              ))}
              <Link href="/client/tickets" className="block text-center text-sm text-[#3B82F6] hover:underline py-2">
                Ver todos →
              </Link>
            </div>
          )}
        </div>

        {/* Projects */}
        <div>
          <h2 className="text-sm font-semibold text-[#F1F5F9] mb-3">Proyectos activos</h2>
          {projects.length === 0 ? (
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-6 text-center">
              <p className="text-sm text-[#64748B]">No hay proyectos activos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map(project => (
                <Link
                  key={project.id}
                  href={`/client/projects`}
                  className="block bg-[#1E293B] border border-[#334155] rounded-xl p-4 hover:border-[#3B82F6]/40 hover:bg-[#263248] transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-medium text-[#F1F5F9]">{project.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      project.status === 'active' ? 'bg-[#10B981]/20 text-[#10B981]' :
                      project.status === 'planning' ? 'bg-[#3B82F6]/20 text-[#3B82F6]' :
                      'bg-[#F59E0B]/20 text-[#F59E0B]'
                    }`}>
                      {project.status === 'active' ? 'Activo' : project.status === 'planning' ? 'Planificación' : 'En espera'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#334155] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#3B82F6] rounded-full transition-all"
                      style={{ width: `${project.progress_percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-[#64748B]">Progreso</span>
                    <span className="text-xs font-medium text-[#94A3B8]">{project.progress_percent}%</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#F1F5F9] mb-3">Facturas pendientes</h2>
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#334155]">
                  {['Número', 'Fecha emisión', 'Vencimiento', 'Total', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-[#334155]/50 hover:bg-[#263248] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[#94A3B8]">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-[#94A3B8]">{new Date(inv.issue_date).toLocaleDateString('es-CO')}</td>
                    <td className="px-4 py-3 text-[#94A3B8]">{new Date(inv.due_date).toLocaleDateString('es-CO')}</td>
                    <td className="px-4 py-3 font-medium text-[#F1F5F9]">${inv.total_usd.toLocaleString()} {inv.currency}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        inv.status === 'overdue' ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                      }`}>
                        {inv.status === 'overdue' ? 'Vencida' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
