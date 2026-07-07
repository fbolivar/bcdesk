import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

type InboundEmailPayload = {
  from: string
  subject: string
  text?: string
  html?: string
  to?: string
}

type ProfileRow = {
  id: string
  organization_id: string | null
}

function parseFromEmail(from: string): { email: string; name: string } {
  const match = from.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) return { name: match[1].trim(), email: match[2].trim() }
  return { name: from.trim(), email: from.trim() }
}

/** Reconstruye un UUID a partir de 32 hex sin guiones (usado en el +alias). */
function hexToUuid(hex: string): string | null {
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Detecta a qué ticket pertenece el correo:
 *  1) +alias  soporte+t{uuid32}@dominio  (respuesta a una notificación) → uuid
 *  2) [#123] en el asunto → número de ticket
 * Devuelve { ticketId } o { ticketNumber } o null (correo nuevo).
 */
function detectTicketRef(to: string | undefined, subject: string): { ticketId?: string; ticketNumber?: number } | null {
  const aliasMatch = (to ?? '').match(/\+t([0-9a-f]{32})/i)
  if (aliasMatch) {
    const id = hexToUuid(aliasMatch[1])
    if (id) return { ticketId: id }
  }
  const numMatch = subject.match(/\[#(\d+)\]/)
  if (numMatch) return { ticketNumber: Number(numMatch[1]) }
  return null
}

/** Recorta la cadena de respuesta citada para quedarnos solo con el mensaje nuevo. */
function stripQuotedReply(body: string): string {
  const markers = [
    /^On .+ wrote:$/m,
    /^El .+ escribió:$/m,
    /^-----Original Message-----$/m,
    /^_{5,}$/m,
    /^De: .+$/m,
    /^From: .+$/m,
  ]
  let cut = body.length
  for (const m of markers) {
    const match = body.match(m)
    if (match?.index !== undefined && match.index < cut) cut = match.index
  }
  // También corta el primer bloque de líneas citadas con ">"
  const quoteLine = body.search(/^>.*/m)
  if (quoteLine !== -1 && quoteLine < cut) cut = quoteLine
  return body.slice(0, cut).trim() || body.trim()
}

export async function POST(req: NextRequest) {
  // Fail-closed: sin EMAIL_INBOUND_SECRET configurado o sin coincidir, se rechaza.
  const secret = process.env.EMAIL_INBOUND_SECRET?.trim()
  const provided = req.headers.get('x-webhook-secret')
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  let payload: InboundEmailPayload
  try {
    payload = (await req.json()) as InboundEmailPayload
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { from, subject, text, html, to } = payload
  if (!from || !subject) {
    return NextResponse.json({ ok: false, error: 'Missing required fields: from, subject' }, { status: 400 })
  }

  const { email: fromEmail } = parseFromEmail(from)
  const rawBody = (text ?? html ?? '').toString()
  const supabase = createServiceClient()

  // ¿El remitente tiene perfil en HexDesk? (para atribuir autor/organización)
  const { data: profile } = (await supabase
    .from('profiles')
    .select('id, organization_id')
    .eq('email', fromEmail)
    .maybeSingle()) as { data: ProfileRow | null }

  // ── ¿Es respuesta a un ticket existente? → agregar comentario, no crear ticket ──
  const ref = detectTicketRef(to, subject)
  if (ref) {
    let ticketQuery = supabase.from('tickets').select('id, ticket_number, created_by, organization_id')
    ticketQuery = ref.ticketId
      ? ticketQuery.eq('id', ref.ticketId)
      : ticketQuery.eq('ticket_number', ref.ticketNumber!).order('created_at', { ascending: false }).limit(1)

    const { data: ticket } = await ticketQuery.maybeSingle() as {
      data: { id: string; ticket_number: number; created_by: string | null; organization_id: string | null } | null
    }

    if (ticket) {
      // author_id es NOT NULL → perfil del remitente, si no el creador del ticket, si no un admin.
      let authorId = profile?.id ?? ticket.created_by ?? null
      if (!authorId) {
        const { data: admin } = await supabase
          .from('profiles').select('id').eq('role', 'admin').eq('is_active', true).limit(1).maybeSingle()
        authorId = admin?.id ?? null
      }
      if (!authorId) {
        return NextResponse.json({ ok: false, error: 'Sin autor para atribuir el comentario' }, { status: 500 })
      }

      const clean = stripQuotedReply(rawBody).substring(0, 5000)
      const content = profile ? clean : `De: ${fromEmail}\n\n${clean}`

      const { error: cErr } = await supabase.from('ticket_comments').insert({
        ticket_id: ticket.id, author_id: authorId,
        content, is_internal: false, is_automated: true,
      })
      if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 })

      // Reabrir si estaba resuelto/cerrado y refrescar updated_at
      await supabase.from('tickets')
        .update({ status: 'open', updated_at: new Date().toISOString() })
        .eq('id', ticket.id).in('status', ['resolved', 'closed', 'cancelled'])

      return NextResponse.json({ ok: true, comment: true, ticket: { id: ticket.id, ticket_number: ticket.ticket_number } })
    }
    // Si el ref no resolvió a un ticket real, cae a crear uno nuevo.
  }

  // ── Correo nuevo → crear ticket ──
  const cleanSubject = subject.replace(/^(Re:|Fwd?:)\s*/gi, '').trim() || 'Consulta por email'
  const body = stripQuotedReply(rawBody)
  const description = profile ? body.substring(0, 5000) : `De: ${fromEmail}\n\n${body.substring(0, 5000)}`

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      title: cleanSubject.substring(0, 200),
      description,
      status: 'open',
      priority: 'medium',
      category: 'support',
      source_channel: 'email',
      created_by: profile?.id ?? null,
      organization_id: profile?.organization_id ?? null,
      requester_email: fromEmail,
    })
    .select('id, ticket_number, title, status, created_at')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ticket })
}
