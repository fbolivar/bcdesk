'use client'

import { useState } from 'react'
import { UserPlus, Check, Copy } from 'lucide-react'
import { createUserDirect } from '../services/admin.service'
import type { Role } from '@/lib/supabase/types'

export function CreateUserForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setCreated(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    setLoading(true)
    const result = await createUserDirect({
      full_name: fd.get('full_name') as string,
      email: fd.get('email') as string,
      role: fd.get('role') as Role,
    })
    setLoading(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    if (result?.tempPassword) {
      setCreated({ email: result.email!, tempPassword: result.tempPassword })
      form.reset()
    }
  }

  async function copyCreds() {
    if (!created) return
    await navigator.clipboard.writeText(`Email: ${created.email}\nContraseña temporal: ${created.tempPassword}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
      <h2 className="text-sm font-semibold text-[#1E293B] mb-4 flex items-center gap-2">
        <UserPlus size={16} className="text-[#3B82F6]" /> Crear usuario directo
      </h2>

      {created && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20">
          <p className="text-sm text-[#10B981] font-medium mb-2">Usuario creado. Comparte estas credenciales (se muestran una sola vez):</p>
          <div className="text-xs text-[#1E293B] font-mono space-y-1">
            <p>Email: {created.email}</p>
            <p>Contraseña temporal: <span className="text-[#10B981]">{created.tempPassword}</span></p>
          </div>
          <button
            onClick={copyCreds}
            className="mt-3 flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[#E6EBF2] text-[#64748B] hover:text-[#1E293B] hover:border-[#3B82F6]/40 transition-colors"
          >
            {copied ? <Check size={12} className="text-[#10B981]" /> : <Copy size={12} />}
            {copied ? 'Copiado' : 'Copiar credenciales'}
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Nombre completo *</label>
            <input
              name="full_name"
              required
              placeholder="Juan Pérez"
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors placeholder-[#64748B]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Email *</label>
            <input
              name="email"
              type="email"
              required
              placeholder="usuario@bcfabric.co"
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors placeholder-[#64748B]"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Rol</label>
            <select
              name="role"
              defaultValue="agent"
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
            >
              <option value="agent">Agente</option>
              <option value="admin">Administrador</option>
              <option value="client">Cliente</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <UserPlus size={14} /> {loading ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-3 text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
