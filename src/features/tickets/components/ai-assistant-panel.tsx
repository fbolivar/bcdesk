'use client'

import { useState } from 'react'
import { Sparkles, Wand2, Copy as CopyIcon, BookOpen, FileText, Check } from 'lucide-react'
import {
  aiTriageTicket,
  aiFindSimilarTickets,
  aiSuggestKbArticles,
  aiSummarizeTicket,
  applyAiTriage,
  type TriageResult,
  type SimilarTicket,
  type KbSuggestion,
} from '../services/ai-ticket.service'

type Tab = 'triage' | 'similar' | 'kb' | 'summary'

const PRIORITY_LABEL: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' }
const CATEGORY_LABEL: Record<string, string> = {
  support: 'Soporte', development: 'Desarrollo', billing: 'Facturación', onboarding: 'Onboarding', other: 'Otro',
}

export function AiAssistantPanel({ ticketId }: { ticketId: string }) {
  const [active, setActive] = useState<Tab | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  const [triage, setTriage] = useState<TriageResult | null>(null)
  const [similar, setSimilar] = useState<SimilarTicket[] | null>(null)
  const [kb, setKb] = useState<KbSuggestion[] | null>(null)
  const [summary, setSummary] = useState<string | null>(null)

  async function run(tab: Tab) {
    setActive(tab)
    setError(null)
    setLoading(true)
    setApplied(false)
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
      } else {
        const r = await aiSummarizeTicket(ticketId)
        if (r.error) setError(r.error); else setSummary(r.data ?? '')
      }
    } finally {
      setLoading(false)
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
          : 'bg-[#0F172A] border-[#334155] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#8B5CF6]/40'
      }`}
    >
      {icon} {label}
    </button>
  )

  return (
    <div className="rounded-xl border border-[#8B5CF6]/25 bg-gradient-to-b from-[#8B5CF6]/[0.06] to-transparent p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={15} className="text-[#A78BFA]" />
        <h2 className="text-sm font-semibold text-[#F1F5F9]">Asistente IA</h2>
        <span className="text-[10px] text-[#64748B]">powered by Claude</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {btn('triage', <Wand2 size={13} />, 'Analizar (triage)')}
        {btn('similar', <CopyIcon size={13} />, 'Similares')}
        {btn('kb', <BookOpen size={13} />, 'Sugerir KB')}
        {btn('summary', <FileText size={13} />, 'Resumen')}
      </div>

      {loading && <p className="text-xs text-[#94A3B8] animate-pulse">Analizando con IA…</p>}
      {error && (
        <p className="text-xs text-[#F87171] bg-[#F87171]/10 border border-[#F87171]/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {!loading && !error && active === 'triage' && triage && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#94A3B8]">Categoría:</span>
            <span className="text-[#F1F5F9] font-medium">{CATEGORY_LABEL[triage.category] ?? triage.category}</span>
            <span className="text-[#94A3B8] ml-2">Prioridad:</span>
            <span className="text-[#F1F5F9] font-medium">{PRIORITY_LABEL[triage.priority] ?? triage.priority}</span>
          </div>
          <p className="text-xs text-[#94A3B8]">{triage.reasoning}</p>
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
          {similar.length === 0 && <p className="text-xs text-[#64748B]">No se encontraron tickets similares.</p>}
          {similar.map((s, i) => (
            <div key={i} className="rounded-lg bg-[#0F172A] border border-[#334155] p-3">
              <p className="text-xs font-medium text-[#F1F5F9]">#{s.ticket_number} — {s.title}</p>
              <p className="text-[11px] text-[#94A3B8] mt-1">{s.why}</p>
              <p className="text-[11px] text-[#10B981] mt-1">💡 {s.resolution}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && active === 'kb' && kb && (
        <div className="space-y-2">
          {kb.length === 0 && <p className="text-xs text-[#64748B]">Sin artículos relevantes.</p>}
          {kb.map(a => (
            <div key={a.id} className="rounded-lg bg-[#0F172A] border border-[#334155] p-3">
              <p className="text-xs font-medium text-[#C4B5FD]">{a.title}</p>
              <p className="text-[11px] text-[#94A3B8] mt-1">{a.why}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && active === 'summary' && summary && (
        <div className="rounded-lg bg-[#0F172A] border border-[#334155] p-3">
          <p className="text-xs text-[#F1F5F9] whitespace-pre-wrap leading-relaxed">{summary}</p>
        </div>
      )}
    </div>
  )
}
