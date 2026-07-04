'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, UserCheck, X, Smile } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Session {
  id: string
  visitor_name: string
  visitor_email: string | null
  subject: string | null
  status: 'waiting' | 'active' | 'closed'
  agent_id: string | null
  updated_at: string
  created_at: string
  agent?: { full_name: string } | null
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
  agentId: string
  agentName: string
  initialSessions: Session[]
}

const QUICK_EMOJIS = ['😊', '👍', '🙏', '✅', '🎉', '👀', '🚀', '❤️']

export function AdminChatShell({ agentId, agentName, initialSessions }: Props) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-chat-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, payload => {
        if (payload.eventType === 'INSERT') {
          setSessions(prev => [payload.new as Session, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Session
          setSessions(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s)
            .filter(s => s.status !== 'closed'))
          setActiveSession(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev)
        } else if (payload.eventType === 'DELETE') {
          setSessions(prev => prev.filter(s => s.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!activeSession) return
    loadMessages(activeSession.id)

    const channel = supabase
      .channel(`chat-messages-${activeSession.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `session_id=eq.${activeSession.id}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeSession?.id])

  async function loadMessages(sessionId: string) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function claimSession(session: Session) {
    await supabase.from('chat_sessions').update({ agent_id: agentId, status: 'active' }).eq('id', session.id)
    setActiveSession({ ...session, agent_id: agentId, status: 'active' })
    await supabase.from('chat_messages').insert({
      session_id: session.id,
      sender_id: agentId,
      sender_type: 'agent',
      sender_name: agentName,
      content: `👋 ¡Hola ${session.visitor_name.split(' ')[0]}! Soy ${agentName.split(' ')[0]} y te ayudaré con esto.`,
    })
  }

  async function closeSession(sessionId: string) {
    await supabase.from('chat_sessions').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', sessionId)
    if (activeSession?.id === sessionId) setActiveSession(null)
  }

  async function sendMessage() {
    if (!input.trim() || !activeSession) return
    setSending(true)
    const content = input.trim()
    setInput('')
    setShowEmojis(false)
    await supabase.from('chat_messages').insert({
      session_id: activeSession.id,
      sender_id: agentId,
      sender_type: 'agent',
      sender_name: agentName,
      content,
    })
    setSending(false)
  }

  function addEmoji(e: string) {
    setInput(prev => prev + e)
    inputRef.current?.focus()
  }

  const waiting = sessions.filter(s => s.status === 'waiting')
  const active = sessions.filter(s => s.status === 'active')

  return (
    <div className="flex h-[calc(100vh-80px)] rounded-2xl overflow-hidden bg-white" style={{ border: '1px solid #E6EBF2' }}>
      {/* Panel izquierdo: sesiones */}
      <div className="w-72 flex flex-col shrink-0 bg-white" style={{ borderRight: '1px solid #E6EBF2' }}>
        <div className="px-4 py-4" style={{ borderBottom: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: '#0F172A' }}>
            💬 Chat en vivo
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <div className="text-xl font-bold" style={{ color: '#F59E0B' }}>{waiting.length}</div>
              <div className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>⏳ En espera</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div className="text-xl font-bold" style={{ color: '#10B981' }}>{active.length}</div>
              <div className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>🟢 Activos</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 px-4 text-center">
              <span className="text-3xl">🌙</span>
              <p className="text-xs" style={{ color: '#94A3B8' }}>Todo tranquilo por ahora</p>
              <p className="text-[10px]" style={{ color: '#CBD5E1' }}>Te avisaremos cuando un cliente escriba</p>
            </div>
          ) : (
            <>
              {waiting.length > 0 && (
                <div className="px-3 mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: '#F59E0B' }}>
                    🙋 En espera ({waiting.length})
                  </p>
                  {waiting.map(s => (
                    <SessionCard key={s.id} session={s} isActive={activeSession?.id === s.id} onClick={() => setActiveSession(s)} />
                  ))}
                </div>
              )}
              {active.length > 0 && (
                <div className="px-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 mt-2 flex items-center gap-1" style={{ color: '#10B981' }}>
                    💚 Activos ({active.length})
                  </p>
                  {active.map(s => (
                    <SessionCard key={s.id} session={s} isActive={activeSession?.id === s.id} onClick={() => setActiveSession(s)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Panel derecho: conversación */}
      <div className="flex-1 flex flex-col" style={{ background: '#F7F9FC' }}>
        {activeSession ? (
          <>
            {/* Header */}
            <div className="px-5 py-3.5 flex items-center justify-between bg-white" style={{ borderBottom: '1px solid #E6EBF2' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: '#fff' }}>
                  {activeSession.visitor_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: '#0F172A' }}>
                    {activeSession.visitor_name}
                    {activeSession.status === 'waiting'
                      ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>⏳ esperando</span>
                      : <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>🟢 en vivo</span>}
                  </p>
                  {activeSession.subject && <p className="text-xs" style={{ color: '#64748B' }}>💬 {activeSession.subject}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeSession.status === 'waiting' && (
                  <button onClick={() => claimSession(activeSession)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-transform hover:scale-105"
                    style={{ background: '#10B981', color: '#fff' }}>
                    <UserCheck size={13} /> Tomar chat
                  </button>
                )}
                <button onClick={() => closeSession(activeSession.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <X size={13} /> Cerrar
                </button>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <span className="text-3xl">✍️</span>
                  <p className="text-sm" style={{ color: '#94A3B8' }}>Aún no hay mensajes</p>
                </div>
              )}
              {messages.map(msg => {
                const isAgent = msg.sender_type === 'agent'
                const isBot = msg.sender_type === 'bot'
                return (
                  <div key={msg.id} className={`flex gap-2.5 ${isAgent ? 'flex-row-reverse' : ''}`}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{
                        background: isBot ? 'rgba(139,92,246,0.15)' : isAgent ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                        color: isBot ? '#8B5CF6' : isAgent ? '#3B82F6' : '#10B981',
                      }}>
                      {isBot ? '🤖' : msg.sender_name.charAt(0).toUpperCase()}
                    </div>
                    <div className={`max-w-[70%] flex flex-col gap-1 ${isAgent ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px]" style={{ color: '#94A3B8' }}>{msg.sender_name}</span>
                      <div className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm"
                        style={isAgent
                          ? { background: '#3B82F6', color: '#fff', borderBottomRightRadius: 4 }
                          : { background: '#fff', color: '#0F172A', border: '1px solid #E6EBF2', borderBottomLeftRadius: 4 }}>
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
            <div className="px-5 py-3.5 bg-white" style={{ borderTop: '1px solid #E6EBF2' }}>
              {activeSession.status === 'waiting' ? (
                <div className="text-center py-2">
                  <p className="text-xs mb-2" style={{ color: '#64748B' }}>🙌 Toma el chat para poder responder</p>
                  <button onClick={() => claimSession(activeSession)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-transform hover:scale-105"
                    style={{ background: '#10B981', color: '#fff' }}>
                    <UserCheck size={14} className="inline mr-1.5" /> Tomar chat
                  </button>
                </div>
              ) : (
                <>
                  {showEmojis && (
                    <div className="flex gap-1 mb-2 flex-wrap">
                      {QUICK_EMOJIS.map(e => (
                        <button key={e} onClick={() => addEmoji(e)}
                          className="w-8 h-8 rounded-lg text-lg hover:scale-125 transition-transform" style={{ background: '#F4F7FB' }}>
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 items-center">
                    <button onClick={() => setShowEmojis(v => !v)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                      style={{ background: showEmojis ? 'rgba(59,130,246,0.12)' : '#F4F7FB', color: showEmojis ? '#3B82F6' : '#64748B' }}>
                      <Smile size={18} />
                    </button>
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      placeholder="Escribe un mensaje… 💬"
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                      style={{ background: '#F4F7FB', border: '1px solid #E6EBF2', color: '#0F172A' }}
                    />
                    <button onClick={sendMessage} disabled={sending || !input.trim()}
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-105 disabled:opacity-40 shrink-0"
                      style={{ background: '#3B82F6' }}>
                      <Send size={16} color="#fff" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            {waiting.length > 0 ? (
              <>
                <span className="text-5xl animate-bounce">🙋</span>
                <div>
                  <p className="text-base font-semibold mb-1" style={{ color: '#0F172A' }}>
                    {waiting.length} cliente{waiting.length > 1 ? 's' : ''} esperando ayuda
                  </p>
                  <p className="text-sm" style={{ color: '#64748B' }}>Selecciona un chat de la izquierda para atenderlo 👈</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: 'rgba(59,130,246,0.08)' }}>💬</div>
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: '#64748B' }}>Selecciona un chat</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>O espera a que un cliente inicie una conversación ✨</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SessionCard({ session, isActive, onClick }: { session: Session; isActive: boolean; onClick: () => void }) {
  const isWaiting = session.status === 'waiting'
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl px-3 py-2.5 mb-1 transition-colors"
      style={{
        background: isActive ? 'rgba(59,130,246,0.1)' : isWaiting ? 'rgba(245,158,11,0.05)' : 'transparent',
        border: isActive ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
      }}
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${isWaiting ? 'animate-pulse' : ''}`}
          style={{ background: isWaiting ? '#F59E0B' : '#10B981' }} />
        <span className="text-sm font-medium truncate flex-1" style={{ color: '#0F172A' }}>{session.visitor_name}</span>
        <span className="text-[10px] shrink-0" style={{ color: '#94A3B8' }}>
          {formatDistanceToNow(new Date(session.updated_at ?? session.created_at), { locale: es, addSuffix: false })}
        </span>
      </div>
      {session.subject && <p className="text-xs mt-0.5 truncate pl-4" style={{ color: '#64748B' }}>{session.subject}</p>}
    </button>
  )
}
