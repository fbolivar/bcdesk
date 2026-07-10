import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Landmark, BellRing, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatMoney } from '@/lib/format/currency'
import { fmtDateOnly } from '@/lib/date'
import { sendInvoiceReminder } from '@/features/admin/services/admin.service'

interface Props { searchParams: Promise<{ reminded?: string }> }

type Inv = {
  id: string; invoice_number: string; total_usd: number | string; currency: string
  status: string; due_date: string; organization_id: string | null
  reminder_sent_at: string | null; organizations?: { name?: string } | { name?: string }[] | null
}

const box = 'bg-white border border-[#E6EBF2] rounded-xl p-4'

export default async function StatementsPage({ searchParams }: Props) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/dashboard')

  const { data: raw } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_usd, currency, status, due_date, organization_id, reminder_sent_at, organizations(name)')
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true })
  const invoices = (raw ?? []) as Inv[]
  const today = new Date().toISOString().slice(0, 10)
  const orgName = (i: Inv) => {
    const o = Array.isArray(i.organizations) ? i.organizations[0] : i.organizations
    return o?.name ?? 'Sin cliente'
  }
  const isOverdue = (i: Inv) => i.status !== 'paid' && String(i.due_date) < today

  // Agregado por cliente.
  const byOrg = new Map<string, { name: string; facturado: number; pagado: number; pendiente: number; vencido: number }>()
  for (const i of invoices) {
    const key = i.organization_id ?? 'none'
    const row = byOrg.get(key) ?? { name: orgName(i), facturado: 0, pagado: 0, pendiente: 0, vencido: 0 }
    const amt = Number(i.total_usd ?? 0)
    row.facturado += amt
    if (i.status === 'paid') row.pagado += amt
    else { row.pendiente += amt; if (isOverdue(i)) row.vencido += amt }
    byOrg.set(key, row)
  }
  const rows = Array.from(byOrg.values()).sort((a, b) => b.vencido - a.vencido || b.pendiente - a.pendiente)

  const overdue = invoices.filter(isOverdue)
  const totals = rows.reduce((t, r) => ({ facturado: t.facturado + r.facturado, pagado: t.pagado + r.pagado, pendiente: t.pendiente + r.pendiente, vencido: t.vencido + r.vencido }), { facturado: 0, pagado: 0, pendiente: 0, vencido: 0 })
  const money = (n: number) => formatMoney(n, 'COP')
  const daysOver = (d: string) => Math.max(0, Math.floor((Date.parse(today) - Date.parse(String(d))) / (24 * 3600 * 1000)))

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-2">
        <Landmark size={20} className="text-[#1789FC]" />
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">Estado de cuenta</h1>
          <p className="text-sm text-[#5B6B7C] mt-0.5">Cobrado, pagado, pendiente y vencido por cliente</p>
        </div>
      </div>

      {sp.reminded === '1' && <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-sm font-medium"><CheckCircle2 size={16} /> Recordatorio enviado al cliente.</div>}
      {sp.reminded === 'noclient' && <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-sm font-medium"><AlertTriangle size={16} /> Esa organización no tiene un usuario cliente con correo activo.</div>}

      {/* Totales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={box}><p className="text-xs text-[#5B6B7C]">Facturado</p><p className="text-xl font-bold text-[#0B2545]">{money(totals.facturado)}</p></div>
        <div className={box}><p className="text-xs text-[#5B6B7C]">Pagado</p><p className="text-xl font-bold text-[#10B981]">{money(totals.pagado)}</p></div>
        <div className={box}><p className="text-xs text-[#5B6B7C]">Pendiente</p><p className="text-xl font-bold text-[#F59E0B]">{money(totals.pendiente)}</p></div>
        <div className="rounded-xl border p-4" style={{ background: '#EF444410', borderColor: '#EF444440' }}><p className="text-xs text-[#EF4444]">Vencido</p><p className="text-xl font-bold text-[#EF4444]">{money(totals.vencido)}</p></div>
      </div>

      {/* Por cliente */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2] text-left text-xs text-[#5B6B7C]">
                <th className="px-4 py-2.5">Cliente</th>
                <th className="px-4 py-2.5 text-right">Facturado</th><th className="px-4 py-2.5 text-right">Pagado</th>
                <th className="px-4 py-2.5 text-right">Pendiente</th><th className="px-4 py-2.5 text-right">Vencido</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3 font-medium text-[#0B2545]">{r.name}</td>
                  <td className="px-4 py-3 text-right text-[#0B2545]">{money(r.facturado)}</td>
                  <td className="px-4 py-3 text-right text-[#10B981]">{money(r.pagado)}</td>
                  <td className="px-4 py-3 text-right text-[#F59E0B]">{money(r.pendiente)}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: r.vencido > 0 ? '#EF4444' : '#94A3B8' }}>{money(r.vencido)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-[#94A3B8] text-sm">Aún no hay cuentas de cobro emitidas.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Facturas vencidas + recordatorio */}
      {overdue.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#0B2545] mb-2 flex items-center gap-2"><AlertTriangle size={15} className="text-[#EF4444]" /> Vencidas ({overdue.length})</h2>
          <div className="bg-white border border-[#E6EBF2] rounded-xl overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E6EBF2] text-left text-xs text-[#5B6B7C]">
                    <th className="px-4 py-2.5">Cuenta</th><th className="px-4 py-2.5">Cliente</th>
                    <th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5">Venció</th>
                    <th className="px-4 py-2.5">Últ. recordatorio</th><th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map(i => (
                    <tr key={i.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                      <td className="px-4 py-3"><Link href={`/admin/invoices/${i.id}`} className="font-mono text-[#0B2545] hover:text-[#1789FC]">{i.invoice_number}</Link></td>
                      <td className="px-4 py-3 text-xs text-[#5B6B7C]">{orgName(i)}</td>
                      <td className="px-4 py-3 text-right text-[#0B2545]">{money(Number(i.total_usd ?? 0))}</td>
                      <td className="px-4 py-3 text-xs text-[#EF4444]">{fmtDateOnly(i.due_date)} · hace {daysOver(i.due_date)}d</td>
                      <td className="px-4 py-3 text-xs text-[#5B6B7C]">{i.reminder_sent_at ? fmtDateOnly(i.reminder_sent_at) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <form action={sendInvoiceReminder}>
                          <input type="hidden" name="invoice_id" value={i.id} />
                          <input type="hidden" name="redirect_to" value="/admin/statements" />
                          <button type="submit" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-xs font-medium">
                            <BellRing size={12} /> Recordar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-2">Los recordatorios también se envían automáticamente cada día a las cuentas vencidas (sin reenviar si ya se recordó en los últimos 3 días).</p>
        </div>
      )}
    </div>
  )
}
