import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Send, XCircle, FileDown } from 'lucide-react'
import { updateInvoiceStatus, sendInvoice } from '@/features/admin/services/admin.service'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Invoice, InvoiceItem } from '@/lib/supabase/types'
import { formatMoney } from '@/lib/format/currency'

interface Props { params: Promise<{ id: string }> }

export default async function AdminInvoiceDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const { data: invoice } = await supabase
    .from('invoices').select('*, organizations(*), invoice_items(*)').eq('id', id).single()
  if (!invoice) notFound()

  const inv = invoice as Invoice & {
    organizations?: { name: string; address: string | null; phone: string | null }
    invoice_items?: InvoiceItem[]
  }

  async function handleMarkPaid(formData: FormData) {
    'use server'
    await updateInvoiceStatus(id, 'paid', formData.get('payment_method') as string, formData.get('reference') as string)
  }
  async function handleSend(formData: FormData) {
    'use server'
    await sendInvoice(id)
  }
  async function handleCancel(formData: FormData) {
    'use server'
    await updateInvoiceStatus(id, 'cancelled')
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    draft:     { label: 'Borrador',   color: 'bg-[#E6EBF2] text-[#64748B]' },
    sent:      { label: 'Enviada',    color: 'bg-[#F59E0B]/20 text-[#F59E0B]' },
    paid:      { label: 'Pagada',     color: 'bg-[#10B981]/20 text-[#10B981]' },
    overdue:   { label: 'Vencida',    color: 'bg-[#EF4444]/20 text-[#EF4444]' },
    cancelled: { label: 'Cancelada',  color: 'bg-[#E6EBF2] text-[#64748B]' },
  }
  const cfg = statusConfig[inv.status]

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/invoices" className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#1E293B]">
          <ArrowLeft size={14} /> Volver a facturas
        </Link>
        <Link href={`/admin/invoices/${id}/pdf`} target="_blank"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#64748B] hover:text-[#1E293B] text-sm font-medium transition-colors">
          <FileDown size={14} /> Descargar PDF
        </Link>
      </div>

      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-md bg-[#3B82F6] flex items-center justify-center text-white font-bold text-xs">BC</div>
              <span className="font-semibold text-[#1E293B]">BCDesk · BC Fabric SAS</span>
            </div>
            <p className="text-xs text-[#64748B]">soporte@bcwork.app</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-bold text-[#1E293B]">{inv.invoice_number}</p>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>

        {/* Billing to */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-xs font-medium text-[#64748B] mb-1">Facturado a</p>
            <p className="font-medium text-[#1E293B]">{inv.organizations?.name}</p>
            {inv.organizations?.address && <p className="text-xs text-[#64748B] mt-0.5">{inv.organizations.address}</p>}
            {inv.organizations?.phone && <p className="text-xs text-[#64748B]">{inv.organizations.phone}</p>}
          </div>
          <div className="text-right">
            <div className="space-y-1">
              <div className="flex justify-between gap-8">
                <span className="text-xs text-[#64748B]">Fecha emisión</span>
                <span className="text-xs text-[#64748B]">{format(new Date(inv.issue_date), 'dd MMM yyyy', { locale: es })}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-xs text-[#64748B]">Vencimiento</span>
                <span className={`text-xs ${inv.status === 'overdue' ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
                  {format(new Date(inv.due_date), 'dd MMM yyyy', { locale: es })}
                </span>
              </div>
              {inv.paid_at && (
                <div className="flex justify-between gap-8">
                  <span className="text-xs text-[#64748B]">Pagado el</span>
                  <span className="text-xs text-[#10B981]">{format(new Date(inv.paid_at), 'dd MMM yyyy', { locale: es })}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items */}
        {inv.invoice_items && inv.invoice_items.length > 0 && (
          <div className="mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E6EBF2]">
                  <th className="pb-2 text-left text-xs text-[#64748B]">Descripción</th>
                  <th className="pb-2 text-right text-xs text-[#64748B]">Cant.</th>
                  <th className="pb-2 text-right text-xs text-[#64748B]">P. Unit.</th>
                  <th className="pb-2 text-right text-xs text-[#64748B]">Total</th>
                </tr>
              </thead>
              <tbody>
                {inv.invoice_items.map(item => (
                  <tr key={item.id} className="border-b border-[#E6EBF2]/50">
                    <td className="py-2.5 text-[#64748B]">{item.description}</td>
                    <td className="py-2.5 text-right text-[#64748B]">{item.quantity}</td>
                    <td className="py-2.5 text-right text-[#64748B]">{formatMoney(item.unit_price_usd, inv.currency)}</td>
                    <td className="py-2.5 text-right text-[#1E293B] font-medium">{formatMoney(item.total_usd, inv.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-48 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-[#64748B]">Subtotal</span>
              <span className="text-[#64748B]">{formatMoney(inv.subtotal_usd, inv.currency)}</span>
            </div>
            {inv.tax_percent > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">IVA ({inv.tax_percent}%)</span>
                <span className="text-[#64748B]">{formatMoney(inv.tax_usd, inv.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t border-[#E6EBF2] pt-2">
              <span className="text-[#1E293B]">Total</span>
              <span className="text-[#1E293B]">{formatMoney(inv.total_usd, inv.currency)}</span>
            </div>
          </div>
        </div>

        {inv.notes && (
          <div className="mt-4 pt-4 border-t border-[#E6EBF2]/50">
            <p className="text-xs text-[#64748B] mb-1">Notas</p>
            <p className="text-sm text-[#64748B]">{inv.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {!['paid', 'cancelled'].includes(inv.status) && (
        <div className="flex flex-wrap gap-3">
          {inv.status === 'draft' && (
            <form action={handleSend}>
              <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
                <Send size={14} /> Enviar al cliente
              </button>
            </form>
          )}

          <form action={handleMarkPaid} className="flex items-center gap-2">
            <input name="payment_method" placeholder="Método de pago"
              className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors placeholder-[#64748B]" />
            <input name="reference" placeholder="Referencia"
              className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors placeholder-[#64748B]" />
            <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-sm font-medium transition-colors">
              <CheckCircle size={14} /> Marcar pagada
            </button>
          </form>

          <form action={handleCancel}>
            <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E6EBF2] hover:bg-[#EF4444]/20 text-[#64748B] hover:text-[#EF4444] text-sm font-medium border border-[#E6EBF2] hover:border-[#EF4444]/30 transition-colors">
              <XCircle size={14} /> Cancelar
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
