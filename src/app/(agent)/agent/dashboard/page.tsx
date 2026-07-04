import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Ticket, Clock, CheckCircle2, Zap, Building2, Activity, ArrowRight, Inbox, Timer,
} from 'lucide-react'
import { StatusBadge, PriorityBadge } from '@/shared/components/priority-badge'
import {
  KpiCard, TrendChart, StatusDonut, PriorityBars, SlaGauge, RankList, AnimatedCounter,
} from '@/features/admin/components/dashboard-widgets'

const ACTIVE_FILTER = '("resolved","closed","cancelled")'
function dayKey(d: Date) { return d.toISOString().slice(0, 10) }

export default async function AgentDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()

  const now = new Date()
  const since30 = new Date(now.getTime() - 30 * 864e5).toISOString()
  const todayKey = dayKey(now)

  const [{ data: mineActive }, { data: mineCreated }, { data: mineResolved }] = await Promise.all([
    supabase.from('tickets')
      .select('id, ticket_number, title, status, priority, sla_resolution_due_at, sla_breached, created_at, organizations(name)')
      .eq('assigned_to', user.id).not('status', 'in', ACTIVE_FILTER)
      .order('sla_resolution_due_at', { ascending: true, nullsFirst: false }).limit(300),
    supabase.from('tickets').select('created_at').eq('assigned_to', user.id).gte('created_at', since30).limit(1000),
    supabase.from('tickets').select('resolved_at, sla_breached, first_response_at, created_at')
      .eq('assigned_to', user.id).not('resolved_at', 'is', null).gte('resolved_at', since30).limit(1000),
  ])

  type T = { id: string; ticket_number: number; title: string; status: string; priority: string; sla_resolution_due_at: string | null; sla_breached: boolean | null; organizations?: { name: string } | { name: string }[] | null }
  const active = (mineActive ?? []) as T[]
  const orgName = (o: T['organizations']) => (Array.isArray(o) ? o[0]?.name : o?.name) ?? null

  const openCount = active.filter(t => t.status === 'open').length
  const inProgress = active.filter(t => t.status === 'in_progress').length
  const waiting = active.filter(t => t.status === 'waiting_client').length
  const in24h = now.getTime() + 24 * 864e5
  const slaAtRisk = active.filter(t => t.sla_breached || (t.sla_resolution_due_at && new Date(t.sla_resolution_due_at).getTime() <= in24h)).length

  const resolvedArr = (mineResolved ?? []) as { resolved_at: string; sla_breached: boolean | null; first_response_at: string | null; created_at: string }[]
  const resolvedToday = resolvedArr.filter(t => dayKey(new Date(t.resolved_at)) === todayKey).length
  const resolvedTotal = resolvedArr.length
  const breached = resolvedArr.filter(t => t.sla_breached).length
  const slaCompliance = resolvedTotal > 0 ? Math.round(((resolvedTotal - breached) / resolvedTotal) * 100) : 100
  const frs = resolvedArr.filter(t => t.first_response_at).map(t => (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()) / 36e5)
  const avgFirstResp = frs.length > 0 ? frs.reduce((a, b) => a + b, 0) / frs.length : 0

  // Distribución
  const statusAgg: Record<string, number> = {}; active.forEach(t => { statusAgg[t.status] = (statusAgg[t.status] ?? 0) + 1 })
  const byStatus = Object.entries(statusAgg).map(([status, count]) => ({ status, count }))
  const priorityAgg: Record<string, number> = {}; active.forEach(t => { priorityAgg[t.priority] = (priorityAgg[t.priority] ?? 0) + 1 })
  const byPriority = Object.entries(priorityAgg).map(([priority, count]) => ({ priority, count }))

  // Tendencia 14d (inflow vs resueltos)
  const createdByDay: Record<string, number> = {}; (mineCreated ?? []).forEach((t: { created_at: string }) => { const k = dayKey(new Date(t.created_at)); createdByDay[k] = (createdByDay[k] ?? 0) + 1 })
  const resolvedByDay: Record<string, number> = {}; resolvedArr.forEach(t => { const k = dayKey(new Date(t.resolved_at)); resolvedByDay[k] = (resolvedByDay[k] ?? 0) + 1 })
  const days: { day: string; creados: number; resueltos: number }[] = []
  for (let i = 13; i >= 0; i--) { const d = new Date(now.getTime() - i * 864e5); const k = dayKey(d); days.push({ day: `${d.getDate()}/${d.getMonth() + 1}`, creados: createdByDay[k] ?? 0, resueltos: resolvedByDay[k] ?? 0 }) }
  const spark = (obj: Record<string, number>) => { const o: number[] = []; for (let i = 6; i >= 0; i--) o.push(obj[dayKey(new Date(now.getTime() - i * 864e5))] ?? 0); return o }
  const gentle = (b: number) => [b * 0.6, b * 0.9, b * 0.7, b, b * 0.85, b * 1.1, b].map(Math.round)

  // Top clientes que atiendo
  const clientAgg: Record<string, number> = {}; active.forEach(t => { const n = orgName(t.organizations); if (n) clientAgg[n] = (clientAgg[n] ?? 0) + 1 })
  const topClients = Object.entries(clientAgg).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }))

  const slaTickets = active.slice(0, 8)
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const dateStr = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

  const kpis = [
    { label: 'Abiertos', value: openCount, icon: <Ticket size={18} />, color: '#3B82F6', spark: spark(createdByDay), href: '/agent/tickets?status=open' },
    { label: 'En progreso', value: inProgress, icon: <Activity size={18} />, color: '#8B5CF6', spark: gentle(Math.max(1, inProgress)), href: '/agent/tickets' },
    { label: 'Esperando cliente', value: waiting, icon: <Timer size={18} />, color: '#F59E0B', spark: gentle(Math.max(1, waiting)), href: '/agent/tickets' },
    { label: 'SLA en riesgo', value: slaAtRisk, icon: <Zap size={18} />, color: '#EF4444', spark: gentle(Math.max(1, slaAtRisk)), delta: slaAtRisk > 0 ? 'urgente' : 'ok', deltaUp: slaAtRisk === 0, href: '/agent/tickets' },
    { label: 'Resueltos hoy', value: resolvedToday, icon: <CheckCircle2 size={18} />, color: '#10B981', spark: spark(resolvedByDay), delta: 'hoy', deltaUp: true, href: '/agent/tickets' },
  ]

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse-glow" /> En vivo
            </span>
            <span className="text-sm capitalize" style={{ color: '#64748B' }}>{dateStr}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#0F172A' }}>
            {greeting}, {profile?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>Tu bandeja, ordenada por urgencia SLA</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((k, i) => <KpiCard key={k.label} {...k} index={i} />)}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0F172A' }}><Activity size={15} className="text-[#3B82F6]" /> Mi flujo · 14 días</h2>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5" style={{ color: '#64748B' }}><span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" /> Entrantes</span>
              <span className="flex items-center gap-1.5" style={{ color: '#64748B' }}><span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Resueltos</span>
            </div>
          </div>
          <TrendChart data={days} />
        </div>
        <div className="rounded-2xl p-5 flex flex-col" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: '#0F172A' }}>Mi rendimiento SLA</h2>
          <SlaGauge value={slaCompliance} />
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="text-center rounded-xl py-2" style={{ background: '#F7F9FC' }}>
              <div className="text-lg font-bold" style={{ color: '#10B981' }}><AnimatedCounter value={resolvedTotal} /></div>
              <div className="text-[10px]" style={{ color: '#64748B' }}>Resueltos 30d</div>
            </div>
            <div className="text-center rounded-xl py-2" style={{ background: '#F7F9FC' }}>
              <div className="text-lg font-bold" style={{ color: '#8B5CF6' }}><AnimatedCounter value={avgFirstResp} decimals={1} suffix="h" /></div>
              <div className="text-[10px]" style={{ color: '#64748B' }}>1ª respuesta</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>Mis tickets por estado</h2>
          <StatusDonut data={byStatus} />
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>Mis tickets por prioridad</h2>
          <PriorityBars data={byPriority} />
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#0F172A' }}><Building2 size={15} className="text-[#3B82F6]" /> Clientes que atiendo</h2>
          <RankList items={topClients} color="#3B82F6" unit=" tickets" />
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0F172A' }}><Clock size={15} className="text-[#F59E0B]" /> Mis tickets por SLA</h2>
          <Link href="/agent/tickets" className="flex items-center gap-1 text-xs" style={{ color: '#3B82F6' }}>Ver bandeja <ArrowRight size={12} /></Link>
        </div>
        {slaTickets.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Inbox size={32} className="mx-auto mb-3 text-[#CBD5E1]" />
            <p className="text-sm" style={{ color: '#64748B' }}>No tienes tickets activos asignados 🎉</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #E6EBF2' }}>
                {['#', 'Cliente', 'Título', 'Prioridad', 'Estado'].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slaTickets.map(t => (
                <tr key={t.id} className="transition-colors hover:bg-[rgba(59,130,246,0.04)]" style={{ borderBottom: '1px solid #F4F7FB' }}>
                  <td className="px-5 py-3"><Link href={`/agent/tickets/${t.id}`} className="font-mono text-xs hover:underline" style={{ color: '#3B82F6' }}>#{t.ticket_number}</Link></td>
                  <td className="px-5 py-3 text-xs" style={{ color: '#64748B' }}>{orgName(t.organizations) ?? '—'}</td>
                  <td className="px-5 py-3"><Link href={`/agent/tickets/${t.id}`} className="text-xs line-clamp-1 max-w-[220px] transition-colors hover:text-[#3B82F6]" style={{ color: '#0F172A' }}>{t.title}</Link></td>
                  <td className="px-5 py-3"><PriorityBadge priority={t.priority as never} /></td>
                  <td className="px-5 py-3"><StatusBadge status={t.status as never} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
