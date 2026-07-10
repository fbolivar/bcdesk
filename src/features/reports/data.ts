import type { createClient } from '@/lib/supabase/server'
import { netIncome } from '@/features/expenses/income'
import { TICKET_CATEGORY_LABELS } from '@/lib/tickets/categories'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type ServerClient = Awaited<ReturnType<typeof createClient>>
export type ReportRange = { from: string; to: string }

const STATUS_LABELS: Record<string, string> = {
  open: 'Abiertos', in_progress: 'En progreso', waiting_client: 'Esperando cliente',
  resolved: 'Resueltos', closed: 'Cerrados', cancelled: 'Cancelados',
}
const PRIORITY_LABELS: Record<string, string> = { critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo' }
const CLOSED = ['resolved', 'closed']

function monthsBetween(from: Date, to: Date) {
  const out: { key: string; label: string }[] = []
  const d = new Date(from.getFullYear(), from.getMonth(), 1)
  let guard = 0
  while (d <= to && guard++ < 60) {
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: format(d, 'MMM yy', { locale: es }) })
    d.setMonth(d.getMonth() + 1)
  }
  return out
}
const mkey = (iso: string | null) => (iso ? String(iso).slice(0, 7) : '')

export async function computeReportData(supabase: ServerClient, range: ReportRange) {
  const { from, to } = range
  const fromD = new Date(from + 'T00:00:00')
  const toD = new Date(to + 'T23:59:59')

  const [ticketsRes, invoicesRes, expensesRes, agentsRes, orgsRes, bpRes] = await Promise.all([
    supabase.from('tickets')
      .select('id, status, category, priority, created_at, resolved_at, first_response_at, satisfaction_score, sla_breached, assigned_to, organization_id')
      .gte('created_at', from).lte('created_at', to + 'T23:59:59'),
    supabase.from('invoices')
      .select('subtotal_usd, tax_usd, total_usd, doc_type, status, issue_date, paid_at, organization_id')
      .neq('status', 'cancelled').gte('issue_date', from).lte('issue_date', to),
    supabase.from('service_expenses').select('amount, category, spent_at, organization_id').gte('spent_at', from).lte('spent_at', to),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'agent']).eq('is_active', true),
    supabase.from('organizations').select('id, name'),
    supabase.from('billing_profile').select('retention_pct').limit(1).maybeSingle(),
  ])

  const tickets = ticketsRes.data ?? []
  const invoices = invoicesRes.data ?? []
  const expenses = expensesRes.data ?? []
  const agents = agentsRes.data ?? []
  const orgName = new Map((orgsRes.data ?? []).map(o => [o.id as string, o.name as string]))
  const retentionPct = Number(bpRes.data?.retention_pct ?? 11)

  // ── KPIs de tickets ──
  const total = tickets.length
  const open = tickets.filter(t => !['resolved', 'closed', 'cancelled', 'merged'].includes(t.status)).length
  const resolved = tickets.filter(t => CLOSED.includes(t.status))
  const withRes = resolved.filter(t => t.resolved_at)
  const avgResolutionHrs = withRes.length
    ? withRes.reduce((a, t) => a + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 3.6e6, 0) / withRes.length
    : 0
  const withFR = tickets.filter(t => t.first_response_at)
  const avgFirstRespMin = withFR.length
    ? withFR.reduce((a, t) => a + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()) / 6e4, 0) / withFR.length
    : 0
  const scored = tickets.filter(t => t.satisfaction_score)
  const avgCsat = scored.length ? scored.reduce((a, t) => a + (t.satisfaction_score ?? 0), 0) / scored.length : 0
  const slaTotal = tickets.filter(t => t.status !== 'cancelled').length
  const slaBreached = tickets.filter(t => t.sla_breached).length
  const slaCompliance = slaTotal ? Math.round(((slaTotal - slaBreached) / slaTotal) * 100) : 100

  // ── Finanzas ──
  const netRevenue = invoices.reduce((a, i) => a + netIncome(i, retentionPct).net, 0)
  const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount ?? 0), 0)
  const margin = netRevenue - totalExpenses
  const marginPct = netRevenue > 0 ? (margin / netRevenue) * 100 : null

  // ── Distribuciones ──
  const byStatus = Object.entries(STATUS_LABELS).map(([s, label]) => ({ status: s, label, count: tickets.filter(t => t.status === s).length })).filter(d => d.count > 0)
  const byPriority = ['critical', 'high', 'medium', 'low'].map(p => ({ priority: p, label: PRIORITY_LABELS[p], count: tickets.filter(t => t.priority === p).length }))
  const catLabels = TICKET_CATEGORY_LABELS as Record<string, string>
  const byCategory = Object.entries(catLabels).map(([c, name]) => ({ name, value: tickets.filter(t => t.category === c).length })).filter(d => d.value > 0)

  // ── Series mensuales ──
  const months = monthsBetween(fromD, toD)
  const monthly = months.map(m => ({
    month: m.label,
    creados: tickets.filter(t => mkey(t.created_at) === m.key).length,
    resueltos: tickets.filter(t => t.resolved_at && mkey(t.resolved_at) === m.key).length,
  }))
  const financeMonthly = months.map(m => {
    const revenue = invoices.filter(i => mkey(i.issue_date) === m.key).reduce((a, i) => a + netIncome(i, retentionPct).net, 0)
    const expense = expenses.filter(e => mkey(e.spent_at) === m.key).reduce((a, e) => a + Number(e.amount ?? 0), 0)
    return { month: m.label, ingresos: Math.round(revenue), gastos: Math.round(expense), margen: Math.round(revenue - expense) }
  })

  // ── Top clientes por ingreso neto ──
  const revByOrg = new Map<string, number>()
  for (const i of invoices) {
    if (!i.organization_id) continue
    revByOrg.set(i.organization_id, (revByOrg.get(i.organization_id) ?? 0) + netIncome(i, retentionPct).net)
  }
  const topClients = Array.from(revByOrg.entries())
    .map(([id, revenue]) => ({ name: orgName.get(id) ?? 'Sin cliente', revenue: Math.round(revenue), tickets: tickets.filter(t => t.organization_id === id).length }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, 8)

  // ── Desempeño por agente ──
  const agentPerf = agents.map(a => {
    const mine = tickets.filter(t => t.assigned_to === a.id)
    const closed = mine.filter(t => CLOSED.includes(t.status))
    const sc = mine.filter(t => t.satisfaction_score)
    const fr = mine.filter(t => t.first_response_at)
    return {
      name: a.full_name as string,
      total: mine.length,
      closed: closed.length,
      closeRate: mine.length ? Math.round((closed.length / mine.length) * 100) : 0,
      avgCsat: sc.length ? sc.reduce((s, t) => s + (t.satisfaction_score ?? 0), 0) / sc.length : null,
      avgFirstRespMin: fr.length ? Math.round(fr.reduce((s, t) => s + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()) / 6e4, 0) / fr.length) : null,
    }
  }).filter(a => a.total > 0).sort((a, b) => b.closed - a.closed)

  return {
    range,
    kpis: {
      total, open, resolved: resolved.length, slaCompliance,
      avgResolutionHrs: Math.round(avgResolutionHrs * 10) / 10,
      avgFirstRespMin: Math.round(avgFirstRespMin),
      avgCsat: Math.round(avgCsat * 10) / 10, csatCount: scored.length,
      netRevenue: Math.round(netRevenue), totalExpenses: Math.round(totalExpenses),
      margin: Math.round(margin), marginPct: marginPct === null ? null : Math.round(marginPct),
    },
    byStatus, byPriority, byCategory, monthly, financeMonthly, topClients, agents: agentPerf,
  }
}

export type ReportData = Awaited<ReturnType<typeof computeReportData>>

/** Rango por defecto: últimos 6 meses (desde el 1° de ese mes) hasta hoy. */
export function defaultRange(): ReportRange {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const fromD = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const from = fromD.toISOString().slice(0, 10)
  return { from, to }
}
