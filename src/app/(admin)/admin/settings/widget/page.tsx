import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Key, Copy, Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import { CopyButton } from './copy-button'

export default async function AdminWidgetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const { data: orgs } = await supabase.from('organizations').select('id, name').eq('is_active', true)
  const { data: tokens } = await supabase
    .from('org_api_tokens')
    .select('*, organizations(name)')
    .order('created_at', { ascending: false })

  const tokenList = tokens ?? []
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('org_api_tokens').insert({
      name: formData.get('name') as string,
      organization_id: formData.get('organization_id') as string || null,
    })
    revalidatePath('/admin/settings/widget')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('org_api_tokens').delete().eq('id', id)
    revalidatePath('/admin/settings/widget')
  }

  async function handleToggle(id: string, current: boolean) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('org_api_tokens').update({ is_active: !current }).eq('id', id)
    revalidatePath('/admin/settings/widget')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Widget embebible</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">Genera tokens para incrustar el formulario de soporte en sitios externos</p>
      </div>

      {/* Create token */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4">Nuevo token</h2>
        <form action={handleCreate} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-[#94A3B8] mb-1">Nombre del token</label>
            <input name="name" required placeholder="ej: Sitio web principal"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div className="w-48">
            <label className="block text-xs text-[#94A3B8] mb-1">Organización</label>
            <select name="organization_id"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="">General</option>
              {(orgs ?? []).map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </div>
          <button type="submit"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors whitespace-nowrap">
            <Plus size={14} /> Crear token
          </button>
        </form>
      </div>

      {/* Token list */}
      {tokenList.length > 0 && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                {['Nombre', 'Organización', 'Token / Embed', 'Estado', 'Último uso', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tokenList.map((t: any) => (
                <tr key={t.id} className="border-b border-[#334155]/50 hover:bg-[#263248]">
                  <td className="px-4 py-3 font-medium text-[#F1F5F9]">{t.name}</td>
                  <td className="px-4 py-3 text-[#94A3B8] text-xs">{t.organizations?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <CopyButton label="Formulario" value={`${appUrl}/widget/${t.token}`} />
                      <CopyButton label="Chat en vivo" value={`${appUrl}/widget/${t.token}/chat`} />
                      <p className="text-[10px] text-[#475569] font-mono truncate max-w-[200px]">{t.token.substring(0, 16)}…</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#334155] text-[#64748B]'}`}>
                      {t.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">
                    {t.last_used_at ? new Date(t.last_used_at).toLocaleDateString('es-CO') : 'Nunca'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <form action={handleToggle.bind(null, t.id, t.is_active)}>
                        <button type="submit" title={t.is_active ? 'Desactivar' : 'Activar'}
                          className="p-1.5 rounded text-[#64748B] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors">
                          {t.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                      </form>
                      <form action={handleDelete.bind(null, t.id)}>
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
      )}

      {/* Embed snippet */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-2">Cómo usar</h2>
        <p className="text-xs text-[#94A3B8] mb-3">Copia el siguiente código en tu sitio web, reemplazando <code className="bg-[#334155] px-1 rounded">TU_TOKEN</code> con el token generado:</p>
        <pre className="bg-[#0F172A] border border-[#334155] rounded-lg p-4 text-xs text-[#94A3B8] overflow-x-auto">{`<!-- BCDesk Support Widget -->
<iframe
  src="${appUrl}/widget/TU_TOKEN"
  width="100%"
  height="500"
  frameborder="0"
  style="border: none; border-radius: 12px;"
  title="Soporte"
></iframe>`}</pre>
      </div>
    </div>
  )
}
