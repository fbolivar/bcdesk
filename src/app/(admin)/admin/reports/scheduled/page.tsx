import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { revalidatePath } from 'next/cache'

const TYPE_LABEL: Record<string, string> = {
  tickets_summary: 'Resumen de tickets',
  agent_performance: 'Rendimiento de agentes',
  sla_compliance: 'Cumplimiento SLA',
  client_activity: 'Actividad de clientes',
}
const FREQ_LABEL: Record<string, string> = {
  daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual',
}

export default async function ScheduledReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: reports }, { data: orgs }] = await Promise.all([
    supabase.from('scheduled_reports').select('*').order('created_at', { ascending: false }),
    supabase.from('organizations').select('id, name').eq('status', 'active').order('name'),
  ])

  const list = reports ?? []
  const orgName = new Map((orgs ?? []).map(o => [o.id as string, o.name as string]))

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const recipientsRaw = formData.get('recipients') as string
    const recipients = recipientsRaw.split(',').map(e => e.trim()).filter(Boolean)
    const freq = formData.get('frequency') as string
    const nextSend = new Date()
    if (freq === 'daily') nextSend.setDate(nextSend.getDate() + 1)
    else if (freq === 'weekly') nextSend.setDate(nextSend.getDate() + 7)
    else nextSend.setMonth(nextSend.getMonth() + 1)

    await supabase.from('scheduled_reports').insert({
      name: formData.get('name') as string,
      report_type: formData.get('report_type') as string,
      frequency: freq,
      recipients,
      organization_id: (formData.get('organization_id') as string) || null,
      next_send_at: nextSend.toISOString(),
      created_by: user?.id,
    })
    revalidatePath('/admin/reports/scheduled')
  }

  async function handleToggle(id: string, current: boolean) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('scheduled_reports').update({ is_active: !current }).eq('id', id)
    revalidatePath('/admin/reports/scheduled')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('scheduled_reports').delete().eq('id', id)
    revalidatePath('/admin/reports/scheduled')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Reportes programados</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Envía automáticamente el reporte de gestión completo (PDF adjunto) por correo</p>
      </div>

      {/* Create */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Nuevo reporte</h2>
        <form action={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Nombre *</label>
            <input name="name" required placeholder="ej: Reporte semanal del equipo"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Tipo de reporte</label>
            <select name="report_type"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]">
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Frecuencia</label>
            <select name="frequency" defaultValue="weekly"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]">
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Cliente (opcional)</label>
            <select name="organization_id"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]">
              <option value="">Todos los clientes</option>
              {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Destinatarios (separados por coma)</label>
            <input name="recipients" required placeholder="user@email.com, otro@email.com"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors">
              <Plus size={14} /> Programar reporte
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {list.length > 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Nombre', 'Cliente', 'Frecuencia', 'Destinatarios', 'Próximo envío', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r: any) => (
                <tr key={r.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3 font-medium text-[#0B2545]">{r.name}</td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{r.organization_id ? (orgName.get(r.organization_id) ?? 'Cliente') : 'Todos'}</td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{FREQ_LABEL[r.frequency]}</td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{r.recipients?.length ?? 0} recipiente(s)</td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">
                    {r.next_send_at ? new Date(r.next_send_at).toLocaleDateString('es-CO') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#E6EBF2] text-[#5B6B7C]'}`}>
                      {r.is_active ? 'Activo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <form action={handleToggle.bind(null, r.id, r.is_active)}>
                        <button type="submit" title="Activar/Pausar"
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
          </table></div>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Clock size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Sin reportes programados.</p>
        </div>
      )}
    </div>
  )
}
