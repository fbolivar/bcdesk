'use client'

import { useState } from 'react'
import { UserPlus, Check, Copy } from 'lucide-react'
import { createUserDirect } from '../services/admin.service'
import type { Role } from '@/lib/supabase/types'

export function CreateUserForm({ organizations = [] }: { organizations?: { id: string; name: string }[] }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [role, setRole] = useState<Role>('agent')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setCreated(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    const selectedRole = fd.get('role') as Role
    if (selectedRole === 'client' && !fd.get('organization_id')) {
      setError('Selecciona la organización del cliente.')
      return
    }
    setLoading(true)
    const result = await createUserDirect({
      full_name: fd.get('full_name') as string,
      email: fd.get('email') as string,
      role: selectedRole,
      organization_id: (fd.get('organization_id') as string) || null,
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
      <h2 className="text-sm font-semibold text-[#0B2545] mb-4 flex items-center gap-2">
        <UserPlus size={16} className="text-[#0E9E86]" /> Crear usuario directo
      </h2>

      {created && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20">
          <p className="text-sm text-[#10B981] font-medium mb-2">Usuario creado. Comparte estas credenciales (se muestran una sola vez):</p>
          <div className="text-xs text-[#0B2545] font-mono space-y-1">
            <p>Email: {created.email}</p>
            <p>Contraseña temporal: <span className="text-[#10B981]">{created.tempPassword}</span></p>
          </div>
          <button
            onClick={copyCreds}
            className="mt-3 flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[#E6EBF2] text-[#5B6B7C] hover:text-[#0B2545] hover:border-[#00D4AA]/40 transition-colors"
          >
            {copied ? <Check size={12} className="text-[#10B981]" /> : <Copy size={12} />}
            {copied ? 'Copiado' : 'Copiar credenciales'}
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Nombre completo *</label>
            <input
              name="full_name"
              required
              placeholder="Juan Pérez"
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] transition-colors placeholder-[#5B6B7C]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Email *</label>
            <input
              name="email"
              type="email"
              required
              placeholder="usuario@bcfabric.co"
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] transition-colors placeholder-[#5B6B7C]"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Rol</label>
            <select
              name="role"
              value={role}
              onChange={e => setRole(e.target.value as Role)}
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] transition-colors"
            >
              <option value="agent">Agente</option>
              <option value="admin">Administrador</option>
              <option value="client">Cliente</option>
            </select>
          </div>
          {role === 'client' && (
            <div>
              <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Organización *</label>
              <select
                name="organization_id"
                defaultValue=""
                className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] transition-colors"
              >
                <option value="" disabled>Selecciona…</option>
                {organizations.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors disabled:opacity-50"
        >
          <UserPlus size={14} /> {loading ? 'Creando...' : 'Crear usuario'}
        </button>
        {role === 'client' && organizations.length === 0 && (
          <p className="text-xs text-[#F59E0B]">Primero crea una organización abajo para poder asignar clientes.</p>
        )}
      </form>

      {error && (
        <p className="mt-3 text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
