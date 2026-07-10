import { sendEmail, APP_URL, mailConfigured, replyToForTicket } from './mailer'
import { getBrand, brandWebsiteLabel, type Brand } from './branding'
import { csatUrl } from './csat'

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

function base(brand: Brand, title: string, body: string, ctaUrl?: string, ctaText?: string) {
  const brandMark = brand.logoUrl
    ? `<img src="${brand.logoUrl}" alt="${brand.name}" height="24" style="height:24px;display:block">`
    : `<span style="color:#fff;font-size:16px;font-weight:700">${brand.name}</span>`
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#F4F7FB;color:#5B6B7C;margin:0;padding:20px}
  .card{max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E6EBF2;border-radius:12px;overflow:hidden}
  .header{background:${brand.color};padding:18px 24px}
  .header .title{color:#fff;font-size:13px;margin:6px 0 0;opacity:.9}
  .body{padding:24px}
  .body p{font-size:14px;line-height:1.6;margin:0 0 12px}
  .label{font-size:11px;color:#5B6B7C;text-transform:uppercase;letter-spacing:.05em}
  .value{font-size:14px;color:${brand.dark};font-weight:500}
  .cta{display:inline-block;margin-top:20px;padding:10px 20px;background:${brand.color};color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600}
  .sign{padding:18px 24px;border-top:1px solid #E6EBF2}
  .sign .n{font-size:13px;color:${brand.dark};font-weight:700;margin:0}
  .sign .t{font-size:11px;color:#5B6B7C;margin:2px 0 0}
  .sign a{color:${brand.color};text-decoration:none}
  .footer{padding:12px 24px;background:#F9FBFD;font-size:11px;color:#94A3B8}
  </style></head><body>
  <div class="card">
  <div class="header">${brandMark}<div class="title">${title}</div></div>
  <div class="body">${body}${ctaUrl ? `<br><a class="cta" href="${ctaUrl}">${ctaText ?? 'Ver'}</a>` : ''}</div>
  <div class="sign">
    <p class="n">${brand.name}</p>
    <p class="t">${brand.tagline}</p>
    <p class="t">✉ <a href="mailto:${brand.supportEmail}">${brand.supportEmail}</a> &nbsp;·&nbsp; 🌐 <a href="${brand.website}">${brandWebsiteLabel(brand.website)}</a></p>
  </div>
  <div class="footer">Este es un mensaje de ${brand.name}. Puedes responder a este correo para continuar la conversación de tu caso.</div>
  </div></body></html>`
}

export async function sendTicketCreatedEmail(params: TicketCreatedParams) {
  if (!mailConfigured()) return
  const url = `${APP_URL}/client/tickets/${params.ticketId}`
  const brand = await getBrand()
  const html = base(brand,
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
  /** Frase de asunto localizada (sin número; se antepone [#N]). */
  subject?: string
  /** Párrafo de acuse en el idioma del cliente; puede usar #{{TICKET}}. */
  intro?: string
  /** Encabezado localizado para la sección de posibles soluciones. */
  kbHeading?: string
  /** Artículos de KB sugeridos (posibles soluciones). */
  kbItems?: { title: string; excerpt: string | null }[]
}

/** Acuse automático al cliente que abrió un caso escribiendo a soporte@.
 *  Responde en el idioma del cliente y sugiere artículos de KB si aplican. */
export async function sendInboundAckEmail(params: InboundAckParams) {
  if (!mailConfigured()) return
  const num = `#${params.ticketNumber}`
  const subjectPhrase = (params.subject?.trim() || 'Recibimos tu solicitud').replace(/\{\{TICKET\}\}/g, num)
  const intro = (params.intro?.trim() ||
    'Hemos recibido tu mensaje y creamos un caso de soporte. Nuestro equipo lo revisará y te responderá por este mismo medio.')
    .replace(/\{\{TICKET\}\}/g, num)

  const kb = (params.kbItems ?? []).filter(k => k.title)
  const kbHtml = kb.length ? `
     <p class="label" style="margin-top:16px">${params.kbHeading?.trim() || 'Posibles soluciones'}</p>
     <ul style="padding-left:18px;margin:6px 0">
       ${kb.map(k => `<li style="margin-bottom:8px"><strong style="color:#0B2545">${k.title}</strong>${k.excerpt ? `<br><span style="font-size:13px;color:#5B6B7C">${k.excerpt}</span>` : ''}</li>`).join('')}
     </ul>` : ''

  const brand = await getBrand()
  const html = base(brand,
    subjectPhrase,
    `<p>${intro}</p>
     <p class="label">Caso</p><p class="value">${num} — ${params.ticketTitle}</p>
     ${kbHtml}`,
    `${APP_URL}`, 'HexDesk'
  )
  await sendEmail({
    to: params.to,
    // El [#N] se conserva SIEMPRE para el threading de respuestas.
    subject: `[${num}] ${subjectPhrase}`,
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
  const brand = await getBrand()
  const html = base(brand,
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
  const brand = await getBrand()
  const emojis = ['😞', '😕', '😐', '😊', '😄']
  // Cada carita es un enlace firmado de 1 clic al endpoint público /api/csat.
  const stars = [1, 2, 3, 4, 5]
    .map(n => `<a href="${csatUrl(params.ticketId, n)}" style="font-size:30px;text-decoration:none;margin:0 4px" title="${n}/5">${emojis[n - 1]}</a>`)
    .join('')
  const html = base(brand,
    '¿Quedaste satisfecho?',
    `<p>Hola${params.clientName ? ` <strong style="color:#0B2545">${params.clientName}</strong>` : ''},</p>
     <p>Tu ticket <strong style="color:#0B2545">#${params.ticketNumber} — ${params.ticketTitle}</strong> ha sido resuelto.</p>
     <p>¿Cómo calificarías la atención? Toca una carita — es 1 solo clic:</p>
     <div style="text-align:center;margin:18px 0">${stars}</div>
     <p style="font-size:12px;color:#5B6B7C;text-align:center">😞 Muy mala &nbsp;·&nbsp; 😄 Excelente</p>`,
    csatUrl(params.ticketId, 5), 'Calificar 5/5'
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
  const brand = await getBrand()
  const html = base(brand,
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

interface InvoiceEmailParams {
  to: string
  orgName?: string
  invoiceNumber: string
  amount: string
  dueDate: string
  invoiceId: string
  attachment?: { filename: string; content: Buffer }
}

interface VisitReportEmailParams {
  to: string
  orgName?: string | null
  visitNumber: string
  title: string
  typeLabel: string
  attachment?: { filename: string; content: Buffer }
}

/** Envía el acta de la visita técnica al cliente (con el PDF adjunto). */
export async function sendVisitReportEmail(params: VisitReportEmailParams) {
  if (!mailConfigured()) return
  const brand = await getBrand()
  const html = base(brand,
    'Acta de visita técnica',
    `<p>Hola${params.orgName ? ` <strong style="color:#0B2545">${params.orgName}</strong>` : ''},</p>
     <p>Te compartimos el acta de la visita técnica realizada${params.attachment ? ' (encuentra el PDF adjunto)' : ''}.</p>
     <p class="label">Documento</p><p class="value">${params.visitNumber}</p>
     <p class="label">Tipo</p><p class="value">${params.typeLabel}</p>
     <p class="label">Asunto</p><p class="value">${params.title}</p>
     <p style="margin-top:12px">Si tienes alguna observación, responde a este correo.</p>`,
  )
  await sendEmail({
    to: params.to,
    subject: `Acta de visita ${params.visitNumber} — ${brand.name}`,
    html,
    ...(params.attachment ? { attachments: [{ filename: params.attachment.filename, content: params.attachment.content, contentType: 'application/pdf' }] } : {}),
  })
}

/** Envía la cuenta de cobro al cliente (al pulsar "Enviar al cliente"). */
export async function sendInvoiceEmail(params: InvoiceEmailParams) {
  if (!mailConfigured()) return
  const brand = await getBrand()
  const url = `${APP_URL}/client/invoices/${params.invoiceId}`
  const html = base(brand,
    'Nueva cuenta de cobro',
    `<p>Hola${params.orgName ? ` <strong style="color:#0B2545">${params.orgName}</strong>` : ''},</p>
     <p>Te compartimos una nueva cuenta de cobro por los servicios prestados${params.attachment ? ' (encuentra el PDF adjunto)' : ''}.</p>
     <p class="label">Cuenta de cobro</p><p class="value">${params.invoiceNumber}</p>
     <p class="label">Total</p><p class="value" style="font-size:18px">${params.amount}</p>
     <p class="label">Fecha de vencimiento</p><p class="value">${params.dueDate}</p>
     <p style="margin-top:12px">Puedes ver el detalle y pagarla desde tu portal:</p>`,
    url, 'Ver y pagar'
  )
  await sendEmail({
    to: params.to,
    subject: `Cuenta de cobro ${params.invoiceNumber} — ${params.amount}`,
    html,
    ...(params.attachment ? { attachments: [{ filename: params.attachment.filename, content: params.attachment.content, contentType: 'application/pdf' }] } : {}),
  })
}
