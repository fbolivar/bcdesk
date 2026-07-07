'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { User, Lock } from 'lucide-react'
import { registerSchema, type RegisterInput } from '../types'
import { registerWithInvite } from '../services/auth.service'

interface Props {
  token: string
  email: string
  orgName?: string
}

export function RegisterForm({ token, email, orgName }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true)
    setServerError(null)
    const result = await registerWithInvite(token, data.password, data.full_name)
    if (result?.error) {
      setServerError(result.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6">
      {orgName && (
        <div className="mb-4 px-3 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(0,212,170,0.10)', border: '1px solid rgba(0,212,170,0.26)', color: '#AEBFD4' }}>
          Has sido invitado a <span style={{ color: '#4FE3C4', fontWeight: 600 }}>{orgName}</span>
        </div>
      )}

      <label className="auth-label">Correo electrónico</label>
      <input value={email} disabled className="auth-input noicon" style={{ opacity: 0.7, cursor: 'not-allowed' }} />

      <label className="auth-label mt-4">Nombre completo</label>
      <div className="auth-inp">
        <User size={16} />
        <input {...register('full_name')} type="text" placeholder="Tu nombre" className="auth-input" />
      </div>
      {errors.full_name && <p className="mt-1 text-xs" style={{ color: '#ff9db0' }}>{errors.full_name.message}</p>}

      <label className="auth-label mt-4">Contraseña</label>
      <div className="auth-inp">
        <Lock size={16} />
        <input {...register('password')} type="password" placeholder="Mínimo 8 caracteres" className="auth-input" />
      </div>
      {errors.password && <p className="mt-1 text-xs" style={{ color: '#ff9db0' }}>{errors.password.message}</p>}

      <label className="auth-label mt-4">Confirmar contraseña</label>
      <div className="auth-inp">
        <Lock size={16} />
        <input {...register('confirm_password')} type="password" placeholder="••••••••" className="auth-input" />
      </div>
      {errors.confirm_password && <p className="mt-1 text-xs" style={{ color: '#ff9db0' }}>{errors.confirm_password.message}</p>}

      {serverError && <div className="auth-error">{serverError}</div>}

      <button type="submit" disabled={loading} className="auth-btn">
        <span className="sh" />
        {loading ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  )
}
