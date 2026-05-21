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

  const { data: reports } = await supabase
    .from('scheduled_reports')
    .select('*')
    .order('created_at', { ascending: false })

  const list = reports ?? []

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
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Reportes programados</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">Envía reportes automáticamente por correo electrónico</p>
      </div>

      {/* Create */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4">Nuevo reporte</h2>
        <form action={handleCreate} className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Nombre *</label>
            <input name="name" required placeholder="ej: Reporte semanal del equipo"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Tipo de reporte</label>
            <select name="report_type"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Frecuencia</label>
            <select name="frequency" defaultValue="weekly"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Destinatarios (separados por coma)</label>
            <input name="recipients" required placeholder="user@email.com, otro@email.com"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Programar reporte
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
                {['Nombre', 'Tipo', 'Frecuencia', 'Destinatarios', 'Próximo envío', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r: any) => (
                <tr key={r.id} className="border-b border-[#334155]/50 hover:bg-[#263248]">
                  <td className="px-4 py-3 font-medium text-[#F1F5F9]">{r.name}</td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{TYPE_LABEL[r.report_type]}</td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{FREQ_LABEL[r.frequency]}</td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{r.recipients?.length ?? 0} recipiente(s)</td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">
                    {r.next_send_at ? new Date(r.next_send_at).toLocaleDateString('es-CO') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#334155] text-[#64748B]'}`}>
                      {r.is_active ? 'Activo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <form action={handleToggle.bind(null, r.id, r.is_active)}>
                        <button type="submit" title="Activar/Pausar"
                          className="p-1.5 rounded text-[#64748B] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors">
                          {r.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                      </form>
                      <form action={handleDelete.bind(null, r.id)}>
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
          <p className="text-[#64748B] text-sm">Sin reportes programados.</p>
        </div>
      )}
    </div>
  )
}
