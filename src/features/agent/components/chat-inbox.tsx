'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, Send, Clock, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface ChatMessage {
  id: string
  content: string
  sender_type: string
  created_at: string
}

interface ChatSession {
  id: string
  visitor_name: string
  visitor_email: string | null
  status: string
  created_at: string
  chat_messages: ChatMessage[]
}

interface Props {
  sessions: ChatSession[]
  agentId: string
  agentName: string
}

const STATUS_COLOR: Record<string, string> = {
  waiting: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  active: 'bg-[#10B981]/20 text-[#10B981]',
  closed: 'bg-[#E6EBF2] text-[#5B6B7C]',
}
const STATUS_LABEL: Record<string, string> = {
  waiting: 'Esperando', active: 'Activo', closed: 'Cerrado',
}

export function ChatInbox({ sessions: initialSessions, agentId, agentName }: Props) {
  const [sessions, setSessions] = useState(initialSessions)
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())

  const activeSession = sessions.find(s => s.id === selected)

  useEffect(() => {
    const sb = supabaseRef.current

    // Listen for new sessions and session updates
    const sessionChannel = sb.channel('agent-chat-sessions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_sessions' }, (payload) => {
        setSessions(prev => [{ ...payload.new as ChatSession, chat_messages: [] }, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_sessions' }, (payload) => {
        setSessions(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new as ChatSession } : s))
      })
      .subscribe()

    return () => { sb.removeChannel(sessionChannel) }
  }, [])

  useEffect(() => {
    if (!selected) return
    const sb = supabaseRef.current

    // Load messages for selected session
    sb.from('chat_messages').select('*').eq('session_id', selected).order('created_at')
      .then(({ data }) => { setMessages(data ?? []) })

    // Subscribe to new messages
    const msgChannel = sb.channel(`chat-msgs:${selected}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `session_id=eq.${selected}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage])
      })
      .subscribe()

    return () => { sb.removeChannel(msgChannel) }
  }, [selected])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function acceptSession(sessionId: string) {
    const sb = supabaseRef.current
    await sb.from('chat_sessions').update({ status: 'active', agent_id: agentId }).eq('id', sessionId)
    setSelected(sessionId)
  }

  async function closeSession(sessionId: string) {
    const sb = supabaseRef.current
    await sb.from('chat_sessions').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', sessionId)
  }

  async function sendMessage() {
    if (!input.trim() || !selected || sending) return
    setSending(true)
    const content = input
    setInput('')

    const sb = supabaseRef.current
    await sb.from('chat_messages').insert({
      session_id: selected, content, sender_type: 'agent', sender_id: agentId,
    })
    setSending(false)
  }

  return (
    <div className="flex h-full bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
      {/* Session list */}
      <div className="w-64 border-r border-[#E6EBF2] flex flex-col">
        <div className="px-3 py-2 border-b border-[#E6EBF2]">
          <p className="text-xs font-semibold text-[#5B6B7C]">CONVERSACIONES ({sessions.length})</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <MessageCircle size={32} className="text-[#E6EBF2] mb-2" />
              <p className="text-xs text-[#5B6B7C]">Sin chats activos</p>
            </div>
          )}
          {sessions.map(s => (
            <button key={s.id} onClick={() => setSelected(s.id)}
              className={`w-full text-left px-3 py-3 border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7] transition-colors ${selected === s.id ? 'bg-[#EEF2F7]' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-[#0B2545] truncate">{s.visitor_name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[s.status]}`}>
                  {STATUS_LABEL[s.status]}
                </span>
              </div>
              {s.chat_messages.length > 0 && (
                <p className="text-xs text-[#5B6B7C] truncate">
                  {s.chat_messages[s.chat_messages.length - 1].content}
                </p>
              )}
              <p className="text-[10px] text-[#CBD5E1] mt-0.5">
                {formatDistanceToNow(new Date(s.created_at), { locale: es, addSuffix: true })}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat window */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <MessageCircle size={48} className="text-[#E6EBF2] mx-auto mb-3" />
              <p className="text-[#5B6B7C] text-sm">Selecciona una conversación</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#E6EBF2] flex items-center justify-between">
              <div>
                <p className="font-medium text-[#0B2545]">{activeSession?.visitor_name}</p>
                {activeSession?.visitor_email && (
                  <p className="text-xs text-[#5B6B7C]">{activeSession.visitor_email}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeSession?.status === 'waiting' && (
                  <button onClick={() => acceptSession(selected)}
                    className="px-3 py-1 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-medium transition-colors">
                    Aceptar chat
                  </button>
                )}
                {activeSession?.status === 'active' && (
                  <button onClick={() => closeSession(selected)}
                    className="px-3 py-1 rounded-lg bg-[#E6EBF2] hover:bg-[#EF4444]/20 text-[#5B6B7C] hover:text-[#EF4444] text-xs font-medium transition-colors">
                    <X size={12} className="inline mr-1" />Cerrar
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-3 py-2 rounded-xl text-sm ${
                    msg.sender_type === 'agent'
                      ? 'bg-[#00D4AA] text-[#0B2545] rounded-br-sm'
                      : 'bg-[#E6EBF2] text-[#0B2545] rounded-bl-sm'
                  }`}>
                    <p>{msg.content}</p>
                    <p className="text-[10px] opacity-60 mt-1">
                      {formatDistanceToNow(new Date(msg.created_at), { locale: es, addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {activeSession?.status !== 'closed' ? (
              <div className="px-4 py-3 border-t border-[#E6EBF2] flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={activeSession?.status === 'waiting' ? 'Acepta el chat para responder…' : 'Escribe una respuesta…'}
                  disabled={activeSession?.status === 'waiting'}
                  className="flex-1 px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] disabled:opacity-50 placeholder-[#CBD5E1]" />
                <button onClick={sendMessage} disabled={!input.trim() || sending || activeSession?.status === 'waiting'}
                  className="px-4 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors disabled:opacity-50">
                  <Send size={14} />
                </button>
              </div>
            ) : (
              <div className="px-4 py-3 border-t border-[#E6EBF2] text-center text-xs text-[#5B6B7C]">
                Chat cerrado
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
