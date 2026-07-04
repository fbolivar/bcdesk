'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, MessageSquare, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Session {
  id: string
  visitor_name: string
  status: 'waiting' | 'active' | 'closed'
  agent_id: string | null
  subject: string | null
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  session_id: string
  sender_type: 'visitor' | 'agent' | 'bot'
  sender_name: string
  content: string
  created_at: string
}

interface Props {
  userId: string
  userName: string
  userEmail: string
  organizationId: string | null
  initialSession: Session | null
}

export function ClientChatWindow({ userId, userName, userEmail, organizationId, initialSession }: Props) {
  const [session, setSession] = useState<Session | null>(initialSession)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [subject, setSubject] = useState('')
  const [starting, setStarting] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!session) return
    loadMessages(session.id)

    const channel = supabase
      .channel(`client-chat-${session.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `session_id=eq.${session.id}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'chat_sessions',
        filter: `id=eq.${session.id}`,
      }, payload => {
        setSession(prev => prev ? { ...prev, ...(payload.new as Session) } : prev)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session?.id])

  async function loadMessages(sessionId: string) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function startChat() {
    if (!subject.trim()) return
    setStarting(true)
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        visitor_id: userId,
        visitor_name: userName,
        visitor_email: userEmail,
        organization_id: organizationId,
        subject: subject.trim(),
        status: 'waiting',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (!error && data) {
      setSession(data as Session)
      // Mensaje de bienvenida automático
      await supabase.from('chat_messages').insert({
        session_id: data.id,
        sender_type: 'bot',
        sender_name: 'BCDesk',
        content: `¡Hola ${userName}! Tu chat ha sido iniciado sobre "${subject}". Un agente se unirá en breve.`,
      })
    }
    setStarting(false)
  }

  async function sendMessage() {
    if (!input.trim() || !session) return
    setSending(true)
    const content = input.trim()
    setInput('')
    await supabase.from('chat_messages').insert({
      session_id: session.id,
      sender_id: userId,
      sender_type: 'visitor',
      sender_name: userName,
      content,
    })
    setSending(false)
  }

  // Estado: sin sesión activa → formulario de inicio
  if (!session) {
    return (
      <div className="rounded-2xl p-8" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(79,138,255,0.1)' }}>
            <MessageSquare size={24} style={{ color: '#4F8AFF' }} />
          </div>
          <h2 className="text-base font-semibold mb-1" style={{ color: '#0F172A' }}>Inicia un chat</h2>
          <p className="text-sm" style={{ color: '#64748B' }}>Nuestro equipo te responderá en minutos</p>
        </div>
        <div className="space-y-4 max-w-sm mx-auto">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>¿En qué te podemos ayudar?</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startChat()}
              placeholder="Ej: Problema con una factura, duda técnica..."
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ background: '#F4F7FB', border: '1px solid #E6EBF2', color: '#0F172A' }}
            />
          </div>
          <button
            onClick={startChat}
            disabled={!subject.trim() || starting}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#4F8AFF', color: '#fff' }}
          >
            {starting ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
            {starting ? 'Iniciando...' : 'Iniciar chat'}
          </button>
        </div>
      </div>
    )
  }

  // Estado: sesión cerrada
  if (session.status === 'closed') {
    return (
      <div className="rounded-2xl p-8 flex flex-col items-center text-center" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
        <CheckCircle2 size={36} style={{ color: '#10D98A' }} className="mb-3" />
        <h2 className="text-base font-semibold mb-1" style={{ color: '#0F172A' }}>Chat finalizado</h2>
        <p className="text-sm mb-5" style={{ color: '#64748B' }}>La conversación ha sido cerrada.</p>
        <button
          onClick={() => setSession(null)}
          className="px-5 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(79,138,255,0.12)', color: '#4F8AFF', border: '1px solid rgba(79,138,255,0.2)' }}
        >
          Iniciar nuevo chat
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ height: 520, background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: '1px solid #E6EBF2' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'linear-gradient(135deg, #4F8AFF, #8B6FFF)', color: '#fff' }}>
          BC
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: '#0F172A' }}>Soporte BCDesk</p>
          <div className="flex items-center gap-1.5">
            {session.status === 'waiting' ? (
              <>
                <Clock size={10} style={{ color: '#FFB547' }} />
                <span className="text-[10px]" style={{ color: '#FFB547' }}>Esperando agente...</span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-[10px]" style={{ color: '#10D98A' }}>Agente conectado</span>
              </>
            )}
          </div>
        </div>
        {session.subject && (
          <span className="text-xs px-2 py-1 rounded-lg truncate max-w-[140px]" style={{ background: '#F4F7FB', color: '#64748B' }}>
            {session.subject}
          </span>
        )}
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.map(msg => {
          const isMe = msg.sender_type === 'visitor'
          const isBot = msg.sender_type === 'bot'
          return (
            <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                style={{
                  background: isBot ? 'rgba(139,111,255,0.2)' : isMe ? 'rgba(79,138,255,0.2)' : 'rgba(16,217,138,0.2)',
                  color: isBot ? '#8B6FFF' : isMe ? '#4F8AFF' : '#10D98A',
                }}
              >
                {isBot ? '🤖' : msg.sender_name.charAt(0).toUpperCase()}
              </div>
              <div className={`max-w-[75%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                  style={isMe
                    ? { background: 'rgba(79,138,255,0.18)', color: '#0F172A', borderBottomRightRadius: 4 }
                    : { background: '#E6EBF2', color: '#0F172A', borderBottomLeftRadius: 4 }
                  }
                >
                  {msg.content}
                </div>
                <span className="text-[10px]" style={{ color: '#94A3B8' }}>
                  {formatDistanceToNow(new Date(msg.created_at), { locale: es, addSuffix: true })}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid #E6EBF2' }}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Escribe tu mensaje..."
            className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{ background: '#F4F7FB', border: '1px solid #E6EBF2', color: '#0F172A' }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
            style={{ background: '#4F8AFF' }}
          >
            <Send size={15} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  )
}
