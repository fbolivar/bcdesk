import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wallet, TrendingUp, TrendingDown, Download } from 'lucide-react'
import { formatMoney } from '@/lib/format/currency'
import { computeProfitability } from '@/features/expenses/report'

interface Props { searchParams: Promise<{ org?: string; from?: string; to?: string }> }

const box = 'bg-white border border-[#E6EBF2] rounded-xl p-4'
const inp = 'px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]'
const CAT_COLORS = ['#1789FC', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#64748B']

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

  const { rows, costNoTicket, totalRev, totalCost, categories, retentionPct } =
    await computeProfitability(supabase, { org: orgFilter, from, to })
  const { data: orgs } = await supabase.from('organizations').select('id, name').eq('status', 'active').order('name')

  const totalMargin = totalRev - totalCost
  const totalPct = totalRev > 0 ? (totalMargin / totalRev) * 100 : null
  const totalColor = totalMargin < 0 ? '#EF4444' : (totalPct !== null && totalPct < 20) || totalRev === 0 ? '#F59E0B' : '#10B981'
  const money = (n: number) => formatMoney(n, 'COP')
  const catMax = Math.max(1, ...categories.map(c => c.total))
  const qs = new URLSearchParams({ ...(orgFilter ? { org: orgFilter } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString()

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Wallet size={20} className="text-[#1789FC]" />
          <div>
            <h1 className="text-xl font-semibold text-[#0B2545]">Rentabilidad por servicio</h1>
            <p className="text-sm text-[#5B6B7C] mt-0.5">Cruce de lo cobrado (neto) con los gastos incurridos</p>
          </div>
        </div>
        <a href={`/api/admin/expenses/export${qs ? `?${qs}` : ''}`}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#5B6B7C] hover:text-[#0B2545] text-sm font-medium">
          <Download size={14} /> Exportar CSV
        </a>
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
        <div><label className="block text-[11px] text-[#5B6B7C] mb-1">Desde</label><input type="date" name="from" defaultValue={from} className={inp} /></div>
        <div><label className="block text-[11px] text-[#5B6B7C] mb-1">Hasta</label><input type="date" name="to" defaultValue={to} className={inp} /></div>
        <button type="submit" className="px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium">Aplicar</button>
        {(orgFilter || from || to) && <Link href="/admin/expenses" className="px-3 py-2 text-sm text-[#5B6B7C] hover:text-[#0B2545]">Limpiar</Link>}
      </form>

      {/* Totales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={box}><p className="text-xs text-[#5B6B7C]">Cobrado neto</p><p className="text-2xl font-bold text-[#0B2545]">{money(totalRev)}</p><p className="text-[10px] text-[#94A3B8] mt-0.5">sin IVA · menos retención</p></div>
        <div className={box}><p className="text-xs text-[#5B6B7C]">Total gastos</p><p className="text-2xl font-bold text-[#0B2545]">{money(totalCost)}</p></div>
        <div className="rounded-xl border p-4" style={{ background: `${totalColor}10`, borderColor: `${totalColor}40` }}>
          <p className="text-xs flex items-center gap-1" style={{ color: totalColor }}>
            {totalMargin < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />} Margen total{totalPct !== null ? ` · ${totalPct.toFixed(0)}%` : ''}
          </p>
          <p className="text-2xl font-bold" style={{ color: totalColor }}>{money(totalMargin)}</p>
        </div>
      </div>

      {/* Gastos por categoría */}
      {categories.length > 0 && (
        <div className={box}>
          <p className="text-sm font-semibold text-[#0B2545] mb-3">Gastos por categoría</p>
          <div className="space-y-2">
            {categories.map((c, i) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-[#5B6B7C] truncate">{c.category}</span>
                <div className="flex-1 h-4 rounded bg-[#F4F7FB] overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(c.total / catMax) * 100}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                </div>
                <span className="w-28 shrink-0 text-right text-xs font-medium text-[#0B2545]">{money(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla por servicio */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2] text-left text-xs text-[#5B6B7C]">
                <th className="px-4 py-2.5">Servicio</th><th className="px-4 py-2.5">Cliente</th>
                <th className="px-4 py-2.5 text-right">Cobrado neto</th><th className="px-4 py-2.5 text-right">Gastos</th>
                <th className="px-4 py-2.5 text-right">Margen</th><th className="px-4 py-2.5 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3"><Link href={`/admin/tickets/${r.id}`} className="font-medium text-[#0B2545] hover:text-[#1789FC]">{r.number ? `#${r.number} · ` : ''}{r.title}</Link></td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{r.org}</td>
                  <td className="px-4 py-3 text-right text-[#0B2545]">{money(r.revenue)}</td>
                  <td className="px-4 py-3 text-right text-[#0B2545]">{money(r.cost)}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: r.color }}>{money(r.margin)}</td>
                  <td className="px-4 py-3 text-right"><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${r.color}18`, color: r.color }}>{r.pct !== null ? `${r.pct.toFixed(0)}%` : '—'}</span></td>
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
      <p className="text-[11px] text-[#94A3B8]">🟢 rentable · 🟡 margen bajo o sin cobrar aún · 🔴 pérdida. El <strong>cobrado neto</strong> ajusta impuestos automáticamente: en factura se excluye el IVA y en cuenta de cobro se descuenta la retención en la fuente ({retentionPct}%, configurable en Ajustes → Datos de facturación).</p>
    </div>
  )
}
