import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, FileSpreadsheet, Mail, Clock, CalendarClock, TrendingUp, Ticket, CheckCircle2, Gauge, Timer, Star, Wallet, TrendingDown } from 'lucide-react'
import { computeReportData, defaultRange } from '@/features/reports/data'
import { TicketsTrendChart, StatusDonut, FinanceChart, TopClientsChart } from '@/features/reports/report-charts'
import { formatMoney } from '@/lib/format/currency'

interface Props { searchParams: Promise<{ from?: string; to?: string; org?: string; type?: string }> }

const card = 'bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4'
const inp = 'px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]'
const PRIORITY_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#00D4AA', low: '#64748B' }

export default async function AdminReportsPage({ searchParams }: Props) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/dashboard')

  const def = defaultRange()
  const from = sp.from || def.from
  const to = sp.to || def.to
  const org = sp.org || ''
  const isClient = sp.type === 'client'
  const [d, { data: orgs }] = await Promise.all([
    computeReportData(supabase, { from, to, org: org || undefined }),
    supabase.from('organizations').select('id, name').eq('status', 'active').order('name'),
  ])
  const k = d.kpis
  const money = (n: number) => formatMoney(n, 'COP')
  const qs = new URLSearchParams({ from, to, ...(org ? { org } : {}), ...(isClient ? { type: 'client' } : {}) }).toString()
  const prioMax = Math.max(1, ...d.byPriority.map(p => p.count))

  const kpis = [
    { icon: Ticket, label: 'Tickets', value: k.total, tone: '#00D4AA' },
    { icon: TrendingUp, label: 'Abiertos', value: k.open, tone: '#F59E0B' },
    { icon: CheckCircle2, label: 'Resueltos', value: k.resolved, tone: '#10B981' },
    { icon: Gauge, label: 'SLA cumplido', value: `${k.slaCompliance}%`, tone: k.slaCompliance >= 90 ? '#10B981' : '#F59E0B' },
    { icon: Clock, label: 'Resolución prom.', value: `${k.avgResolutionHrs}h`, tone: '#00D4AA' },
    { icon: Timer, label: '1ª respuesta', value: k.avgFirstRespMin ? `${k.avgFirstRespMin}m` : '—', tone: '#00D4AA' },
    { icon: Star, label: 'CSAT', value: k.avgCsat ? `${k.avgCsat}/5` : '—', tone: '#8B5CF6' },
    ...(isClient ? [] : [{ icon: Wallet, label: 'Ingreso neto', value: money(k.netRevenue), tone: '#10B981' }]),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">Reportes</h1>
          <p className="text-sm text-[#5B6B7C] mt-0.5">{d.orgLabel} · {from} → {to}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/admin/reports/export/pdf?${qs}`} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B2545] hover:bg-[#0B2545]/90 text-white text-sm font-medium">
            <FileText size={14} /> PDF
          </a>
          <a href={`/api/admin/reports/export/xlsx?${qs}`} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-sm font-medium">
            <FileSpreadsheet size={14} /> Excel
          </a>
        </div>
      </div>

      {/* Filtro + accesos */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <form className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[11px] text-[#5B6B7C] mb-1">Tipo de informe</label>
            <select name="type" defaultValue={isClient ? 'client' : 'internal'} className={inp}>
              <option value="internal">Interno (con finanzas)</option>
              <option value="client">Para cliente (sin finanzas)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-[#5B6B7C] mb-1">Cliente</label>
            <select name="org" defaultValue={org} className={inp}>
              <option value="">Todos</option>
              {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div><label className="block text-[11px] text-[#5B6B7C] mb-1">Desde</label><input type="date" name="from" defaultValue={from} className={inp} /></div>
          <div><label className="block text-[11px] text-[#5B6B7C] mb-1">Hasta</label><input type="date" name="to" defaultValue={to} className={inp} /></div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium">Aplicar</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {[
            { href: '/admin/reports/email', label: 'Correo', icon: Mail },
            { href: '/admin/reports/timesheet', label: 'Timesheet', icon: Clock },
            { href: '/admin/reports/scheduled', label: 'Programados', icon: CalendarClock },
            { href: '/admin/reports/predictive', label: 'Predictivo', icon: TrendingUp },
          ].map(l => (
            <Link key={l.href} href={l.href} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6EBF2] bg-white text-[#5B6B7C] hover:text-[#0B2545] hover:bg-[#F4F7FB] text-xs font-medium">
              <l.icon size={13} /> {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className={card}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${kpi.tone}15` }}>
                <kpi.icon size={15} style={{ color: kpi.tone }} />
              </div>
              <p className="text-[11px] text-[#5B6B7C]">{kpi.label}</p>
            </div>
            <p className="text-2xl font-bold text-[#0B2545] mt-2">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Finanzas resumen (solo informe interno) */}
      {!isClient && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={card}><p className="text-xs text-[#5B6B7C]">Ingreso neto</p><p className="text-xl font-bold text-[#10B981]">{money(k.netRevenue)}</p></div>
        <div className={card}><p className="text-xs text-[#5B6B7C]">Gastos</p><p className="text-xl font-bold text-[#F59E0B]">{money(k.totalExpenses)}</p></div>
        <div className="rounded-xl border p-4" style={{ background: `${k.margin < 0 ? '#EF4444' : '#10B981'}10`, borderColor: `${k.margin < 0 ? '#EF4444' : '#10B981'}40` }}>
          <p className="text-xs flex items-center gap-1" style={{ color: k.margin < 0 ? '#EF4444' : '#10B981' }}>{k.margin < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />} Margen{k.marginPct !== null ? ` · ${k.marginPct}%` : ''}</p>
          <p className="text-xl font-bold" style={{ color: k.margin < 0 ? '#EF4444' : '#10B981' }}>{money(k.margin)}</p>
        </div>
      </div>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className={card}>
          <h2 className="text-sm font-semibold text-[#0B2545] mb-3">Tickets: creados vs resueltos</h2>
          <TicketsTrendChart data={d.monthly} />
        </div>
        {!isClient && (
          <div className={card}>
            <h2 className="text-sm font-semibold text-[#0B2545] mb-3">Ingresos vs gastos por mes</h2>
            <FinanceChart data={d.financeMonthly} />
          </div>
        )}
        <div className={card}>
          <h2 className="text-sm font-semibold text-[#0B2545] mb-3">Tickets por estado</h2>
          {d.byStatus.length ? <StatusDonut data={d.byStatus} /> : <p className="text-xs text-[#94A3B8] py-12 text-center">Sin datos</p>}
        </div>
        <div className={card}>
          <h2 className="text-sm font-semibold text-[#0B2545] mb-3">Prioridad</h2>
          <div className="space-y-3 pt-2">
            {d.byPriority.map(p => (
              <div key={p.priority} className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-[#5B6B7C]">{p.label}</span><span className="text-[#5B6B7C]">{p.count}</span></div>
                <div className="h-2.5 bg-[#F4F7FB] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(p.count / prioMax) * 100}%`, background: PRIORITY_COLOR[p.priority] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top clientes */}
      {!isClient && d.topClients.length > 0 && (
        <div className={card}>
          <h2 className="text-sm font-semibold text-[#0B2545] mb-3">Top clientes por ingreso neto</h2>
          <TopClientsChart data={d.topClients} />
        </div>
      )}

      {/* Agentes */}
      {!isClient && d.agents.length > 0 && (
        <div className="bg-white border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E6EBF2]"><h2 className="text-sm font-semibold text-[#0B2545]">Desempeño por agente</h2></div>
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-[#E6EBF2] text-left text-xs text-[#5B6B7C]">
              {['Agente', 'Asignados', 'Cerrados', 'Tasa cierre', 'CSAT', '1ª respuesta'].map(h => <th key={h} className="px-4 py-2.5">{h}</th>)}
            </tr></thead>
            <tbody>
              {d.agents.map(a => (
                <tr key={a.name} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-2.5 font-medium text-[#0B2545]">{a.name}</td>
                  <td className="px-4 py-2.5 text-[#5B6B7C]">{a.total}</td>
                  <td className="px-4 py-2.5 text-[#5B6B7C]">{a.closed}</td>
                  <td className="px-4 py-2.5"><span className="font-medium" style={{ color: a.closeRate > 70 ? '#10B981' : '#F59E0B' }}>{a.closeRate}%</span></td>
                  <td className="px-4 py-2.5 text-[#5B6B7C]">{a.avgCsat !== null ? `${a.avgCsat.toFixed(1)} ⭐` : '—'}</td>
                  <td className="px-4 py-2.5 text-[#5B6B7C]">{a.avgFirstRespMin !== null ? (a.avgFirstRespMin < 60 ? `${a.avgFirstRespMin}m` : `${Math.round(a.avgFirstRespMin / 60)}h`) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}
