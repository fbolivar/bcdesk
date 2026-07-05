import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/format/currency'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Invoice, InvoiceItem } from '@/lib/supabase/types'
import { PayButton } from '@/features/client/components/pay-button'

interface Props {
  params: Promise<{ id: string }>
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Borrador',   color: '#64748B' },
  sent:      { label: 'Pendiente',  color: '#4F8AFF' },
  paid:      { label: 'Pagada',     color: '#10D98A' },
  overdue:   { label: 'Vencida',    color: '#FF4D6A' },
  cancelled: { label: 'Cancelada',  color: '#64748B' },
}

export default async function ClientInvoiceDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('organization_id').eq('id', user.id).single()

  if (!profile?.organization_id) redirect('/client/dashboard')

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, organizations(name, phone, address)')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!invoice) notFound()

  const inv = invoice as Invoice & { organizations?: { name: string; phone: string | null; address: string | null } }

  const { data: itemsData } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .order('created_at', { ascending: true })

  const items = (itemsData ?? []) as InvoiceItem[]

  const cfg = statusConfig[inv.status] ?? { label: inv.status, color: '#64748B' }
  const canPay = ['sent', 'overdue'].includes(inv.status)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/client/invoices"
          className="inline-flex items-center gap-2 text-sm transition-colors"
          style={{ color: '#64748B' }}
        >
          <ArrowLeft size={14} />
          Volver a facturas
        </Link>
        {canPay && <PayButton invoiceId={inv.id} />}
      </div>

      <div
        className="rounded-2xl p-5"
        style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(79,138,255,0.12)' }}
            >
              <FileText size={18} style={{ color: '#4F8AFF' }} />
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>Factura</p>
              <h1 className="text-xl font-bold font-mono" style={{ color: '#0F172A' }}>{inv.invoice_number}</h1>
            </div>
          </div>
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: `${cfg.color}1a`, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>Fecha emisión</p>
            <p className="text-sm font-medium" style={{ color: '#0F172A' }}>
              {format(new Date(inv.issue_date), 'dd MMM yyyy', { locale: es })}
            </p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>Fecha vencimiento</p>
            <p
              className="text-sm font-medium"
              style={{ color: inv.status === 'overdue' ? '#FF4D6A' : '#0F172A' }}
            >
              {format(new Date(inv.due_date), 'dd MMM yyyy', { locale: es })}
            </p>
          </div>
          {inv.paid_at && (
            <div>
              <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>Fecha de pago</p>
              <p className="text-sm font-medium" style={{ color: '#10D98A' }}>
                {format(new Date(inv.paid_at), 'dd MMM yyyy', { locale: es })}
              </p>
            </div>
          )}
          {inv.payment_method && (
            <div>
              <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>Método de pago</p>
              <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{inv.payment_method}</p>
            </div>
          )}
          {inv.payment_reference && (
            <div>
              <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>Referencia</p>
              <p className="text-sm font-medium font-mono" style={{ color: '#0F172A' }}>{inv.payment_reference}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div
          className="rounded-2xl p-5"
          style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={14} style={{ color: '#4F8AFF' }} />
            <p className="text-xs font-semibold" style={{ color: '#64748B' }}>EMISOR</p>
          </div>
          <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>BCDesk</p>
          <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>BC Fabric SAS</p>
          <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>soporte@bcdesk.co</p>
        </div>
        <div
          className="rounded-2xl p-5"
          style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={14} style={{ color: '#8B6FFF' }} />
            <p className="text-xs font-semibold" style={{ color: '#64748B' }}>RECEPTOR</p>
          </div>
          <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{inv.organizations?.name ?? '—'}</p>
          {inv.organizations?.phone && (
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{inv.organizations.phone}</p>
          )}
          {inv.organizations?.address && (
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{inv.organizations.address}</p>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #E6EBF2' }}>
                {['Descripción', 'Cant.', 'Precio unit.', 'Total'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: idx < items.length - 1 ? '1px solid #F4F7FB' : 'none' }}
                >
                  <td className="px-5 py-3.5" style={{ color: '#0F172A' }}>{item.description}</td>
                  <td className="px-5 py-3.5 tabular-nums" style={{ color: '#64748B' }}>{item.quantity}</td>
                  <td className="px-5 py-3.5 tabular-nums" style={{ color: '#64748B' }}>
                    {formatMoney(item.unit_price_usd, inv.currency)}
                  </td>
                  <td className="px-5 py-3.5 font-semibold tabular-nums" style={{ color: '#0F172A' }}>
                    {formatMoney(item.total_usd, inv.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        className="rounded-2xl p-5 space-y-3"
        style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
      >
        <h2 className="text-sm font-semibold mb-1" style={{ color: '#0F172A' }}>Resumen</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span style={{ color: '#64748B' }}>Subtotal</span>
            <span style={{ color: '#0F172A' }}>{formatMoney(inv.subtotal_usd, inv.currency)}</span>
          </div>
          {inv.tax_percent > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: '#64748B' }}>Impuesto ({inv.tax_percent}%)</span>
              <span style={{ color: '#0F172A' }}>{formatMoney(inv.tax_usd, inv.currency)}</span>
            </div>
          )}
          <div
            className="flex justify-between text-base font-bold pt-3"
            style={{ borderTop: '1px solid #E6EBF2' }}
          >
            <span style={{ color: '#0F172A' }}>Total</span>
            <span style={{ color: inv.status === 'paid' ? '#10D98A' : '#0F172A' }}>
              {formatMoney(inv.total_usd, inv.currency)}
            </span>
          </div>
        </div>

        {canPay && (
          <div className="pt-2 flex justify-end">
            <PayButton invoiceId={inv.id} />
          </div>
        )}
      </div>

      {inv.notes && (
        <div
          className="rounded-2xl p-5"
          style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>Notas</p>
          <p className="text-sm leading-relaxed" style={{ color: '#0F172A' }}>{inv.notes}</p>
        </div>
      )}
    </div>
  )
}
