'use client'

import { useState } from 'react'
import Link from 'next/link'
import { User, Mail, Lock } from 'lucide-react'
import { register } from '@/features/auth/services/auth.service'

export default function SignupPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await register(
      fd.get('email') as string,
      fd.get('password') as string,
      fd.get('full_name') as string,
    )
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>Crear cuenta</h1>
      <p className="lead">Accede a tu mesa de ayuda</p>

      <form onSubmit={handleSubmit} className="mt-6">
        <label className="auth-label">Nombre completo</label>
        <div className="auth-inp">
          <User size={16} />
          <input name="full_name" required placeholder="Felipe Bolívar" className="auth-input" />
        </div>

        <label className="auth-label mt-4">Correo electrónico</label>
        <div className="auth-inp">
          <Mail size={16} />
          <input name="email" type="email" required placeholder="tu@empresa.com" className="auth-input" />
        </div>

        <label className="auth-label mt-4">Contraseña</label>
        <div className="auth-inp">
          <Lock size={16} />
          <input name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" className="auth-input" />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" disabled={loading} className="auth-btn">
          <span className="sh" />
          {loading ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: '#AEBFD4' }}>
        ¿Ya tienes cuenta? <Link href="/login" className="auth-link" style={{ color: '#4FE3C4', fontWeight: 600 }}>Ingresar</Link>
      </p>
    </div>
  )
}
