'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import { loginSchema, type LoginInput } from '../types'
import { login } from '../services/auth.service'

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setLoading(true)
    setServerError(null)
    const result = await login(data.email, data.password)
    if (result?.error) {
      setServerError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>Bienvenido de nuevo</h1>
      <p className="lead">Ingresa a tu mesa de ayuda</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6">
        <div>
          <label className="auth-label">Correo electrónico</label>
          <div className="auth-inp">
            <Mail size={16} />
            <input {...register('email')} type="email" autoComplete="email" placeholder="tu@empresa.com" className="auth-input" />
          </div>
          {errors.email && <p className="mt-1.5 text-xs" style={{ color: '#ff9db0' }}>{errors.email.message}</p>}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="auth-label" style={{ margin: 0 }}>Contraseña</label>
            <a href="/forgot-password" className="text-xs auth-link">¿Olvidaste tu contraseña?</a>
          </div>
          <div className="auth-inp">
            <Lock size={16} />
            <input
              {...register('password')}
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="auth-input"
            />
            <button type="button" className="auth-eye" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'} tabIndex={-1}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="mt-1.5 text-xs" style={{ color: '#ff9db0' }}>{errors.password.message}</p>}
        </div>

        {serverError && (
          <div className="auth-error">
            <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>{serverError}</span>
          </div>
        )}

        <button type="submit" disabled={loading} className="auth-btn">
          <span className="sh" />
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" style={{ position: 'relative' }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Ingresando…
            </>
          ) : (
            <>
              Ingresar
              <ArrowRight size={16} style={{ position: 'relative' }} />
            </>
          )}
        </button>
      </form>
    </div>
  )
}
