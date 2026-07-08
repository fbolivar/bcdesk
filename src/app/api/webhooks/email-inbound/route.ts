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

  const { data: newTicket } = await supabase.from('tickets').insert({
    title: cleanSubject.substring(0, 200),
    description: body.substring(0, 5000),
    status: 'open',
    priority: 'medium',
    category: 'support',
    source_channel: 'email',
    email_thread_id: threadId || `${fromEmail}_${Date.now()}`,
    created_by: userProfile?.id ?? null,
    organization_id: userProfile?.organization_id ?? null,
  }).select('id').single()

  if (newTicket) {
    await supabase.from('multichannel_messages')
      .update({ ticket_id: newTicket.id, is_processed: true })
      .eq('external_id', threadId)
  }

  return NextResponse.json({ ok: true, action: 'ticket_created', ticket_id: newTicket?.id })
}
