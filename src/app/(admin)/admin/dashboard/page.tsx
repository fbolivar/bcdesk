import { createClient } from '@/lib/supabase/server'
import { bogotaDayKey } from '@/lib/date'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Ticket, Briefcase, AlertTriangle, Users, Building2, Plus, ArrowRight,
  Activity, Clock, CheckCircle2, Inbox, Zap,
} from 'lucide-react'
import { StatusBadge, PriorityBadge } from '@/shared/components/priority-badge'
import {
  KpiCard, TrendChart, StatusDonut, PriorityBars, SlaGauge, RankList, AnimatedCounter,
} from '@/features/admin/components/dashboard-widgets'
import { FleetHealthSection, type FleetHealth } from '@/features/rmm/fleet-health-section'

const ACTIVE_FILTER = '("resolved","closed","cancelled")'

function dayKey(d: Date) { return bogotaDayKey(d) }

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const now = new Date()
  const since30 = new Date(now.getTime() - 30 * 864e5).toISOString()
  const since14 = new Date(now.getTime() - 14 * 864e5).toISOString()
  const todayKey = dayKey(now)

  const [
    { data: activeTickets },
    { data: created30 },
    { data: resolved30 },
    { data: projectsList },
    { count: pendingInvoices },
    { count: activeClients },
    { count: agentsCount },
  ] = await Promise.all([
    // Tickets activos (para KPIs, distribución, agentes, clientes, tabla SLA)
    supabase.from('tickets')
      .select('id, ticket_number, title, status, priority, assigned_to, sla_resolution_due_at, sla_breached, created_at, organizations(name), profiles!assigned_to(full_name)')
      .not('status', 'in', ACTIVE_FILTER)
      .order('sla_resolution_due_at', { ascending: true, nullsFirst: false })
      .limit(500),
    // Creados últimos 30 días (tendencia)
    supabase.from('tickets').select('created_at, priority').gte('created_at', since30).limit(2000),
    // Resueltos últimos 30 días (tendencia + SLA + agentes)
    supabase.from('tickets').select('resolved_at, sla_breached, first_response_at, created_at, assigned_to, profiles!assigned_to(full_name)')
      .not('resolved_at', 'is', null).gte('resolved_at', since30).limit(2000),
    supabase.from('projects').select('id, name, progress_percent, status, organizations(name)').eq('status', 'active').order('end_date', { ascending: true }).limit(6),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).in('status', ['sent', 'overdue']),
    supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['admin', 'agent']).eq('is_active', true),
  ])

  // Salud de flota RMM (agregación en el servidor; solo se muestra si hay flota).
  const { data: fleetRaw } = await supabase.rpc('rmm_fleet_health')
  const fleet = (fleetRaw ?? null) as FleetHealth | null
  const hasFleet = !!fleet?.summary && fleet.summary.total > 0

  type ActiveTicket = {
    id: string; ticket_number: number; title: string; status: string; priority: string
    assigned_to: string | null; sla_resolution_due_at: string | null; sla_breached: boolean | null; created_at: string
    organizations?: { name: string } | { name: string }[] | null
    profiles?: { full_name: string } | { full_name: string }[] | null
  }
  const active = (activeTickets ?? []) as ActiveTicket[]
  const orgName = (o: ActiveTicket['organizations']) => (Array.isArray(o) ? o[0]?.name : o?.name) ?? null
  const agentName = (p: ActiveTicket['profiles']) => (Array.isArray(p) ? p[0]?.full_name : p?.full_name) ?? null

  // ── KPIs ────────────────────────────────────────────────
  const openCount = active.filter(t => t.status === 'open').length
  const criticalCount = active.filter(t => t.priority === 'critical').length
  const unassigned = active.filter(t => !t.assigned_to).length
  const in24h = now.getTime() + 24 * 864e5
  const slaAtRisk = active.filter(t => t.sla_breached || (t.sla_resolution_due_at && new Date(t.sla_resolution_due_at).getTime() <= in24h)).length
  const resolvedToday = (resolved30 ?? []).filter((t: { resolved_at: string }) => dayKey(new Date(t.resolved_at)) === todayKey).length
  const createdToday = (created30 ?? []).filter((t: { created_at: string }) => dayKey(new Date(t.created_at)) === todayKey).length

  // ── Distribución ────────────────────────────────────────
  const statusAgg: Record<string, number> = {}
  active.forEach(t => { statusAgg[t.status] = (statusAgg[t.status] ?? 0) + 1 })
  const byStatus = Object.entries(statusAgg).map(([status, count]) => ({ status, count }))

  const priorityAgg: Record<string, number> = {}
  active.forEach(t => { priorityAgg[t.priority] = (priorityAgg[t.priority] ?? 0) + 1 })
  const byPriority = Object.entries(priorityAgg).map(([priority, count]) => ({ priority, count }))

  // ── Tendencia 14 días (creados vs resueltos) ────────────
  const days: { day: string; creados: number; resueltos: number }[] = []
  const createdByDay: Record<string, number> = {}
  const resolvedByDay: Record<string, number> = {}
  ;(created30 ?? []).forEach((t: { created_at: string }) => { const k = dayKey(new Date(t.created_at)); createdByDay[k] = (createdByDay[k] ?? 0) + 1 })
  ;(resolved30 ?? []).forEach((t: { resolved_at: string }) => { const k = dayKey(new Date(t.resolved_at)); resolvedByDay[k] = (resolvedByDay[k] ?? 0) + 1 })
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 864e5)
    const k = dayKey(d)
    days.push({ day: `${d.getDate()}/${d.getMonth() + 1}`, creados: createdByDay[k] ?? 0, resueltos: resolvedByDay[k] ?? 0 })
  }
  const spark = (obj: Record<string, number>) => {
    const out: number[] = []
    for (let i = 6; i >= 0; i--) out.push(obj[dayKey(new Date(now.getTime() - i * 864e5))] ?? 0)
    return out
  }
  const createdSpark = spark(createdByDay)
  const resolvedSpark = spark(resolvedByDay)

  // ── SLA compliance (resueltos últimos 30d) ──────────────
  const resolvedArr = (resolved30 ?? []) as { sla_breached: boolean | null; first_response_at: string | null; created_at: string; assigned_to: string | null; profiles?: { full_name: string } | { full_name: string }[] | null }[]
  const resolvedTotal = resolvedArr.length
  const breached = resolvedArr.filter(t => t.sla_breached).length
  const slaCompliance = resolvedTotal > 0 ? Math.round(((resolvedTotal - breached) / resolvedTotal) * 100) : 100

  // ── Tiempo prom. 1ra respuesta (h) ──────────────────────
  const frs = resolvedArr.filter(t => t.first_response_at).map(t => (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()) / 36e5)
  const avgFirstResp = frs.length > 0 ? (frs.reduce((a, b) => a + b, 0) / frs.length) : 0

  // ── Top agentes (resueltos 30d + carga activa) ──────────
  const resolvedByAgent: Record<string, number> = {}
  resolvedArr.forEach(t => { const n = Array.isArray(t.profiles) ? t.profiles[0]?.full_name : t.profiles?.full_name; if (n) resolvedByAgent[n] = (resolvedByAgent[n] ?? 0) + 1 })
  const activeByAgent: Record<string, number> = {}
  active.forEach(t => { const n = agentName(t.profiles); if (n) activeByAgent[n] = (activeByAgent[n] ?? 0) + 1 })
  const topAgents = Object.entries(resolvedByAgent).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([label, value]) => ({ label, value, sub: `${activeByAgent[label] ?? 0} activos ahora` }))

  // ── Top clientes (por tickets activos) ──────────────────
  const clientAgg: Record<string, number> = {}
  active.forEach(t => { const n = orgName(t.organizations); if (n) clientAgg[n] = (clientAgg[n] ?? 0) + 1 })
  const topClients = Object.entries(clientAgg).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }))

  const projects = (projectsList ?? []) as { id: string; name: string; progress_percent: number; organizations?: { name: string } | { name: string }[] | null }[]
  const slaTickets = active.slice(0, 8)

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const dateStr = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

  const gentle = (base: number) => [base * 0.6, base * 0.9, base * 0.7, base, base * 0.85, base * 1.1, base].map(Math.round)

  const kpis = [
    { label: 'Tickets abiertos', value: openCount, icon: <Ticket size={18} />, color: '#00D4AA', spark: createdSpark, delta: `${createdToday} hoy`, deltaUp: true, href: '/admin/tickets?status=open' },
    { label: 'Críticos activos', value: criticalCount, icon: <AlertTriangle size={18} />, color: '#EF4444', spark: gentle(Math.max(1, criticalCount)), delta: criticalCount > 0 ? 'atención' : 'ok', deltaUp: criticalCount === 0, href: '/admin/tickets?priority=critical' },
    { label: 'SLA en riesgo', value: slaAtRisk, icon: <Zap size={18} />, color: '#F59E0B', spark: gentle(Math.max(1, slaAtRisk)), delta: `${unassigned} sin asignar`, deltaUp: false, href: '/admin/tickets' },
    { label: 'Proyectos activos', value: projects.length, icon: <Briefcase size={18} />, color: '#10B981', spark: gentle(Math.max(1, projects.length)), href: '/admin/projects' },
    { label: 'Clientes activos', value: activeClients ?? 0, icon: <Building2 size={18} />, color: '#8B5CF6', spark: gentle(Math.max(1, activeClients ?? 1)), href: '/admin/clients' },
  ]

  const miniStats = [
    { label: 'Resueltos hoy', value: resolvedToday, icon: <CheckCircle2 size={15} />, color: '#10B981' },
    { label: 'Creados hoy', value: createdToday, icon: <Inbox size={15} />, color: '#00D4AA' },
    { label: '1ª respuesta', value: avgFirstResp, suffix: 'h', decimals: 1, icon: <Clock size={15} />, color: '#8B5CF6' },
    { label: 'Agentes', value: agentsCount ?? 0, icon: <Users size={15} />, color: '#06B6D4' },
  ]

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse-glow" /> En vivo
            </span>
            <span className="text-sm capitalize" style={{ color: '#5B6B7C' }}>{dateStr}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#0B2545' }}>
            {greeting}, {profile?.full_name?.split(' ')[0]} 👋
          </h1>
        </div>
        <Link href="/admin/tickets/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
          style={{ background: '#00D4AA', boxShadow: '0 4px 14px rgba(0, 212, 170,0.35)' }}>
          <Plus size={16} /> Nuevo ticket
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((k, i) => <KpiCard key={k.label} {...k} index={i} />)}
      </div>

      {/* Salud de flota RMM (solo si el operador tiene equipos monitoreados) */}
      {hasFleet && fleet && <FleetHealthSection data={fleet} />}

      {/* Trend + SLA gauge */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0B2545' }}>
              <Activity size={15} className="text-[#0E9E86]" /> Flujo de tickets · 14 días
            </h2>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5" style={{ color: '#5B6B7C' }}><span className="w-2.5 h-2.5 rounded-full bg-[#00D4AA]" /> Creados</span>
              <span className="flex items-center gap-1.5" style={{ color: '#5B6B7C' }}><span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Resueltos</span>
            </div>
          </div>
          <TrendChart data={days} />
        </div>
        <div className="rounded-2xl p-5 flex flex-col" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: '#0B2545' }}>Rendimiento SLA</h2>
          <SlaGauge value={slaCompliance} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            <div className="text-center rounded-xl py-2" style={{ background: '#F7F9FC' }}>
              <div className="text-lg font-bold" style={{ color: '#10B981' }}><AnimatedCounter value={resolvedTotal} /></div>
              <div className="text-[10px]" style={{ color: '#5B6B7C' }}>Resueltos 30d</div>
            </div>
            <div className="text-center rounded-xl py-2" style={{ background: '#F7F9FC' }}>
              <div className="text-lg font-bold" style={{ color: '#EF4444' }}><AnimatedCounter value={breached} /></div>
              <div className="text-[10px]" style={{ color: '#5B6B7C' }}>SLA incumplidos</div>
            </div>
          </div>
        </div>
      </div>

      {/* Distribution + mini stats */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#0B2545' }}>Tickets por estado</h2>
          <StatusDonut data={byStatus} />
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#0B2545' }}>Tickets por prioridad</h2>
          <PriorityBars data={byPriority} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {miniStats.map(m => (
            <div key={m.label} className="rounded-2xl p-4 flex flex-col justify-between" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${m.color}18`, color: m.color }}>{m.icon}</div>
              <div className="text-2xl font-bold" style={{ color: '#0B2545' }}><AnimatedCounter value={m.value} suffix={m.suffix} decimals={m.decimals} /></div>
              <div className="text-[11px]" style={{ color: '#5B6B7C' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SLA tickets + Top agents */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E6EBF2' }}>
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0B2545' }}><Clock size={15} className="text-[#F59E0B]" /> Tickets activos por SLA</h2>
            <Link href="/admin/tickets" className="flex items-center gap-1 text-xs" style={{ color: '#00D4AA' }}>Ver todos <ArrowRight size={12} /></Link>
          </div>
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #E6EBF2' }}>
                {['#', 'Cliente', 'Título', 'Prioridad', 'Estado', 'Asignado'].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slaTickets.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm" style={{ color: '#94A3B8' }}>No hay tickets activos 🎉</td></tr>
              ) : slaTickets.map(t => (
                <tr key={t.id} className="transition-colors hover:bg-[rgba(0, 212, 170,0.04)]" style={{ borderBottom: '1px solid #F4F7FB' }}>
                  <td className="px-5 py-3"><Link href={`/admin/tickets/${t.id}`} className="font-mono text-xs hover:underline" style={{ color: '#00D4AA' }}>#{t.ticket_number}</Link></td>
                  <td className="px-5 py-3 text-xs" style={{ color: '#5B6B7C' }}>{orgName(t.organizations) ?? '—'}</td>
                  <td className="px-5 py-3"><Link href={`/admin/tickets/${t.id}`} className="text-xs line-clamp-1 max-w-[180px] transition-colors hover:text-[#0E9E86]" style={{ color: '#0B2545' }}>{t.title}</Link></td>
                  <td className="px-5 py-3"><PriorityBadge priority={t.priority as never} /></td>
                  <td className="px-5 py-3"><StatusBadge status={t.status as never} /></td>
                  <td className="px-5 py-3 text-xs" style={{ color: '#94A3B8' }}>{agentName(t.profiles) ?? 'Sin asignar'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#0B2545' }}><Users size={15} className="text-[#8B5CF6]" /> Top agentes · 30 días</h2>
          <RankList items={topAgents} color="#8B5CF6" unit=" ✓" />
        </div>
      </div>

      {/* Top clients + projects */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#0B2545' }}><Building2 size={15} className="text-[#0E9E86]" /> Clientes con más actividad</h2>
          <RankList items={topClients} color="#00D4AA" unit=" tickets" />
        </div>
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0B2545' }}><Briefcase size={15} className="text-[#10B981]" /> Proyectos activos</h2>
            <Link href="/admin/projects" className="flex items-center gap-1 text-xs" style={{ color: '#00D4AA' }}>Ver todos <ArrowRight size={12} /></Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {projects.length === 0 ? (
              <p className="text-sm col-span-2 text-center py-6" style={{ color: '#94A3B8' }}>Sin proyectos activos</p>
            ) : projects.map(p => {
              const pct = p.progress_percent ?? 0
              const pn = Array.isArray(p.organizations) ? p.organizations[0]?.name : p.organizations?.name
              return (
                <Link key={p.id} href={`/admin/projects/${p.id}`} className="rounded-xl p-4 transition-all hover:-translate-y-0.5" style={{ background: '#F7F9FC', border: '1px solid #E6EBF2' }}>
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0" style={{ width: 46, height: 46 }}>
                      <svg width="46" height="46" className="-rotate-90">
                        <circle cx="23" cy="23" r="19" fill="none" stroke="#E6EBF2" strokeWidth="4" />
                        <circle cx="23" cy="23" r="19" fill="none" stroke="#10B981" strokeWidth="4" strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 19}`} strokeDashoffset={`${2 * Math.PI * 19 * (1 - pct / 100)}`} />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color: '#0B2545' }}>{pct}%</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#0B2545' }}>{p.name}</p>
                      <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{pn ?? '—'}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
