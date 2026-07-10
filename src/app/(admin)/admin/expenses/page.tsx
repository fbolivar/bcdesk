import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { formatMoney } from '@/lib/format/currency'

interface Props { searchParams: Promise<{ org?: string; from?: string; to?: string }> }

const box = 'bg-white border border-[#E6EBF2] rounded-xl p-4'
const inp = 'px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]'

function tone(revenue: number, cost: number) {
  const margin = revenue - cost
  const pct = revenue > 0 ? (margin / revenue) * 100 : null
  let color = '#10B981'
  if (margin < 0) color = '#EF4444'
  else if ((pct !== null && pct < 20) || revenue === 0) color = '#F59E0B'
  return { margin, pct, color }
}

export default async function AdminExpensesPage({ searchParams }: Props) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/dashboard')

  const orgFilter = sp.org || ''
  const from = sp.from || ''
  const to = sp.to || ''

  // Expenses (filtrados por periodo y cliente).
  let expQ = supabase.from('service_expenses').select('amount, ticket_id, visit_id, organization_id, spent_at')
  if (orgFilter) expQ = expQ.eq('organization_id', orgFilter)
  if (from) expQ = expQ.gte('spent_at', from)
  if (to) expQ = expQ.lte('spent_at', to)
  const { data: expenses } = await expQ

  // Invoices (ingresos) filtrados por periodo (issue_date) y cliente.
  let invQ = supabase.from('invoices').select('total_usd, status, ticket_id, organization_id, issue_date').neq('status', 'cancelled')
  if (orgFilter) invQ = invQ.eq('organization_id', orgFilter)
  if (from) invQ = invQ.gte('issue_date', from)
  if (to) invQ = invQ.lte('issue_date', to)
  const { data: invoices } = await invQ

  const [{ data: visits }, { data: orgs }] = await Promise.all([
    supabase.from('technical_visits').select('id, ticket_id'),
    supabase.from('organizations').select('id, name').eq('status', 'active').order('name'),
  ])

  const visitTicket = new Map((visits ?? []).map(v => [v.id as string, (v.ticket_id as string) || null]))
  const effTicket = (e: { ticket_id: string | null; visit_id: string | null }) =>
    e.ticket_id || (e.visit_id ? visitTicket.get(e.visit_id) ?? null : null)

  // Agrega costos por ticket (incluye gastos ligados a visitas del ticket) e ingresos por ticket.
  const costByTicket = new Map<string, number>()
  let costNoTicket = 0
  for (const e of expenses ?? []) {
    const t = effTicket(e)
    const amt = Number(e.amount ?? 0)
    if (t) costByTicket.set(t, (costByTicket.get(t) ?? 0) + amt)
    else costNoTicket += amt
  }
  const revByTicket = new Map<string, number>()
  for (const i of invoices ?? []) {
    if (!i.ticket_id) continue
    revByTicket.set(i.ticket_id, (revByTicket.get(i.ticket_id) ?? 0) + Number(i.total_usd ?? 0))
  }

  const ticketIds = Array.from(new Set([...costByTicket.keys(), ...revByTicket.keys()]))
  const { data: ticketRows } = ticketIds.length
    ? await supabase.from('tickets').select('id, ticket_number, title, organizations(name)').in('id', ticketIds)
    : { data: [] }
  const ticketInfo = new Map(((ticketRows ?? []) as Record<string, unknown>[]).map(t => [t.id as string, t]))

  const rows = ticketIds.map(id => {
    const info = ticketInfo.get(id) as { ticket_number?: number; title?: string; organizations?: { name?: string } } | undefined
    const revenue = revByTicket.get(id) ?? 0
    const cost = costByTicket.get(id) ?? 0
    const t = tone(revenue, cost)
    return {
      id, number: info?.ticket_number, title: info?.title ?? '—',
      org: info?.organizations?.name ?? '—', revenue, cost, ...t,
    }
  }).sort((a, b) => a.margin - b.margin) // peores márgenes primero

  const totalRev = (invoices ?? []).reduce((s, i) => s + Number(i.total_usd ?? 0), 0)
  const totalCost = (expenses ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0)
  const totalT = tone(totalRev, totalCost)
  const money = (n: number) => formatMoney(n, 'COP')

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-2">
        <Wallet size={20} className="text-[#1789FC]" />
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">Rentabilidad por servicio</h1>
          <p className="text-sm text-[#5B6B7C] mt-0.5">Cruce de lo cobrado con los gastos incurridos</p>
        </div>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] text-[#5B6B7C] mb-1">Cliente</label>
          <select name="org" defaultValue={orgFilter} className={inp}>
            <option value="">Todos</option>
            {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-[#5B6B7C] mb-1">Desde</label>
          <input type="date" name="from" defaultValue={from} className={inp} />
        </div>
        <div>
          <label className="block text-[11px] text-[#5B6B7C] mb-1">Hasta</label>
          <input type="date" name="to" defaultValue={to} className={inp} />
        </div>
        <button type="submit" className="px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium">Aplicar</button>
        {(orgFilter || from || to) && <Link href="/admin/expenses" className="px-3 py-2 text-sm text-[#5B6B7C] hover:text-[#0B2545]">Limpiar</Link>}
      </form>

      {/* Totales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={box}><p className="text-xs text-[#5B6B7C]">Total cobrado</p><p className="text-2xl font-bold text-[#0B2545]">{money(totalRev)}</p></div>
        <div className={box}><p className="text-xs text-[#5B6B7C]">Total gastos</p><p className="text-2xl font-bold text-[#0B2545]">{money(totalCost)}</p></div>
        <div className="rounded-xl border p-4" style={{ background: `${totalT.color}10`, borderColor: `${totalT.color}40` }}>
          <p className="text-xs flex items-center gap-1" style={{ color: totalT.color }}>
            {totalT.margin < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />} Margen total{totalT.pct !== null ? ` · ${totalT.pct.toFixed(0)}%` : ''}
          </p>
          <p className="text-2xl font-bold" style={{ color: totalT.color }}>{money(totalT.margin)}</p>
        </div>
      </div>

      {/* Tabla por servicio */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2] text-left text-xs text-[#5B6B7C]">
                <th className="px-4 py-2.5">Servicio</th><th className="px-4 py-2.5">Cliente</th>
                <th className="px-4 py-2.5 text-right">Cobrado</th><th className="px-4 py-2.5 text-right">Gastos</th>
                <th className="px-4 py-2.5 text-right">Margen</th><th className="px-4 py-2.5 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/tickets/${r.id}`} className="font-medium text-[#0B2545] hover:text-[#1789FC]">
                      {r.number ? `#${r.number} · ` : ''}{r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{r.org}</td>
                  <td className="px-4 py-3 text-right text-[#0B2545]">{money(r.revenue)}</td>
                  <td className="px-4 py-3 text-right text-[#0B2545]">{money(r.cost)}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: r.color }}>{money(r.margin)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${r.color}18`, color: r.color }}>
                      {r.pct !== null ? `${r.pct.toFixed(0)}%` : '—'}
                    </span>
                  </td>
                </tr>
              ))}
              {costNoTicket > 0 && (
                <tr className="border-b border-[#E6EBF2]/50 bg-[#F9FBFD]">
                  <td className="px-4 py-3 text-[#5B6B7C]">Gastos sin ticket (visitas/otros)</td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">—</td>
                  <td className="px-4 py-3 text-right text-[#5B6B7C]">—</td>
                  <td className="px-4 py-3 text-right text-[#0B2545]">{money(costNoTicket)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#EF4444]">{money(-costNoTicket)}</td>
                  <td className="px-4 py-3 text-right text-[#5B6B7C]">—</td>
                </tr>
              )}
              {rows.length === 0 && costNoTicket === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-[#94A3B8] text-sm">Sin datos en este periodo. Registra gastos desde un ticket o una visita.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-[#94A3B8]">🟢 rentable · 🟡 margen bajo o sin cobrar aún · 🔴 pérdida. El cobrado suma las cuentas de cobro no canceladas del servicio.</p>
    </div>
  )
}
