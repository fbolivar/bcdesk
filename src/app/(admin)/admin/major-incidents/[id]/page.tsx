import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Siren, Clock, Plus, CheckCircle2, AlertTriangle, Search } from 'lucide-react'

const STATUS_STEPS = ['investigating', 'identified', 'monitoring', 'resolved']
const STATUS_LABEL: Record<string, string> = {
  investigating: 'Investigando',
  identified: 'Identificado',
  monitoring: 'Monitoreando',
  resolved: 'Resuelto',
}

export default async function MajorIncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agent'].includes(profile.role)) redirect('/dashboard')

  const { data: incident } = await supabase
    .from('major_incidents')
    .select('*, profiles!major_incidents_incident_commander_id_fkey(full_name, email)')
    .eq('id', id)
    .single()
  if (!incident) redirect('/admin/major-incidents')

  const [updatesRes, linkedTicketsRes, availableTicketsRes] = await Promise.all([
    supabase.from('major_incident_updates')
      .select('*, profiles(full_name)')
      .eq('major_incident_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('major_incident_tickets')
      .select('*, tickets(id, title, status, priority)')
      .eq('major_incident_id', id),
    supabase.from('tickets')
      .select('id, title, status, priority')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const updates = updatesRes.data ?? []
  const linkedTicketIds = new Set((linkedTicketsRes.data ?? []).map((lt: any) => lt.ticket_id))
  const availableTickets = (availableTicketsRes.data ?? []).filter(t => !linkedTicketIds.has(t.id))

  const commander = Array.isArray(incident.profiles) ? incident.profiles[0] : incident.profiles

  async function handleAddUpdate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const newStatus = formData.get('new_status') as string
    await supabase.from('major_incident_updates').insert({
      major_incident_id: id,
      update_text: formData.get('update_text') as string,
      author_id: user?.id,
      update_type: formData.get('update_type') as string || 'update',
    })
    if (newStatus && newStatus !== incident.status) {
      await supabase.from('major_incidents').update({
        status: newStatus,
        ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
      }).eq('id', id)
    }
    revalidatePath(`/admin/major-incidents/${id}`)
  }

  async function handleLinkTicket(ticketId: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('major_incident_tickets').insert({
      major_incident_id: id,
      ticket_id: ticketId,
    })
    revalidatePath(`/admin/major-incidents/${id}`)
  }

  const currentStep = STATUS_STEPS.indexOf(incident.status)
  const duration = incident.resolved_at
    ? Math.round((new Date(incident.resolved_at).getTime() - new Date(incident.created_at).getTime()) / 60000)
    : Math.round((new Date().getTime() - new Date(incident.created_at).getTime()) / 60000)

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Siren size={16} className={`${incident.status !== 'resolved' ? 'text-[#EF4444] animate-pulse' : 'text-[#10B981]'}`} />
            <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-[#EF4444] text-white">{incident.severity}</span>
          </div>
          <h1 className="text-xl font-semibold text-[#1E293B]">{incident.title}</h1>
          {incident.description && <p className="text-sm text-[#64748B] mt-1">{incident.description}</p>}
        </div>
        <div className="text-right text-xs text-[#64748B]">
          <p>Comandante: <span className="text-[#64748B]">{commander?.full_name || commander?.email || '—'}</span></p>
          <p className="flex items-center gap-1 justify-end mt-1">
            <Clock size={11} /> {incident.status !== 'resolved' ? `${duration}m activo` : `Resuelto en ${duration}m`}
          </p>
        </div>
      </div>

      {/* Status timeline */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <div className="flex items-center justify-between">
          {STATUS_STEPS.map((s, idx) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex flex-col items-center ${idx < STATUS_STEPS.length - 1 ? 'flex-1' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2
                  ${idx <= currentStep ? 'bg-[#3B82F6] border-[#3B82F6] text-white' : 'bg-[#F4F7FB] border-[#E6EBF2] text-[#CBD5E1]'}`}>
                  {idx < currentStep ? <CheckCircle2 size={14} /> : idx + 1}
                </div>
                <p className="text-xs text-[#64748B] mt-1">{STATUS_LABEL[s]}</p>
              </div>
              {idx < STATUS_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${idx < currentStep ? 'bg-[#3B82F6]' : 'bg-[#E6EBF2]'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Post update */}
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#1E293B] mb-4">Publicar actualización</h2>
          <form action={handleAddUpdate} className="space-y-3">
            <div>
              <label className="block text-xs text-[#64748B] mb-1">Tipo</label>
              <select name="update_type" defaultValue="update"
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6]">
                <option value="update">Actualización</option>
                <option value="workaround">Workaround</option>
                <option value="resolution">Resolución</option>
                <option value="postmortem">Post-mortem</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#64748B] mb-1">Mensaje *</label>
              <textarea name="update_text" required rows={4} placeholder="Describe qué está pasando, qué se está haciendo..."
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#CBD5E1] resize-none" />
            </div>
            <div>
              <label className="block text-xs text-[#64748B] mb-1">Cambiar estado</label>
              <select name="new_status" defaultValue={incident.status}
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6]">
                {STATUS_STEPS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Publicar
            </button>
          </form>
        </div>

        {/* Link tickets */}
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#1E293B] mb-4">Vincular tickets afectados</h2>
          {availableTickets.length > 0 ? (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {availableTickets.map(t => (
                <form key={t.id} action={handleLinkTicket.bind(null, t.id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#EEF2F7] group">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#1E293B] truncate">{t.title}</p>
                    <p className="text-[10px] text-[#CBD5E1]">{t.status} · {t.priority}</p>
                  </div>
                  <button type="submit"
                    className="text-xs text-[#64748B] group-hover:text-[#3B82F6] transition-colors opacity-0 group-hover:opacity-100">
                    + vincular
                  </button>
                </form>
              ))}
            </div>
          ) : <p className="text-xs text-[#CBD5E1]">No hay tickets disponibles para vincular.</p>}

          {linkedTicketsRes.data && linkedTicketsRes.data.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-[#64748B] mb-2">VINCULADOS ({linkedTicketsRes.data.length})</p>
              <div className="space-y-1">
                {(linkedTicketsRes.data as any[]).map(lt => (
                  <div key={lt.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#F4F7FB]">
                    <span className="text-xs text-[#64748B] truncate">{lt.tickets?.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      {updates.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#1E293B] mb-4">Timeline del incidente</h2>
          <div className="space-y-4">
            {updates.map((u: any) => {
              const author = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles
              return (
                <div key={u.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${
                      u.update_type === 'resolution' ? 'bg-[#10B981]' :
                      u.update_type === 'workaround' ? 'bg-[#F59E0B]' :
                      u.update_type === 'postmortem' ? 'bg-[#8B5CF6]' : 'bg-[#3B82F6]'
                    }`} />
                    <div className="flex-1 w-px bg-[#E6EBF2] mt-1" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-[#64748B]">{author?.full_name || 'Sistema'}</span>
                      <span className="text-[10px] text-[#CBD5E1]">{new Date(u.created_at).toLocaleString('es-CO')}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        u.update_type === 'resolution' ? 'bg-[#10B981]/20 text-[#10B981]' :
                        u.update_type === 'workaround' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                        u.update_type === 'postmortem' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]' : 'bg-[#3B82F6]/20 text-[#3B82F6]'
                      }`}>{u.update_type}</span>
                    </div>
                    <p className="text-sm text-[#1E293B]">{u.update_text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
