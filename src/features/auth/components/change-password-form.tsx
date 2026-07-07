'use client'

import { useState } from 'react'
import { changePassword } from '../services/auth.service'

const inputStyle = {
  background: '#F4F7FB',
  border: '1px solid #E6EBF2',
  color: '#0B2545',
}

export function ChangePasswordForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const form = e.currentTarget
    const fd = new FormData(form)
    const current = (fd.get('current_password') as string) ?? ''
    const next = (fd.get('new_password') as string) ?? ''
    const confirm = (fd.get('confirm_password') as string) ?? ''

    if (next !== confirm) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }
    if (next.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }

    setLoading(true)
    const result = await changePassword(current, next)
    setLoading(false)

    if (result?.error) {
      setError(result.error)
      return
    }
    setSuccess(true)
    form.reset()
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl p-5 space-y-4"
      style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
    >
      <div>
        <h2 className="text-sm font-semibold" style={{ color: '#0B2545' }}>Cambiar contraseña</h2>
        <p className="text-xs mt-0.5" style={{ color: '#5B6B7C' }}>
          Ingresa tu contraseña actual y la nueva
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: '#5B6B7C' }}>
          Contraseña actual
        </label>
        <input
          name="current_password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
          style={inputStyle}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#5B6B7C' }}>
            Nueva contraseña
          </label>
          <input
            name="new_password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#5B6B7C' }}>
            Confirmar nueva contraseña
          </label>
          <input
            name="confirm_password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Repite la contraseña"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
            style={inputStyle}
          />
        </div>
      </div>

      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.2)', color: '#FF4D6A' }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(16,217,138,0.08)', border: '1px solid rgba(16,217,138,0.2)', color: '#10D98A' }}
        >
          Contraseña actualizada correctamente.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#1789FC', color: '#fff' }}
        >
          {loading ? 'Guardando...' : 'Actualizar contraseña'}
        </button>
      </div>
    </form>
  )
}
