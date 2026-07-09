'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createInvoice } from '@/features/admin/services/admin.service'
import { CurrencySelect } from '@/shared/components/currency-select'

type Org = { id: string; name: string }
type Row = { description: string; quantity: string; unit_price: string }

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors placeholder-[#CBD5E1]'
// Igual pero SIN w-full (para las líneas de ítems, que usan flex/anchos fijos).
const lineCls = 'px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors placeholder-[#CBD5E1]'

export function InvoiceCreateForm({ orgs, defaultOrgId, defaultTicketId, defaultDescription }: {
  orgs: Org[]
  defaultOrgId?: string
  defaultTicketId?: string
  defaultDescription?: string
}) {
  const [rows, setRows] = useState<Row[]>([{ description: defaultDescription ?? '', quantity: '1', unit_price: '' }])
  const [taxPct, setTaxPct] = useState('0')

  const items = rows
    .map(r => ({ description: r.description.trim(), quantity: Number(r.quantity) || 0, unit_price: Number(r.unit_price) || 0 }))
    .filter(r => r.description && r.quantity > 0)
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0)
  const tax = (subtotal * (Number(taxPct) || 0)) / 100
  const total = subtotal + tax
  const fmt = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 })

  const update = (i: number, field: keyof Row, value: string) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  const addRow = () => setRows(rs => [...rs, { description: '', quantity: '1', unit_price: '' }])
  const removeRow = (i: number) => setRows(rs => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))

  return (
    <form action={createInvoice} className="px-5 pb-5 space-y-4 border-t border-[#E6EBF2] pt-4">
      {defaultTicketId && <input type="hidden" name="ticket_id" value={defaultTicketId} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Cliente *</label>
          <select name="organization_id" required defaultValue={defaultOrgId ?? ''} className={inputCls}>
            <option value="">Seleccionar...</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Vencimiento *</label>
          <input name="due_date" type="date" required className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Moneda</label>
          <CurrencySelect className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">IVA %</label>
          <input name="tax_percent" type="number" step="0.01" value={taxPct}
            onChange={e => setTaxPct(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Ítems por línea (desglose por servicio) */}
      <div>
        <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Servicios / conceptos</label>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input name="desc" value={r.description} onChange={e => update(i, 'description', e.target.value)}
                placeholder="Descripción del servicio" className={`${lineCls} flex-1 min-w-0`} />
              <input name="qty" value={r.quantity} onChange={e => update(i, 'quantity', e.target.value)}
                type="number" step="0.01" min="0" title="Cantidad" className={`${lineCls} w-16 text-right shrink-0`} />
              <input name="price" value={r.unit_price} onChange={e => update(i, 'unit_price', e.target.value)}
                type="number" step="0.01" min="0" placeholder="P. unit." title="Precio unitario" className={`${lineCls} w-28 text-right shrink-0`} />
              <span className="w-24 text-right text-sm text-[#0B2545] font-medium tabular-nums shrink-0">
                {fmt((Number(r.quantity) || 0) * (Number(r.unit_price) || 0))}
              </span>
              <button type="button" onClick={() => removeRow(i)}
                className="p-1.5 rounded-lg text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#1789FC] hover:underline">
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
        <textarea name="notes" rows={2} className={`${inputCls} resize-none`} />
      </div>

      <button type="submit"
        className="px-5 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
        Crear cuenta de cobro
      </button>
    </form>
  )
}
