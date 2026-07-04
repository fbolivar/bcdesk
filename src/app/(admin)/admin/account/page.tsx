import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { ChangePasswordForm } from '@/features/auth/components/change-password-form'

export default async function AdminAccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const initial = user.full_name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Mi cuenta</h1>
        <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>Gestiona tu acceso y seguridad</p>
      </div>

      <div
        className="rounded-2xl p-5 flex items-center gap-5"
        style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg, #4F8AFF, #8B6FFF)', color: '#fff' }}
        >
          {initial}
        </div>
        <div>
          <p className="text-base font-semibold" style={{ color: '#0F172A' }}>{user.full_name}</p>
          <p className="text-sm" style={{ color: '#64748B' }}>{user.email}</p>
          <span
            className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ background: 'rgba(79,138,255,0.15)', color: '#4F8AFF' }}
          >
            Admin
          </span>
        </div>
      </div>

      <ChangePasswordForm />
    </div>
  )
}
