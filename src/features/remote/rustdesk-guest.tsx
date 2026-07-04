'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Download, Send, ShieldCheck, CheckCircle2 } from 'lucide-react'

const RUSTDESK_DOWNLOAD = 'https://rustdesk.com/'

export function RustdeskGuest({ token, visitorName }: { token: string; visitorName: string }) {
  const [rdId, setRdId] = useState('')
  const [rdPass, setRdPass] = useState('')
  const [sent, setSent] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`rdctrl:${token}`, { config: { broadcast: { self: false } } })
    channelRef.current = channel
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [token])

  function submit() {
    const id = rdId.trim()
    if (!id) return
    channelRef.current?.send({ type: 'broadcast', event: 'creds', payload: { id, password: rdPass.trim() } })
    setSent(true)
  }

  return (
    <div className="max-w-lg mx-auto mt-10 px-4">
      <div className="rounded-2xl bg-white p-8" style={{ border: '1px solid #E6EBF2' }}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl" style={{ background: 'rgba(59,130,246,0.1)' }}>🛠️</div>
          <h1 className="text-lg font-semibold" style={{ color: '#0F172A' }}>Control remoto asistido</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>
            Hola {visitorName?.split(' ')[0] || ''} 👋 — sigue estos 3 pasos para que un técnico controle tu equipo y te ayude.
          </p>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: '#10B981' }} />
            <h2 className="text-base font-semibold" style={{ color: '#0F172A' }}>¡Datos enviados! 🎉</h2>
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>
              El técnico se conectará en breve. Verás una ventana de RustDesk pidiendo permiso —
              acéptala para que pueda ayudarte. 🙌
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Paso 1 */}
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#3B82F6', color: '#fff' }}>1</span>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: '#0F172A' }}>Descarga y abre RustDesk</p>
                <p className="text-xs mt-0.5 mb-2" style={{ color: '#64748B' }}>Es gratis y no necesita instalación (versión portable).</p>
                <a href={RUSTDESK_DOWNLOAD} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <Download size={15} /> Descargar RustDesk
                </a>
              </div>
            </div>

            {/* Paso 2 */}
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#3B82F6', color: '#fff' }}>2</span>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: '#0F172A' }}>Copia tu ID y contraseña</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>En RustDesk verás <strong>“Tu escritorio”</strong> con un <strong>ID</strong> y una <strong>contraseña</strong>.</p>
              </div>
            </div>

            {/* Paso 3 */}
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#3B82F6', color: '#fff' }}>3</span>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium" style={{ color: '#0F172A' }}>Pégalos aquí y envíalos al técnico</p>
                <input value={rdId} onChange={e => setRdId(e.target.value)} placeholder="ID de RustDesk (ej: 123 456 789)"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={{ background: '#F4F7FB', border: '1px solid #E6EBF2', color: '#0F172A' }} />
                <input value={rdPass} onChange={e => setRdPass(e.target.value)} placeholder="Contraseña de esta sesión"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={{ background: '#F4F7FB', border: '1px solid #E6EBF2', color: '#0F172A' }} />
                <button onClick={submit} disabled={!rdId.trim()}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#3B82F6', color: '#fff' }}>
                  <Send size={15} /> Enviar al técnico
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs pt-1" style={{ color: '#94A3B8' }}>
              <ShieldCheck size={12} /> Tú autorizas la conexión desde RustDesk y puedes cortarla cuando quieras.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
