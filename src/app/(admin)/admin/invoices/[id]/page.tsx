import { fmtDateOnly } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Send, XCircle, FileDown } from 'lucide-react'
import { updateInvoiceStatus, sendInvoice, updateInvoice } from '@/features/admin/services/admin.service'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Invoice, InvoiceItem } from '@/lib/supabase/types'
import { formatMoney } from '@/lib/format/currency'
import { LogoMark } from '@/shared/components/logo'
import { InvoiceCreateForm } from '@/features/admin/components/invoice-create-form'
import { DeleteInvoiceButton } from '@/features/admin/components/delete-invoice-button'
import { docTitle } from '@/lib/invoices/doc-type'

interface Props { params: Promise<{ id: string }> }

export default async function AdminInvoiceDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const [{ data: invoice }, { data: orgs }] = await Promise.all([
    supabase.from('invoices').select('*, organizations(*), invoice_items(*), tickets(ticket_number, title)').eq('id', id).single(),
    supabase.from('organizations').select('id, name').eq('status', 'active').order('name'),
  ])
  if (!invoice) notFound()

  const inv = invoice as Invoice & {
    organizations?: { name: string; legal_name: string | null; tax_id: string | null; address: string | null; phone: string | null }
    invoice_items?: InvoiceItem[]
    ticket_id?: string | null
    tickets?: { ticket_number: number; title: string } | null
    doc_type?: string | null
    doc_type_other?: string | null
  }
  const org = inv.organizations
  const title = docTitle(inv.doc_type, inv.doc_type_other)

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
    draft:     { label: 'Borrador',   color: 'bg-[#E6EBF2] text-[#5B6B7C]' },
    sent:      { label: 'Enviada',    color: 'bg-[#F59E0B]/20 text-[#F59E0B]' },
    paid:      { label: 'Pagada',     color: 'bg-[#10B981]/20 text-[#10B981]' },
    overdue:   { label: 'Vencida',    color: 'bg-[#EF4444]/20 text-[#EF4444]' },
    cancelled: { label: 'Cancelada',  color: 'bg-[#E6EBF2] text-[#5B6B7C]' },
  }
  const cfg = statusConfig[inv.status]

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/invoices" className="inline-flex items-center gap-2 text-sm text-[#5B6B7C] hover:text-[#0B2545]">
          <ArrowLeft size={14} /> Volver a facturas
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/admin/invoices/${id}/pdf`} target="_blank"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#5B6B7C] hover:text-[#0B2545] text-sm font-medium transition-colors">
            <FileDown size={14} /> Descargar PDF
          </Link>
          <DeleteInvoiceButton invoiceId={id} />
        </div>
      </div>

      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <LogoMark size={26} />
              <span className="font-semibold text-[#0B2545]">HexDesk</span>
            </div>
            <p className="text-xs text-[#5B6B7C]">Fernando Bolívar Buitrago · Ciberseguridad</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-[#5B6B7C] uppercase tracking-wide">{title}</p>
            <p className="font-mono text-lg font-bold text-[#0B2545]">{inv.invoice_number}</p>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>

        {/* Billing to */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-xs font-medium text-[#5B6B7C] mb-1">Facturado a</p>
            <p className="font-medium text-[#0B2545]">{org?.legal_name || org?.name}</p>
            {org?.tax_id && <p className="text-xs text-[#5B6B7C] mt-0.5">NIT/C.C.: {org.tax_id}</p>}
            {org?.address && <p className="text-xs text-[#5B6B7C]">{org.address}</p>}
            {org?.phone && <p className="text-xs text-[#5B6B7C]">{org.phone}</p>}
          </div>
          <div className="text-right">
            <div className="space-y-1">
              <div className="flex justify-between gap-8">
                <span className="text-xs text-[#5B6B7C]">Fecha emisión</span>
                <span className="text-xs text-[#5B6B7C]">{fmtDateOnly(inv.issue_date)}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-xs text-[#5B6B7C]">Vencimiento</span>
                <span className={`text-xs ${inv.status === 'overdue' ? 'text-[#EF4444]' : 'text-[#5B6B7C]'}`}>
                  {fmtDateOnly(inv.due_date)}
                </span>
              </div>
              {inv.paid_at && (
                <div className="flex justify-between gap-8">
                  <span className="text-xs text-[#5B6B7C]">Pagado el</span>
                  <span className="text-xs text-[#10B981]">{format(new Date(inv.paid_at), 'dd MMM yyyy', { locale: es })}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items */}
        {inv.invoice_items && inv.invoice_items.length > 0 && (
          <div className="mb-6">
            <div className="w-full overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E6EBF2]">
                  <th className="pb-2 text-left text-xs text-[#5B6B7C]">Descripción</th>
                  <th className="pb-2 text-right text-xs text-[#5B6B7C]">Cant.</th>
                  <th className="pb-2 text-right text-xs text-[#5B6B7C]">P. Unit.</th>
                  <th className="pb-2 text-right text-xs text-[#5B6B7C]">Total</th>
                </tr>
              </thead>
              <tbody>
                {inv.invoice_items.map(item => (
                  <tr key={item.id} className="border-b border-[#E6EBF2]/50">
                    <td className="py-2.5 text-[#5B6B7C]">{item.description}</td>
                    <td className="py-2.5 text-right text-[#5B6B7C]">{item.quantity}</td>
                    <td className="py-2.5 text-right text-[#5B6B7C]">{formatMoney(item.unit_price_usd, inv.currency)}</td>
                    <td className="py-2.5 text-right text-[#0B2545] font-medium">{formatMoney(item.total_usd, inv.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-48 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-[#5B6B7C]">Subtotal</span>
              <span className="text-[#5B6B7C]">{formatMoney(inv.subtotal_usd, inv.currency)}</span>
            </div>
            {inv.tax_percent > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#5B6B7C]">IVA ({inv.tax_percent}%)</span>
                <span className="text-[#5B6B7C]">{formatMoney(inv.tax_usd, inv.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t border-[#E6EBF2] pt-2">
              <span className="text-[#0B2545]">Total</span>
              <span className="text-[#0B2545]">{formatMoney(inv.total_usd, inv.currency)}</span>
            </div>
          </div>
        </div>

        {inv.notes && (
          <div className="mt-4 pt-4 border-t border-[#E6EBF2]/50">
            <p className="text-xs text-[#5B6B7C] mb-1">Notas</p>
            <p className="text-sm text-[#5B6B7C]">{inv.notes}</p>
          </div>
        )}
        <div className="mt-6 pt-4 border-t border-[#E6EBF2]/50 text-center text-[10px]" style={{ color: '#94A3B8' }}>
          Fernando Bolívar Buitrago · Consultor en Ciberseguridad · BC Fabric SAS
        </div>
      </div>

      {/* Actions */}
      {!['paid', 'cancelled'].includes(inv.status) && (
        <div className="flex flex-wrap gap-3">
          {inv.status === 'draft' && (
            <form action={handleSend}>
              <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
                <Send size={14} /> Enviar al cliente
              </button>
            </form>
          )}

          <form action={handleMarkPaid} className="flex items-center gap-2">
            <input name="payment_method" placeholder="Método de pago"
              className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors placeholder-[#5B6B7C]" />
            <input name="reference" placeholder="Referencia"
              className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors placeholder-[#5B6B7C]" />
            <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-sm font-medium transition-colors">
              <CheckCircle size={14} /> Marcar pagada
            </button>
          </form>

          <form action={handleCancel}>
            <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E6EBF2] hover:bg-[#EF4444]/20 text-[#5B6B7C] hover:text-[#EF4444] text-sm font-medium border border-[#E6EBF2] hover:border-[#EF4444]/30 transition-colors">
              <XCircle size={14} /> Cancelar
            </button>
          </form>
        </div>
      )}

      {/* Editar (solo en Borrador) */}
      {inv.status === 'draft' && (
        <details className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl">
          <summary className="px-5 py-4 cursor-pointer text-sm font-medium text-[#5B6B7C] hover:text-[#0B2545] select-none">
            ✏️ Editar {title.toLowerCase()}
          </summary>
          <InvoiceCreateForm
            action={updateInvoice}
            invoiceId={id}
            orgs={orgs ?? []}
            defaultOrgId={inv.organization_id}
            initialItems={(inv.invoice_items ?? []).map(it => ({ description: it.description, quantity: it.quantity, unit_price_usd: it.unit_price_usd }))}
            initialDueDate={String(inv.due_date).slice(0, 10)}
            initialCurrency={inv.currency}
            initialTaxPct={String(inv.tax_percent ?? 0)}
            initialNotes={inv.notes ?? ''}
            initialDocType={inv.doc_type ?? 'cuenta_cobro'}
            initialDocTypeOther={inv.doc_type_other ?? ''}
            submitLabel="Guardar cambios"
          />
        </details>
      )}
    </div>
  )
}
