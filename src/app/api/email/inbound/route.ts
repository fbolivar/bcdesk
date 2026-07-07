import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/push/send'
import { sendInboundAckEmail } from '@/lib/email/ticket-emails'
import { validateUploadMeta } from '@/lib/storage/upload-guard'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Supa = ReturnType<typeof createServiceClient>

type InboundAttachment = { filename: string; mimeType?: string; size?: number; contentBase64?: string }

/** Sube los adjuntos del correo al bucket y los enlaza al ticket/comentario. */
async function saveAttachments(
  supabase: Supa, ticketId: string, commentId: string | null, uploadedBy: string,
  attachments: InboundAttachment[] | undefined,
): Promise<number> {
  if (!attachments?.length) return 0
  let saved = 0
  for (const att of attachments) {
    if (!att.contentBase64 || !att.filename) continue
    let buffer: Buffer
    try { buffer = Buffer.from(att.contentBase64, 'base64') } catch { continue }
    const mime = att.mimeType || 'application/octet-stream'
    const invalid = validateUploadMeta(buffer.length, mime)
    if (invalid) { console.warn(`[inbound] adjunto omitido "${att.filename}": ${invalid}`); continue }

    const ext = att.filename.includes('.') ? att.filename.split('.').pop() : 'bin'
    const path = `${ticketId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('ticket-attachments').upload(path, buffer, { contentType: mime })
    if (upErr) { console.warn(`[inbound] fallo subida "${att.filename}": ${upErr.message}`); continue }

    const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('ticket_attachments').insert({
      ticket_id: ticketId, comment_id: commentId, uploaded_by: uploadedBy,
      file_name: att.filename, file_url: publicUrl, file_size_bytes: buffer.length, mime_type: mime,
    })
    if (!dbErr) saved++
  }
  return saved
}

/** Agente activo con menor carga de tickets abiertos (round-robin por carga). */
async function pickAgentId(supabase: Supa): Promise<string | null> {
  const { data: agents } = await supabase
    .from('profiles').select('id').eq('role', 'agent').eq('is_active', true)
  if (!agents?.length) return null
  let best: string | null = null
  let bestLoad = Infinity
  for (const a of agents) {
    const { count } = await supabase
      .from('tickets').select('id', { count: 'exact', head: true })
      .eq('assigned_to', a.id).in('status', ['open', 'in_progress', 'waiting_client'])
    if ((count ?? 0) < bestLoad) { bestLoad = count ?? 0; best = a.id }
  }
  return best
}

/** No enviar acuse a buzones de sistema/automáticos (evita rebotes y bucles). */
function isSystemSender(email: string): boolean {
  const lp = (email.split('@')[0] || '').toLowerCase()
  const own = [process.env.SUPPORT_EMAIL, process.env.GMAIL_USER].map(e => (e || '').toLowerCase())
  if (own.includes(email.toLowerCase())) return true
  return ['no-reply', 'noreply', 'no_reply', 'do-not-reply', 'donotreply', 'mailer-daemon', 'postmaster', 'bounce', 'bounces', 'notification', 'notifications']
    .some(x => lp.includes(x))
}

/** Notifica a todos los admins/agentes activos (campana en tiempo real + push). */
async function notifyStaff(supabase: Supa, ticketId: string, title: string, body: string) {
  const { data: staff } = await supabase
    .from('profiles').select('id, role')
    .in('role', ['admin', 'agent']).eq('is_active', true)
  if (!staff?.length) return
  const linkFor = (role: string) => `/${role === 'admin' ? 'admin' : 'agent'}/tickets/${ticketId}`
  await supabase.from('notifications').insert(
    staff.map(s => ({ user_id: s.id, type: 'ticket', title, body, link: linkFor(s.role) })),
  )
  await Promise.allSettled(staff.map(s => sendPushToUser(s.id, title, body, linkFor(s.role))))
}

type InboundEmailPayload = {
  from: string
  subject: string
  text?: string
  html?: string
  to?: string
  attachments?: InboundAttachment[]
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

  const { from, subject, text, html, to, attachments } = payload
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

      const { data: comment, error: cErr } = await supabase.from('ticket_comments').insert({
        ticket_id: ticket.id, author_id: authorId,
        content, is_internal: false, is_automated: true,
      }).select('id').single()
      if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 })

      const attached = await saveAttachments(supabase, ticket.id, comment?.id ?? null, authorId, attachments)

      // Reabrir si estaba resuelto/cerrado y refrescar updated_at
      await supabase.from('tickets')
        .update({ status: 'open', updated_at: new Date().toISOString() })
        .eq('id', ticket.id).in('status', ['resolved', 'closed', 'cancelled'])

      await notifyStaff(supabase, ticket.id,
        `Nueva respuesta por correo #${ticket.ticket_number}`,
        `${fromEmail} respondió al ticket`)

      return NextResponse.json({ ok: true, comment: true, attachments: attached, ticket: { id: ticket.id, ticket_number: ticket.ticket_number } })
    }
    // Si el ref no resolvió a un ticket real, cae a crear uno nuevo.
  }

  // ── Correo nuevo → crear ticket ──
  const cleanSubject = subject.replace(/^(Re:|Fwd?:)\s*/gi, '').trim() || 'Consulta por email'
  const body = stripQuotedReply(rawBody)
  const description = profile ? body.substring(0, 5000) : `De: ${fromEmail}\n\n${body.substring(0, 5000)}`

  // created_by y organization_id son NOT NULL. El remitente suele NO tener perfil
  // (es un cliente externo), así que resolvemos valores por defecto:
  //  - autor  → perfil del remitente, si no un admin activo.
  //  - org    → org del remitente, si no INBOUND_DEFAULT_ORG_ID, si no la más antigua.
  let createdBy = profile?.id ?? null
  let organizationId = profile?.organization_id ?? null

  if (!createdBy || !organizationId) {
    const { data: admin } = await supabase
      .from('profiles').select('id, organization_id')
      .eq('role', 'admin').eq('is_active', true)
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
    createdBy = createdBy ?? admin?.id ?? null
    organizationId = organizationId ?? admin?.organization_id ?? null
  }
  if (!organizationId) {
    organizationId = process.env.INBOUND_DEFAULT_ORG_ID?.trim() || null
    if (!organizationId) {
      const { data: org } = await supabase
        .from('organizations').select('id')
        .order('created_at', { ascending: true }).limit(1).maybeSingle()
      organizationId = org?.id ?? null
    }
  }
  if (!createdBy || !organizationId) {
    return NextResponse.json({ ok: false, error: 'No hay autor/organización por defecto para el ticket' }, { status: 500 })
  }

  // Asignación automática al agente con menor carga (si hay agentes activos).
  const assignedTo = await pickAgentId(supabase)

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      title: cleanSubject.substring(0, 200),
      description,
      status: 'open',
      priority: 'medium',
      category: 'support',
      source_channel: 'email',
      created_by: createdBy,
      organization_id: organizationId,
      requester_email: fromEmail,
      assigned_to: assignedTo,
    })
    .select('id, ticket_number, title, status, created_at')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const attached = await saveAttachments(supabase, ticket.id, null, createdBy, attachments)

  // Acuse automático al cliente (salvo remitentes de sistema, para evitar bucles).
  if (!isSystemSender(fromEmail)) {
    sendInboundAckEmail({
      to: fromEmail,
      ticketNumber: ticket.ticket_number,
      ticketTitle: ticket.title,
      ticketId: ticket.id,
    }).catch(() => {})
  }

  await notifyStaff(supabase, ticket.id,
    `Nuevo ticket por correo #${ticket.ticket_number}`,
    `${fromEmail}: ${ticket.title}`)

  return NextResponse.json({ ok: true, ticket, attachments: attached, assigned_to: assignedTo })
}
