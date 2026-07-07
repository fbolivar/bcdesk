'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check, Maximize2, Radio, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { logRemoteSession } from './log-remote-session'

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

type Status = 'waiting' | 'live' | 'ended'

interface SignalPayload {
  type: 'offer' | 'answer' | 'ice' | 'host-ready'
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export function RemoteHost({ token, clientLink, ticketId }: { token: string; clientLink: string; ticketId?: string }) {
  const [status, setStatus] = useState<Status>('waiting')
  const [copied, setCopied] = useState(false)
  const [listening, setListening] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [hasMic, setHasMic] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const loggedRef = useRef(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    if (status === 'live' && ticketId && !loggedRef.current) {
      loggedRef.current = true
      logRemoteSession({ ticketId, type: 'screen' })
    }
  }, [status, ticketId])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`remote:${token}`, { config: { broadcast: { self: false } } })
    channelRef.current = channel

    const send = (payload: SignalPayload) => channel.send({ type: 'broadcast', event: 'signal', payload })

    channel
      .on('broadcast', { event: 'signal' }, async ({ payload }: { payload: SignalPayload }) => {
        if (payload.type === 'offer' && payload.sdp) {
          pcRef.current?.close() // renegociación: descarta el pc anterior
          const pc = new RTCPeerConnection(ICE)
          pcRef.current = pc
          try {
          pc.ontrack = e => {
            if (videoRef.current) {
              videoRef.current.srcObject = e.streams[0]
              videoRef.current.play().catch(() => {})
              setStatus('live')
            }
          }
          pc.onicecandidate = ev => { if (ev.candidate) send({ type: 'ice', candidate: ev.candidate.toJSON() }) }
          pc.onconnectionstatechange = () => {
            if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) setStatus('ended')
          }
          await pc.setRemoteDescription(payload.sdp)
          // Micrófono del agente para voz bidireccional (opcional)
          if (!micStreamRef.current) {
            try {
              micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
              setHasMic(true)
            } catch { /* sin micrófono */ }
          }
          const mic = micStreamRef.current
          if (mic) mic.getAudioTracks().forEach(t => { t.enabled = micOn; pc.addTrack(t, mic) })
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          send({ type: 'answer', sdp: answer })
          } catch { /* pc cerrado o estado inválido */ }
        } else if (payload.type === 'ice' && pcRef.current && pcRef.current.signalingState !== 'closed' && payload.candidate) {
          try { await pcRef.current.addIceCandidate(payload.candidate) } catch { /* ignore */ }
        }
      })
      .subscribe((st) => { if (st === 'SUBSCRIBED') send({ type: 'host-ready' }) })

    return () => {
      supabase.removeChannel(channel)
      pcRef.current?.close()
      micStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [token])

  function toggleListen() {
    const next = !listening
    if (videoRef.current) videoRef.current.muted = !next
    setListening(next)
  }

  function toggleMic() {
    const next = !micOn
    micStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = next })
    setMicOn(next)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(clientLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function fullscreen() {
    videoRef.current?.requestFullscreen?.()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: '#0B2545' }}>
          🖥️ Sesión de soporte remoto
        </h1>
        <span className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5"
          style={status === 'live'
            ? { background: 'rgba(16,185,129,0.15)', color: '#10B981' }
            : status === 'ended'
            ? { background: 'rgba(239,68,68,0.12)', color: '#EF4444' }
            : { background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
          <Radio size={12} className={status !== 'ended' ? 'animate-pulse' : ''} />
          {status === 'live' ? '🟢 En vivo' : status === 'ended' ? 'Finalizada' : '⏳ Esperando al cliente'}
        </span>
      </div>

      {/* Link para el cliente */}
      <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #E6EBF2' }}>
        <p className="text-xs font-medium mb-2" style={{ color: '#5B6B7C' }}>
          📎 Comparte este link con el cliente para que inicie la sesión:
        </p>
        <div className="flex gap-2">
          <input readOnly value={clientLink}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-mono truncate"
            style={{ background: '#F4F7FB', border: '1px solid #E6EBF2', color: '#0B2545' }} />
          <button onClick={copyLink}
            className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
            style={{ background: copied ? 'rgba(16,185,129,0.12)' : '#1789FC', color: copied ? '#10B981' : '#fff' }}>
            {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
          </button>
        </div>
      </div>

      {/* Vista de la pantalla del cliente */}
      <div className="rounded-2xl overflow-hidden relative bg-[#0B2545]" style={{ border: '1px solid #E6EBF2', minHeight: 380 }}>
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto max-h-[70vh]" />
        {status !== 'live' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            {status === 'waiting' ? (
              <>
                <span className="text-4xl animate-pulse">🖥️</span>
                <p className="text-sm font-medium text-white/90">Esperando a que el cliente comparta su pantalla…</p>
                <p className="text-xs text-white/50">Envíale el link de arriba. Aparecerá aquí en cuanto acepte 👆</p>
              </>
            ) : (
              <>
                <span className="text-4xl">👋</span>
                <p className="text-sm font-medium text-white/90">La sesión finalizó</p>
              </>
            )}
          </div>
        )}
        {status === 'live' && (
          <>
            <button onClick={fullscreen} title="Pantalla completa"
              className="absolute top-3 right-3 w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(15,23,42,0.7)', color: '#fff' }}>
              <Maximize2 size={16} />
            </button>
            <div className="absolute bottom-3 left-3 flex gap-2">
              <button onClick={toggleListen} title="Escuchar al cliente"
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium"
                style={{ background: listening ? '#10B981' : 'rgba(15,23,42,0.7)', color: '#fff' }}>
                {listening ? <Volume2 size={15} /> : <VolumeX size={15} />}
                {listening ? 'Escuchando' : 'Escuchar'}
              </button>
              {hasMic && (
                <button onClick={toggleMic} title="Tu micrófono"
                  className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium"
                  style={{ background: micOn ? '#1789FC' : 'rgba(15,23,42,0.7)', color: '#fff' }}>
                  {micOn ? <Mic size={15} /> : <MicOff size={15} />}
                  {micOn ? 'Mic' : 'Mic off'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <p className="text-xs" style={{ color: '#94A3B8' }}>
        💡 Sesión de <strong>visualización guiada + voz</strong>: ves la pantalla del cliente y pueden hablarse en vivo
        (pulsa <strong>Escuchar</strong> para oírlo). Para <strong>control total</strong> del mouse/teclado usa una
        herramienta de la sección de arriba (p. ej. RustDesk).
      </p>
    </div>
  )
}
