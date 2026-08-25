'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, Receipt, Loader2, Check, Plus, Trash2, Package } from 'lucide-react'
import { saveContractBilling, generateMonthlyContractInvoice } from '@/features/admin/services/auto-invoice.service'

type Initial = { billing_amount: number | null; billing_currency: string | null; retention_pct: number | null; total_value: number | null }
type Item = { description: string; quantity: string; unitPrice: string }

const money = (n: number, cur: string) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: cur || 'COP', maximumFractionDigits: 0 }).format(n || 0)

export function ContractBillingPanel({ contractId, initial }: { contractId: string; initial: Initial }) {
  const router = useRouter()
  const [amount, setAmount] = useState(String(initial.billing_amount ?? ''))
  const [currency, setCurrency] = useState(initial.billing_currency ?? 'COP')
  const [ret, setRet] = useState(String(initial.retention_pct ?? '0'))
  const [total, setTotal] = useState(String(initial.total_value ?? ''))
  const [items, setItems] = useState<Item[]>([])
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingT, saveStart] = useTransition()
  const [genT, genStart] = useTransition()

  const amt = Number(amount) || 0
  const retPct = Number(ret) || 0
  const retVal = Math.round(amt * retPct / 100)
  const cleanItems = items
    .map(it => ({ description: it.description.trim(), quantity: Number(it.quantity) || 0, unit_price: Math.round(Number(it.unitPrice) || 0) }))
    .filter(it => it.description && it.quantity > 0 && it.unit_price >= 0)
  const extraSubtotal = cleanItems.reduce((s, it) => s + it.quantity * it.unit_price, 0)
  const subtotal = amt + extraSubtotal
  const neto = subtotal - retVal

  function addItem() { setItems(prev => [...prev, { description: '', quantity: '1', unitPrice: '' }]) }
  function updateItem(i: number, patch: Partial<Item>) { setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it)) }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }

  function save() {
    setError(null); setSaved(false)
    saveStart(async () => {
      const res = await saveContractBilling(contractId, {
        billing_amount: amt, billing_currency: currency, retention_pct: retPct,
        total_value: total ? Number(total) : null,
      })
      if (res?.error) setError(res.error); else { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    })
  }

  function generate() {
    setError(null)
    genStart(async () => {
      await saveContractBilling(contractId, { billing_amount: amt, billing_currency: currency, retention_pct: retPct, total_value: total ? Number(total) : null })
      const res = await generateMonthlyContractInvoice(contractId, cleanItems)
      if (res?.error) setError(res.error)
      else if (res?.invoiceId) router.push(`/admin/invoices/${res.invoiceId}`)
    })
  }

  const inp = 'w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]'
  const lbl = 'block text-[11px] text-[#5B6B7C] mb-1'

  return (
    <div className="bg-white border border-[#E6EBF2] rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-[#0B2545] flex items-center gap-2"><Wallet size={15} className="text-[#0E9E86]" /> Datos de facturación</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><label className={lbl}>Valor mensual</label><input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className={inp} /></div>
        <div><label className={lbl}>Moneda</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)} className={inp}>
            <option value="COP">COP</option><option value="USD">USD</option>
          </select>
        </div>
        <div><label className={lbl}>Retención en la fuente (%)</label><input type="number" min="0" step="0.1" value={ret} onChange={e => setRet(e.target.value)} placeholder="0" className={inp} /></div>
        <div><label className={lbl}>Valor total del contrato</label><input type="number" min="0" value={total} onChange={e => setTotal(e.target.value)} placeholder="opcional" className={inp} /></div>
      </div>

      {/* Ítems adicionales (repuestos, materiales, etc.) */}
      <div className="rounded-lg border border-[#E6EBF2] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-[#0B2545] flex items-center gap-1.5"><Package size={13} className="text-[#8B5CF6]" /> Ítems adicionales (repuestos, materiales…)</p>
          <button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-xs text-[#0E9E86] hover:text-[#0B2545]"><Plus size={13} /> Agregar ítem</button>
        </div>
        {items.length === 0 ? (
          <p className="text-[11px] text-[#94A3B8]">Sin ítems adicionales. Úsalos para repuestos, materiales o servicios puntuales que se cobran junto con la mensualidad.</p>
        ) : (
          <div className="space-y-2">
            {/* Encabezados */}
            <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] text-[#94A3B8] px-1">
              <span className="col-span-6">Descripción</span>
              <span className="col-span-2 text-right">Cantidad</span>
              <span className="col-span-3 text-right">Valor unitario</span>
              <span className="col-span-1"></span>
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input value={it.description} onChange={e => updateItem(i, { description: e.target.value })} placeholder="Ej: Disco SSD 500GB / RAM 8GB / Fuente de poder"
                  className={`${inp} col-span-12 sm:col-span-6`} />
                <input type="number" min="0" step="1" value={it.quantity} onChange={e => updateItem(i, { quantity: e.target.value })} placeholder="1"
                  className={`${inp} col-span-4 sm:col-span-2 text-right`} />
                <input type="number" min="0" value={it.unitPrice} onChange={e => updateItem(i, { unitPrice: e.target.value })} placeholder="0"
                  className={`${inp} col-span-6 sm:col-span-3 text-right`} />
                <button type="button" onClick={() => removeItem(i)} title="Quitar"
                  className="col-span-2 sm:col-span-1 inline-flex justify-center p-2 rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vista previa de la cuenta de cobro */}
      <div className="rounded-lg bg-[#F7F9FC] border border-[#E6EBF2] p-3 text-sm space-y-1">
        {amt > 0 && <div className="flex justify-between text-[#5B6B7C]"><span>Servicio mensual</span><span>{money(amt, currency)}</span></div>}
        {extraSubtotal > 0 && <div className="flex justify-between text-[#5B6B7C]"><span>Ítems adicionales ({cleanItems.length})</span><span>{money(extraSubtotal, currency)}</span></div>}
        <div className="flex justify-between text-[#5B6B7C]"><span>Subtotal</span><span>{money(subtotal, currency)}</span></div>
        <div className="flex justify-between text-[#EF4444]"><span>Retención ({retPct}%, sobre el servicio)</span><span>- {money(retVal, currency)}</span></div>
        <div className="flex justify-between font-semibold text-[#0B2545] border-t border-[#E6EBF2] pt-1"><span>Neto a pagar</span><span>{money(neto, currency)}</span></div>
      </div>

      {error && <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={savingT} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E6EBF2] text-[#5B6B7C] text-sm hover:text-[#0B2545] disabled:opacity-50">
          {savingT ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} className="text-[#10B981]" /> : null} {saved ? 'Guardado' : 'Guardar'}
        </button>
        <button onClick={generate} disabled={genT || (amt <= 0 && cleanItems.length === 0)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B2545] hover:bg-[#0B2545]/90 text-white text-sm font-medium disabled:opacity-50">
          {genT ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />} Generar cuenta de cobro
        </button>
      </div>
      <p className="text-[11px] text-[#94A3B8]">La cuenta de cobro se crea como borrador con la mensualidad más los ítems adicionales. La retención en la fuente se descuenta solo del servicio mensual. Puedes seguir editándola y descargar el PDF desde Facturas.</p>
    </div>
  )
}
