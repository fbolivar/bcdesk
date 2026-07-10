import type { createClient } from '@/lib/supabase/server'
import { netIncome } from './income'

type ServerClient = Awaited<ReturnType<typeof createClient>>
export type ProfitFilters = { org?: string; from?: string; to?: string }

export type ProfitRow = {
  id: string; number?: number; title: string; org: string
  revenue: number; cost: number; margin: number; pct: number | null; color: string
}

export function tone(revenue: number, cost: number) {
  const margin = revenue - cost
  const pct = revenue > 0 ? (margin / revenue) * 100 : null
  let color = '#10B981'
  if (margin < 0) color = '#EF4444'
  else if ((pct !== null && pct < 20) || revenue === 0) color = '#F59E0B'
  return { margin, pct, color }
}

/** Calcula la rentabilidad por servicio (ticket) cruzando ingreso neto vs gastos.
 *  Usado por la página y por la exportación CSV. */
export async function computeProfitability(supabase: ServerClient, f: ProfitFilters) {
  let expQ = supabase.from('service_expenses').select('amount, category, ticket_id, visit_id, organization_id, spent_at')
  if (f.org) expQ = expQ.eq('organization_id', f.org)
  if (f.from) expQ = expQ.gte('spent_at', f.from)
  if (f.to) expQ = expQ.lte('spent_at', f.to)
  const { data: expenses } = await expQ

  let invQ = supabase.from('invoices').select('subtotal_usd, tax_usd, total_usd, doc_type, status, ticket_id, organization_id, issue_date').neq('status', 'cancelled')
  if (f.org) invQ = invQ.eq('organization_id', f.org)
  if (f.from) invQ = invQ.gte('issue_date', f.from)
  if (f.to) invQ = invQ.lte('issue_date', f.to)
  const { data: invoices } = await invQ

  const [{ data: visits }, { data: bp }] = await Promise.all([
    supabase.from('technical_visits').select('id, ticket_id'),
    supabase.from('billing_profile').select('retention_pct').limit(1).maybeSingle(),
  ])
  const retentionPct = Number(bp?.retention_pct ?? 11)

  const visitTicket = new Map((visits ?? []).map(v => [v.id as string, (v.ticket_id as string) || null]))
  const effTicket = (e: { ticket_id: string | null; visit_id: string | null }) =>
    e.ticket_id || (e.visit_id ? visitTicket.get(e.visit_id) ?? null : null)

  const costByTicket = new Map<string, number>()
  const byCategory = new Map<string, number>()
  let costNoTicket = 0
  for (const e of expenses ?? []) {
    const amt = Number(e.amount ?? 0)
    const t = effTicket(e)
    if (t) costByTicket.set(t, (costByTicket.get(t) ?? 0) + amt)
    else costNoTicket += amt
    const cat = (e.category as string) || 'Otros'
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + amt)
  }

  const revByTicket = new Map<string, number>()
  for (const i of invoices ?? []) {
    if (!i.ticket_id) continue
    revByTicket.set(i.ticket_id, (revByTicket.get(i.ticket_id) ?? 0) + netIncome(i, retentionPct).net)
  }

  const ticketIds = Array.from(new Set([...costByTicket.keys(), ...revByTicket.keys()]))
  const { data: ticketRows } = ticketIds.length
    ? await supabase.from('tickets').select('id, ticket_number, title, organizations(name)').in('id', ticketIds)
    : { data: [] }
  const info = new Map(((ticketRows ?? []) as Record<string, unknown>[]).map(t => [t.id as string, t]))

  const rows: ProfitRow[] = ticketIds.map(id => {
    const r = info.get(id) as { ticket_number?: number; title?: string; organizations?: { name?: string } } | undefined
    const revenue = revByTicket.get(id) ?? 0
    const cost = costByTicket.get(id) ?? 0
    const t = tone(revenue, cost)
    return { id, number: r?.ticket_number, title: r?.title ?? '—', org: r?.organizations?.name ?? '—', revenue, cost, ...t }
  }).sort((a, b) => a.margin - b.margin)

  const totalRev = (invoices ?? []).reduce((s, i) => s + netIncome(i, retentionPct).net, 0)
  const totalCost = (expenses ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0)
  const categories = Array.from(byCategory.entries()).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total)

  return { rows, costNoTicket, totalRev, totalCost, categories, retentionPct }
}
