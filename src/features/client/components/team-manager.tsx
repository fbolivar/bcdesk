'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Loader2, Copy, Check, Power, ShieldCheck, Trash2 } from 'lucide-react'
import { inviteOrgMember, toggleOrgMember, removeOrgMember } from '@/features/client/services/team.service'

export type Member = { id: string; full_name: string; email: string; is_active: boolean; is_org_admin?: boolean }

function initials(name: string) {
  return (name || '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function TeamManager({ members, selfId }: { members: Member[]; selfId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [inviting, startInvite] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)

  function invite() {
    setError(null); setCreated(null)
    startInvite(async () => {
      const res = await inviteOrgMember({ full_name: name, email })
      if ('error' in res) { setError(res.error); return }
      setCreated({ email: res.email, tempPassword: res.tempPassword })
      setName(''); setEmail('')
      router.refresh()
    })
  }

  async function toggle(m: Member) {
    setError(null); setTogglingId(m.id)
    const res = await toggleOrgMember(m.id, !m.is_active)
    setTogglingId(null)
    if (res?.error) { setError(res.error); return }
    router.refresh()
  }

  async function remove(m: Member) {
    if (!confirm(`¿Eliminar a ${m.full_name}? Esta acción es permanente.`)) return
    setError(null); setTogglingId(m.id)
    const res = await removeOrgMember(m.id)
    setTogglingId(null)
    if (res?.error) { setError(res.error); return }
    router.refresh()
  }

  async function copyCreds() {
    if (!created) return
    await navigator.clipboard.writeText(`Portal: hexdesk.fernandobolivar.app\nUsuario: ${created.email}\nContraseña temporal: ${created.tempPassword}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      {/* Invitar */}
      <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={15} className="text-[#0E9E86]" />
          <h2 className="text-sm font-semibold text-[#0B2545]">Invitar a un miembro de tu equipo</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[11px] text-[#5B6B7C] mb-1">Nombre completo</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre y apellido"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] text-[#5B6B7C] mb-1">Correo</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="persona@empresa.com"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]" />
          </div>
          <button onClick={invite} disabled={inviting || !name.trim() || !email.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium disabled:opacity-50">
            {inviting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Invitar
          </button>
        </div>
        <p className="text-[11px] text-[#94A3B8] mt-2">Se crea como usuario cliente de tu organización y recibe un correo de bienvenida con acceso al portal.</p>

        {error && <p className="mt-3 text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg px-3 py-2">{error}</p>}

        {created && (
          <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <p className="text-xs font-medium text-[#10B981] mb-1.5">Usuario creado. Comparte estos datos (se muestran una sola vez):</p>
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs text-[#0B2545]">{created.email} · {created.tempPassword}</code>
              <button onClick={copyCreds} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-[#E6EBF2] bg-white text-[#5B6B7C]">
                {copied ? <Check size={12} className="text-[#10B981]" /> : <Copy size={12} />} {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="text-[11px] text-[#5B6B7C] mt-1.5">También puede entrar y usar “¿Olvidaste tu contraseña?” para crear la suya.</p>
          </div>
        )}
      </div>

      {/* Miembros */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
        <div className="px-5 py-3 border-b border-[#E6EBF2]">
          <p className="text-sm font-semibold text-[#0B2545]">Miembros ({members.length})</p>
        </div>
        <div className="divide-y" style={{ borderColor: '#F4F7FB' }}>
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00D4AA] to-[#8B6FFF] flex items-center justify-center text-white font-bold text-xs shrink-0">
                {initials(m.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0B2545] truncate">{m.full_name}
                  {m.id === selfId && <span className="text-[10px] text-[#94A3B8] font-normal ml-1.5">(tú)</span>}
                  {m.is_org_admin && <span className="text-[10px] text-[#0E9E86] bg-[#00D4AA]/12 px-1.5 py-0.5 rounded-full ml-1.5 align-middle">Administrador</span>}
                </p>
                <p className="text-xs text-[#94A3B8] truncate">{m.email}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                style={m.is_active ? { color: '#10B981', background: 'rgba(16,185,129,0.12)' } : { color: '#94A3B8', background: '#E6EBF2' }}>
                {m.is_active ? 'Activo' : 'Inactivo'}
              </span>
              {m.id !== selfId && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggle(m)} disabled={togglingId === m.id}
                    title={m.is_active ? 'Desactivar acceso' : 'Reactivar acceso'}
                    className={`p-1.5 rounded-lg disabled:opacity-50 ${m.is_active ? 'text-[#5B6B7C] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10' : 'text-[#5B6B7C] hover:text-[#10B981] hover:bg-[#10B981]/10'}`}>
                    {togglingId === m.id ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
                  </button>
                  <button onClick={() => remove(m)} disabled={togglingId === m.id} title="Eliminar"
                    className="p-1.5 rounded-lg text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 disabled:opacity-50">
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
