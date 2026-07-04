'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check, Radio, MonitorPlay, KeyRound } from 'lucide-react'

interface Creds { id: string; password: string }

export function RustdeskHost({ token, clientLink }: { token: string; clientLink: string }) {
  const [creds, setCreds] = useState<Creds | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedPass, setCopiedPass] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`rdctrl:${token}`, { config: { broadcast: { self: false } } })
    channelRef.current = channel
    channel
      .on('broadcast', { event: 'creds' }, ({ payload }: { payload: Creds }) => {
        setCreds({ id: (payload.id || '').replace(/\s+/g, ''), password: payload.password || '' })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [token])

  async function copy(text: string, which: 'link' | 'pass') {
    await navigator.clipboard.writeText(text)
    if (which === 'link') { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000) }
    else { setCopiedPass(true); setTimeout(() => setCopiedPass(false), 2000) }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: '#1E293B' }}>🛠️ Control remoto (RustDesk)</h1>
        <span className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5"
          style={creds ? { background: 'rgba(16,185,129,0.15)', color: '#10B981' } : { background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
          <Radio size={12} className="animate-pulse" />
          {creds ? '🟢 Datos recibidos' : '⏳ Esperando al cliente'}
        </span>
      </div>

      {/* Link para el cliente */}
      <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #E6EBF2' }}>
        <p className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>📎 Comparte este link con el cliente:</p>
        <div className="flex gap-2">
          <input readOnly value={clientLink} className="flex-1 px-3 py-2 rounded-lg text-sm font-mono truncate"
            style={{ background: '#F4F7FB', border: '1px solid #E6EBF2', color: '#1E293B' }} />
          <button onClick={() => copy(clientLink, 'link')}
            className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
            style={{ background: copiedLink ? 'rgba(16,185,129,0.12)' : '#3B82F6', color: copiedLink ? '#10B981' : '#fff' }}>
            {copiedLink ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
          </button>
        </div>
      </div>

      {/* Datos del cliente + conectar */}
      {creds ? (
        <div className="rounded-xl bg-white p-5 space-y-4" style={{ border: '1px solid #E6EBF2' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>ID de RustDesk</p>
              <p className="text-lg font-mono font-semibold" style={{ color: '#0F172A' }}>{creds.id || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>Contraseña</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-mono font-semibold" style={{ color: '#0F172A' }}>{creds.password || '—'}</p>
                {creds.password && (
                  <button onClick={() => copy(creds.password, 'pass')} title="Copiar contraseña"
                    className="p-1 rounded" style={{ color: copiedPass ? '#10B981' : '#64748B' }}>
                    {copiedPass ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          <a href={`rustdesk://${creds.id}`}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
            style={{ background: '#3B82F6', color: '#fff' }}>
            <MonitorPlay size={16} /> Conectar con RustDesk
          </a>
          <p className="text-xs flex items-start gap-1.5" style={{ color: '#94A3B8' }}>
            <KeyRound size={12} className="mt-0.5 shrink-0" />
            Al pulsar "Conectar" se abre RustDesk con el ID del cliente. Cuando pida la contraseña, pega la de arriba.
            Si el botón no abre RustDesk, ingresa el ID manualmente en la app.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-8 text-center" style={{ border: '1px solid #E6EBF2' }}>
          <span className="text-3xl">⏳</span>
          <p className="text-sm font-medium mt-2" style={{ color: '#0F172A' }}>Esperando a que el cliente envíe su ID y contraseña…</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Envíale el link de arriba. Aparecerán aquí en cuanto los mande. 👆</p>
        </div>
      )}
    </div>
  )
}
