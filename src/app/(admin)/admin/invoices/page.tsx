import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createInvoice } from '@/features/admin/services/admin.service'
import type { Invoice } from '@/lib/supabase/types'
import { formatMoney } from '@/lib/format/currency'
import { CurrencySelect } from '@/shared/components/currency-select'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props { searchParams: Promise<{ status?: string }> }

export default async function AdminInvoicesPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  let query = supabase.from('invoices').select('*, organizations(name)').order('created_at', { ascending: false })
  if (params.status) query = query.eq('status', params.status)

  const [{ data: invoices }, { data: orgs }] = await Promise.all([
    query,
    supabase.from('organizations').select('id, name').eq('status', 'active'),
  ])

  const typedInvoices = (invoices ?? []) as (Invoice & { organizations?: { name: string } })[]

  const statusConfig: Record<string, { label: string; color: string }> = {
    draft:     { label: 'Borrador',   color: 'bg-[#E6EBF2] text-[#64748B]' },
    sent:      { label: 'Enviada',    color: 'bg-[#F59E0B]/20 text-[#F59E0B]' },
    paid:      { label: 'Pagada',     color: 'bg-[#10B981]/20 text-[#10B981]' },
    overdue:   { label: 'Vencida',    color: 'bg-[#EF4444]/20 text-[#EF4444]' },
    cancelled: { label: 'Cancelada',  color: 'bg-[#E6EBF2] text-[#64748B]' },
  }

  const totalPending = typedInvoices.filter(i => ['sent','overdue'].includes(i.status)).reduce((s, i) => s + i.total_usd, 0)
  const totalPaid = typedInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_usd, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Facturación</h1>
        <p className="text-sm text-[#64748B] mt-0.5">{typedInvoices.length} facturas</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-xs text-[#64748B] mb-1">Por cobrar</p>
          <p className="text-2xl font-bold text-[#F59E0B]">{formatMoney(totalPending)}</p>
        </div>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-xs text-[#64748B] mb-1">Cobrado</p>
          <p className="text-2xl font-bold text-[#10B981]">{formatMoney(totalPaid)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {[['', 'Todas'], ['draft','Borrador'], ['sent','Enviadas'], ['paid','Pagadas'], ['overdue','Vencidas']].map(([v, l]) => (
          <Link key={v}
            href={v ? `/admin/invoices?status=${v}` : '/admin/invoices'}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              (params.status ?? '') === v ? 'bg-[#3B82F6] text-white' : 'bg-[#FFFFFF] text-[#64748B] border border-[#E6EBF2] hover:text-[#1E293B]'
            }`}
          >{l}</Link>
        ))}
      </div>

      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E6EBF2]">
              {['Número', 'Cliente', 'Emisión', 'Vencimiento', 'Total', 'Estado', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {typedInvoices.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#64748B]">No hay facturas</td></tr>
            ) : typedInvoices.map(inv => {
              const cfg = statusConfig[inv.status]
              return (
                <tr key={inv.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/invoices/${inv.id}`} className="font-mono text-xs text-[#3B82F6] hover:underline">{inv.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{inv.organizations?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{format(new Date(inv.issue_date), 'dd MMM yyyy', { locale: es })}</td>
                  <td className={`px-4 py-3 text-xs ${inv.status === 'overdue' ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
                    {format(new Date(inv.due_date), 'dd MMM yyyy', { locale: es })}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#1E293B]">{formatMoney(inv.total_usd, inv.currency)}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span></td>
                  <td className="px-4 py-3"><Link href={`/admin/invoices/${inv.id}`} className="text-xs text-[#3B82F6] hover:underline">Ver →</Link></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <details className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl">
        <summary className="px-5 py-4 cursor-pointer text-sm font-medium text-[#64748B] hover:text-[#1E293B] select-none">
          + Crear nueva factura
        </summary>
        <form action={createInvoice} className="px-5 pb-5 space-y-4 border-t border-[#E6EBF2] pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">Cliente *</label>
              <select name="organization_id" required className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors">
                <option value="">Seleccionar...</option>
                {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">Fecha vencimiento *</label>
              <input name="due_date" type="date" required className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">Moneda</label>
              <CurrencySelect className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">Subtotal *</label>
              <input name="subtotal_usd" type="number" step="0.01" required className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">IVA %</label>
              <input name="tax_percent" type="number" step="0.01" defaultValue="0" className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Notas</label>
            <textarea name="notes" rows={2} className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors resize-none" />
          </div>
          <button type="submit" className="px-5 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
            Crear factura
          </button>
        </form>
      </details>
    </div>
  )
}
