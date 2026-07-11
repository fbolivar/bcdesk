import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Megaphone, Plus, Trash2, Archive } from 'lucide-react'
import { revalidatePath } from 'next/cache'

const TYPE_COLOR: Record<string, string> = {
  info: 'bg-[#00D4AA]/20 text-[#0E9E86]',
  warning: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  incident: 'bg-[#EF4444]/20 text-[#EF4444]',
  maintenance: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
  resolved: 'bg-[#10B981]/20 text-[#10B981]',
}
const TYPE_LABEL: Record<string, string> = {
  info: 'Información', warning: 'Aviso', incident: 'Incidente', maintenance: 'Mantenimiento', resolved: 'Resuelto',
}

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })

  const list = announcements ?? []

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('announcements').insert({
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      announcement_type: formData.get('announcement_type') as string || 'info',
      ends_at: formData.get('ends_at') as string || null,
      created_by: user?.id,
    })
    revalidatePath('/admin/announcements')
  }

  async function handleArchive(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('announcements').update({ status: 'archived' }).eq('id', id)
    revalidatePath('/admin/announcements')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('announcements').delete().eq('id', id)
    revalidatePath('/admin/announcements')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Anuncios y estado del sistema</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Comunica incidentes, mantenimientos y novedades a los usuarios</p>
      </div>

      {/* Create */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Publicar anuncio</h2>
        <form action={handleCreate} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Título *</label>
              <input name="title" required placeholder="ej: Mantenimiento programado"
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
            </div>
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Tipo</label>
              <select name="announcement_type"
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]">
                {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Mensaje *</label>
            <textarea name="content" required rows={3} placeholder="Describe el anuncio en detalle..."
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1] resize-none" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Vence (opcional)</label>
            <input name="ends_at" type="datetime-local"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]" />
          </div>
          <div className="flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors">
              <Plus size={14} /> Publicar
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="space-y-3">
        {list.map((a: any) => (
          <div key={a.id} className={`bg-[#FFFFFF] border rounded-xl p-4 ${a.status === 'archived' ? 'opacity-50 border-[#E6EBF2]' : 'border-[#E6EBF2]'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[a.announcement_type]}`}>
                    {TYPE_LABEL[a.announcement_type]}
                  </span>
                  {a.status === 'archived' && (
                    <span className="text-xs text-[#CBD5E1]">Archivado</span>
                  )}
                </div>
                <h3 className="font-medium text-[#0B2545]">{a.title}</h3>
                <p className="text-sm text-[#5B6B7C] mt-1">{a.content}</p>
                <p className="text-xs text-[#CBD5E1] mt-2">
                  {new Date(a.created_at).toLocaleString('es-CO')}
                  {a.ends_at && ` · Vence: ${new Date(a.ends_at).toLocaleString('es-CO')}`}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {a.status === 'active' && (
                  <form action={handleArchive.bind(null, a.id)}>
                    <button type="submit" title="Archivar"
                      className="p-1.5 rounded text-[#5B6B7C] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors">
                      <Archive size={14} />
                    </button>
                  </form>
                )}
                <form action={handleDelete.bind(null, a.id)}>
                  <button type="submit" title="Eliminar"
                    className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
            <Megaphone size={32} className="text-[#E6EBF2] mx-auto mb-3" />
            <p className="text-[#5B6B7C] text-sm">Sin anuncios publicados.</p>
          </div>
        )}
      </div>
    </div>
  )
}
