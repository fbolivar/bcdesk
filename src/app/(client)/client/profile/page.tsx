import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { Profile, Organization } from '@/lib/supabase/types'
import { ChangePasswordForm } from '@/features/auth/components/change-password-form'

export default async function ClientProfilePage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*, organizations(name)')
    .eq('id', user.id)
    .single()

  const profile = profileData as (Profile & { organizations?: Organization | { name: string } | null }) | null
  if (!profile) redirect('/login')

  const orgName = profile.organizations
    ? (Array.isArray(profile.organizations) ? (profile.organizations[0] as { name: string })?.name : (profile.organizations as { name: string })?.name)
    : null

  async function updateProfile(formData: FormData) {
    'use server'
    const sb = await createClient()
    const { data: { user: u } } = await sb.auth.getUser()
    if (!u) redirect('/login')

    const fullName = (formData.get('full_name') as string)?.trim()
    const phone = (formData.get('phone') as string)?.trim() || null

    const updates: Record<string, unknown> = {}
    if (fullName) updates.full_name = fullName
    updates.phone = phone

    if (Object.keys(updates).length > 0) {
      await sb.from('profiles').update(updates).eq('id', u.id)
    }

    revalidatePath('/client/profile')
    redirect('/client/profile?success=1')
  }

  const initial = profile.full_name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0B2545' }}>Mi perfil</h1>
        <p className="text-sm mt-0.5" style={{ color: '#5B6B7C' }}>Gestiona tu información personal</p>
      </div>

      {sp.success === '1' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}>
          ✓ Perfil actualizado correctamente.
        </div>
      )}

      <div
        className="rounded-2xl p-5 flex items-center gap-5"
        style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg, #00D4AA, #8B6FFF)', color: '#fff' }}
        >
          {initial}
        </div>
        <div>
          <p className="text-base font-semibold" style={{ color: '#0B2545' }}>{profile.full_name}</p>
          <p className="text-sm" style={{ color: '#5B6B7C' }}>{user.email}</p>
          {orgName && (
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: 'rgba(0, 212, 170,0.12)', color: '#00D4AA' }}
            >
              {orgName}
            </span>
          )}
        </div>
      </div>

      <form action={updateProfile} className="space-y-5">
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: '#0B2545' }}>Información personal</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#5B6B7C' }}>
                Nombre completo
              </label>
              <input
                name="full_name"
                defaultValue={profile.full_name}
                required
                placeholder="Tu nombre"
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
                style={{
                  background: '#F4F7FB',
                  border: '1px solid #E6EBF2',
                  color: '#0B2545',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#5B6B7C' }}>
                Correo electrónico
              </label>
              <input
                value={user.email ?? ''}
                disabled
                readOnly
                className="w-full px-3 py-2.5 rounded-xl text-sm opacity-50 cursor-not-allowed"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #F4F7FB',
                  color: '#5B6B7C',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#5B6B7C' }}>
                Teléfono
              </label>
              <input
                name="phone"
                type="tel"
                defaultValue={profile.phone ?? ''}
                placeholder="+57 300 000 0000"
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
                style={{
                  background: '#F4F7FB',
                  border: '1px solid #E6EBF2',
                  color: '#0B2545',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#5B6B7C' }}>
                Organización
              </label>
              <input
                value={orgName ?? 'Sin organización'}
                disabled
                readOnly
                className="w-full px-3 py-2.5 rounded-xl text-sm opacity-50 cursor-not-allowed"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #F4F7FB',
                  color: '#5B6B7C',
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: '#00D4AA', color: '#0B2545' }}
          >
            Guardar cambios
          </button>
        </div>
      </form>

      <ChangePasswordForm />
    </div>
  )
}
