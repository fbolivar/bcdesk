'use client'

import { useState } from 'react'
import { requestPasswordReset } from '@/features/auth/services/auth.service'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await requestPasswordReset(fd.get('email') as string)
    setLoading(false)
    setSent(true)
  }

  return (
    <div
      className="rounded-2xl p-8"
      style={{
        background: '#FFFFFF',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: '1px solid #E6EBF2',
        boxShadow: '0 32px 64px rgba(0,0,0,0.4), 0 0 0 1px #FFFFFF inset',
      }}
    >
      <div className="mb-7">
        <h1 className="text-xl font-semibold" style={{ color: '#0F172A' }}>Recuperar contraseña</h1>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Te enviaremos un enlace para restablecerla</p>
      </div>

      {sent ? (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(16,217,138,0.08)', border: '1px solid rgba(16,217,138,0.2)', color: '#10D98A' }}
        >
          Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja (y spam).
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium mb-2 tracking-wide uppercase" style={{ color: '#64748B', letterSpacing: '0.06em' }}>
              Email
            </label>
            <input name="email" type="email" required placeholder="tu@empresa.com" className="input-neo" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>
      )}

      <p className="text-center text-xs mt-6" style={{ color: '#94A3B8' }}>
        <a href="/login" style={{ color: '#4F8AFF' }} className="hover:underline">Volver a iniciar sesión</a>
      </p>
    </div>
  )
}
