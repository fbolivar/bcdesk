import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Key, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { CurrencySelect } from '@/shared/components/currency-select'

const TYPE_LABEL: Record<string, string> = {
  perpetual: 'Perpetua', subscription: 'Suscripción', concurrent: 'Concurrente',
  per_user: 'Por usuario', per_device: 'Por dispositivo', trial: 'Trial',
}

export default async function LicensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin','agent'].includes(profile.role)) redirect('/dashboard')

  const { data: licenses } = await supabase
    .from('software_licenses')
    .select('*, organizations(name)')
    .eq('is_active', true)
    .order('expiry_date', { nullsFirst: false })

  const { data: orgs } = await supabase.from('organizations').select('id, name').eq('status', 'active')

  const list = licenses ?? []
  const today = new Date()
  const expiringSoon = list.filter(l => {
    if (!l.expiry_date) return false
    const exp = new Date(l.expiry_date)
    const days = (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return days <= 30 && days > 0
  })
  const expired = list.filter(l => l.expiry_date && new Date(l.expiry_date) < today)

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('software_licenses').insert({
      software_name: formData.get('software_name') as string,
      vendor: formData.get('vendor') as string || null,
      license_type: formData.get('license_type') as string || 'subscription',
      seats_total: parseInt(formData.get('seats_total') as string) || 1,
      seats_used: parseInt(formData.get('seats_used') as string) || 0,
      expiry_date: formData.get('expiry_date') as string || null,
      cost: parseFloat(formData.get('cost') as string) || null,
      currency: formData.get('currency') as string || 'COP',
      organization_id: formData.get('organization_id') as string || null,
      notes: formData.get('notes') as string || null,
    })
    revalidatePath('/admin/licenses')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('software_licenses').update({ is_active: false }).eq('id', id)
    revalidatePath('/admin/licenses')
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Gestión de licencias de software</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Seguimiento de licencias, vencimientos y cumplimiento</p>
      </div>

      {/* Alerts */}
      {(expiringSoon.length > 0 || expired.length > 0) && (
        <div className="space-y-2">
          {expired.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl">
              <AlertTriangle size={14} className="text-[#EF4444] shrink-0" />
              <p className="text-sm text-[#EF4444]">{expired.length} licencia(s) vencida(s): {expired.map(l => l.software_name).join(', ')}</p>
            </div>
          )}
          {expiringSoon.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl">
              <AlertTriangle size={14} className="text-[#F59E0B] shrink-0" />
              <p className="text-sm text-[#F59E0B]">{expiringSoon.length} licencia(s) vencen en 30 días: {expiringSoon.map(l => l.software_name).join(', ')}</p>
            </div>
          )}
        </div>
      )}

      {/* Create */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Registrar licencia</h2>
        <form action={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Software *</label>
            <input name="software_name" required placeholder="ej: Microsoft 365"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Fabricante</label>
            <input name="vendor" placeholder="ej: Microsoft"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Tipo</label>
            <select name="license_type" defaultValue="subscription"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Asientos totales</label>
            <input name="seats_total" type="number" defaultValue="1" min="1"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Asientos usados</label>
            <input name="seats_used" type="number" defaultValue="0" min="0"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Vencimiento</label>
            <input name="expiry_date" type="date"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Costo</label>
            <input name="cost" type="number" placeholder="0"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Moneda</label>
            <CurrencySelect />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Organización</label>
            <select name="organization_id"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="">General</option>
              {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Registrar
            </button>
          </div>
        </form>
      </div>

      {/* License list */}
      {list.length > 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Software', 'Tipo', 'Organización', 'Asientos', 'Vencimiento', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((l: any) => {
                const org = Array.isArray(l.organizations) ? l.organizations[0] : l.organizations
                const exp = l.expiry_date ? new Date(l.expiry_date) : null
                const isExpired = exp && exp < today
                const days = exp ? Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null
                const usagePct = l.seats_total > 0 ? Math.round((l.seats_used / l.seats_total) * 100) : 0
                return (
                  <tr key={l.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#0B2545]">{l.software_name}</p>
                      {l.vendor && <p className="text-xs text-[#5B6B7C]">{l.vendor}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5B6B7C]">{TYPE_LABEL[l.license_type]}</td>
                    <td className="px-4 py-3 text-xs text-[#5B6B7C]">{org?.name ?? 'General'}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs text-[#5B6B7C]">{l.seats_used}/{l.seats_total}</p>
                        <div className="h-1 bg-[#E6EBF2] rounded-full mt-1 w-16">
                          <div className={`h-full rounded-full ${usagePct > 90 ? 'bg-[#EF4444]' : usagePct > 70 ? 'bg-[#F59E0B]' : 'bg-[#10B981]'}`}
                            style={{ width: `${usagePct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {exp ? (
                        <span className={isExpired ? 'text-[#EF4444]' : days && days <= 30 ? 'text-[#F59E0B]' : 'text-[#5B6B7C]'}>
                          {exp.toLocaleDateString('es-CO')}
                          {isExpired ? ' ⚠️' : days && days <= 30 ? ` (${days}d)` : ''}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isExpired ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'bg-[#10B981]/20 text-[#10B981]'}`}>
                        {isExpired ? 'Vencida' : 'Activa'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <form action={handleDelete.bind(null, l.id)}>
                        <button type="submit"
                          className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
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
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Key size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Sin licencias registradas.</p>
        </div>
      )}
    </div>
  )
}
