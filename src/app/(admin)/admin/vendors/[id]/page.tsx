import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/format/currency'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, AlertTriangle } from 'lucide-react'

const TYPE_COLOR: Record<string, string> = {
  support: 'bg-[#1789FC]/20 text-[#1789FC]',
  saas: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
  hardware: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  consulting: 'bg-[#06B6D4]/20 text-[#06B6D4]',
  maintenance: 'bg-[#10B981]/20 text-[#10B981]',
  other: 'bg-[#E6EBF2] text-[#5B6B7C]',
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: vendor } = await supabase.from('vendors').select('*').eq('id', id).single()
  if (!vendor) redirect('/admin/vendors')

  const { data: contracts } = await supabase
    .from('vendor_contracts')
    .select('*')
    .eq('vendor_id', id)
    .order('created_at', { ascending: false })

  const list = contracts ?? []
  const today = new Date()
  const expiringSoon = list.filter(c => {
    if (!c.end_date) return false
    const exp = new Date(c.end_date)
    const days = (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return days <= 30 && days > 0
  })

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('vendor_contracts').insert({
      vendor_id: id,
      title: formData.get('title') as string,
      contract_type: formData.get('contract_type') as string || 'support',
      start_date: formData.get('start_date') as string || null,
      end_date: formData.get('end_date') as string || null,
      cost: parseFloat(formData.get('cost') as string) || null,
      currency: formData.get('currency') as string || 'COP',
      sla_response_hours: parseInt(formData.get('sla_response_hours') as string) || null,
      sla_resolution_hours: parseInt(formData.get('sla_resolution_hours') as string) || null,
      auto_renew: formData.get('auto_renew') === 'on',
    })
    revalidatePath(`/admin/vendors/${id}`)
  }

  async function handleDelete(contractId: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('vendor_contracts').update({ is_active: false }).eq('id', contractId)
    revalidatePath(`/admin/vendors/${id}`)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/vendors" className="text-[#5B6B7C] hover:text-[#0B2545] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">{vendor.name}</h1>
          <p className="text-sm text-[#5B6B7C]">{vendor.contact_name} · {vendor.contact_email}</p>
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl">
          <AlertTriangle size={14} className="text-[#F59E0B] shrink-0" />
          <p className="text-sm text-[#F59E0B]">{expiringSoon.length} contrato(s) vencen en 30 días</p>
        </div>
      )}

      {/* Add contract */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Nuevo contrato</h2>
        <form action={handleCreate} className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-[#5B6B7C] mb-1">Título *</label>
            <input name="title" required placeholder="ej: Soporte Microsoft 365 Enterprise"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Tipo</label>
            <select name="contract_type" defaultValue="support"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="support">Soporte</option>
              <option value="saas">SaaS</option>
              <option value="hardware">Hardware</option>
              <option value="consulting">Consultoría</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Inicio</label>
            <input name="start_date" type="date"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Vencimiento</label>
            <input name="end_date" type="date"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Costo anual</label>
            <input name="cost" type="number" placeholder="0"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">SLA Respuesta (h)</label>
            <input name="sla_response_hours" type="number" placeholder="4"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">SLA Resolución (h)</label>
            <input name="sla_resolution_hours" type="number" placeholder="24"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-xs text-[#5B6B7C] cursor-pointer pb-2">
              <input type="checkbox" name="auto_renew" className="rounded" />
              Auto-renovar
            </label>
            <button type="submit"
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Agregar
            </button>
          </div>
        </form>
      </div>

      {/* Contracts list */}
      {list.length > 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Contrato', 'Tipo', 'Vigencia', 'Costo', 'SLA', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((c: any) => {
                const exp = c.end_date ? new Date(c.end_date) : null
                const isExpired = exp && exp < today
                const days = exp ? Math.ceil((exp.getTime() - today.getTime()) / 86400000) : null
                return (
                  <tr key={c.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#0B2545]">{c.title}</p>
                      {c.auto_renew && <p className="text-xs text-[#10B981]">↻ auto-renovar</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[c.contract_type]}`}>
                        {c.contract_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {exp ? (
                        <span className={isExpired ? 'text-[#EF4444]' : days! <= 30 ? 'text-[#F59E0B]' : 'text-[#5B6B7C]'}>
                          {exp.toLocaleDateString('es-CO')}
                          {isExpired ? ' ⚠️' : days! <= 30 ? ` (${days}d)` : ''}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5B6B7C]">
                      {c.cost ? formatMoney(c.cost, c.currency) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5B6B7C]">
                      {c.sla_response_hours ? `R: ${c.sla_response_hours}h` : ''}
                      {c.sla_resolution_hours ? ` / Sol: ${c.sla_resolution_hours}h` : ''}
                      {!c.sla_response_hours && !c.sla_resolution_hours ? '—' : ''}
                    </td>
                    <td className="px-4 py-3">
                      <form action={handleDelete.bind(null, c.id)}>
                        <button type="submit" className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-8 text-center">
          <p className="text-[#5B6B7C] text-sm">Sin contratos para este proveedor.</p>
        </div>
      )}
    </div>
  )
}
