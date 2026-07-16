import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Star, Plus, Trash2, BarChart2 } from 'lucide-react'

export default async function SurveysPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: surveys } = await supabase
    .from('surveys')
    .select('*, survey_responses(count)')
    .order('created_at', { ascending: false })

  const list = surveys ?? []

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    // La columna obligatoria es `name`, no `title`: se insertaba title (que no
    // existe) y sin name, así que el insert fallaba siempre y crear una encuesta
    // no hacía nada.
    const { error } = await supabase.from('surveys').insert({
      name: formData.get('title') as string,
      survey_type: formData.get('survey_type') as string || 'nps',
      description: formData.get('description') as string || null,
      trigger_event: formData.get('trigger_event') as string || 'ticket.resolved',
      is_active: true,
      created_by: user.id,
    })
    if (error) throw new Error('No se pudo crear la encuesta.')
    revalidatePath('/admin/surveys')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('surveys').delete().eq('id', id)
    revalidatePath('/admin/surveys')
  }

  async function handleToggle(id: string, current: boolean) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('surveys').update({ is_active: !current }).eq('id', id)
    revalidatePath('/admin/surveys')
  }

  // NPS aggregation
  const npsData: Record<string, { promoters: number; passives: number; detractors: number; total: number }> = {}
  for (const s of list) {
    if (s.survey_type === 'nps') {
      const { data: responses } = await supabase
        .from('survey_responses')
        .select('score')
        .eq('survey_id', s.id)
      const rs = responses ?? []
      const promoters = rs.filter(r => r.score >= 9).length
      const passives = rs.filter(r => r.score >= 7 && r.score < 9).length
      const detractors = rs.filter(r => r.score < 7).length
      npsData[s.id] = { promoters, passives, detractors, total: rs.length }
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Encuestas NPS / CSAT</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Mide satisfacción y Net Promoter Score automáticamente</p>
      </div>

      {/* Create */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Nueva encuesta</h2>
        <form action={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Título *</label>
            <input name="title" required placeholder="ej: NPS post-resolución"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Tipo</label>
            <select name="survey_type" defaultValue="nps"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]">
              <option value="nps">NPS (0-10)</option>
              <option value="csat">CSAT (1-5)</option>
              <option value="ces">CES (Esfuerzo)</option>
              <option value="custom">Personalizada</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Evento disparador</label>
            <select name="trigger_event" defaultValue="ticket.resolved"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]">
              <option value="ticket.resolved">Ticket resuelto</option>
              <option value="ticket.closed">Ticket cerrado</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Descripción</label>
            <input name="description" placeholder="Descripción opcional"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors">
              <Plus size={14} /> Crear encuesta
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {list.length > 0 ? (
        <div className="space-y-4">
          {list.map((s: any) => {
            const count = s.survey_responses?.[0]?.count ?? 0
            const nps = npsData[s.id]
            const npsScore = nps && nps.total > 0
              ? Math.round(((nps.promoters - nps.detractors) / nps.total) * 100)
              : null
            return (
              <div key={s.id} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#0B2545]">{s.name}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#00D4AA]/20 text-[#0E9E86]">
                        {s.survey_type.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#E6EBF2] text-[#5B6B7C]'}`}>
                        {s.is_active ? 'Activa' : 'Pausada'}
                      </span>
                    </div>
                    {s.description && <p className="text-sm text-[#5B6B7C] mt-1">{s.description}</p>}
                    <p className="text-xs text-[#CBD5E1] mt-1">Trigger: {s.trigger_event} · {count} respuestas</p>
                  </div>
                  <div className="flex gap-1">
                    <form action={handleToggle.bind(null, s.id, s.is_active)}>
                      <button type="submit"
                        className="px-2 py-1 rounded text-xs text-[#5B6B7C] hover:text-[#F59E0B] border border-[#E6EBF2] transition-colors">
                        {s.is_active ? 'Pausar' : 'Activar'}
                      </button>
                    </form>
                    <form action={handleDelete.bind(null, s.id)}>
                      <button type="submit"
                        className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </div>
                </div>

                {nps && nps.total > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#F4F7FB] rounded-lg p-3 text-center">
                      <p className={`text-2xl font-bold ${npsScore! >= 50 ? 'text-[#10B981]' : npsScore! >= 0 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                        {npsScore}
                      </p>
                      <p className="text-xs text-[#5B6B7C] mt-1">NPS Score</p>
                    </div>
                    <div className="bg-[#F4F7FB] rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-[#10B981]">{nps.promoters}</p>
                      <p className="text-xs text-[#5B6B7C] mt-1">Promotores (9-10)</p>
                    </div>
                    <div className="bg-[#F4F7FB] rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-[#F59E0B]">{nps.passives}</p>
                      <p className="text-xs text-[#5B6B7C] mt-1">Pasivos (7-8)</p>
                    </div>
                    <div className="bg-[#F4F7FB] rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-[#EF4444]">{nps.detractors}</p>
                      <p className="text-xs text-[#5B6B7C] mt-1">Detractores (0-6)</p>
                    </div>
                  </div>
                )}
                {(!nps || nps.total === 0) && s.survey_type === 'nps' && (
                  <div className="flex items-center gap-2 text-xs text-[#CBD5E1]">
                    <BarChart2 size={12} />
                    <span>Sin respuestas aún</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Star size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Sin encuestas creadas.</p>
        </div>
      )}
    </div>
  )
}
