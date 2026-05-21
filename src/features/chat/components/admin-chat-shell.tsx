'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Circle, Send, UserCheck, X, Clock, Users } from 'lucide-react'
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

export function AdminChatShell({ agentId, agentName, initialSessions }: Props) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
    await supabase.from('chat_sessions').update({
      agent_id: agentId,
      status: 'active',
    }).eq('id', session.id)
    setActiveSession({ ...session, agent_id: agentId, status: 'active' })
  }

  async function closeSession(sessionId: string) {
    await supabase.from('chat_sessions').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
    }).eq('id', sessionId)
    if (activeSession?.id === sessionId) setActiveSession(null)
  }

  async function sendMessage() {
    if (!input.trim() || !activeSession) return
    setSending(true)
    const content = input.trim()
    setInput('')
    await supabase.from('chat_messages').insert({
      session_id: activeSession.id,
      sender_id: agentId,
      sender_type: 'agent',
      sender_name: agentName,
      content,
    })
    setSending(false)
  }

  const waiting = sessions.filter(s => s.status === 'waiting')
  const active = sessions.filter(s => s.status === 'active')

  return (
    <div className="flex h-[calc(100vh-80px)] gap-0 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Panel izquierdo: sesiones */}
      <div className="w-72 flex flex-col shrink-0" style={{ background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Stats */}
        <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: '#F0F4FF' }}>Chat en vivo</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,181,71,0.08)', border: '1px solid rgba(255,181,71,0.15)' }}>
              <div className="text-xl font-bold" style={{ color: '#FFB547' }}>{waiting.length}</div>
              <div className="text-[10px] mt-0.5" style={{ color: '#8B9BB4' }}>En espera</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,217,138,0.08)', border: '1px solid rgba(16,217,138,0.15)' }}>
              <div className="text-xl font-bold" style={{ color: '#10D98A' }}>{active.length}</div>
              <div className="text-[10px] mt-0.5" style={{ color: '#8B9BB4' }}>Activos</div>
            </div>
          </div>
        </div>

        {/* Lista sesiones */}
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <MessageSquare size={24} style={{ color: '#4A5568' }} />
              <p className="text-xs" style={{ color: '#4A5568' }}>Sin chats activos</p>
            </div>
          ) : (
            <>
              {waiting.length > 0 && (
                <div className="px-3 mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#FFB547' }}>En espera</p>
                  {waiting.map(s => (
                    <SessionCard key={s.id} session={s} isActive={activeSession?.id === s.id} onClick={() => setActiveSession(s)} />
                  ))}
                </div>
              )}
              {active.length > 0 && (
                <div className="px-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 mt-2" style={{ color: '#10D98A' }}>Activos</p>
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
      <div className="flex-1 flex flex-col" style={{ background: 'rgba(8,14,26,0.6)' }}>
        {activeSession ? (
          <>
            {/* Header conversación */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: 'rgba(79,138,255,0.15)', color: '#4F8AFF' }}>
                    {activeSession.visitor_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#F0F4FF' }}>{activeSession.visitor_name}</p>
                    {activeSession.visitor_email && (
                      <p className="text-xs" style={{ color: '#8B9BB4' }}>{activeSession.visitor_email}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeSession.status === 'waiting' && (
                  <button
                    onClick={() => claimSession(activeSession)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: 'rgba(16,217,138,0.12)', color: '#10D98A', border: '1px solid rgba(16,217,138,0.2)' }}
                  >
                    <UserCheck size={13} /> Tomar chat
                  </button>
                )}
                <button
                  onClick={() => closeSession(activeSession.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'rgba(255,77,106,0.1)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.2)' }}
                >
                  <X size={13} /> Cerrar
                </button>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm" style={{ color: '#4A5568' }}>Sin mensajes aún</p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.sender_type === 'agent' ? 'flex-row-reverse' : ''}`}>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{
                      background: msg.sender_type === 'agent' ? 'rgba(79,138,255,0.2)' : 'rgba(139,111,255,0.2)',
                      color: msg.sender_type === 'agent' ? '#4F8AFF' : '#8B6FFF',
                    }}
                  >
                    {msg.sender_name.charAt(0).toUpperCase()}
                  </div>
                  <div className={`max-w-[70%] ${msg.sender_type === 'agent' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <span className="text-[10px]" style={{ color: '#4A5568' }}>{msg.sender_name}</span>
                    <div
                      className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                      style={msg.sender_type === 'agent'
                        ? { background: 'rgba(79,138,255,0.15)', color: '#F0F4FF', borderBottomRightRadius: 4 }
                        : { background: 'rgba(255,255,255,0.06)', color: '#F0F4FF', borderBottomLeftRadius: 4 }
                      }
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px]" style={{ color: '#4A5568' }}>
                      {formatDistanceToNow(new Date(msg.created_at), { locale: es, addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              {activeSession.status === 'waiting' ? (
                <div className="text-center py-2">
                  <p className="text-xs mb-2" style={{ color: '#8B9BB4' }}>Toma el chat para responder</p>
                  <button
                    onClick={() => claimSession(activeSession)}
                    className="px-4 py-2 rounded-xl text-sm font-medium"
                    style={{ background: 'rgba(16,217,138,0.12)', color: '#10D98A', border: '1px solid rgba(16,217,138,0.2)' }}
                  >
                    <UserCheck size={14} className="inline mr-1.5" /> Tomar chat
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#F0F4FF' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !input.trim()}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
                    style={{ background: '#4F8AFF' }}
                  >
                    <Send size={16} color="#fff" />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ color: '#4A5568' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(79,138,255,0.08)' }}>
              <MessageSquare size={28} style={{ color: '#4F8AFF' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium mb-1" style={{ color: '#8B9BB4' }}>Selecciona un chat</p>
              <p className="text-xs" style={{ color: '#4A5568' }}>O espera a que un cliente inicie una conversación</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SessionCard({ session, isActive, onClick }: { session: Session; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl px-3 py-2.5 mb-1 transition-colors"
      style={{
        background: isActive ? 'rgba(79,138,255,0.1)' : 'transparent',
        border: isActive ? '1px solid rgba(79,138,255,0.2)' : '1px solid transparent',
      }}
    >
      <div className="flex items-center gap-2">
        <Circle
          size={7}
          fill={session.status === 'waiting' ? '#FFB547' : '#10D98A'}
          style={{ color: session.status === 'waiting' ? '#FFB547' : '#10D98A', shrink: 0 } as React.CSSProperties}
        />
        <span className="text-sm font-medium truncate flex-1" style={{ color: '#F0F4FF' }}>
          {session.visitor_name}
        </span>
        <span className="text-[10px] shrink-0" style={{ color: '#4A5568' }}>
          {formatDistanceToNow(new Date(session.updated_at ?? session.created_at), { locale: es, addSuffix: false })}
        </span>
      </div>
      {session.subject && (
        <p className="text-xs mt-0.5 truncate pl-3.5" style={{ color: '#8B9BB4' }}>{session.subject}</p>
      )}
    </button>
  )
}
