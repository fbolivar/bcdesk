import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Palette } from 'lucide-react'

export default async function BrandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: orgs } = await supabase.from('organizations').select('id, name').eq('is_active', true)
  const { data: brandings } = await supabase
    .from('org_branding')
    .select('*, organizations(name)')
    .order('created_at')

  async function handleSave(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const orgId = formData.get('organization_id') as string
    await supabase.from('org_branding').upsert({
      organization_id: orgId,
      logo_url: formData.get('logo_url') as string || null,
      primary_color: formData.get('primary_color') as string || '#3B82F6',
      secondary_color: formData.get('secondary_color') as string || '#1E293B',
      company_display_name: formData.get('company_display_name') as string || null,
      support_email: formData.get('support_email') as string || null,
      custom_domain: formData.get('custom_domain') as string || null,
      welcome_message: formData.get('welcome_message') as string || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id' })
    revalidatePath('/admin/settings/branding')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('org_branding').delete().eq('id', id)
    revalidatePath('/admin/settings/branding')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Branding por organización</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">Portal white-label — cada cliente ve su propia identidad visual</p>
      </div>

      {/* Create / Update */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4">Configurar branding</h2>
        <form action={handleSave} className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Organización *</label>
            <select name="organization_id" required
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="">Selecciona...</option>
              {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Nombre a mostrar</label>
            <input name="company_display_name" placeholder="ej: Acme Corp Support"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">URL del logo</label>
            <input name="logo_url" type="url" placeholder="https://empresa.com/logo.png"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Email de soporte</label>
            <input name="support_email" type="email" placeholder="soporte@empresa.com"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Color primario</label>
            <div className="flex gap-2">
              <input name="primary_color" type="color" defaultValue="#3B82F6"
                className="w-10 h-10 rounded-lg border border-[#334155] bg-[#0F172A] cursor-pointer" />
              <input readOnly value="#3B82F6"
                className="flex-1 px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Dominio personalizado</label>
            <input name="custom_domain" placeholder="soporte.empresa.com"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[#94A3B8] mb-1">Mensaje de bienvenida</label>
            <input name="welcome_message" placeholder="ej: Bienvenido al portal de soporte de Acme Corp"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
              <Palette size={14} /> Guardar branding
            </button>
          </div>
        </form>
      </div>

      {/* Active brandings */}
      {(brandings ?? []).length > 0 && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                {['Organización', 'Nombre', 'Color', 'Dominio', 'Email', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(brandings ?? []).map((b: any) => {
                const org = Array.isArray(b.organizations) ? b.organizations[0] : b.organizations
                return (
                  <tr key={b.id} className="border-b border-[#334155]/50 hover:bg-[#263248]">
                    <td className="px-4 py-3 font-medium text-[#F1F5F9]">{org?.name}</td>
                    <td className="px-4 py-3 text-sm text-[#94A3B8]">{b.company_display_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full border border-[#334155]" style={{ backgroundColor: b.primary_color }} />
                        <span className="text-xs text-[#64748B]">{b.primary_color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">{b.custom_domain ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">{b.support_email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <form action={handleDelete.bind(null, b.id)}>
                        <button type="submit"
                          className="p-1.5 rounded text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                          ×
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
