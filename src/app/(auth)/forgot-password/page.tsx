'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'
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
    <div className="auth-card">
      <h1>Recuperar contraseña</h1>
      <p className="lead">Te enviaremos un enlace para restablecerla</p>

      {sent ? (
        <div className="mt-6 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(0,212,170,0.10)', border: '1px solid rgba(0,212,170,0.28)', color: '#4FE3C4' }}>
          Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja (y spam).
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6">
          <label className="auth-label">Correo electrónico</label>
          <div className="auth-inp">
            <Mail size={16} />
            <input name="email" type="email" required placeholder="tu@empresa.com" className="auth-input" />
          </div>
          <button type="submit" disabled={loading} className="auth-btn">
            <span className="sh" />
            {loading ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>
      )}

      <p className="text-center text-sm mt-6">
        <a href="/login" className="auth-link">Volver a iniciar sesión</a>
      </p>
    </div>
  )
}
