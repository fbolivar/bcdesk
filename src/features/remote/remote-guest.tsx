'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Monitor, MonitorOff, Loader2, ShieldCheck } from 'lucide-react'

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
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`remote:${token}`, { config: { broadcast: { self: false } } })
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'signal' }, async ({ payload }: { payload: SignalPayload }) => {
        const pc = pcRef.current
        if (payload.type === 'answer' && pc && payload.sdp) {
          await pc.setRemoteDescription(payload.sdp)
        } else if (payload.type === 'ice' && pc && payload.candidate) {
          try { await pc.addIceCandidate(payload.candidate) } catch { /* ignore */ }
        } else if (payload.type === 'host-ready' && streamRef.current) {
          // El agente (re)conectó estando ya compartiendo → renegociar
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
    if (!pc) return
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send({ type: 'offer', sdp: offer })
  }

  async function startShare() {
    setErr('')
    setStatus('connecting')
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false })
      streamRef.current = stream

      const pc = new RTCPeerConnection(ICE)
      pcRef.current = pc
      pc.onicecandidate = e => { if (e.candidate) send({ type: 'ice', candidate: e.candidate.toJSON() }) }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setStatus('sharing')
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) setStatus('ended')
      }
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      stream.getVideoTracks()[0].onended = stopShare
      await makeOffer()
      setStatus('sharing')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo compartir la pantalla')
      setStatus('error')
    }
  }

  function stopShare() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    pcRef.current?.close()
    setStatus('ended')
  }

  return (
    <div className="max-w-lg mx-auto mt-10 px-4">
      <div className="rounded-2xl bg-white p-8 text-center" style={{ border: '1px solid #E6EBF2' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl" style={{ background: 'rgba(59,130,246,0.1)' }}>
          🖥️
        </div>
        <h1 className="text-lg font-semibold" style={{ color: '#0F172A' }}>Soporte remoto BCDesk</h1>
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
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" /> 🟢 Compartiendo tu pantalla
            </div>
            <button onClick={stopShare}
              className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              <MonitorOff size={15} /> Detener y finalizar
            </button>
          </>
        )}

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
