'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { aiJSON, aiComplete, isAiConfigured } from '@/lib/ai/anthropic'
import { revalidatePath } from 'next/cache'
import type { TicketCategory, TicketPriority } from '@/lib/supabase/types'
import { TICKET_CATEGORY_VALUES } from '@/lib/tickets/categories'

async function requireStaff() {
  const user = await getCurrentUser()
  if (!user || !['admin', 'agent'].includes(user.role)) {
    throw new Error('No autorizado')
  }
  return user
}

async function loadTicket(id: string) {
  const supabase = await createClient()
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, ticket_number, title, description, category, priority, status')
    .eq('id', id)
    .single()
  return { supabase, ticket }
}

const CATEGORIES = TICKET_CATEGORY_VALUES.join(', ')
const PRIORITIES = 'low, medium, high, critical'

// ── 1. Triage: sugiere categoría y prioridad ────────────────────────────────
export interface TriageResult {
  category: TicketCategory
  priority: TicketPriority
  reasoning: string
}

export async function aiTriageTicket(ticketId: string): Promise<{ data?: TriageResult; error?: string }> {
  await requireStaff()
  if (!isAiConfigured()) return { error: 'IA no configurada (falta ANTHROPIC_API_KEY).' }

  const { ticket } = await loadTicket(ticketId)
  if (!ticket) return { error: 'Ticket no encontrado.' }

  try {
    const result = await aiJSON<TriageResult>(
      `Eres un experto en mesa de ayuda ITSM. Clasifica el ticket. Categorías válidas: ${CATEGORIES}. Prioridades válidas: ${PRIORITIES}. Devuelve JSON con las claves: category, priority, reasoning (una frase breve en español).`,
      `Título: ${ticket.title}\nDescripción: ${ticket.description ?? ''}`,
      400
    )
    return { data: result }
  } catch {
    return { error: 'No se pudo analizar el ticket. Intenta de nuevo.' }
  }
}

// ── 2. Tickets similares ────────────────────────────────────────────────────
export interface SimilarTicket {
  ticket_number: number
  title: string
  why: string
  resolution: string
}

export async function aiFindSimilarTickets(ticketId: string): Promise<{ data?: SimilarTicket[]; error?: string }> {
  await requireStaff()
  if (!isAiConfigured()) return { error: 'IA no configurada.' }

  const { supabase, ticket } = await loadTicket(ticketId)
  if (!ticket) return { error: 'Ticket no encontrado.' }

  const { data: candidates } = await supabase
    .from('tickets')
    .select('ticket_number, title, description, status')
    .neq('id', ticketId)
    .in('status', ['resolved', 'closed'])
    .order('created_at', { ascending: false })
    .limit(40)

  if (!candidates || candidates.length === 0) return { data: [] }

  const list = candidates
    .map(c => `#${c.ticket_number} | ${c.title} | ${(c.description ?? '').slice(0, 120)}`)
    .join('\n')

  try {
    const result = await aiJSON<{ similar: SimilarTicket[] }>(
      `Eres un analista de soporte. Dado un ticket actual y una lista de tickets resueltos, identifica hasta 3 más similares. Devuelve JSON: { "similar": [{ "ticket_number": number, "title": string, "why": string (por qué es similar, en español), "resolution": string (cómo podría resolverse basándote en el similar) }] }. Si ninguno es relevante, devuelve lista vacía.`,
      `TICKET ACTUAL:\n${ticket.title}\n${ticket.description ?? ''}\n\nTICKETS RESUELTOS:\n${list}`,
      800
    )
    return { data: result.similar ?? [] }
  } catch {
    return { error: 'No se pudieron buscar similares.' }
  }
}

// ── 3. Sugerencia de artículos de KB ────────────────────────────────────────
export interface KbSuggestion {
  id: string
  title: string
  why: string
}

export async function aiSuggestKbArticles(ticketId: string): Promise<{ data?: KbSuggestion[]; error?: string }> {
  await requireStaff()
  if (!isAiConfigured()) return { error: 'IA no configurada.' }

  const { supabase, ticket } = await loadTicket(ticketId)
  if (!ticket) return { error: 'Ticket no encontrado.' }

  const { data: articles } = await supabase
    .from('kb_articles')
    .select('id, title, excerpt, category')
    .eq('is_published', true)
    .limit(50)

  if (!articles || articles.length === 0) return { data: [] }

  const list = articles.map(a => `${a.id} | ${a.title} | ${a.excerpt ?? ''}`).join('\n')

  try {
    const result = await aiJSON<{ suggestions: KbSuggestion[] }>(
      `Dado un ticket y una lista de artículos (formato "id | título | resumen"), selecciona hasta 3 artículos relevantes para resolverlo. Devuelve JSON: { "suggestions": [{ "id": string (el id exacto del artículo), "title": string, "why": string en español }] }. Si ninguno aplica, devuelve lista vacía.`,
      `TICKET:\n${ticket.title}\n${ticket.description ?? ''}\n\nARTÍCULOS:\n${list}`,
      600
    )
    return { data: result.suggestions ?? [] }
  } catch {
    return { error: 'No se pudieron sugerir artículos.' }
  }
}

// ── 4. Resumen del ticket ───────────────────────────────────────────────────
export async function aiSummarizeTicket(ticketId: string): Promise<{ data?: string; error?: string }> {
  await requireStaff()
  if (!isAiConfigured()) return { error: 'IA no configurada.' }

  const { supabase, ticket } = await loadTicket(ticketId)
  if (!ticket) return { error: 'Ticket no encontrado.' }

  const { data: comments } = await supabase
    .from('ticket_comments')
    .select('content, is_internal, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
    .limit(50)

  const thread = (comments ?? []).map(c => `${c.is_internal ? '[interno] ' : ''}${c.content}`).join('\n---\n')

  try {
    const summary = await aiComplete(
      'Eres un asistente de soporte. Resume el ticket y su conversación en 3-5 puntos concisos en español: situación, acciones tomadas y estado/pendiente. Usa viñetas con "•".',
      `Título: ${ticket.title}\nDescripción: ${ticket.description ?? ''}\n\nConversación:\n${thread || '(sin comentarios)'}`,
      500
    )
    return { data: summary.trim() }
  } catch {
    return { error: 'No se pudo generar el resumen.' }
  }
}

// ── Aplicar triage ──────────────────────────────────────────────────────────
export async function applyAiTriage(ticketId: string, category: string, priority: string) {
  await requireStaff()
  const supabase = await createClient()
  const { error } = await supabase
    .from('tickets')
    .update({ category, priority })
    .eq('id', ticketId)
  if (error) return { error: 'No se pudo aplicar el triage.' }
  revalidatePath(`/admin/tickets/${ticketId}`)
  revalidatePath(`/agent/tickets/${ticketId}`)
  return { success: true }
}
