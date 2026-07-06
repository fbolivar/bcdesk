'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Monitor, MonitorOff, Loader2, ShieldCheck, Mic, MicOff } from 'lucide-react'

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

type Status = 'idle' | 'connecting' | 'sharing' | 'ended' | 'error'

interface SignalPayload {
  type: 'offer' | 'answer' | 'ice' | 'host-ready'
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export function RemoteGuest({ token, visitorName }: { token: string; visitorName: string }) {
  const [status, setStatus] = useState<Status>('idle')
  const [err, setErr] = useState('')
  const [hasMic, setHasMic] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`remote:${token}`, { config: { broadcast: { self: false } } })
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'signal' }, async ({ payload }: { payload: SignalPayload }) => {
        const pc = pcRef.current
        if (payload.type === 'answer' && pc && pc.signalingState === 'have-local-offer' && payload.sdp) {
          try { await pc.setRemoteDescription(payload.sdp) } catch { /* ignore */ }
        } else if (payload.type === 'ice' && pc && pc.signalingState !== 'closed' && payload.candidate) {
          try { await pc.addIceCandidate(payload.candidate) } catch { /* ignore */ }
        } else if (payload.type === 'host-ready' && streamRef.current) {
          // El agente (re)conectó estando ya compartiendo → renegociar (makeOffer se auto-protege)
          await makeOffer()
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      streamRef.current?.getTracks().forEach(t => t.stop())
      pcRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function send(payload: SignalPayload) {
    channelRef.current?.send({ type: 'broadcast', event: 'signal', payload })
  }

  async function makeOffer() {
    const pc = pcRef.current
    // Solo ofertar desde un estado estable y con la conexión viva.
    if (!pc || pc.signalingState !== 'stable') return
    try {
      const offer = await pc.createOffer()
      if (pc.signalingState !== 'stable') return
      await pc.setLocalDescription(offer)
      send({ type: 'offer', sdp: offer })
    } catch { /* pc cerrado o estado inválido durante la renegociación */ }
  }

  async function startShare() {
    setErr('')
    setStatus('connecting')
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false })
      // Micrófono para hablar con el agente (opcional; si lo deniega, sigue solo pantalla)
      let mic: MediaStream | null = null
      try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { /* sin micrófono */ }
      micStreamRef.current = mic
      setHasMic(!!mic)

      const combined = new MediaStream([...screen.getTracks(), ...(mic ? mic.getAudioTracks() : [])])
      streamRef.current = combined

      const pc = new RTCPeerConnection(ICE)
      pcRef.current = pc
      pc.onicecandidate = e => { if (e.candidate) send({ type: 'ice', candidate: e.candidate.toJSON() }) }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setStatus('sharing')
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) setStatus('ended')
      }
      // Recibe y reproduce la voz del agente
      pc.ontrack = e => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = e.streams[0]
          remoteAudioRef.current.play().catch(() => {})
        }
      }
      combined.getTracks().forEach(t => pc.addTrack(t, combined))
      screen.getVideoTracks()[0].onended = stopShare
      await makeOffer()
      setStatus('sharing')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo compartir la pantalla')
      setStatus('error')
    }
  }

  function stopShare() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    micStreamRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    setStatus('ended')
  }

  function toggleMic() {
    const next = !micOn
    micStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = next })
    setMicOn(next)
  }

  return (
    <div className="max-w-lg mx-auto mt-10 px-4">
      <div className="rounded-2xl bg-white p-8 text-center" style={{ border: '1px solid #E6EBF2' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl" style={{ background: 'rgba(59,130,246,0.1)' }}>
          🖥️
        </div>
        <h1 className="text-lg font-semibold" style={{ color: '#0F172A' }}>Soporte remoto HexDesk</h1>
        <p className="text-sm mt-1 mb-6" style={{ color: '#64748B' }}>
          Hola {visitorName?.split(' ')[0] || ''} 👋 — comparte tu pantalla para que un técnico te ayude en vivo.
        </p>

        {status === 'idle' && (
          <>
            <button onClick={startShare}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
              style={{ background: '#3B82F6', color: '#fff' }}>
              <Monitor size={16} /> Compartir mi pantalla
            </button>
            <div className="flex items-center justify-center gap-1.5 mt-4 text-xs" style={{ color: '#94A3B8' }}>
              <ShieldCheck size={12} /> Tú controlas tu equipo. Solo verá tu pantalla; puedes detenerlo cuando quieras.
            </div>
          </>
        )}

        {status === 'connecting' && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm" style={{ color: '#3B82F6' }}>
            <Loader2 size={16} className="animate-spin" /> Conectando…
          </div>
        )}

        {status === 'sharing' && (
          <>
            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium mb-3"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" /> 🟢 Compartiendo tu pantalla {hasMic ? '· 🎙️ con voz' : ''}
            </div>
            <div className="flex gap-2">
              {hasMic && (
                <button onClick={toggleMic}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                  style={micOn
                    ? { background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }
                    : { background: '#F4F7FB', color: '#94A3B8', border: '1px solid #E6EBF2' }}>
                  {micOn ? <><Mic size={15} /> Mic activo</> : <><MicOff size={15} /> Mic silenciado</>}
                </button>
              )}
              <button onClick={stopShare}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                <MonitorOff size={15} /> Finalizar
              </button>
            </div>
            {!hasMic && (
              <p className="text-[11px] mt-3" style={{ color: '#94A3B8' }}>🔇 Sin micrófono — la voz no está disponible en esta sesión.</p>
            )}
          </>
        )}

        <audio ref={remoteAudioRef} autoPlay className="hidden" />

        {status === 'ended' && (
          <div className="py-4">
            <span className="text-3xl">✅</span>
            <p className="text-sm mt-2" style={{ color: '#64748B' }}>La sesión finalizó. ¡Gracias! 🙌</p>
            <button onClick={() => setStatus('idle')} className="mt-4 text-xs font-medium" style={{ color: '#3B82F6' }}>
              Volver a compartir
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="py-3">
            <p className="text-sm" style={{ color: '#EF4444' }}>⚠️ {err}</p>
            <button onClick={startShare} className="mt-3 text-xs font-medium" style={{ color: '#3B82F6' }}>Reintentar</button>
          </div>
        )}
      </div>
    </div>
  )
}
