'use client'

import { useState } from 'react'
import { Sparkles, Wand2, Copy as CopyIcon, BookOpen, FileText, Check, MessageSquareText, ClipboardCheck } from 'lucide-react'
import {
  aiTriageTicket,
  aiFindSimilarTickets,
  aiSuggestKbArticles,
  aiSummarizeTicket,
  aiSuggestReply,
  applyAiTriage,
  type TriageResult,
  type SimilarTicket,
  type KbSuggestion,
} from '../services/ai-ticket.service'
import { TICKET_CATEGORY_LABELS } from '@/lib/tickets/categories'

type Tab = 'triage' | 'similar' | 'kb' | 'summary' | 'reply'

const PRIORITY_LABEL: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' }
const CATEGORY_LABEL = TICKET_CATEGORY_LABELS as Record<string, string>

export function AiAssistantPanel({ ticketId }: { ticketId: string }) {
  const [active, setActive] = useState<Tab | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  const [triage, setTriage] = useState<TriageResult | null>(null)
  const [similar, setSimilar] = useState<SimilarTicket[] | null>(null)
  const [kb, setKb] = useState<KbSuggestion[] | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [reply, setReply] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function run(tab: Tab) {
    setActive(tab)
    setError(null)
    setLoading(true)
    setApplied(false)
    setCopied(false)
    try {
      if (tab === 'triage') {
        const r = await aiTriageTicket(ticketId)
        if (r.error) setError(r.error); else setTriage(r.data ?? null)
      } else if (tab === 'similar') {
        const r = await aiFindSimilarTickets(ticketId)
        if (r.error) setError(r.error); else setSimilar(r.data ?? [])
      } else if (tab === 'kb') {
        const r = await aiSuggestKbArticles(ticketId)
        if (r.error) setError(r.error); else setKb(r.data ?? [])
      } else if (tab === 'reply') {
        const r = await aiSuggestReply(ticketId)
        if (r.error) setError(r.error); else setReply(r.data ?? '')
      } else {
        const r = await aiSummarizeTicket(ticketId)
        if (r.error) setError(r.error); else setSummary(r.data ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  async function copyReply() {
    if (!reply) return
    try { await navigator.clipboard.writeText(reply); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* noop */ }
  }

  /** Inserta el borrador en el textarea de respuesta del ticket (formulario del agente). */
  function useReply() {
    if (!reply) return
    const el = document.querySelector<HTMLTextAreaElement>('textarea[name="content"]')
    if (el) {
      el.value = reply
      el.focus()
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  async function apply() {
    if (!triage) return
    const r = await applyAiTriage(ticketId, triage.category, triage.priority)
    if (!r.error) setApplied(true)
  }

  const btn = (tab: Tab, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => run(tab)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        active === tab
          ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#C4B5FD]'
          : 'bg-[#F4F7FB] border-[#E6EBF2] text-[#5B6B7C] hover:text-[#0B2545] hover:border-[#8B5CF6]/40'
      }`}
    >
      {icon} {label}
    </button>
  )

  return (
    <div className="rounded-xl border border-[#8B5CF6]/25 bg-gradient-to-b from-[#8B5CF6]/[0.06] to-transparent p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={15} className="text-[#A78BFA]" />
        <h2 className="text-sm font-semibold text-[#0B2545]">Asistente IA</h2>
        <span className="text-[10px] text-[#5B6B7C]">powered by Claude</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {btn('reply', <MessageSquareText size={13} />, 'Respuesta sugerida')}
        {btn('triage', <Wand2 size={13} />, 'Analizar (triage)')}
        {btn('similar', <CopyIcon size={13} />, 'Similares')}
        {btn('kb', <BookOpen size={13} />, 'Sugerir KB')}
        {btn('summary', <FileText size={13} />, 'Resumen')}
      </div>

      {loading && <p className="text-xs text-[#5B6B7C] animate-pulse">Analizando con IA…</p>}
      {error && (
        <p className="text-xs text-[#F87171] bg-[#F87171]/10 border border-[#F87171]/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {!loading && !error && active === 'triage' && triage && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#5B6B7C]">Categoría:</span>
            <span className="text-[#0B2545] font-medium">{CATEGORY_LABEL[triage.category] ?? triage.category}</span>
            <span className="text-[#5B6B7C] ml-2">Prioridad:</span>
            <span className="text-[#0B2545] font-medium">{PRIORITY_LABEL[triage.priority] ?? triage.priority}</span>
          </div>
          <p className="text-xs text-[#5B6B7C]">{triage.reasoning}</p>
          <button
            onClick={apply}
            disabled={applied}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 text-white text-xs font-medium transition-colors"
          >
            {applied ? <><Check size={13} /> Aplicado</> : 'Aplicar al ticket'}
          </button>
        </div>
      )}

      {!loading && !error && active === 'similar' && similar && (
        <div className="space-y-2">
          {similar.length === 0 && <p className="text-xs text-[#5B6B7C]">No se encontraron tickets similares.</p>}
          {similar.map((s, i) => (
            <div key={i} className="rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] p-3">
              <p className="text-xs font-medium text-[#0B2545]">#{s.ticket_number} — {s.title}</p>
              <p className="text-[11px] text-[#5B6B7C] mt-1">{s.why}</p>
              <p className="text-[11px] text-[#10B981] mt-1">💡 {s.resolution}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && active === 'kb' && kb && (
        <div className="space-y-2">
          {kb.length === 0 && <p className="text-xs text-[#5B6B7C]">Sin artículos relevantes.</p>}
          {kb.map(a => (
            <div key={a.id} className="rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] p-3">
              <p className="text-xs font-medium text-[#C4B5FD]">{a.title}</p>
              <p className="text-[11px] text-[#5B6B7C] mt-1">{a.why}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && active === 'reply' && reply !== null && (
        <div className="space-y-2">
          <div className="rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] p-3">
            <p className="text-xs text-[#0B2545] whitespace-pre-wrap leading-relaxed">{reply}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={useReply}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-medium transition-colors"
            >
              <MessageSquareText size={13} /> Usar en respuesta
            </button>
            <button
              onClick={copyReply}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#5B6B7C] hover:text-[#0B2545] text-xs font-medium transition-colors"
            >
              {copied ? <><ClipboardCheck size={13} /> Copiado</> : <><CopyIcon size={13} /> Copiar</>}
            </button>
          </div>
          <p className="text-[10px] text-[#5B6B7C]">Revisa y edita el borrador antes de enviar. La IA puede equivocarse.</p>
        </div>
      )}

      {!loading && !error && active === 'summary' && summary && (
        <div className="rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] p-3">
          <p className="text-xs text-[#0B2545] whitespace-pre-wrap leading-relaxed">{summary}</p>
        </div>
      )}
    </div>
  )
}
