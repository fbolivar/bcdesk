'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
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
    <div className="auth-card">
      <h1>Nueva contraseña</h1>
      <p className="lead">Crea una contraseña nueva para tu cuenta</p>

      {done ? (
        <div className="mt-6 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(0,212,170,0.10)', border: '1px solid rgba(0,212,170,0.28)', color: '#4FE3C4' }}>
          Contraseña actualizada. Redirigiéndote al inicio de sesión…
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6">
          <label className="auth-label">Nueva contraseña</label>
          <div className="auth-inp">
            <Lock size={16} />
            <input name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" autoComplete="new-password" className="auth-input" />
          </div>

          <label className="auth-label mt-4">Confirmar contraseña</label>
          <div className="auth-inp">
            <Lock size={16} />
            <input name="confirm" type="password" required minLength={8} placeholder="Repite la contraseña" autoComplete="new-password" className="auth-input" />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" disabled={loading} className="auth-btn">
            <span className="sh" />
            {loading ? 'Guardando…' : 'Restablecer contraseña'}
          </button>
        </form>
      )}

      <p className="text-center text-sm mt-6">
        <a href="/login" className="auth-link">Volver a iniciar sesión</a>
      </p>
    </div>
  )
}
