import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { Profile, Organization } from '@/lib/supabase/types'

export default async function ClientProfilePage() {
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

  let successMessage: string | null = null
  let errorMessage: string | null = null

  async function updateProfile(formData: FormData) {
    'use server'
    const sb = await createClient()
    const { data: { user: u } } = await sb.auth.getUser()
    if (!u) redirect('/login')

    const fullName = (formData.get('full_name') as string)?.trim()
    const phone = (formData.get('phone') as string)?.trim() || null
    const newPassword = (formData.get('new_password') as string)?.trim()
    const confirmPassword = (formData.get('confirm_password') as string)?.trim()

    const updates: Record<string, unknown> = {}
    if (fullName) updates.full_name = fullName
    updates.phone = phone

    if (Object.keys(updates).length > 0) {
      await sb.from('profiles').update(updates).eq('id', u.id)
    }

    if (newPassword) {
      if (newPassword !== confirmPassword) {
        redirect('/client/profile?error=password_mismatch')
      }
      if (newPassword.length < 8) {
        redirect('/client/profile?error=password_short')
      }
      await sb.auth.updateUser({ password: newPassword })
    }

    revalidatePath('/client/profile')
    redirect('/client/profile?success=1')
  }

  const initial = profile.full_name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#F0F4FF' }}>Mi perfil</h1>
        <p className="text-sm mt-0.5" style={{ color: '#8B9BB4' }}>Gestiona tu información personal</p>
      </div>

      {successMessage === null && (
        <></>
      )}

      <div
        className="rounded-2xl p-5 flex items-center gap-5"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg, #4F8AFF, #8B6FFF)', color: '#fff' }}
        >
          {initial}
        </div>
        <div>
          <p className="text-base font-semibold" style={{ color: '#F0F4FF' }}>{profile.full_name}</p>
          <p className="text-sm" style={{ color: '#8B9BB4' }}>{user.email}</p>
          {orgName && (
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: 'rgba(79,138,255,0.12)', color: '#4F8AFF' }}
            >
              {orgName}
            </span>
          )}
        </div>
      </div>

      <form action={updateProfile} className="space-y-5">
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: '#F0F4FF' }}>Información personal</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#8B9BB4' }}>
                Nombre completo
              </label>
              <input
                name="full_name"
                defaultValue={profile.full_name}
                required
                placeholder="Tu nombre"
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#F0F4FF',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#8B9BB4' }}>
                Correo electrónico
              </label>
              <input
                value={user.email ?? ''}
                disabled
                readOnly
                className="w-full px-3 py-2.5 rounded-xl text-sm opacity-50 cursor-not-allowed"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: '#8B9BB4',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#8B9BB4' }}>
                Teléfono
              </label>
              <input
                name="phone"
                type="tel"
                defaultValue={profile.phone ?? ''}
                placeholder="+57 300 000 0000"
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#F0F4FF',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#8B9BB4' }}>
                Organización
              </label>
              <input
                value={orgName ?? 'Sin organización'}
                disabled
                readOnly
                className="w-full px-3 py-2.5 rounded-xl text-sm opacity-50 cursor-not-allowed"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: '#8B9BB4',
                }}
              />
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#F0F4FF' }}>Cambiar contraseña</h2>
            <p className="text-xs mt-0.5" style={{ color: '#8B9BB4' }}>Deja en blanco si no deseas cambiarla</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#8B9BB4' }}>
                Nueva contraseña
              </label>
              <input
                name="new_password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#F0F4FF',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#8B9BB4' }}>
                Confirmar contraseña
              </label>
              <input
                name="confirm_password"
                type="password"
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#F0F4FF',
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: '#4F8AFF', color: '#fff' }}
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  )
}
