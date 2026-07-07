import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Wrench, Plus, Trash2, AlertTriangle } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'bg-[#1789FC]/20 text-[#1789FC]',
  active: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  completed: 'bg-[#10B981]/20 text-[#10B981]',
  cancelled: 'bg-[#E6EBF2] text-[#5B6B7C]',
}

export default async function MaintenancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: windows } = await supabase
    .from('maintenance_windows')
    .select('*')
    .order('start_at', { ascending: false })

  const list = windows ?? []
  const now = new Date()
  const active = list.filter(w => w.status === 'active' || (w.status === 'scheduled' && new Date(w.start_at) <= now && new Date(w.end_at) >= now))

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('maintenance_windows').insert({
      title: formData.get('title') as string,
      description: formData.get('description') as string || null,
      start_at: formData.get('start_at') as string,
      end_at: formData.get('end_at') as string,
      affected_services: formData.get('affected_services') as string || null,
      suppress_alerts: formData.get('suppress_alerts') === 'on',
      created_by: user?.id,
    })
    revalidatePath('/admin/maintenance')
  }

  async function handleUpdateStatus(id: string, status: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('maintenance_windows').update({ status }).eq('id', id)
    revalidatePath('/admin/maintenance')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('maintenance_windows').delete().eq('id', id)
    revalidatePath('/admin/maintenance')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Ventanas de mantenimiento</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Planifica downtimes para que no afecten SLA ni disparen alertas</p>
      </div>

      {active.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl">
          <AlertTriangle size={14} className="text-[#F59E0B] shrink-0" />
          <p className="text-sm text-[#F59E0B]">Mantenimiento activo: {active.map(w => w.title).join(', ')}</p>
        </div>
      )}

      {/* Create */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Programar mantenimiento</h2>
        <form action={handleCreate} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-[#5B6B7C] mb-1">Título *</label>
            <input name="title" required placeholder="ej: Actualización base de datos producción"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Inicio *</label>
            <input name="start_at" type="datetime-local" required
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Fin *</label>
            <input name="end_at" type="datetime-local" required
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Servicios afectados</label>
            <input name="affected_services" placeholder="ej: API, Portal web, Chat"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Descripción</label>
            <input name="description" placeholder="Detalle del mantenimiento"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-[#5B6B7C] cursor-pointer">
              <input type="checkbox" name="suppress_alerts" defaultChecked className="rounded" />
              Suprimir alertas SLA durante este período
            </label>
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Programar
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {list.length > 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Título', 'Inicio', 'Fin', 'Servicios', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((w: any) => (
                <tr key={w.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#0B2545]">{w.title}</p>
                    {w.description && <p className="text-xs text-[#5B6B7C]">{w.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{new Date(w.start_at).toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{new Date(w.end_at).toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{w.affected_services ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[w.status]}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {w.status === 'scheduled' && (
                        <form action={handleUpdateStatus.bind(null, w.id, 'active')}>
                          <button type="submit" className="px-2 py-1 rounded text-xs text-[#F59E0B] border border-[#F59E0B]/30 hover:bg-[#F59E0B]/10 transition-colors">Iniciar</button>
                        </form>
                      )}
                      {w.status === 'active' && (
                        <form action={handleUpdateStatus.bind(null, w.id, 'completed')}>
                          <button type="submit" className="px-2 py-1 rounded text-xs text-[#10B981] border border-[#10B981]/30 hover:bg-[#10B981]/10 transition-colors">Completar</button>
                        </form>
                      )}
                      <form action={handleDelete.bind(null, w.id)}>
                        <button type="submit" className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
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
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Wrench size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Sin ventanas de mantenimiento programadas.</p>
        </div>
      )}
    </div>
  )
}
