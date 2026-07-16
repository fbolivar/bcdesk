import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSecret } from '@/lib/api/webhook-secret'

// Compatible with SendGrid Inbound Parse, Postmark, Mailgun
export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req, 'EMAIL_INBOUND_SECRET')) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }
  const supabase = createServiceClient()

  let from = '', subject = '', body = '', threadId = ''

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const data = await req.json()
    from = data.From ?? data.from ?? ''
    subject = data.Subject ?? data.subject ?? ''
    body = data.TextBody ?? data.text ?? data.body ?? ''
    threadId = data.MessageID ?? data.messageId ?? ''
  } else {
    const formData = await req.formData()
    from = formData.get('from') as string ?? ''
    subject = formData.get('subject') as string ?? ''
    body = formData.get('text') as string ?? formData.get('html') as string ?? ''
    threadId = formData.get('Message-Id') as string ?? ''
  }

  if (!from || !body) return NextResponse.json({ ok: false, error: 'Missing fields' })

  const emailMatch = from.match(/<(.+?)>/)
  const fromEmail = emailMatch ? emailMatch[1] : from
  const fromName = emailMatch ? from.replace(/<.+?>/, '').trim() : from

  await supabase.from('multichannel_messages').insert({
    channel: 'email',
    external_id: threadId,
    from_address: fromEmail,
    from_name: fromName,
    subject,
    body: body.substring(0, 10000),
    raw_payload: { from, subject, threadId },
  })

  // Check if reply to existing ticket: subject contains [#TICKET-ID]
  const replyMatch = subject.match(/\[(?:Ticket\s*)?#?([A-Z0-9-]{8,})\]/i)

  if (replyMatch) {
    const ticketRef = replyMatch[1]
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, created_by')
      .or(`id.eq.${ticketRef},email_thread_id.eq.${ticketRef}`)
      .single()

    if (ticket) {
      await supabase.from('ticket_comments').insert({
        ticket_id: ticket.id,
        author_id: ticket.created_by,
        content: `📧 **Respuesta por email de ${fromName} (${fromEmail}):**\n\n${body.substring(0, 5000)}`,
        is_internal: false,
      })
      await supabase.from('multichannel_messages')
        .update({ ticket_id: ticket.id, is_processed: true })
        .eq('external_id', threadId)
      return NextResponse.json({ ok: true, action: 'comment_added' })
    }
  }

  // Create new ticket
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('id, organization_id')
    .eq('email', fromEmail)
    .single()

  const cleanSubject = subject.replace(/^(Re:|Fwd?:)\s*/gi, '').trim() || 'Consulta por email'

  // created_by es NOT NULL y quien escribe desde fuera normalmente NO tiene
  // perfil (es justo el caso principal: un cliente nuevo). Antes se pasaba null
  // y el insert fallaba, pero se respondía ok:true con ticket_id undefined, así
  // que el proveedor de correo daba la entrega por buena y el mensaje se perdía.
  let createdBy = userProfile?.id ?? null
  if (!createdBy) {
    const { data: admin } = await supabase
      .from('profiles').select('id')
      .eq('role', 'admin').eq('is_active', true)
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
    createdBy = admin?.id ?? null
  }
  if (!createdBy) {
    return NextResponse.json({ ok: false, error: 'No hay autor por defecto' }, { status: 500 })
  }

  const { data: newTicket, error: ticketErr } = await supabase.from('tickets').insert({
    title: cleanSubject.substring(0, 200),
    description: body.substring(0, 5000),
    status: 'open',
    priority: 'medium',
    category: 'support',
    source_channel: 'email',
    email_thread_id: threadId || `${fromEmail}_${Date.now()}`,
    created_by: createdBy,
    requester_email: fromEmail,
    // Sin perfil no se adivina el dueño: el ticket nace interno (organization_id
    // null) en vez de caer en un cliente que no tiene nada que ver.
    organization_id: userProfile?.organization_id ?? null,
  }).select('id').single()

  // Devolver error para que el proveedor reintente en vez de dar el correo por
  // procesado y perderlo.
  if (ticketErr || !newTicket) {
    console.error('[email-inbound] no se pudo crear el ticket', ticketErr?.message)
    return NextResponse.json({ ok: false, error: 'No se pudo crear el ticket' }, { status: 500 })
  }

  await supabase.from('multichannel_messages')
    .update({ ticket_id: newTicket.id, is_processed: true })
    .eq('external_id', threadId)

  return NextResponse.json({ ok: true, action: 'ticket_created', ticket_id: newTicket.id })
}
