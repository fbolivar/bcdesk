import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { DollarSign, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { formatMoney } from '@/lib/format/currency'
import { CurrencySelect } from '@/shared/components/currency-select'

const CATEGORY_COLOR: Record<string, string> = {
  hardware: 'bg-[#00D4AA]/20 text-[#0E9E86]',
  software: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
  licenses: 'bg-[#06B6D4]/20 text-[#06B6D4]',
  services: 'bg-[#10B981]/20 text-[#10B981]',
  personnel: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  training: 'bg-[#EC4899]/20 text-[#EC4899]',
  infrastructure: 'bg-[#EF4444]/20 text-[#EF4444]',
  other: 'bg-[#E6EBF2] text-[#5B6B7C]',
}

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const currentYear = new Date().getFullYear()

  const [itemsRes, vendorsRes] = await Promise.all([
    supabase.from('it_budget_items').select('*').order('fiscal_year', { ascending: false }).order('category'),
    supabase.from('vendors').select('id, name').eq('is_active', true).order('name'),
  ])

  const items = itemsRes.data ?? []
  const vendors = vendorsRes.data ?? []

  const yearItems = items.filter(i => i.fiscal_year === currentYear)
  const totalBudgeted = yearItems.reduce((s, i) => s + (i.budgeted_amount ?? 0), 0)
  const totalActual = yearItems.reduce((s, i) => s + (i.actual_amount ?? 0), 0)
  const variance = totalBudgeted - totalActual
  const pct = totalBudgeted > 0 ? Math.round((totalActual / totalBudgeted) * 100) : 0

  // By category
  const byCategory: Record<string, { budgeted: number; actual: number }> = {}
  for (const item of yearItems) {
    if (!byCategory[item.category]) byCategory[item.category] = { budgeted: 0, actual: 0 }
    byCategory[item.category].budgeted += item.budgeted_amount ?? 0
    byCategory[item.category].actual += item.actual_amount ?? 0
  }

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('it_budget_items').insert({
      fiscal_year: parseInt(formData.get('fiscal_year') as string) || new Date().getFullYear(),
      category: formData.get('category') as string,
      department: formData.get('department') as string || null,
      description: formData.get('description') as string,
      budgeted_amount: parseFloat(formData.get('budgeted_amount') as string) || 0,
      actual_amount: parseFloat(formData.get('actual_amount') as string) || 0,
      currency: (formData.get('currency') as string) || 'COP',
      vendor_id: formData.get('vendor_id') as string || null,
      notes: formData.get('notes') as string || null,
      created_by: user?.id,
    })
    revalidatePath('/admin/finance')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('it_budget_items').delete().eq('id', id)
    revalidatePath('/admin/finance')
  }

  const fmt = (n: number) => formatMoney(Math.abs(n))

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">IT Financial Management</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Presupuesto TI {currentYear}, TCO de activos y análisis de gasto</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Presupuesto ' + currentYear, value: fmt(totalBudgeted), color: 'text-[#0B2545]', sub: 'COP' },
          { label: 'Gasto real', value: fmt(totalActual), color: 'text-[#0E9E86]', sub: `${pct}% ejecutado` },
          { label: 'Variación', value: fmt(variance), color: variance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]', sub: variance >= 0 ? '↓ bajo presupuesto' : '↑ sobre presupuesto' },
          { label: 'Ítems', value: String(yearItems.length), color: 'text-[#F59E0B]', sub: 'líneas de presupuesto' },
        ].map(k => (
          <div key={k.label} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
            <p className="text-xs text-[#5B6B7C] mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-[#CBD5E1] mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* By category */}
      {Object.keys(byCategory).length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Gasto por categoría</h2>
          <div className="space-y-3">
            {Object.entries(byCategory).sort((a, b) => b[1].budgeted - a[1].budgeted).map(([cat, data]) => {
              const pctCat = data.budgeted > 0 ? Math.round((data.actual / data.budgeted) * 100) : 0
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.other}`}>{cat}</span>
                    <span className="text-[#5B6B7C]">{fmt(data.actual)} / {fmt(data.budgeted)} ({pctCat}%)</span>
                  </div>
                  <div className="h-1.5 bg-[#E6EBF2] rounded-full">
                    <div className={`h-full rounded-full ${pctCat > 100 ? 'bg-[#EF4444]' : pctCat > 80 ? 'bg-[#F59E0B]' : 'bg-[#00D4AA]'}`}
                      style={{ width: `${Math.min(pctCat, 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add item */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Agregar ítem de presupuesto</h2>
        <form action={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Año fiscal</label>
            <input name="fiscal_year" type="number" defaultValue={currentYear}
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Categoría *</label>
            <select name="category" required defaultValue=""
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]">
              <option value="" disabled>Selecciona...</option>
              {Object.keys(CATEGORY_COLOR).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Departamento</label>
            <input name="department" placeholder="ej: TI, Operaciones"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[#5B6B7C] mb-1">Descripción *</label>
            <input name="description" required placeholder="ej: Renovación licencias Microsoft 365"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Proveedor</label>
            <select name="vendor_id" defaultValue=""
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]">
              <option value="">Sin proveedor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Moneda</label>
            <CurrencySelect />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Presupuestado</label>
            <input name="budgeted_amount" type="number" placeholder="0"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Gasto real</label>
            <input name="actual_amount" type="number" placeholder="0"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div className="flex items-end">
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors">
              <Plus size={14} /> Agregar
            </button>
          </div>
        </form>
      </div>

      {/* Items table */}
      {items.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Año', 'Categoría', 'Descripción', 'Proveedor', 'Presupuesto', 'Real', 'Var.', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => {
                const vendor = vendors.find(v => v.id === item.vendor_id)
                const var_ = item.budgeted_amount - item.actual_amount
                return (
                  <tr key={item.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                    <td className="px-4 py-3 text-xs text-[#5B6B7C]">{item.fiscal_year}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLOR[item.category] ?? CATEGORY_COLOR.other}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#0B2545] max-w-[200px] truncate">{item.description}</td>
                    <td className="px-4 py-3 text-xs text-[#5B6B7C]">{vendor?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#5B6B7C]">{formatMoney(item.budgeted_amount, item.currency)}</td>
                    <td className="px-4 py-3 text-xs text-[#5B6B7C]">{formatMoney(item.actual_amount, item.currency)}</td>
                    <td className={`px-4 py-3 text-xs font-medium flex items-center gap-1 ${var_ >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {var_ >= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                      {fmt(var_)}
                    </td>
                    <td className="px-4 py-3">
                      <form action={handleDelete.bind(null, item.id)}>
                        <button type="submit" className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </form>
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
