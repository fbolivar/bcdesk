import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Ticket, Briefcase, FileText, AlertTriangle, TrendingUp, Users, ArrowRight } from 'lucide-react'
import { StatusBadge, PriorityBadge } from '@/shared/components/priority-badge'
import { DashboardBuilder } from '@/features/admin/components/dashboard-builder'
import type { Ticket as TicketType, Project } from '@/lib/supabase/types'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [
    { count: openTickets },
    { count: criticalTickets },
    { count: activeProjects },
    { count: pendingInvoices },
    { data: recentTickets },
    { data: activeProjectsList },
  ] = await Promise.all([
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('tickets').select('*', { count: 'exact', head: true })
      .eq('priority', 'critical').not('status', 'in', '("resolved","closed","cancelled")'),
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).in('status', ['sent', 'overdue']),
    supabase.from('tickets')
      .select('*, organizations(name), profiles!assigned_to(full_name)')
      .not('status', 'in', '("resolved","closed","cancelled")')
      .order('sla_resolution_due_at', { ascending: true, nullsFirst: false })
      .limit(10),
    supabase.from('projects')
      .select('*, organizations(name)')
      .eq('status', 'active')
      .order('end_date', { ascending: true })
      .limit(5),
  ])

  const [
    { data: byStatusRaw },
    { data: byPriorityRaw },
    { data: topAgentsRaw },
    { data: userWidgets },
    { count: activeClients },
  ] = await Promise.all([
    supabase.from('tickets').select('status').not('status', 'in', '("resolved","closed")'),
    supabase.from('tickets').select('priority').not('status', 'in', '("resolved","closed")'),
    supabase.from('tickets').select('profiles!assigned_to(full_name)').not('assigned_to', 'is', null).limit(100),
    supabase.from('dashboard_widgets').select('*').eq('user_id', user.id).order('position_y'),
    supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ])

  const statusCounts: Record<string, number> = {}
  ;(byStatusRaw ?? []).forEach((t: { status: string }) => { statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1 })
  const byStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

  const priorityCounts: Record<string, number> = {}
  ;(byPriorityRaw ?? []).forEach((t: { priority: string }) => { priorityCounts[t.priority] = (priorityCounts[t.priority] ?? 0) + 1 })
  const byPriority = Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count }))

  const agentCounts: Record<string, number> = {}
  ;(topAgentsRaw ?? []).forEach((t: { profiles?: { full_name?: string } | Array<{ full_name?: string }> }) => {
    const p = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles
    if (p?.full_name) agentCounts[p.full_name] = (agentCounts[p.full_name] ?? 0) + 1
  })
  const topAgents = Object.entries(agentCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }))

  const resolvedTotal = (byStatusRaw ?? []).filter((t: { status: string }) => t.status === 'resolved').length
  const total = (byStatusRaw ?? []).length
  const slaCompliance = total > 0 ? Math.round((resolvedTotal / total) * 100) : 0

  const dashboardStats = {
    openTickets: openTickets ?? 0,
    byStatus,
    byPriority,
    topAgents,
    slaCompliance,
    activeClients: activeClients ?? 0,
    avgResponseHours: '4.2',
    trend: [3,5,2,8,6,4,9,7,5,6,8,10,7,5,9,11,8,6,7,9,10,8,6,7,9,8,10,12,9,7],
  }

  const tickets = (recentTickets ?? []) as TicketType[]
  const projects = (activeProjectsList ?? []) as (Project & { organizations?: { name: string } })[]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  const stats = [
    {
      label: 'Tickets abiertos',
      value: openTickets ?? 0,
      icon: Ticket,
      href: '/admin/tickets?status=open',
      color: '#4F8AFF',
      glow: 'rgba(79,138,255,0.2)',
      bg: 'rgba(79,138,255,0.08)',
      trend: '+12%',
    },
    {
      label: 'Tickets críticos',
      value: criticalTickets ?? 0,
      icon: AlertTriangle,
      href: '/admin/tickets?priority=critical',
      color: '#FF4D6A',
      glow: 'rgba(255,77,106,0.2)',
      bg: 'rgba(255,77,106,0.08)',
      trend: '-3%',
    },
    {
      label: 'Proyectos activos',
      value: activeProjects ?? 0,
      icon: Briefcase,
      href: '/admin/projects',
      color: '#10D98A',
      glow: 'rgba(16,217,138,0.2)',
      bg: 'rgba(16,217,138,0.08)',
      trend: '0%',
    },
    {
      label: 'Facturas pendientes',
      value: pendingInvoices ?? 0,
      icon: FileText,
      href: '/admin/invoices?status=sent',
      color: '#FFB547',
      glow: 'rgba(255,181,71,0.2)',
      bg: 'rgba(255,181,71,0.08)',
      trend: '+5%',
    },
  ]

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm mb-1" style={{ color: '#8B9BB4' }}>{greeting}, {profile?.full_name?.split(' ')[0]}</p>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#F0F4FF' }}>
            Panel de administración
          </h1>
        </div>
        <Link
          href="/admin/tickets/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, #4F8AFF 0%, #8B6FFF 100%)',
            boxShadow: '0 0 20px rgba(79,138,255,0.25)',
          }}
        >
          + Nuevo ticket
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-2xl p-5 relative overflow-hidden group transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {/* Glow on hover */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: `radial-gradient(circle at 50% 0%, ${stat.glow} 0%, transparent 70%)` }}
            />
            {/* Top accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${stat.color}44, transparent)` }}
            />
            <div className="relative">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                style={{ background: stat.bg }}
              >
                <stat.icon size={16} style={{ color: stat.color }} />
              </div>
              <div className="text-3xl font-bold mb-1 tracking-tight" style={{ color: '#F0F4FF' }}>{stat.value}</div>
              <div className="flex items-center justify-between">
                <div className="text-xs" style={{ color: '#8B9BB4' }}>{stat.label}</div>
                <div className="flex items-center gap-1 text-[10px] font-medium" style={{ color: stat.color }}>
                  <TrendingUp size={10} />
                  {stat.trend}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tickets table */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: '#F0F4FF' }}>Tickets activos por SLA</h2>
            <Link href="/admin/tickets" className="flex items-center gap-1 text-xs transition-colors" style={{ color: '#4F8AFF' }}>
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['#', 'Cliente', 'Título', 'Prioridad', 'Estado', 'Asignado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#4A5568', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: '#4A5568' }}>
                      No hay tickets activos
                    </td>
                  </tr>
                ) : tickets.map(t => (
                  <tr
                    key={t.id}
                    className="transition-colors hover:bg-[rgba(79,138,255,0.04)]"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/admin/tickets/${t.id}`} className="font-mono text-xs hover:underline" style={{ color: '#4F8AFF' }}>
                        #{t.ticket_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#8B9BB4' }}>
                      {(t as { organization?: { name: string } }).organization?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/tickets/${t.id}`} className="text-xs hover:text-[#4F8AFF] line-clamp-1 max-w-[160px] transition-colors" style={{ color: '#F0F4FF' }}>
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#4A5568' }}>
                      {(t as { assigned_to_profile?: { full_name: string } }).assigned_to_profile?.full_name ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active projects */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: '#F0F4FF' }}>Proyectos activos</h2>
            <Link href="/admin/projects" className="flex items-center gap-1 text-xs" style={{ color: '#4F8AFF' }}>
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {projects.length === 0 ? (
              <div
                className="rounded-2xl p-6 text-center text-sm"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', color: '#4A5568' }}
              >
                Sin proyectos activos
              </div>
            ) : projects.map(p => (
              <Link
                key={p.id}
                href={`/admin/projects/${p.id}`}
                className="block rounded-2xl p-4 transition-all duration-150 hover:-translate-y-0.5"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <p className="text-sm font-medium mb-0.5" style={{ color: '#F0F4FF' }}>{p.name}</p>
                <p className="text-xs mb-3" style={{ color: '#4A5568' }}>{p.organizations?.name}</p>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${p.progress_percent}%`,
                      background: 'linear-gradient(90deg, #4F8AFF, #8B6FFF)',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-1 text-[10px]" style={{ color: '#4F8AFF' }}>
                    <Briefcase size={9} /> Activo
                  </div>
                  <span className="text-[11px] font-semibold" style={{ color: '#8B9BB4' }}>{p.progress_percent}%</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Configurable dashboard */}
      <div>
        <h2 className="text-sm font-semibold mb-4" style={{ color: '#F0F4FF' }}>Mi dashboard</h2>
        <DashboardBuilder
          initialWidgets={userWidgets ?? []}
          stats={dashboardStats}
          userId={user.id}
        />
      </div>
    </div>
  )
}
