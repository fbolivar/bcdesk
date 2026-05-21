import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { revalidatePath } from 'next/cache'

export default async function SlaPoliciesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: policies } = await supabase
    .from('sla_policies')
    .select('*')
    .order('priority')

  const { data: orgs } = await supabase.from('organizations').select('id, name').eq('is_active', true)

  const list = policies ?? []

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('sla_policies').insert({
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      priority: formData.get('priority') as string || null,
      organization_id: formData.get('organization_id') as string || null,
      response_time_minutes: parseInt(formData.get('response_hours') as string) * 60 || 240,
      resolution_time_minutes: parseInt(formData.get('resolution_hours') as string) * 60 || 1440,
      escalate_after_minutes: parseInt(formData.get('escalate_hours') as string) * 60 || 480,
      is_active: true,
    })
    revalidatePath('/admin/settings/sla-policies')
  }

  async function handleToggle(id: string, current: boolean) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('sla_policies').update({ is_active: !current }).eq('id', id)
    revalidatePath('/admin/settings/sla-policies')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('sla_policies').delete().eq('id', id)
    revalidatePath('/admin/settings/sla-policies')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Políticas SLA multinivel</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">Define SLAs por prioridad, organización o contrato</p>
      </div>

      {/* Create */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4">Nueva política SLA</h2>
        <form action={handleCreate} className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Nombre *</label>
            <input name="name" required placeholder="ej: Premium - Urgente"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Prioridad (opcional)</label>
            <select name="priority"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="">Cualquiera</option>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Organización (opcional)</label>
            <select name="organization_id"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="">General</option>
              {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Tiempo de respuesta (horas)</label>
            <input name="response_hours" type="number" defaultValue="4" min="0.5" step="0.5"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Tiempo de resolución (horas)</label>
            <input name="resolution_hours" type="number" defaultValue="24" min="1"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Escalar después de (horas)</label>
            <input name="escalate_hours" type="number" defaultValue="8" min="1"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Descripción</label>
            <input name="description" placeholder="Notas adicionales"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div className="col-span-3 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Crear política
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
                {['Política', 'Prioridad', 'Org', 'Respuesta', 'Resolución', 'Escalar', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p: any) => (
                <tr key={p.id} className="border-b border-[#334155]/50 hover:bg-[#263248]">
                  <td className="px-4 py-3 font-medium text-[#F1F5F9]">{p.name}</td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{p.priority ?? 'Cualquiera'}</td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">
                    {(orgs ?? []).find(o => o.id === p.organization_id)?.name ?? 'General'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">
                    <span className="flex items-center gap-1"><Clock size={10} /> {Math.round(p.response_time_minutes / 60)}h</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{Math.round(p.resolution_time_minutes / 60)}h</td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{Math.round(p.escalate_after_minutes / 60)}h</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#334155] text-[#64748B]'}`}>
                      {p.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <form action={handleToggle.bind(null, p.id, p.is_active)}>
                        <button type="submit"
                          className="p-1.5 rounded text-[#64748B] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors">
                          {p.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                      </form>
                      <form action={handleDelete.bind(null, p.id)}>
                        <button type="submit"
                          className="p-1.5 rounded text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-12 text-center">
          <Clock size={32} className="text-[#334155] mx-auto mb-3" />
          <p className="text-[#64748B] text-sm">Sin políticas SLA. Crea la primera arriba.</p>
        </div>
      )}
    </div>
  )
}
