'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { CurrencySelect } from '@/shared/components/currency-select'
import { DOC_TYPE_OPTIONS } from '@/lib/invoices/doc-type'

type Org = { id: string; name: string }
type Row = { description: string; quantity: string; unit_price: string }
type ItemInit = { description: string; quantity: number; unit_price_usd: number }

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] transition-colors placeholder-[#CBD5E1]'
const smallCls = 'px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] transition-colors placeholder-[#CBD5E1]'

export function InvoiceCreateForm({
  orgs, action, invoiceId,
  defaultOrgId, defaultTicketId, defaultDescription,
  initialItems, initialDueDate, initialCurrency, initialTaxPct, initialNotes, initialDocType, initialDocTypeOther,
  submitLabel = 'Crear cuenta de cobro',
}: {
  orgs: Org[]
  action: (formData: FormData) => void | Promise<void>
  invoiceId?: string
  defaultOrgId?: string
  defaultTicketId?: string
  defaultDescription?: string
  initialItems?: ItemInit[]
  initialDueDate?: string
  initialCurrency?: string
  initialTaxPct?: string
  initialNotes?: string
  initialDocType?: string
  initialDocTypeOther?: string
  submitLabel?: string
}) {
  const initRows: Row[] = initialItems && initialItems.length
    ? initialItems.map(it => ({ description: it.description, quantity: String(it.quantity), unit_price: String(it.unit_price_usd) }))
    : [{ description: defaultDescription ?? '', quantity: '1', unit_price: '' }]

  const [rows, setRows] = useState<Row[]>(initRows)
  const [taxPct, setTaxPct] = useState(initialTaxPct ?? '0')
  const [docType, setDocType] = useState(initialDocType ?? 'cuenta_cobro')

  const subtotal = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0), 0)
  const tax = (subtotal * (Number(taxPct) || 0)) / 100
  const total = subtotal + tax
  const fmt = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 })

  const update = (i: number, field: keyof Row, value: string) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  const addRow = () => setRows(rs => [...rs, { description: '', quantity: '1', unit_price: '' }])
  const removeRow = (i: number) => setRows(rs => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))

  return (
    <form action={action} className="px-5 pb-5 space-y-4 border-t border-[#E6EBF2] pt-4">
      {invoiceId && <input type="hidden" name="invoice_id" value={invoiceId} />}
      {defaultTicketId && <input type="hidden" name="ticket_id" value={defaultTicketId} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Tipo de documento</label>
          <select name="doc_type" value={docType} onChange={e => setDocType(e.target.value)} className={inputCls}>
            {DOC_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {docType === 'otro' && (
          <div>
            <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Nombre del documento</label>
            <input name="doc_type_other" defaultValue={initialDocTypeOther ?? ''} placeholder="ej: Recibo, Orden de servicio…" className={inputCls} />
          </div>
        )}
        <div className={docType === 'otro' ? '' : 'lg:col-span-2'}>
          <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Cliente *</label>
          <select name="organization_id" required defaultValue={defaultOrgId ?? ''} className={inputCls}>
            <option value="">Seleccionar...</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Vencimiento *</label>
          <input name="due_date" type="date" required defaultValue={initialDueDate ?? ''} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Moneda</label>
          <CurrencySelect className={inputCls} defaultValue={initialCurrency} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">IVA %</label>
          <input name="tax_percent" type="number" step="0.01" value={taxPct} onChange={e => setTaxPct(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Ítems por línea — descripción a todo lo ancho */}
      <div>
        <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Servicios / conceptos</label>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg border border-[#E6EBF2] bg-[#FBFCFE] p-2.5 space-y-2">
              <input name="desc" value={r.description} onChange={e => update(i, 'description', e.target.value)}
                placeholder="Descripción del servicio" className={inputCls} />
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#5B6B7C]">Cant.</span>
                  <input name="qty" value={r.quantity} onChange={e => update(i, 'quantity', e.target.value)}
                    type="number" step="0.01" min="0" className={`${smallCls} w-20 text-right`} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#5B6B7C]">P. unit.</span>
                  <input name="price" value={r.unit_price} onChange={e => update(i, 'unit_price', e.target.value)}
                    type="number" step="0.01" min="0" placeholder="0" className={`${smallCls} w-32 text-right`} />
                </div>
                <span className="ml-auto text-sm text-[#0B2545] font-medium tabular-nums">
                  {fmt((Number(r.quantity) || 0) * (Number(r.unit_price) || 0))}
                </span>
                <button type="button" onClick={() => removeRow(i)}
                  className="p-1.5 rounded-lg text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#0E9E86] hover:underline">
          <Plus size={13} /> Agregar línea
        </button>
      </div>

      {/* Totales en vivo */}
      <div className="flex justify-end">
        <div className="w-56 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-[#5B6B7C]">Subtotal</span><span className="text-[#0B2545] tabular-nums">{fmt(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-[#5B6B7C]">IVA ({taxPct || 0}%)</span><span className="text-[#0B2545] tabular-nums">{fmt(tax)}</span></div>
          <div className="flex justify-between font-bold border-t border-[#E6EBF2] pt-1"><span className="text-[#0B2545]">Total</span><span className="text-[#0B2545] tabular-nums">{fmt(total)}</span></div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Notas</label>
        <textarea name="notes" rows={2} defaultValue={initialNotes ?? ''} className={`${inputCls} resize-none`} />
      </div>

      <button type="submit"
        className="px-5 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors">
        {submitLabel}
      </button>
    </form>
  )
}
