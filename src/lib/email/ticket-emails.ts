import { sendEmail, APP_URL, mailConfigured, replyToForTicket } from './mailer'

interface TicketCreatedParams {
  to: string
  clientName: string
  ticketNumber: number
  ticketTitle: string
  ticketId: string
}

interface CommentAddedParams {
  to: string
  recipientName: string
  authorName: string
  ticketNumber: number
  ticketTitle: string
  commentPreview: string
  ticketId: string
  isInternal: boolean
  recipientRole: 'client' | 'agent' | 'admin'
  replyToToken?: string
}

interface CsatRequestParams {
  to: string
  clientName: string
  ticketNumber: number
  ticketTitle: string
  ticketId: string
}

interface StatusChangedParams {
  to: string
  clientName: string
  ticketNumber: number
  ticketTitle: string
  newStatus: string
  ticketId: string
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Abierto', in_progress: 'En progreso', waiting_client: 'Esperando tu respuesta',
  resolved: 'Resuelto', closed: 'Cerrado', cancelled: 'Cancelado',
}

function base(title: string, body: string, ctaUrl: string, ctaText: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:system-ui,sans-serif;background:#F4F7FB;color:#5B6B7C;margin:0;padding:20px}
  .card{max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E6EBF2;border-radius:12px;overflow:hidden}
  .header{background:#1789FC;padding:20px 24px}
  .header h1{color:#fff;font-size:16px;margin:0}
  .body{padding:24px}
  .body p{font-size:14px;line-height:1.6;margin:0 0 12px}
  .label{font-size:11px;color:#5B6B7C;text-transform:uppercase;letter-spacing:.05em}
  .value{font-size:14px;color:#0B2545;font-weight:500}
  .cta{display:inline-block;margin-top:20px;padding:10px 20px;background:#1789FC;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500}
  .footer{padding:16px 24px;border-top:1px solid #E6EBF2;font-size:11px;color:#5B6B7C}
  </style></head><body>
  <div class="card">
  <div class="header"><h1>HexDesk — ${title}</h1></div>
  <div class="body">${body}<br><a class="cta" href="${ctaUrl}">${ctaText}</a></div>
  <div class="footer">HexDesk · BC Fabric SAS</div>
  </div></body></html>`
}

export async function sendTicketCreatedEmail(params: TicketCreatedParams) {
  if (!mailConfigured()) return
  const url = `${APP_URL}/client/tickets/${params.ticketId}`
  const html = base(
    'Ticket recibido',
    `<p>Hola <strong style="color:#0B2545">${params.clientName}</strong>,</p>
     <p>Hemos recibido tu solicitud de soporte y ya estamos trabajando en ella.</p>
     <p class="label">Ticket</p><p class="value">#${params.ticketNumber} — ${params.ticketTitle}</p>
     <p>Te notificaremos cuando tengamos novedades. Puedes responder a este correo para agregar información.</p>`,
    url, 'Ver ticket'
  )
  await sendEmail({
    to: params.to,
    subject: `[#${params.ticketNumber}] Ticket recibido: ${params.ticketTitle}`,
    html,
    replyTo: replyToForTicket(params.ticketId),
    headers: { 'X-Ticket-Id': params.ticketId },
  })
}

interface InboundAckParams {
  to: string
  ticketNumber: number
  ticketTitle: string
  ticketId: string
}

/** Acuse automático al cliente que abrió un caso escribiendo a soporte@. */
export async function sendInboundAckEmail(params: InboundAckParams) {
  if (!mailConfigured()) return
  const html = base(
    'Recibimos tu solicitud',
    `<p>Hola,</p>
     <p>Hemos recibido tu mensaje y creamos un caso de soporte. Nuestro equipo lo revisará y te responderá por este mismo medio.</p>
     <p class="label">Tu número de caso</p><p class="value">#${params.ticketNumber} — ${params.ticketTitle}</p>
     <p style="font-size:12px;color:#5B6B7C;margin-top:16px">Puedes responder directamente a este correo para agregar información; se adjuntará a tu caso.</p>`,
    `${APP_URL}`, 'Ir a HexDesk'
  )
  await sendEmail({
    to: params.to,
    subject: `[#${params.ticketNumber}] Recibimos tu solicitud: ${params.ticketTitle}`,
    html,
    replyTo: replyToForTicket(params.ticketId),
    // Evita que auto-responders reboten sobre este acuse (mitiga bucles).
    headers: { 'X-Ticket-Id': params.ticketId, 'Auto-Submitted': 'auto-replied' },
  })
}

export async function sendCommentNotificationEmail(params: CommentAddedParams) {
  if (!mailConfigured()) return
  if (params.isInternal) return
  const isClientRecipient = params.recipientRole === 'client'
  const url = `${APP_URL}/${isClientRecipient ? 'client' : 'agent'}/tickets/${params.ticketId}`
  const html = base(
    'Nueva respuesta en tu ticket',
    `<p>Hola <strong style="color:#0B2545">${params.recipientName}</strong>,</p>
     <p><strong style="color:#0B2545">${params.authorName}</strong> respondió en el ticket:</p>
     <p class="label">Ticket #${params.ticketNumber}</p><p class="value">${params.ticketTitle}</p>
     <p class="label">Mensaje</p>
     <p style="background:#F4F7FB;border:1px solid #E6EBF2;padding:12px;border-radius:8px;color:#0B2545">${params.commentPreview}</p>
     ${isClientRecipient ? '<p style="font-size:12px;color:#5B6B7C;margin-top:16px">Puedes responder directamente a este correo para agregar un comentario al ticket.</p>' : ''}`,
    url, 'Ver conversación'
  )

  await sendEmail({
    to: params.to,
    subject: `Re: [#${params.ticketNumber}] ${params.ticketTitle}`,
    html,
    // El +alias por ticket permite reconectar la respuesta al hilo correcto.
    replyTo: replyToForTicket(params.ticketId),
    headers: { 'X-Ticket-Id': params.ticketId },
  })
}

export async function sendCsatRequestEmail(params: CsatRequestParams) {
  if (!mailConfigured()) return
  const url = `${APP_URL}/client/tickets/${params.ticketId}`
  const html = base(
    '¿Quedaste satisfecho?',
    `<p>Hola <strong style="color:#0B2545">${params.clientName}</strong>,</p>
     <p>Tu ticket <strong style="color:#0B2545">#${params.ticketNumber} — ${params.ticketTitle}</strong> ha sido resuelto.</p>
     <p>¿Puedes calificar la atención que recibiste? Solo toma 10 segundos.</p>
     <div style="display:flex;gap:12px;margin-top:16px">
       ${[1,2,3,4,5].map(n => `<a href="${url}?rate=${n}" style="font-size:24px;text-decoration:none">${['😞','😕','😐','😊','😄'][n-1]}</a>`).join('')}
     </div>`,
    url, 'Abrir ticket'
  )
  await sendEmail({
    to: params.to,
    subject: `[#${params.ticketNumber}] ¿Cómo calificarías tu experiencia?`,
    html,
    replyTo: replyToForTicket(params.ticketId),
    headers: { 'X-Ticket-Id': params.ticketId },
  })
}

export async function sendStatusChangedEmail(params: StatusChangedParams) {
  if (!mailConfigured()) return
  const url = `${APP_URL}/client/tickets/${params.ticketId}`
  const label = STATUS_LABELS[params.newStatus] ?? params.newStatus
  const html = base(
    `Ticket ${label.toLowerCase()}`,
    `<p>Hola <strong style="color:#0B2545">${params.clientName}</strong>,</p>
     <p>El estado de tu ticket ha cambiado.</p>
     <p class="label">Ticket #${params.ticketNumber}</p><p class="value">${params.ticketTitle}</p>
     <p class="label">Nuevo estado</p>
     <p style="color:#10B981;font-weight:600;font-size:16px">${label}</p>
     ${params.newStatus === 'resolved' ? '<p>Por favor confírmanos si todo está resuelto. Si el problema persiste, puedes reabrir el ticket.</p>' : ''}`,
    url, 'Ver ticket'
  )
  await sendEmail({
    to: params.to,
    subject: `[#${params.ticketNumber}] Estado: ${label} — ${params.ticketTitle}`,
    html,
    replyTo: replyToForTicket(params.ticketId),
    headers: { 'X-Ticket-Id': params.ticketId },
  })
}
