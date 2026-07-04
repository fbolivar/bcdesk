import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Monitor, Plus, Trash2 } from 'lucide-react'

const TOOL_LABELS: Record<string, string> = {
  teamviewer: 'TeamViewer',
  anydesk: 'AnyDesk',
  rustdesk: 'RustDesk',
  chrome_remote: 'Chrome Remote Desktop',
  custom: 'URL personalizada',
}

export default async function RemoteSupportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: configs } = await supabase.from('remote_support_configs').select('*').order('created_at')
  const list = configs ?? []

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('remote_support_configs').insert({
      tool: formData.get('tool') as string,
      name: formData.get('name') as string,
      url_template: formData.get('url_template') as string,
    })
    revalidatePath('/admin/settings/remote-support')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('remote_support_configs').delete().eq('id', id)
    revalidatePath('/admin/settings/remote-support')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Soporte remoto</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Configura herramientas de acceso remoto accesibles desde tickets</p>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-xl">
        <Monitor size={14} className="text-[#3B82F6] shrink-0 mt-0.5" />
        <div className="text-xs text-[#64748B] space-y-1">
          <p>Usa <code className="text-[#1E293B] bg-[#F4F7FB] px-1 rounded">{'{ticket_id}'}</code> y <code className="text-[#1E293B] bg-[#F4F7FB] px-1 rounded">{'{client_email}'}</code> en la URL para generar links dinámicos desde cada ticket.</p>
          <p><strong className="text-[#1E293B]">Ejemplo TeamViewer:</strong> <span className="font-mono">https://start.teamviewer.com/?id={'{ticket_id}'}</span></p>
          <p><strong className="text-[#1E293B]">Ejemplo AnyDesk:</strong> <span className="font-mono">anydesk:{'{ticket_id}'}</span></p>
        </div>
      </div>

      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#1E293B] mb-4">Nueva configuración</h2>
        <form action={handleCreate} className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">Herramienta</label>
            <select name="tool" defaultValue="teamviewer"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6]">
              {Object.entries(TOOL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">Nombre de botón *</label>
            <input name="name" required placeholder="ej: Iniciar TeamViewer"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">URL template *</label>
            <input name="url_template" required placeholder="https://..."
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-3 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Agregar
            </button>
          </div>
        </form>
      </div>

      {list.length > 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Herramienta', 'Botón', 'URL template', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((c: any) => (
                <tr key={c.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3 text-sm font-medium text-[#1E293B]">{TOOL_LABELS[c.tool]}</td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{c.name}</td>
                  <td className="px-4 py-3 text-xs font-mono text-[#CBD5E1] truncate max-w-[200px]">{c.url_template}</td>
                  <td className="px-4 py-3">
                    <form action={handleDelete.bind(null, c.id)}>
                      <button type="submit" className="p-1.5 rounded text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
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
          <Monitor size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#64748B] text-sm">Sin configuraciones de soporte remoto.</p>
        </div>
      )}
    </div>
  )
}
