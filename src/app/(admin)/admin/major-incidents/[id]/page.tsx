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
    // La FK real es incident_id (antes se filtraba por major_incident_id, que no
    // existe: la consulta fallaba y la línea de tiempo salía siempre vacía).
    supabase.from('major_incident_updates')
      .select('*, profiles:posted_by(full_name)')
      .eq('incident_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('major_incident_tickets')
      .select('*, tickets(id, title, status, priority)')
      .eq('incident_id', id),
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

  // Un Server Action es un endpoint HTTP: la guarda de rol de arriba solo corre
  // al renderizar, así que cada acción revalida por su cuenta.
  async function requireAdminHere() {
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (me?.role !== 'admin') throw new Error('Sin permiso')
    return { supabase, user }
  }

  async function handleAddUpdate(formData: FormData) {
    'use server'
    const { supabase, user } = await requireAdminHere()

    // La tabla modela cada actualización como status + message (ambos NOT NULL).
    // Antes se insertaba major_incident_id/update_text/author_id/update_type,
    // columnas inexistentes, y sin status ni message: el insert fallaba siempre
    // y el error se ignoraba, así que publicar no hacía absolutamente nada.
    const message = (formData.get('message') as string ?? '').trim()
    if (!message) throw new Error('El mensaje es obligatorio.')
    const newStatus = (formData.get('new_status') as string) || incident.status

    const { error } = await supabase.from('major_incident_updates').insert({
      incident_id: id,
      status: newStatus,
      message,
      posted_by: user.id,
      notify_stakeholders: formData.get('notify_stakeholders') === 'on',
    })
    if (error) throw new Error('No se pudo publicar la actualización.')

    if (newStatus !== incident.status) {
      const { error: stErr } = await supabase.from('major_incidents').update({
        status: newStatus,
        ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
      }).eq('id', id)
      if (stErr) throw new Error('La actualización se publicó, pero no se pudo cambiar el estado.')
    }
    revalidatePath(`/admin/major-incidents/${id}`)
  }

  async function handleLinkTicket(ticketId: string) {
    'use server'
    const { supabase } = await requireAdminHere()
    const { error } = await supabase.from('major_incident_tickets').insert({
      incident_id: id,
      ticket_id: ticketId,
    })
    if (error) throw new Error('No se pudo vincular el ticket.')
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
          <h1 className="text-xl font-semibold text-[#0B2545]">{incident.title}</h1>
          {incident.description && <p className="text-sm text-[#5B6B7C] mt-1">{incident.description}</p>}
        </div>
        <div className="text-right text-xs text-[#5B6B7C]">
          <p>Comandante: <span className="text-[#5B6B7C]">{commander?.full_name || commander?.email || '—'}</span></p>
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
                  ${idx <= currentStep ? 'bg-[#00D4AA] border-[#00D4AA] text-white' : 'bg-[#F4F7FB] border-[#E6EBF2] text-[#CBD5E1]'}`}>
                  {idx < currentStep ? <CheckCircle2 size={14} /> : idx + 1}
                </div>
                <p className="text-xs text-[#5B6B7C] mt-1">{STATUS_LABEL[s]}</p>
              </div>
              {idx < STATUS_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${idx < currentStep ? 'bg-[#00D4AA]' : 'bg-[#E6EBF2]'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Post update */}
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Publicar actualización</h2>
          <form action={handleAddUpdate} className="space-y-3">
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Mensaje *</label>
              <textarea name="message" required rows={4} placeholder="Describe qué está pasando, qué se está haciendo..."
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1] resize-none" />
            </div>
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Estado tras esta actualización</label>
              <select name="new_status" defaultValue={incident.status}
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]">
                {STATUS_STEPS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#5B6B7C]">
              <input type="checkbox" name="notify_stakeholders" className="accent-[#00D4AA]" />
              Marcar para notificar a los interesados
            </label>
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors">
              <Plus size={14} /> Publicar
            </button>
          </form>
        </div>

        {/* Link tickets */}
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Vincular tickets afectados</h2>
          {availableTickets.length > 0 ? (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {availableTickets.map(t => (
                <form key={t.id} action={handleLinkTicket.bind(null, t.id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#EEF2F7] group">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#0B2545] truncate">{t.title}</p>
                    <p className="text-[10px] text-[#CBD5E1]">{t.status} · {t.priority}</p>
                  </div>
                  <button type="submit"
                    className="text-xs text-[#5B6B7C] group-hover:text-[#0E9E86] transition-colors opacity-0 group-hover:opacity-100">
                    + vincular
                  </button>
                </form>
              ))}
            </div>
          ) : <p className="text-xs text-[#CBD5E1]">No hay tickets disponibles para vincular.</p>}

          {linkedTicketsRes.data && linkedTicketsRes.data.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-[#5B6B7C] mb-2">VINCULADOS ({linkedTicketsRes.data.length})</p>
              <div className="space-y-1">
                {(linkedTicketsRes.data as any[]).map(lt => (
                  <div key={lt.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#F4F7FB]">
                    <span className="text-xs text-[#5B6B7C] truncate">{lt.tickets?.title}</span>
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
          <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Timeline del incidente</h2>
          <div className="space-y-4">
            {updates.map((u: any) => {
              const author = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles
              return (
                // La tabla guarda status + message: el color y la etiqueta salen
                // del estado en que quedó el incidente con esa actualización.
                <div key={u.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${
                      u.status === 'resolved' ? 'bg-[#10B981]' :
                      u.status === 'mitigated' ? 'bg-[#F59E0B]' :
                      u.status === 'closed' ? 'bg-[#8B5CF6]' : 'bg-[#00D4AA]'
                    }`} />
                    <div className="flex-1 w-px bg-[#E6EBF2] mt-1" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium text-[#5B6B7C]">{author?.full_name || 'Sistema'}</span>
                      <span className="text-[10px] text-[#CBD5E1]">{new Date(u.created_at).toLocaleString('es-CO')}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        u.status === 'resolved' ? 'bg-[#10B981]/20 text-[#10B981]' :
                        u.status === 'mitigated' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                        u.status === 'closed' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]' : 'bg-[#00D4AA]/20 text-[#0E9E86]'
                      }`}>{STATUS_LABEL[u.status] ?? u.status}</span>
                      {u.notify_stakeholders && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#E6EBF2] text-[#5B6B7C]">
                          Notificar interesados
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#0B2545]">{u.message}</p>
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
