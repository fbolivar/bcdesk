'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { resetPassword } from '@/features/auth/services/auth.service'

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const pass = fd.get('password') as string
    const confirm = fd.get('confirm') as string
    if (pass !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    const result = await resetPassword(token, pass)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <div
      className="rounded-2xl p-8"
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 32px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset',
      }}
    >
      <div className="mb-7">
        <h1 className="text-xl font-semibold" style={{ color: '#F0F4FF' }}>Nueva contraseña</h1>
        <p className="text-sm mt-1" style={{ color: '#8B9BB4' }}>Crea una contraseña nueva para tu cuenta</p>
      </div>

      {done ? (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(16,217,138,0.08)', border: '1px solid rgba(16,217,138,0.2)', color: '#10D98A' }}
        >
          Contraseña actualizada. Redirigiéndote al inicio de sesión…
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium mb-2 tracking-wide uppercase" style={{ color: '#8B9BB4', letterSpacing: '0.06em' }}>
              Nueva contraseña
            </label>
            <input name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" autoComplete="new-password" className="input-neo" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2 tracking-wide uppercase" style={{ color: '#8B9BB4', letterSpacing: '0.06em' }}>
              Confirmar contraseña
            </label>
            <input name="confirm" type="password" required minLength={8} placeholder="Repite la contraseña" autoComplete="new-password" className="input-neo" />
          </div>

          {error && (
            <div
              className="px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.2)', color: '#FF4D6A' }}
            >
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? 'Guardando...' : 'Restablecer contraseña'}
          </button>
        </form>
      )}

      <p className="text-center text-xs mt-6" style={{ color: '#4A5568' }}>
        <a href="/login" style={{ color: '#4F8AFF' }} className="hover:underline">Volver a iniciar sesión</a>
      </p>
    </div>
  )
}
