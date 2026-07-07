'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {orgName && (
        <div className="px-3 py-2.5 rounded-lg bg-[#1789FC]/10 border border-[#1789FC]/20 text-sm text-[#5B6B7C]">
          Has sido invitado a <span className="text-[#0B2545] font-medium">{orgName}</span>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Email</label>
        <input
          value={email}
          disabled
          className="w-full px-3 py-2.5 rounded-lg bg-[#FFFFFF]/50 border border-[#E6EBF2] text-[#5B6B7C] cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Nombre completo</label>
        <input
          {...register('full_name')}
          type="text"
          placeholder="Tu nombre"
          className="w-full px-3 py-2.5 rounded-lg bg-[#FFFFFF] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors"
        />
        {errors.full_name && <p className="mt-1 text-xs text-[#EF4444]">{errors.full_name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Contraseña</label>
        <input
          {...register('password')}
          type="password"
          placeholder="Mínimo 8 caracteres"
          className="w-full px-3 py-2.5 rounded-lg bg-[#FFFFFF] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors"
        />
        {errors.password && <p className="mt-1 text-xs text-[#EF4444]">{errors.password.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Confirmar contraseña</label>
        <input
          {...register('confirm_password')}
          type="password"
          placeholder="••••••••"
          className="w-full px-3 py-2.5 rounded-lg bg-[#FFFFFF] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors"
        />
        {errors.confirm_password && <p className="mt-1 text-xs text-[#EF4444]">{errors.confirm_password.message}</p>}
      </div>

      {serverError && (
        <div className="px-3 py-2.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-sm">
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>
    </form>
  )
}
