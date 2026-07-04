import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WeeklyTicketsChart, CategoryPieChart, StatusBarChart } from '@/features/admin/components/reports-charts'
import { VolumePrediction } from '@/features/reports/components/volume-prediction'
import { subWeeks, startOfWeek, format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function AdminReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const [allTickets, invoicesAll, agentsRes] = await Promise.all([
    supabase.from('tickets').select('id, status, category, priority, created_at, resolved_at, first_response_at, satisfaction_score, sla_breached, assigned_to'),
    supabase.from('invoices').select('total_usd, paid_at, status, created_at'),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'agent']).eq('is_active', true),
  ])

  const tickets = allTickets.data ?? []
  const invoices = invoicesAll.data ?? []
  const agents = agentsRes.data ?? []

  // ── KPIs ──────────────────────────────────────────
  const openTickets = tickets.filter(t => !['resolved','closed','cancelled','merged'].includes(t.status)).length
  const resolvedTickets = tickets.filter(t => ['resolved','closed'].includes(t.status))
  const last30 = tickets.filter(t => new Date(t.created_at) >= subDays(new Date(), 30))
  const prev30 = tickets.filter(t => {
    const d = new Date(t.created_at)
    return d >= subDays(new Date(), 60) && d < subDays(new Date(), 30)
  })
  const trend30 = prev30.length > 0 ? Math.round(((last30.length - prev30.length) / prev30.length) * 100) : 0

  const avgResolutionHrs = resolvedTickets.length > 0
    ? resolvedTickets
        .filter(t => t.resolved_at)
        .reduce((acc, t) => acc + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000, 0)
        / resolvedTickets.filter(t => t.resolved_at).length
    : 0

  const scored = tickets.filter(t => t.satisfaction_score)
  const avgCsat = scored.length > 0
    ? scored.reduce((acc, t) => acc + (t.satisfaction_score ?? 0), 0) / scored.length
    : 0

  const slaBreached = tickets.filter(t => t.sla_breached).length
  const slaTotal = tickets.filter(t => t.status !== 'cancelled').length
  const slaCompliance = slaTotal > 0 ? Math.round(((slaTotal - slaBreached) / slaTotal) * 100) : 100

  const paidInvoices = invoices.filter(i => i.status === 'paid')
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthRevenue = paidInvoices.filter(i => i.paid_at && new Date(i.paid_at) >= monthStart)
    .reduce((acc, i) => acc + i.total_usd, 0)
  const totalRevenue = paidInvoices.reduce((acc, i) => acc + i.total_usd, 0)

  // ── Weekly chart ──────────────────────────────────
  const weeklyData = Array.from({ length: 8 }, (_, i) => {
    const weekStart = startOfWeek(subWeeks(new Date(), 7 - i))
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7)
    return {
      week: format(weekStart, 'dd MMM', { locale: es }),
      tickets: tickets.filter(t => { const d = new Date(t.created_at); return d >= weekStart && d < weekEnd }).length,
    }
  })

  // ── Category & status ─────────────────────────────
  const categoryLabels: Record<string, string> = {
    support: 'Soporte', development: 'Desarrollo', billing: 'Facturación', onboarding: 'Onboarding', other: 'Otro',
  }
  const categoryData = Object.entries(categoryLabels)
    .map(([cat, name]) => ({ name, value: tickets.filter(t => t.category === cat).length }))
    .filter(d => d.value > 0)

  const statusLabels: Record<string, string> = {
    open: 'Abiertos', in_progress: 'En progreso', waiting_client: 'Esperando', resolved: 'Resueltos', closed: 'Cerrados',
  }
  const statusData = Object.entries(statusLabels).map(([s, label]) => ({
    status: label, count: tickets.filter(t => t.status === s).length,
  }))

  // ── Agent performance ─────────────────────────────
  const agentPerf = agents.map(agent => {
    const myTickets = tickets.filter(t => t.assigned_to === agent.id)
    const myClosed = myTickets.filter(t => ['resolved','closed'].includes(t.status))
    const myScored = myTickets.filter(t => t.satisfaction_score)
    const avgScore = myScored.length > 0
      ? myScored.reduce((a, t) => a + (t.satisfaction_score ?? 0), 0) / myScored.length
      : null
    const myResolved = myClosed.filter(t => t.resolved_at && t.first_response_at)
    const avgFirstResp = myResolved.length > 0
      ? myResolved.reduce((a, t) => a + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()) / 60000, 0) / myResolved.length
      : null
    return {
      name: agent.full_name,
      total: myTickets.length,
      closed: myClosed.length,
      avgCsat: avgScore,
      avgFirstRespMin: avgFirstResp,
    }
  }).filter(a => a.total > 0).sort((a, b) => b.closed - a.closed)

  // ── Priority breakdown ────────────────────────────
  const priorityData = ['critical','high','medium','low'].map(p => ({
    priority: p,
    open: tickets.filter(t => t.priority === p && !['resolved','closed','cancelled'].includes(t.status)).length,
    total: tickets.filter(t => t.priority === p).length,
  }))
  const priorityColors: Record<string, string> = {
    critical: 'bg-[#EF4444]', high: 'bg-[#F59E0B]', medium: 'bg-[#3B82F6]', low: 'bg-[#64748B]',
  }
  const priorityLabels: Record<string, string> = {
    critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo',
  }

  function fmtMin(min: number | null) {
    if (min === null) return '—'
    if (min < 60) return `${Math.round(min)}m`
    return `${Math.round(min / 60)}h`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Reportes</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Métricas de desempeño en tiempo real</p>
      </div>

      {/* Predicción de volumen IA */}
      <VolumePrediction />

      {/* KPIs row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tickets abiertos', value: openTickets, sub: `${last30.length} últimos 30d (${trend30 > 0 ? '+' : ''}${trend30}%)` },
          { label: 'Tiempo prom. resolución', value: `${avgResolutionHrs.toFixed(1)}h`, sub: `${resolvedTickets.length} resueltos total` },
          { label: 'CSAT promedio', value: avgCsat > 0 ? `${avgCsat.toFixed(1)}/5` : '—', sub: `${scored.length} calificaciones` },
          { label: 'SLA cumplimiento', value: `${slaCompliance}%`, sub: `${slaBreached} incumplidos` },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
            <p className="text-2xl font-bold text-[#1E293B]">{kpi.value}</p>
            <p className="text-xs text-[#64748B] mt-0.5">{kpi.label}</p>
            <p className="text-[10px] text-[#CBD5E1] mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* KPIs row 2 — Revenue */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ingresos del mes', value: `$${monthRevenue.toLocaleString()}` },
          { label: 'Ingresos totales', value: `$${totalRevenue.toLocaleString()}` },
          { label: 'Facturas pendientes', value: invoices.filter(i => ['sent','overdue'].includes(i.status)).length },
          { label: 'Total tickets', value: tickets.length },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
            <p className="text-xl font-bold text-[#1E293B]">{kpi.value}</p>
            <p className="text-xs text-[#64748B] mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#1E293B] mb-4">Tickets por semana (últimas 8 semanas)</h2>
          <WeeklyTicketsChart data={weeklyData} />
        </div>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#1E293B] mb-4">Distribución por categoría</h2>
          <CategoryPieChart data={categoryData} />
        </div>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#1E293B] mb-4">Tickets por estado</h2>
          <StatusBarChart data={statusData} />
        </div>

        {/* Priority breakdown */}
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#1E293B] mb-4">Tickets abiertos por prioridad</h2>
          <div className="space-y-3">
            {priorityData.map(p => (
              <div key={p.priority} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#64748B]">{priorityLabels[p.priority]}</span>
                  <span className="text-[#64748B]">{p.open} abiertos / {p.total} total</span>
                </div>
                <div className="h-2 bg-[#E6EBF2] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${priorityColors[p.priority]}`}
                    style={{ width: p.total > 0 ? `${(p.open / p.total) * 100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent performance table */}
      {agentPerf.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E6EBF2]">
            <h2 className="text-sm font-semibold text-[#1E293B]">Performance por agente</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Agente', 'Asignados', 'Cerrados', 'Tasa cierre', 'CSAT', '1ra respuesta'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agentPerf.map(a => (
                <tr key={a.name} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-2.5 text-sm font-medium text-[#1E293B]">{a.name}</td>
                  <td className="px-4 py-2.5 text-sm text-[#64748B]">{a.total}</td>
                  <td className="px-4 py-2.5 text-sm text-[#64748B]">{a.closed}</td>
                  <td className="px-4 py-2.5 text-sm">
                    <span className={`font-medium ${a.total > 0 && (a.closed / a.total) > 0.7 ? 'text-[#10B981]' : 'text-[#F59E0B]'}`}>
                      {a.total > 0 ? `${Math.round((a.closed / a.total) * 100)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-[#64748B]">
                    {a.avgCsat !== null ? `${a.avgCsat.toFixed(1)} ⭐` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-[#64748B]">{fmtMin(a.avgFirstRespMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
