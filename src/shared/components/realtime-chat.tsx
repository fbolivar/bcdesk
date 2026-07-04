'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface Props {
  role: 'admin' | 'agent'
  userId: string
}

/** Tono corto de notificación (Web Audio, sin archivos externos / CSP-safe). */
function ping() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1180, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch { /* el navegador puede bloquear audio sin interacción previa */ }
}

/**
 * Notifica visualmente a agentes y admins (en cualquier pantalla) cuando un
 * cliente inicia un chat o envía un mensaje, para que tomen la conversación.
 */
export function RealtimeChat({ role }: Props) {
  useEffect(() => {
    const supabase = createClient()
    const chatUrl = `/${role}/chat`
    const onChatPage = () => typeof window !== 'undefined' && window.location.pathname.startsWith(chatUrl)

    const channel = supabase
      .channel('chat-realtime-notify')
      // Cliente inicia un chat → sesión en espera
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_sessions' }, (payload) => {
        const s = payload.new as { status: string; visitor_name: string; subject: string | null }
        if (s.status !== 'waiting') return
        ping()
        toast(`🙋 ${s.visitor_name} necesita ayuda`, {
          description: s.subject ? `💬 ${s.subject}` : 'Un cliente inició un chat en vivo',
          action: { label: 'Atender', onClick: () => { window.location.href = chatUrl } },
          duration: 12000,
          className: 'chat-toast',
        })
      })
      // Sesión reabierta / vuelve a espera
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_sessions' }, (payload) => {
        const prev = payload.old as { status?: string }
        const next = payload.new as { status: string; visitor_name: string }
        if (prev.status !== 'waiting' && next.status === 'waiting') {
          ping()
          toast(`🙋 ${next.visitor_name} está esperando`, {
            description: 'Un chat volvió a la cola de espera',
            action: { label: 'Atender', onClick: () => { window.location.href = chatUrl } },
            duration: 10000,
          })
        }
      })
      // Cliente escribe un mensaje
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const m = payload.new as { sender_type: string; sender_name: string; content: string }
        if (m.sender_type !== 'visitor') return
        if (onChatPage()) return // ya lo ve en el módulo de chat
        ping()
        const preview = m.content.length > 60 ? m.content.slice(0, 60) + '…' : m.content
        toast(`💬 ${m.sender_name}`, {
          description: preview,
          action: { label: 'Responder', onClick: () => { window.location.href = chatUrl } },
          duration: 8000,
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [role])

  return null
}
