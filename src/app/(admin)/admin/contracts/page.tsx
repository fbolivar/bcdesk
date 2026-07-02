import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FileSignature, Plus, Trash2, AlertCircle, Zap } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import { generateInvoiceFromContract } from '@/features/admin/services/auto-invoice.service'

const TIER_COLOR: Record<string, string> = {
  standard: 'bg-[#334155] text-[#94A3B8]',
  premium: 'bg-[#3B82F6]/20 text-[#3B82F6]',
  enterprise: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
}
const STATUS_COLOR: Record<string, string> = {
  active: 'bg-[#10B981]/20 text-[#10B981]',
  expired: 'bg-[#EF4444]/20 text-[#EF4444]',
  suspended: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  cancelled: 'bg-[#334155] text-[#64748B]',
}

export default async function ContractsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin','agent'].includes(profile.role)) redirect('/dashboard')

  const { data: contracts } = await supabase
    .from('service_contracts')
    .select('*, organizations(name), sla_policies(name)')
    .order('end_date')

  const { data: orgs } = await supabase.from('organizations').select('id, name').eq('is_active', true)
  const { data: slaList } = await supabase.from('sla_policies').select('id, name').eq('is_active', true)

  const list = contracts ?? []
  const today = new Date()
  const expiringSoon = list.filter(c => {
    const end = new Date(c.end_date)
    const days = (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return c.status === 'active' && days <= 30 && days > 0
  })

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('service_contracts').insert({
      name: formData.get('name') as string,
      organization_id: formData.get('organization_id') as string,
      contract_type: formData.get('contract_type') as string || 'support',
      support_tier: formData.get('support_tier') as string || 'standard',
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      included_hours: parseFloat(formData.get('included_hours') as string) || 0,
      sla_policy_id: formData.get('sla_policy_id') as string || null,
      notes: formData.get('notes') as string || null,
      auto_renew: formData.get('auto_renew') === 'on',
    })
    revalidatePath('/admin/contracts')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('service_contracts').delete().eq('id', id)
    revalidatePath('/admin/contracts')
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Contratos de servicio</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">SLAs y acuerdos por organización</p>
      </div>

      {expiringSoon.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl">
          <AlertCircle size={16} className="text-[#F59E0B] shrink-0 mt-0.5" />
          <p className="text-sm text-[#F59E0B]">
            {expiringSoon.length} contrato{expiringSoon.length > 1 ? 's' : ''} vence{expiringSoon.length === 1 ? '' : 'n'} en los próximos 30 días:
            {' '}{expiringSoon.map(c => {
              const org = Array.isArray(c.organizations) ? c.organizations[0] : c.organizations
              return org?.name ?? c.name
            }).join(', ')}
          </p>
        </div>
      )}

      {/* Create */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4">Nuevo contrato</h2>
        <form action={handleCreate} className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Nombre *</label>
            <input name="name" required placeholder="ej: Contrato Anual 2026"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Organización *</label>
            <select name="organization_id" required
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="">Selecciona...</option>
              {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Tipo</label>
            <select name="contract_type"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="support">Soporte</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="managed">Managed Services</option>
              <option value="project">Proyecto</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Nivel de soporte</label>
            <select name="support_tier"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="standard">Estándar</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Inicio *</label>
            <input name="start_date" type="date" required
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Vencimiento *</label>
            <input name="end_date" type="date" required
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Horas incluidas</label>
            <input name="included_hours" type="number" defaultValue="0" min="0"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Política SLA</label>
            <select name="sla_policy_id"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="">Sin SLA específico</option>
              {(slaList ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm text-[#94A3B8] cursor-pointer">
              <input name="auto_renew" type="checkbox" className="rounded" />
              Auto-renovar
            </label>
          </div>
          <div className="col-span-3">
            <label className="block text-xs text-[#94A3B8] mb-1">Notas</label>
            <input name="notes" placeholder="Observaciones del contrato"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div className="col-span-3 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Crear contrato
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {list.length > 0 ? (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                {['Contrato', 'Organización', 'Nivel', 'Estado', 'Vigencia', 'Horas', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((c: any) => {
                const org = Array.isArray(c.organizations) ? c.organizations[0] : c.organizations
                const end = new Date(c.end_date)
                const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <tr key={c.id} className="border-b border-[#334155]/50 hover:bg-[#263248]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#F1F5F9]">{c.name}</p>
                      <p className="text-xs text-[#64748B]">{c.contract_type}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#94A3B8]">{org?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLOR[c.support_tier]}`}>
                        {c.support_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="text-[#94A3B8]">{new Date(c.start_date).toLocaleDateString('es-CO')} – {new Date(c.end_date).toLocaleDateString('es-CO')}</p>
                      {c.status === 'active' && daysLeft > 0 && daysLeft <= 30 && (
                        <p className="text-[#F59E0B]">Vence en {daysLeft}d</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">
                      {c.used_hours}/{c.included_hours}h
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <form action={async () => { 'use server'; await generateInvoiceFromContract(c.id) }}>
                          <button type="submit" title="Generar factura desde horas"
                            className="p-1.5 rounded text-[#64748B] hover:text-[#10B981] hover:bg-[#10B981]/10 transition-colors">
                            <Zap size={14} />
                          </button>
                        </form>
                        <form action={handleDelete.bind(null, c.id)}>
                          <button type="submit"
                            className="p-1.5 rounded text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-12 text-center">
          <FileSignature size={32} className="text-[#334155] mx-auto mb-3" />
          <p className="text-[#64748B] text-sm">Sin contratos registrados.</p>
        </div>
      )}
    </div>
  )
}
