'use client'

import { useState } from 'react'
import Link from 'next/link'
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
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold text-[#1E293B] mb-1">Crear cuenta</h1>
      <p className="text-sm text-[#64748B] mb-6">Accede al portal BCDesk</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Nombre completo</label>
          <input
            name="full_name"
            required
            placeholder="Felipe Bolívar"
            className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm placeholder:text-[#CBD5E1] focus:outline-none focus:border-[#3B82F6] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Email</label>
          <input
            name="email"
            type="email"
            required
            placeholder="tu@empresa.com"
            className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm placeholder:text-[#CBD5E1] focus:outline-none focus:border-[#3B82F6] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Contraseña</label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
            className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm placeholder:text-[#CBD5E1] focus:outline-none focus:border-[#3B82F6] transition-colors"
          />
        </div>

        {error && (
          <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <p className="text-center text-sm text-[#64748B] mt-6">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-[#3B82F6] hover:text-[#60A5FA]">
          Ingresar
        </Link>
      </p>
    </div>
  )
}
