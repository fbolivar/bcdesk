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

  const inputBase = 'w-full rounded-xl bg-white text-sm text-[#0B2545] placeholder-[#94A3B8] transition-all duration-150 outline-none border'

  return (
    <div
      className="rounded-2xl p-7 sm:p-8"
      style={{ background: '#FFFFFF', border: '1px solid #E6EBF2', boxShadow: '0 16px 48px rgba(11,37,69,0.08), 0 2px 6px rgba(11,37,69,0.04)' }}
    >
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#0B2545' }}>Bienvenido de nuevo</h1>
        <p className="text-sm mt-1.5" style={{ color: '#5B6B7C' }}>Inicia sesión para gestionar tu mesa de ayuda</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#5B6B7C' }}>Correo electrónico</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" color="#94A3B8" />
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="tu@empresa.com"
              className={`${inputBase} pl-10 pr-3.5 py-3`}
              style={{ borderColor: errors.email ? '#FF4D6A' : '#E2E8F0' }}
              onFocus={(e) => {
                if (errors.email) return
                e.currentTarget.style.borderColor = '#1789FC'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(23,137,252,0.12)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = errors.email ? '#FF4D6A' : '#E2E8F0'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>
          {errors.email && <p className="mt-1.5 text-xs" style={{ color: '#FF4D6A' }}>{errors.email.message}</p>}
        </div>

        {/* Contraseña */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold" style={{ color: '#5B6B7C' }}>Contraseña</label>
            <a href="/forgot-password" className="text-xs font-medium hover:underline" style={{ color: '#1789FC' }}>¿Olvidaste tu contraseña?</a>
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" color="#94A3B8" />
            <input
              {...register('password')}
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className={`${inputBase} pl-10 pr-11 py-3`}
              style={{ borderColor: errors.password ? '#FF4D6A' : '#E2E8F0' }}
              onFocus={(e) => {
                if (errors.password) return
                e.currentTarget.style.borderColor = '#1789FC'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(23,137,252,0.12)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = errors.password ? '#FF4D6A' : '#E2E8F0'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors hover:bg-[#F1F4F8]"
              aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              tabIndex={-1}
            >
              {showPw ? <EyeOff size={16} color="#94A3B8" /> : <Eye size={16} color="#94A3B8" />}
            </button>
          </div>
          {errors.password && <p className="mt-1.5 text-xs" style={{ color: '#FF4D6A' }}>{errors.password.message}</p>}
        </div>

        {serverError && (
          <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl text-sm" style={{ background: 'rgba(255,77,106,0.07)', border: '1px solid rgba(255,77,106,0.2)', color: '#E11D48' }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="group w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-60"
          style={{ background: loading ? '#0B72D6' : '#1789FC', boxShadow: '0 6px 18px rgba(23,137,252,0.30)' }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#0B72D6' }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#1789FC' }}
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Ingresando…
            </>
          ) : (
            <>
              Ingresar
              <ArrowRight size={16} className="transition-transform duration-150 group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 text-center text-sm" style={{ borderTop: '1px solid #EEF2F7', color: '#5B6B7C' }}>
        ¿No tienes cuenta?{' '}
        <a href="/register" className="font-semibold hover:underline" style={{ color: '#1789FC' }}>Crear cuenta</a>
      </div>
    </div>
  )
}
