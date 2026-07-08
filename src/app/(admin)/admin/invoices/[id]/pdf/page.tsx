import { fmtDateOnly } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/format/currency'
import { redirect, notFound } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Invoice, InvoiceItem } from '@/lib/supabase/types'
import { PrintButton } from './print-button'
import { LogoMark } from '@/shared/components/logo'

interface Props { params: Promise<{ id: string }> }

export default async function InvoicePdfPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const { data: invoice } = await supabase
    .from('invoices').select('*, organizations(*), invoice_items(*), tickets(ticket_number, title)').eq('id', id).single()
  if (!invoice) notFound()

  const inv = invoice as Invoice & {
    organizations?: { name: string; address: string | null; phone: string | null; email?: string | null }
    invoice_items?: InvoiceItem[]
    tickets?: { ticket_number: number; title: string } | null
  }

  const statusLabels: Record<string, string> = {
    draft: 'Borrador', sent: 'Enviada', paid: 'Pagada', overdue: 'Vencida', cancelled: 'Cancelada',
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 20mm; size: A4; }
        }
        body { font-family: system-ui, -apple-system, sans-serif; }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <a href={`/admin/invoices/${id}`}
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">
          ← Volver
        </a>
        <PrintButton />
      </div>

      {/* Invoice document */}
      <div className="min-h-screen bg-gray-50 print:bg-white flex items-start justify-center py-12 print:py-0 print:block">
        <div className="w-[794px] bg-white shadow-lg print:shadow-none p-12">

          {/* Header */}
          <div className="flex items-start justify-between mb-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <LogoMark size={32} />
                <span className="font-bold text-gray-800 text-lg">HexDesk</span>
              </div>
              <p className="text-sm text-gray-500">Fernando Bolívar Buitrago · Consultor en Ciberseguridad</p>
              <p className="text-sm text-gray-500">Colombia · soporte@bcwork.app</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-800 mb-1">FACTURA</p>
              <p className="font-mono text-lg text-gray-600">{inv.invoice_number}</p>
              <span className="inline-block mt-1 px-3 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-600 uppercase tracking-wide">
                {statusLabels[inv.status] ?? inv.status}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-200 mb-8" />

          {/* Billing info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Facturado a</p>
              <p className="font-semibold text-gray-800">{inv.organizations?.name}</p>
              {inv.organizations?.address && <p className="text-sm text-gray-500 mt-0.5">{inv.organizations.address}</p>}
              {inv.organizations?.phone && <p className="text-sm text-gray-500">{inv.organizations.phone}</p>}
              {inv.organizations?.email && <p className="text-sm text-gray-500">{inv.organizations.email}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Detalles</p>
              <div className="w-full overflow-x-auto"><table className="text-sm w-full">
                <tbody>
                  <tr>
                    <td className="text-gray-500 pr-4 pb-1">Fecha de emisión</td>
                    <td className="text-gray-800 font-medium text-right">{fmtDateOnly(inv.issue_date)}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 pr-4 pb-1">Vencimiento</td>
                    <td className={`font-medium text-right ${inv.status === 'overdue' ? 'text-red-600' : 'text-gray-800'}`}>
                      {fmtDateOnly(inv.due_date)}
                    </td>
                  </tr>
                  {inv.paid_at && (
                    <tr>
                      <td className="text-gray-500 pr-4 pb-1">Pagado el</td>
                      <td className="text-green-600 font-medium text-right">{format(new Date(inv.paid_at), 'dd MMM yyyy', { locale: es })}</td>
                    </tr>
                  )}
                  {inv.payment_method && (
                    <tr>
                      <td className="text-gray-500 pr-4">Método de pago</td>
                      <td className="text-gray-800 font-medium text-right capitalize">{inv.payment_method}</td>
                    </tr>
                  )}
                  {inv.tickets && (
                    <tr>
                      <td className="text-gray-500 pr-4">Servicio</td>
                      <td className="text-gray-800 font-medium text-right">Ticket #{inv.tickets.ticket_number}</td>
                    </tr>
                  )}
                </tbody>
              </table></div>
            </div>
          </div>

          {/* Items table */}
          <div className="w-full overflow-x-auto"><table className="w-full text-sm mb-8">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-200">
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Cant.</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">P. Unitario</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(inv.invoice_items ?? []).map(item => (
                <tr key={item.id}>
                  <td className="py-3 px-4 text-gray-700">{item.description}</td>
                  <td className="py-3 px-4 text-right text-gray-600">{item.quantity}</td>
                  <td className="py-3 px-4 text-right text-gray-600">{formatMoney(item.unit_price_usd, inv.currency)}</td>
                  <td className="py-3 px-4 text-right font-medium text-gray-800">{formatMoney(item.total_usd, inv.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-56 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-700">{formatMoney(inv.subtotal_usd, inv.currency)}</span>
              </div>
              {inv.tax_percent > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IVA ({inv.tax_percent}%)</span>
                  <span className="text-gray-700">{formatMoney(inv.tax_usd, inv.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-gray-300 pt-2">
                <span className="text-gray-800">Total</span>
                <span className="text-gray-900">{formatMoney(inv.total_usd, inv.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {inv.notes && (
            <div className="border-t border-gray-200 pt-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notas</p>
              <p className="text-sm text-gray-600">{inv.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">Generado por HexDesk · BC Fabric SAS · soporte@bcwork.app</p>
          </div>
        </div>
      </div>
    </>
  )
}
