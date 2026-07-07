import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowUpCircle, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { revalidatePath } from 'next/cache'

const TIER_LABEL: Record<number, string> = {
  1: 'N1 → N2 (primer nivel)',
  2: 'N2 → N3 (segundo nivel)',
  3: 'N3 → Gerencia',
}

export default async function EscalationRulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: rules } = await supabase
    .from('escalation_rules')
    .select('*')
    .order('tier')
    .order('trigger_after_hours')

  const list = rules ?? []

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const notifyRaw = formData.get('notify_emails') as string
    const notify = notifyRaw ? notifyRaw.split(',').map(e => e.trim()).filter(Boolean) : []
    await supabase.from('escalation_rules').insert({
      name: formData.get('name') as string,
      tier: parseInt(formData.get('tier') as string) || 1,
      trigger_after_hours: parseFloat(formData.get('trigger_after_hours') as string) || 4,
      notify_emails: notify,
      is_active: true,
    })
    revalidatePath('/admin/settings/escalation')
  }

  async function handleToggle(id: string, current: boolean) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('escalation_rules').update({ is_active: !current }).eq('id', id)
    revalidatePath('/admin/settings/escalation')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('escalation_rules').delete().eq('id', id)
    revalidatePath('/admin/settings/escalation')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Reglas de escalación N1→N2→N3</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Configura cuándo y cómo se escalan los tickets automáticamente</p>
      </div>

      {/* Create */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Nueva regla de escalación</h2>
        <form action={handleCreate} className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Nombre *</label>
            <input name="name" required placeholder="ej: Escalación urgente N1→N2"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Nivel de escalación</label>
            <select name="tier"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="1">N1 → N2</option>
              <option value="2">N2 → N3</option>
              <option value="3">N3 → Gerencia</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Disparar después de (horas sin respuesta)</label>
            <input name="trigger_after_hours" type="number" defaultValue="4" min="0.5" step="0.5"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Notificar a (emails, separados por coma)</label>
            <input name="notify_emails" placeholder="supervisor@empresa.com, gerente@empresa.com"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Crear regla
            </button>
          </div>
        </form>
      </div>

      {/* Rules */}
      {[1, 2, 3].map(tier => {
        const tierRules = list.filter((r: any) => r.tier === tier)
        return (
          <div key={tier} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#E6EBF2] flex items-center gap-2 bg-[#EEF2F7]">
              <ArrowUpCircle size={14} className="text-[#F59E0B]" />
              <span className="text-xs font-semibold text-[#5B6B7C]">{TIER_LABEL[tier]}</span>
            </div>
            {tierRules.length === 0 ? (
              <div className="px-4 py-4 text-xs text-[#CBD5E1]">Sin reglas para este nivel</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E6EBF2]">
                    {['Regla', 'Disparar', 'Notificar a', 'Estado', ''].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tierRules.map((r: any) => (
                    <tr key={r.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                      <td className="px-4 py-3 font-medium text-[#0B2545]">{r.name}</td>
                      <td className="px-4 py-3 text-xs text-[#5B6B7C]">+{r.trigger_after_hours}h</td>
                      <td className="px-4 py-3 text-xs text-[#5B6B7C]">{r.notify_emails?.join(', ') || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#E6EBF2] text-[#5B6B7C]'}`}>
                          {r.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <form action={handleToggle.bind(null, r.id, r.is_active)}>
                            <button type="submit"
                              className="p-1.5 rounded text-[#5B6B7C] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors">
                              {r.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                            </button>
                          </form>
                          <form action={handleDelete.bind(null, r.id)}>
                            <button type="submit"
                              className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

      {list.length === 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <ArrowUpCircle size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Sin reglas de escalación configuradas.</p>
        </div>
      )}
    </div>
  )
}
