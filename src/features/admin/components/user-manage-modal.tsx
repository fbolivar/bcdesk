'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, KeyRound, Check, Copy, Save } from 'lucide-react'
import { updateUser, resetUserPassword, setUserPassword } from '../services/admin.service'

interface ManagedUser {
  id: string
  full_name: string
  email: string
  phone?: string | null
  role: string
}

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] transition-colors placeholder-[#94A3B8]'

export function UserManageModal({ user }: { user: ManagedUser }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [fullName, setFullName] = useState(user.full_name)
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(user.phone ?? '')

  const [newPass, setNewPass] = useState('')
  const [tempPass, setTempPass] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function save() {
    setSaving(true); setMsg(null)
    const r = await updateUser({ userId: user.id, full_name: fullName, email, phone })
    setSaving(false)
    if (r.error) { setMsg({ type: 'err', text: r.error }); return }
    setMsg({ type: 'ok', text: 'Datos actualizados ✓' })
    router.refresh()
  }

  async function generateTemp() {
    setMsg(null); setTempPass(null)
    const r = await resetUserPassword(user.id)
    if (r.error) { setMsg({ type: 'err', text: r.error }); return }
    setTempPass(r.tempPassword!)
  }

  async function applyPass() {
    if (newPass.length < 8) { setMsg({ type: 'err', text: 'Mínimo 8 caracteres.' }); return }
    setMsg(null)
    const r = await setUserPassword(user.id, newPass)
    if (r.error) { setMsg({ type: 'err', text: r.error }); return }
    setNewPass(''); setTempPass(null)
    setMsg({ type: 'ok', text: 'Contraseña actualizada ✓' })
  }

  async function copyTemp() {
    if (!tempPass) return
    await navigator.clipboard.writeText(`Email: ${email}\nContraseña temporal: ${tempPass}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setMsg(null) }}
        title="Editar / contraseña"
        className="p-1.5 rounded-lg text-[#5B6B7C] hover:text-[#0E9E86] hover:bg-[#00D4AA]/10 transition-colors shrink-0"
      >
        <Pencil size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.45)' }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(16,24,40,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E6EBF2' }}>
              <h3 className="text-sm font-semibold text-[#0B2545]">Gestionar usuario</h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0B2545] hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Datos */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Nombre completo</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Teléfono</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+57 300 000 0000" className={inputCls} />
                </div>
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors disabled:opacity-50">
                  <Save size={14} /> {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>

              {/* Contraseña */}
              <div className="pt-4 space-y-3" style={{ borderTop: '1px solid #E6EBF2' }}>
                <h4 className="text-xs font-semibold text-[#0B2545] flex items-center gap-1.5"><KeyRound size={13} className="text-[#8B5CF6]" /> Contraseña</h4>

                <button onClick={generateTemp}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#8B5CF6]/30 text-[#8B5CF6] hover:bg-[#8B5CF6]/10 text-sm font-medium transition-colors">
                  Generar contraseña temporal
                </button>

                {tempPass && (
                  <div className="px-3 py-2.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20">
                    <p className="text-[11px] text-[#10B981] mb-1">Contraseña temporal (se muestra una vez):</p>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-sm font-mono text-[#0B2545]">{tempPass}</code>
                      <button onClick={copyTemp} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-[#E6EBF2] text-[#5B6B7C] hover:text-[#0B2545]">
                        {copied ? <Check size={12} className="text-[#10B981]" /> : <Copy size={12} />} {copied ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input type="text" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="…o define una (mín. 8)" className={inputCls} />
                  <button onClick={applyPass} className="px-3 py-2 rounded-lg bg-[#F1F5F9] hover:bg-[#E6EBF2] text-[#0B2545] text-sm font-medium transition-colors shrink-0">Establecer</button>
                </div>
              </div>

              {msg && (
                <p className={`text-xs px-3 py-2 rounded-lg ${msg.type === 'ok' ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20' : 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20'}`}>
                  {msg.text}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
