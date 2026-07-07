import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Shield, Plus, Trash2, Download } from 'lucide-react'

const TABLE_LABELS: Record<string, string> = {
  tickets: 'Tickets',
  ticket_comments: 'Comentarios',
  time_logs: 'Registros de tiempo',
  chat_sessions: 'Sesiones de chat',
  chat_messages: 'Mensajes de chat',
  audit_logs: 'Logs de auditoría',
}

export default async function GdprPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: policies } = await supabase
    .from('data_retention_policies')
    .select('*')
    .order('created_at', { ascending: false })

  const list = policies ?? []

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('data_retention_policies').insert({
      table_name: formData.get('table_name') as string,
      retention_days: parseInt(formData.get('retention_days') as string) || 365,
      action: formData.get('action') as string || 'archive',
      description: formData.get('description') as string || null,
      created_by: user?.id,
    })
    revalidatePath('/admin/settings/gdpr')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('data_retention_policies').delete().eq('id', id)
    revalidatePath('/admin/settings/gdpr')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Auditoría GDPR y retención de datos</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Configuración de políticas de privacidad y retención de datos</p>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 px-4 py-3 bg-[#1789FC]/10 border border-[#1789FC]/20 rounded-xl">
        <Shield size={14} className="text-[#1789FC] shrink-0 mt-0.5" />
        <div className="text-xs text-[#5B6B7C] space-y-1">
          <p><strong className="text-[#0B2545]">GDPR:</strong> Define cuántos días conservar datos por tabla. Al vencer, los datos se archivan o eliminan según la política.</p>
          <p><strong className="text-[#0B2545]">Exportar datos:</strong> Puedes exportar todos los datos de un usuario en formato JSON para cumplir con solicitudes de portabilidad.</p>
        </div>
      </div>

      {/* Create */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Nueva política de retención</h2>
        <form action={handleCreate} className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Tabla *</label>
            <select name="table_name" required defaultValue=""
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="" disabled>Selecciona tabla...</option>
              {Object.entries(TABLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Retención (días) *</label>
            <input name="retention_days" type="number" required defaultValue="365" min="30"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Acción al vencer</label>
            <select name="action" defaultValue="archive"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="archive">Archivar</option>
              <option value="delete">Eliminar</option>
              <option value="anonymize">Anonimizar</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Descripción</label>
            <input name="description" placeholder="Ej: Tickets cerrados >1 año"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Crear política
            </button>
          </div>
        </form>
      </div>

      {/* Export section */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-2">Exportar datos de usuario (GDPR Art. 20)</h2>
        <p className="text-xs text-[#5B6B7C] mb-4">Exporta todos los datos personales de un usuario en formato JSON para cumplir con solicitudes de portabilidad.</p>
        <a href="/api/gdpr/export"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#0B2545] text-sm font-medium transition-colors">
          <Download size={14} /> Exportar mis datos
        </a>
      </div>

      {/* Policies list */}
      {list.length > 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Tabla', 'Retención', 'Acción', 'Descripción', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p: any) => (
                <tr key={p.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3 font-medium text-[#0B2545]">{TABLE_LABELS[p.table_name] ?? p.table_name}</td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{p.retention_days} días</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.action === 'delete' ? 'bg-[#EF4444]/20 text-[#EF4444]' :
                      p.action === 'anonymize' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                      'bg-[#1789FC]/20 text-[#1789FC]'
                    }`}>{p.action}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{p.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    <form action={handleDelete.bind(null, p.id)}>
                      <button type="submit"
                        className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Shield size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Sin políticas de retención configuradas.</p>
        </div>
      )}
    </div>
  )
}
