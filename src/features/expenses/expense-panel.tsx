import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/format/currency'
import { createExpense, deleteExpense } from './expenses.service'
import { sumNetIncome } from './income'
import { Wallet, Trash2, Plus, TrendingUp, TrendingDown } from 'lucide-react'

const input = 'w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]'
const lbl = 'block text-[11px] text-[#5B6B7C] mb-1'

type Expense = {
  id: string; category: string; description: string | null; amount: number | string
  spent_at: string; ticket_id: string | null; visit_id: string | null
}

async function categories(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('service_expense_categories').select('name').eq('is_active', true).order('name')
  return (data ?? []).map(c => c.name as string)
}

/** Formulario para registrar un gasto (ticket y/o visita prefijados por el contexto). */
async function AddExpenseForm({ ticketId, visitId, redirectTo }: { ticketId?: string; visitId?: string; redirectTo: string }) {
  const cats = await categories()
  const today = new Date().toISOString().slice(0, 10)
  return (
    <form action={createExpense} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
      {ticketId && <input type="hidden" name="ticket_id" value={ticketId} />}
      {visitId && <input type="hidden" name="visit_id" value={visitId} />}
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <div className="col-span-2 sm:col-span-1">
        <label className={lbl}>Categoría</label>
        <input name="category" list="expense-cats" required placeholder="Transporte…" className={input} />
        <datalist id="expense-cats">{cats.map(c => <option key={c} value={c} />)}</datalist>
      </div>
      <div className="col-span-2 sm:col-span-2">
        <label className={lbl}>Descripción</label>
        <input name="description" placeholder="Taxi al sitio, almuerzo…" className={input} />
      </div>
      <div>
        <label className={lbl}>Monto (COP)</label>
        <input name="amount" type="number" min="0" step="any" required placeholder="0" className={input} />
      </div>
      <div>
        <label className={lbl}>Fecha</label>
        <input name="spent_at" type="date" defaultValue={today} className={input} />
      </div>
      <div className="col-span-2 sm:col-span-5 flex justify-end">
        <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
          <Plus size={14} /> Registrar gasto
        </button>
      </div>
    </form>
  )
}

function ExpenseRows({ expenses, redirectTo, currency }: { expenses: Expense[]; redirectTo: string; currency: string }) {
  if (!expenses.length) return <p className="text-xs text-[#94A3B8]">Aún sin gastos registrados.</p>
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E6EBF2] text-left text-xs text-[#5B6B7C]">
            <th className="py-2 pr-3">Fecha</th><th className="py-2 pr-3">Categoría</th>
            <th className="py-2 pr-3">Descripción</th><th className="py-2 pr-3 text-right">Monto</th><th></th>
          </tr>
        </thead>
        <tbody>
          {expenses.map(e => (
            <tr key={e.id} className="border-b border-[#E6EBF2]/50">
              <td className="py-2 pr-3 text-xs text-[#5B6B7C] whitespace-nowrap">{String(e.spent_at).slice(0, 10)}</td>
              <td className="py-2 pr-3">
                <span className="px-2 py-0.5 rounded-full text-xs bg-[#E6EBF2] text-[#5B6B7C]">{e.category}</span>
              </td>
              <td className="py-2 pr-3 text-[#0B2545]">{e.description || '—'}</td>
              <td className="py-2 pr-3 text-right font-medium text-[#0B2545] whitespace-nowrap">{formatMoney(Number(e.amount), currency)}</td>
              <td className="py-2 text-right">
                <form action={deleteExpense}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="redirect_to" value={redirectTo} />
                  <button type="submit" className="p-1 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10" title="Eliminar gasto">
                    <Trash2 size={13} />
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Semáforo de rentabilidad. */
function tone(revenue: number, cost: number) {
  const margin = revenue - cost
  const pct = revenue > 0 ? (margin / revenue) * 100 : null
  let color = '#10B981', label = 'Rentable'
  if (margin < 0) { color = '#EF4444'; label = 'Pérdida' }
  else if (pct !== null && pct < 20) { color = '#F59E0B'; label = 'Margen bajo' }
  else if (revenue === 0) { color = '#F59E0B'; label = 'Sin cobrar aún' }
  return { margin, pct, color, label }
}

/** Panel completo en el ticket: cobrado − gastos = margen, lista y alta de gastos. */
export async function TicketExpensePanel({ ticketId, flash }: { ticketId: string; flash?: string }) {
  const supabase = await createClient()
  const redirectTo = `/admin/tickets/${ticketId}`

  const [{ data: visits }, { data: invoices }, { data: bp }] = await Promise.all([
    supabase.from('technical_visits').select('id').eq('ticket_id', ticketId),
    supabase.from('invoices').select('subtotal_usd, tax_usd, total_usd, currency, status, doc_type').eq('ticket_id', ticketId),
    supabase.from('billing_profile').select('retention_pct').limit(1).maybeSingle(),
  ])
  const visitIds = (visits ?? []).map(v => v.id as string)
  const retentionPct = Number(bp?.retention_pct ?? 11)

  const orParts = [`ticket_id.eq.${ticketId}`]
  if (visitIds.length) orParts.push(`visit_id.in.(${visitIds.join(',')})`)
  const { data: exp } = await supabase.from('service_expenses').select('*').or(orParts.join(',')).order('spent_at', { ascending: false })
  const expenses = (exp ?? []) as Expense[]

  const inv = (invoices ?? []).filter(i => ['sent', 'overdue', 'paid'].includes(i.status as string))
  const currency = (inv[0]?.currency as string) || 'COP'
  const income = sumNetIncome(inv, retentionPct)
  const revenue = income.net // ingreso neto real (sin IVA / menos retención)
  const cost = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0)
  const t = tone(revenue, cost)

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet size={16} className="text-[#1789FC]" />
        <h2 className="text-sm font-semibold text-[#0B2545]">Gastos y rentabilidad del servicio</h2>
      </div>

      {flash === '1' && <div className="px-3 py-2 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-medium">✓ Gasto registrado</div>}
      {flash === 'del' && <div className="px-3 py-2 rounded-lg bg-[#E6EBF2] text-[#5B6B7C] text-xs font-medium">Gasto eliminado</div>}

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-[#F4F7FB] p-3">
          <p className="text-[11px] text-[#5B6B7C]">Cobrado neto</p>
          <p className="text-lg font-bold text-[#0B2545]">{formatMoney(revenue, currency)}</p>
          {(income.iva > 0 || income.retention > 0) && (
            <p className="text-[10px] text-[#94A3B8] mt-0.5">
              Facturado {formatMoney(income.gross, currency)}
              {income.iva > 0 ? ` · −IVA ${formatMoney(income.iva, currency)}` : ''}
              {income.retention > 0 ? ` · −Ret. ${formatMoney(income.retention, currency)}` : ''}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-[#F4F7FB] p-3">
          <p className="text-[11px] text-[#5B6B7C]">Gastos</p>
          <p className="text-lg font-bold text-[#0B2545]">{formatMoney(cost, currency)}</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: `${t.color}14` }}>
          <p className="text-[11px] flex items-center gap-1" style={{ color: t.color }}>
            {t.margin < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />} Margen{t.pct !== null ? ` · ${t.pct.toFixed(0)}%` : ''}
          </p>
          <p className="text-lg font-bold" style={{ color: t.color }}>{formatMoney(t.margin, currency)}</p>
          <p className="text-[10px]" style={{ color: t.color }}>{t.label}</p>
        </div>
      </div>

      <ExpenseRows expenses={expenses} redirectTo={redirectTo} currency={currency} />

      <div className="border-t border-[#E6EBF2] pt-4">
        <AddExpenseForm ticketId={ticketId} redirectTo={redirectTo} />
      </div>
    </div>
  )
}

/** Sección compacta en la visita: registra y lista los gastos de la visita. */
export async function VisitExpensePanel({ visitId, ticketId, redirectTo, flash }: { visitId: string; ticketId?: string | null; redirectTo: string; flash?: string }) {
  const supabase = await createClient()
  const { data: exp } = await supabase.from('service_expenses').select('*').eq('visit_id', visitId).order('spent_at', { ascending: false })
  const expenses = (exp ?? []) as Expense[]
  const cost = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0)

  return (
    <div className="bg-white border border-[#E6EBF2] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-[#1789FC]" />
          <h2 className="text-sm font-semibold text-[#0B2545]">Gastos de la visita</h2>
        </div>
        <span className="text-sm font-semibold text-[#0B2545]">{formatMoney(cost, 'COP')}</span>
      </div>

      {flash === '1' && <div className="px-3 py-2 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-medium">✓ Gasto registrado</div>}
      {flash === 'del' && <div className="px-3 py-2 rounded-lg bg-[#E6EBF2] text-[#5B6B7C] text-xs font-medium">Gasto eliminado</div>}

      <ExpenseRows expenses={expenses} redirectTo={redirectTo} currency="COP" />

      <div className="border-t border-[#E6EBF2] pt-4">
        {/* Liga el gasto a la visita y, si la visita tiene ticket, tambien al ticket (para el margen). */}
        <AddExpenseForm visitId={visitId} ticketId={ticketId ?? undefined} redirectTo={redirectTo} />
      </div>
      {ticketId ? <p className="text-[11px] text-[#94A3B8]">Estos gastos se suman a la rentabilidad del ticket asociado.</p> : null}
    </div>
  )
}
