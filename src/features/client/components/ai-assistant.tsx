'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, MessageCircle, Ticket, ChevronRight, BookOpen } from 'lucide-react'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface KbArticle {
  id: string
  title: string
  slug: string
  category: string
  excerpt: string
}

type FlowStep = 'welcome' | 'category_selected' | 'free_chat'

const CATEGORIES = [
  { id: 'technical', label: '🖥️ Problema técnico', query: 'problema técnico soporte' },
  { id: 'billing', label: '💰 Facturación', query: 'facturación pago factura' },
  { id: 'service', label: '📦 Consulta de servicio', query: 'servicio consulta información' },
]

export function AiAssistant() {
  const [open, setOpen] = useState(false)
  const [flowStep, setFlowStep] = useState<FlowStep>('welcome')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [kbArticles, setKbArticles] = useState<KbArticle[]>([])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, flowStep])

  function handleOpen() {
    setOpen(true)
    setFlowStep('welcome')
    setMessages([])
    setKbArticles([])
  }

  function handleClose() {
    setOpen(false)
  }

  async function selectCategory(cat: { id: string; label: string; query: string }) {
    setFlowStep('category_selected')

    const userMsg: Message = { role: 'user', content: cat.label }
    setMessages([userMsg])
    setLoading(true)

    // Fetch KB articles and AI response in parallel
    const [deflectRes] = await Promise.allSettled([
      fetch('/api/ai/deflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cat.query }),
      }),
    ])

    if (deflectRes.status === 'fulfilled' && deflectRes.value.ok) {
      const data = await deflectRes.value.json()
      setKbArticles(data.articles ?? [])
    }

    // Stream AI response with category context
    const systemContext: Message = {
      role: 'user',
      content: `El usuario seleccionó la categoría: "${cat.label}". Por favor responde con sugerencias específicas y concisas para esta categoría.`,
    }

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [systemContext] }),
      })

      if (!res.ok || !res.body) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Lo siento, no pude cargar sugerencias. Por favor abre un ticket o intenta de nuevo.',
        }])
        setLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content ?? ''
            assistantContent += delta
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
              return updated
            })
          } catch {}
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Ocurrió un error. Por favor intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  function escalateToFreeChat() {
    setFlowStep('free_chat')
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '¡Claro! Estoy aquí para ayudarte. ¿En qué más puedo asistirte?',
    }])
    setKbArticles([])
  }

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const allMsgs = [...messages, userMsg]

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMsgs }),
      })

      if (!res.ok || !res.body) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, no pude procesar tu consulta. Por favor abre un ticket.' }])
        setLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content ?? ''
            assistantContent += delta
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
              return updated
            })
          } catch {}
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Ocurrió un error. Por favor intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#1789FC] hover:bg-[#0B72D6] text-white shadow-lg flex items-center justify-center transition-all hover:scale-110 z-50">
          <Sparkles size={22} />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-6 right-6 w-80 sm:w-96 h-[520px] bg-[#FFFFFF] border border-[#E6EBF2] rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1789FC]">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-white" />
              <p className="text-sm font-semibold text-white">Asistente IA</p>
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            </div>
            <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* ── WELCOME STEP ── */}
          {flowStep === 'welcome' && (
            <div className="flex-1 flex flex-col justify-center p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#1789FC] flex items-center justify-center shrink-0">
                  <Sparkles size={12} className="text-white" />
                </div>
                <div className="bg-[#E6EBF2] rounded-xl rounded-tl-sm px-3 py-2.5 text-sm text-[#0B2545]">
                  ¡Hola! 👋 Soy el asistente de soporte. ¿En qué puedo ayudarte hoy?
                </div>
              </div>

              <div className="space-y-2 pl-10">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => selectCategory(cat)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-[#F4F7FB] hover:bg-[#1a2a42] border border-[#E6EBF2] hover:border-[#1789FC] rounded-xl text-sm text-[#0B2545] transition-all group">
                    <span>{cat.label}</span>
                    <ChevronRight size={14} className="text-[#5B6B7C] group-hover:text-[#1789FC] transition-colors" />
                  </button>
                ))}
                <button
                  onClick={escalateToFreeChat}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-[#F4F7FB] hover:bg-[#1a2a42] border border-[#E6EBF2] hover:border-[#1789FC] rounded-xl text-sm text-[#0B2545] transition-all group">
                  <span>💬 Hablar con soporte</span>
                  <ChevronRight size={14} className="text-[#5B6B7C] group-hover:text-[#1789FC] transition-colors" />
                </button>
              </div>
            </div>
          )}

          {/* ── CATEGORY SELECTED + FREE CHAT STEPS ── */}
          {(flowStep === 'category_selected' || flowStep === 'free_chat') && (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-[#1789FC] flex items-center justify-center mr-2 shrink-0 mt-1">
                        <Sparkles size={10} className="text-white" />
                      </div>
                    )}
                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                      m.role === 'user'
                        ? 'bg-[#1789FC] text-white rounded-br-sm'
                        : 'bg-[#E6EBF2] text-[#0B2545] rounded-bl-sm'
                    }`}>
                      {m.content || (loading && i === messages.length - 1 ? (
                        <span className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5B6B7C] animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5B6B7C] animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5B6B7C] animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      ) : '')}
                    </div>
                  </div>
                ))}

                {/* KB Articles (shown only in category_selected step) */}
                {flowStep === 'category_selected' && kbArticles.length > 0 && (
                  <div className="space-y-1.5 mt-1">
                    <p className="text-xs text-[#5B6B7C] flex items-center gap-1 pl-8">
                      <BookOpen size={10} /> Artículos sugeridos
                    </p>
                    {kbArticles.slice(0, 2).map(art => (
                      <Link key={art.id} href={`/client/knowledge/${art.slug}`}
                        className="ml-8 flex items-start gap-2 px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] hover:border-[#1789FC] rounded-lg transition-colors group">
                        <BookOpen size={12} className="text-[#5B6B7C] group-hover:text-[#1789FC] mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#0B2545] truncate">{art.title}</p>
                          <p className="text-[10px] text-[#5B6B7C] line-clamp-1">{art.excerpt}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* "Need more help" button in category_selected */}
                {flowStep === 'category_selected' && !loading && messages.length >= 2 && (
                  <div className="pl-8">
                    <button
                      onClick={escalateToFreeChat}
                      className="text-xs text-[#1789FC] hover:text-[#4FA9FD] transition-colors underline underline-offset-2">
                      Necesito más ayuda →
                    </button>
                  </div>
                )}

                <div ref={endRef} />
              </div>

              {/* Quick actions */}
              <div className="px-3 py-2 border-t border-[#E6EBF2] flex gap-2">
                <Link href="/client/tickets/new"
                  className="flex items-center gap-1 px-2 py-1 bg-[#E6EBF2] hover:bg-[#CBD5E1] rounded-lg text-[10px] text-[#5B6B7C] transition-colors">
                  <Ticket size={10} /> Abrir ticket
                </Link>
                <Link href="/client/knowledge"
                  className="flex items-center gap-1 px-2 py-1 bg-[#E6EBF2] hover:bg-[#CBD5E1] rounded-lg text-[10px] text-[#5B6B7C] transition-colors">
                  <MessageCircle size={10} /> Ver ayuda
                </Link>
              </div>

              {/* Input */}
              <div className="px-3 py-3 border-t border-[#E6EBF2] flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder="Escribe tu pregunta…"
                  className="flex-1 px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-xl text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]"
                />
                <button onClick={send} disabled={!input.trim() || loading}
                  className="w-9 h-9 rounded-xl bg-[#1789FC] hover:bg-[#0B72D6] text-white flex items-center justify-center transition-colors disabled:opacity-50">
                  <Send size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
