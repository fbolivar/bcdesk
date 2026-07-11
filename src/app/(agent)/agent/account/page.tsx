import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { ChangePasswordForm } from '@/features/auth/components/change-password-form'

export default async function AgentAccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const initial = user.full_name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0B2545' }}>Mi cuenta</h1>
        <p className="text-sm mt-0.5" style={{ color: '#5B6B7C' }}>Gestiona tu acceso y seguridad</p>
      </div>

      <div
        className="rounded-2xl p-5 flex items-center gap-5"
        style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg, #00D4AA, #00D4AA)', color: '#fff' }}
        >
          {initial}
        </div>
        <div>
          <p className="text-base font-semibold" style={{ color: '#0B2545' }}>{user.full_name}</p>
          <p className="text-sm" style={{ color: '#5B6B7C' }}>{user.email}</p>
          <span
            className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4AA' }}
          >
            Agente
          </span>
        </div>
      </div>

      <ChangePasswordForm />
    </div>
  )
}
