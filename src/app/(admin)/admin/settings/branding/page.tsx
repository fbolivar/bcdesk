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

  const { data: orgs } = await supabase.from('organizations').select('id, name').eq('status', 'active')
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
      primary_color: formData.get('primary_color') as string || '#1789FC',
      secondary_color: formData.get('secondary_color') as string || '#FFFFFF',
      company_display_name: formData.get('company_display_name') as string || null,
      support_email: formData.get('support_email') as string || null,
      custom_domain: formData.get('custom_domain') as string || null,
      welcome_message: formData.get('welcome_message') as string || null,
      email_tagline: formData.get('email_tagline') as string || null,
      email_website: formData.get('email_website') as string || null,
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
        <h1 className="text-xl font-semibold text-[#0B2545]">Branding por organización</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Portal white-label — cada cliente ve su propia identidad visual</p>
      </div>

      {/* Create / Update */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Configurar branding</h2>
        <form action={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Organización *</label>
            <select name="organization_id" required
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="">Selecciona...</option>
              {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Nombre a mostrar</label>
            <input name="company_display_name" placeholder="ej: Acme Corp Support"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">URL del logo</label>
            <input name="logo_url" type="url" placeholder="https://empresa.com/logo.png"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Email de soporte</label>
            <input name="support_email" type="email" placeholder="soporte@empresa.com"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Color primario</label>
            <div className="flex gap-2">
              <input name="primary_color" type="color" defaultValue="#1789FC"
                className="w-10 h-10 rounded-lg border border-[#E6EBF2] bg-[#F4F7FB] cursor-pointer" />
              <input readOnly value="#1789FC"
                className="flex-1 px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Dominio personalizado</label>
            <input name="custom_domain" placeholder="soporte.empresa.com"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[#5B6B7C] mb-1">Mensaje de bienvenida</label>
            <input name="welcome_message" placeholder="ej: Bienvenido al portal de soporte de Acme Corp"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>

          <div className="col-span-2 border-t border-[#E6EBF2] pt-3 mt-1">
            <p className="text-xs font-semibold text-[#0B2545]">Firma de los correos</p>
            <p className="text-[11px] text-[#5B6B7C] mt-0.5">Aparece en el pie de todos los correos salientes (acuse, respuestas, estado…).</p>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Eslogan / cargo (firma)</label>
            <input name="email_tagline" placeholder="ej: Mesa de ayuda · Fernando Bolívar · Consultor en Ciberseguridad"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Sitio web (firma)</label>
            <input name="email_website" type="url" placeholder="https://tu-sitio.com"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Palette size={14} /> Guardar branding
            </button>
          </div>
        </form>
      </div>

      {/* Active brandings */}
      {(brandings ?? []).length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Organización', 'Nombre', 'Color', 'Dominio', 'Email', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(brandings ?? []).map((b: any) => {
                const org = Array.isArray(b.organizations) ? b.organizations[0] : b.organizations
                return (
                  <tr key={b.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                    <td className="px-4 py-3 font-medium text-[#0B2545]">{org?.name}</td>
                    <td className="px-4 py-3 text-sm text-[#5B6B7C]">{b.company_display_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full border border-[#E6EBF2]" style={{ backgroundColor: b.primary_color }} />
                        <span className="text-xs text-[#5B6B7C]">{b.primary_color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5B6B7C]">{b.custom_domain ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#5B6B7C]">{b.support_email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <form action={handleDelete.bind(null, b.id)}>
                        <button type="submit"
                          className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                          ×
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}
