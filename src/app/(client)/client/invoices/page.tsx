import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/format/currency'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Invoice } from '@/lib/supabase/types'
import { PayButton } from '@/features/client/components/pay-button'

export default async function ClientInvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('organization_id').eq('id', user.id).single()

  if (!profile?.organization_id) redirect('/client/dashboard')

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('issue_date', { ascending: false })

  const typedInvoices = (invoices ?? []) as Invoice[]

  const statusConfig = {
    draft:     { label: 'Borrador',   color: 'bg-[#E6EBF2] text-[#5B6B7C]' },
    sent:      { label: 'Pendiente',  color: 'bg-[#F59E0B]/20 text-[#F59E0B]' },
    paid:      { label: 'Pagada',     color: 'bg-[#10B981]/20 text-[#10B981]' },
    overdue:   { label: 'Vencida',    color: 'bg-[#EF4444]/20 text-[#EF4444]' },
    cancelled: { label: 'Cancelada',  color: 'bg-[#E6EBF2] text-[#5B6B7C]' },
  }

  const totalPending = typedInvoices
    .filter(i => ['sent', 'overdue'].includes(i.status))
    .reduce((acc, i) => acc + i.total_usd, 0)

  const totalPaid = typedInvoices
    .filter(i => i.status === 'paid')
    .reduce((acc, i) => acc + i.total_usd, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Facturas</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Historial de facturación</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-xs text-[#5B6B7C] mb-1">Por pagar</p>
          <p className="text-2xl font-bold text-[#F59E0B]">{formatMoney(totalPending)}</p>
        </div>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-xs text-[#5B6B7C] mb-1">Pagado (historial)</p>
          <p className="text-2xl font-bold text-[#10B981]">{formatMoney(totalPaid)}</p>
        </div>
      </div>

      {typedInvoices.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <p className="text-[#5B6B7C]">No hay facturas emitidas.</p>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Número', 'Fecha emisión', 'Vencimiento', 'Total', 'Estado', 'Pago'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {typedInvoices.map(inv => {
                const cfg = statusConfig[inv.status]
                return (
                  <tr key={inv.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[#5B6B7C]">
                      <Link href={`/client/invoices/${inv.id}`} className="hover:text-[#1789FC] transition-colors">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#5B6B7C]">
                      {format(new Date(inv.issue_date), 'dd MMM yyyy', { locale: es })}
                    </td>
                    <td className={`px-4 py-3 ${inv.status === 'overdue' ? 'text-[#EF4444]' : 'text-[#5B6B7C]'}`}>
                      {format(new Date(inv.due_date), 'dd MMM yyyy', { locale: es })}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#0B2545]">
                      {formatMoney(inv.total_usd, inv.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5B6B7C]">
                      {inv.status === 'paid'
                        ? (inv.paid_at ? format(new Date(inv.paid_at), 'dd MMM yyyy', { locale: es }) : '—')
                        : ['sent', 'overdue'].includes(inv.status)
                        ? <PayButton invoiceId={inv.id} />
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}
