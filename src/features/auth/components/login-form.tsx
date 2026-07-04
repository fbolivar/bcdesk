'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { loginSchema, type LoginInput } from '../types'
import { login } from '../services/auth.service'

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    <div
      className="rounded-2xl p-8"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E6EBF2',
        boxShadow: '0 12px 40px rgba(16,24,40,0.10), 0 2px 8px rgba(16,24,40,0.05)',
      }}
    >
      <div className="mb-7">
        <h1 className="text-xl font-semibold" style={{ color: '#0F172A' }}>Bienvenido de nuevo</h1>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Inicia sesión en tu cuenta</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-xs font-medium mb-2 tracking-wide uppercase" style={{ color: '#64748B', letterSpacing: '0.06em' }}>
            Email
          </label>
          <input
            {...register('email')}
            type="email"
            placeholder="tu@empresa.com"
            className="input-neo"
          />
          {errors.email && <p className="mt-1.5 text-xs" style={{ color: '#FF4D6A' }}>{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium mb-2 tracking-wide uppercase" style={{ color: '#64748B', letterSpacing: '0.06em' }}>
            Contraseña
          </label>
          <input
            {...register('password')}
            type="password"
            placeholder="••••••••"
            className="input-neo"
          />
          {errors.password && <p className="mt-1.5 text-xs" style={{ color: '#FF4D6A' }}>{errors.password.message}</p>}
        </div>

        {serverError && (
          <div
            className="px-4 py-3 rounded-xl text-sm"
            style={{
              background: 'rgba(255,77,106,0.08)',
              border: '1px solid rgba(255,77,106,0.2)',
              color: '#FF4D6A',
            }}
          >
            {serverError}
          </div>
        )}

        <div className="text-right -mt-2">
          <a href="/forgot-password" className="text-xs hover:underline" style={{ color: '#64748B' }}>
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        <button type="submit" disabled={loading} className="btn-primary mt-2">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Ingresando...
            </span>
          ) : 'Ingresar'}
        </button>
      </form>

      <p className="text-center text-xs mt-6" style={{ color: '#94A3B8' }}>
        ¿No tienes cuenta?{' '}
        <a href="/register" style={{ color: '#4F8AFF' }} className="hover:underline">Regístrate</a>
      </p>
    </div>
  )
}
