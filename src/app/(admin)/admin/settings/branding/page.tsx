import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Palette, Building2, Save, CheckCircle2 } from 'lucide-react'
import { LogoUploader } from '@/features/admin/components/logo-uploader'

interface Props { searchParams: Promise<{ saved?: string }> }

export default async function BrandingPage({ searchParams }: Props) {
  const sp = await searchParams
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

  // Marca de la aplicación (emisor): es la primera fila, la que usan
  // los correos y reportes (getBrand). Se edita con "Mi marca".
  const appBrand = (brandings ?? [])[0] as Record<string, string> | undefined
  const mb = (k: string, d = '') => (appBrand?.[k] ?? d) as string

  async function handleSaveMyBrand(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const id = formData.get('brand_id') as string
    const payload = {
      company_display_name: (formData.get('company_display_name') as string)?.trim() || null,
      email_tagline: (formData.get('email_tagline') as string)?.trim() || null,
      support_email: (formData.get('support_email') as string)?.trim() || null,
      email_website: (formData.get('email_website') as string)?.trim() || null,
      primary_color: (formData.get('primary_color') as string) || '#00D4AA',
      logo_url: (formData.get('logo_url') as string)?.trim() || null,
      updated_at: new Date().toISOString(),
    }
    if (id) await supabase.from('org_branding').update(payload).eq('id', id)
    revalidatePath('/admin/settings/branding')
    redirect('/admin/settings/branding?saved=mybrand')
  }

  async function handleSave(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const orgId = formData.get('organization_id') as string
    await supabase.from('org_branding').upsert({
      organization_id: orgId,
      logo_url: formData.get('logo_url') as string || null,
      primary_color: formData.get('primary_color') as string || '#00D4AA',
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
        <h1 className="text-xl font-semibold text-[#0B2545]">Marca</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Tu identidad en reportes y correos, y branding por cliente (white-label)</p>
      </div>

      {sp.saved === 'mybrand' && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-sm font-medium">
          <CheckCircle2 size={16} /> Marca guardada. Se aplicará en tus próximos reportes y correos.
        </div>
      )}

      {/* Mi marca (emisor) */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={16} className="text-[#0E9E86]" />
          <h2 className="text-sm font-semibold text-[#0B2545]">Mi marca</h2>
        </div>
        <p className="text-[11px] text-[#5B6B7C] mb-4">Aparece como membrete en los reportes (PDF) y en el pie de todos tus correos.</p>
        {appBrand ? (
          <form action={handleSaveMyBrand} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="hidden" name="brand_id" value={appBrand.id} />
            <div className="sm:col-span-2">
              <label className="block text-xs text-[#5B6B7C] mb-1.5">Logo</label>
              <LogoUploader name="logo_url" initialUrl={mb('logo_url')} />
            </div>
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Nombre de tu empresa / marca</label>
              <input name="company_display_name" defaultValue={mb('company_display_name')} placeholder="ej: HexDesk, BC Fabric SAS…"
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
            </div>
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Color principal</label>
              <input name="primary_color" type="color" defaultValue={mb('primary_color', '#00D4AA')}
                className="w-full h-10 rounded-lg border border-[#E6EBF2] bg-[#F4F7FB] cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Correo de soporte</label>
              <input name="support_email" type="email" defaultValue={mb('support_email')} placeholder="soporte@tudominio.com"
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
            </div>
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Sitio web</label>
              <input name="email_website" type="url" defaultValue={mb('email_website')} placeholder="https://tudominio.com"
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-[#5B6B7C] mb-1">Eslogan / cargo (firma de correos)</label>
              <input name="email_tagline" defaultValue={mb('email_tagline')} placeholder="ej: Mesa de ayuda · Fernando Bolívar · Consultor en Ciberseguridad"
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors">
                <Save size={14} /> Guardar mi marca
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-[#94A3B8]">Aún no hay una marca configurada. Usa el formulario de abajo para crear la primera.</p>
        )}
      </div>

      {/* Branding por cliente (white-label) */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-1">Branding por cliente (opcional)</h2>
        <p className="text-[11px] text-[#5B6B7C] mb-4">Si quieres que un cliente vea su propia identidad en su portal.</p>
        <form action={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Organización *</label>
            <select name="organization_id" required
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]">
              <option value="">Selecciona...</option>
              {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Nombre a mostrar</label>
            <input name="company_display_name" placeholder="ej: Acme Corp Support"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">URL del logo</label>
            <input name="logo_url" type="url" placeholder="https://empresa.com/logo.png"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Email de soporte</label>
            <input name="support_email" type="email" placeholder="soporte@empresa.com"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Color primario</label>
            <div className="flex gap-2">
              <input name="primary_color" type="color" defaultValue="#00D4AA"
                className="w-10 h-10 rounded-lg border border-[#E6EBF2] bg-[#F4F7FB] cursor-pointer" />
              <input readOnly value="#00D4AA"
                className="flex-1 px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Dominio personalizado</label>
            <input name="custom_domain" placeholder="soporte.empresa.com"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[#5B6B7C] mb-1">Mensaje de bienvenida</label>
            <input name="welcome_message" placeholder="ej: Bienvenido al portal de soporte de Acme Corp"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>

          <div className="col-span-2 border-t border-[#E6EBF2] pt-3 mt-1">
            <p className="text-xs font-semibold text-[#0B2545]">Firma de los correos</p>
            <p className="text-[11px] text-[#5B6B7C] mt-0.5">Aparece en el pie de todos los correos salientes (acuse, respuestas, estado…).</p>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Eslogan / cargo (firma)</label>
            <input name="email_tagline" placeholder="ej: Mesa de ayuda · Fernando Bolívar · Consultor en Ciberseguridad"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Sitio web (firma)</label>
            <input name="email_website" type="url" placeholder="https://tu-sitio.com"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors">
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
