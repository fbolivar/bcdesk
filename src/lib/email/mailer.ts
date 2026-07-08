import nodemailer from 'nodemailer'

/**
 * Transporte de correo saliente vía SMTP de Google Workspace.
 *
 * En Workspace, "soporte@" suele ser un ALIAS de la cuenta principal (no tiene
 * login propio). Por eso separamos dos cosas:
 *  - GMAIL_USER + GMAIL_APP_PASSWORD → login real que AUTENTICA el SMTP.
 *  - SUPPORT_EMAIL (alias) → dirección VISIBLE desde la que se envía y a la que
 *    llegan las respuestas. Gmail permite enviar "como" un alias de la cuenta.
 * El envío queda alineado con SPF/DKIM/DMARC de Google automáticamente.
 */

const GMAIL_USER = process.env.GMAIL_USER?.trim() ?? ''
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '') ?? ''
// Dirección visible (alias). Puede diferir de la cuenta que autentica.
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL?.trim() || 'soporte@fernandobolivar.app'

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
export const FROM_EMAIL = process.env.MAIL_FROM ?? `HexDesk <${SUPPORT_EMAIL}>`

/** Hay credenciales SMTP configuradas. Si no, los envíos se omiten en silencio. */
export function mailConfigured(): boolean {
  return Boolean(GMAIL_USER && GMAIL_PASS)
}

let _transporter: nodemailer.Transporter | null = null
function transporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    })
  }
  return _transporter
}

/**
 * Dirección Reply-To con "+alias" por ticket (soporte+t{uuid}@dominio).
 * Se construye sobre la dirección VISIBLE (SUPPORT_EMAIL), no sobre la cuenta
 * que autentica. Gmail entrega los +alias al mismo buzón, y el alias sobrevive
 * en el header To de la respuesta → el receptor lo usa para reconectar la
 * respuesta al ticket original en vez de crear uno nuevo.
 */
export function replyToForTicket(ticketId: string): string | undefined {
  if (!SUPPORT_EMAIL || !ticketId) return undefined
  const [local, domain] = SUPPORT_EMAIL.split('@')
  if (!local || !domain) return undefined
  return `${local}+t${ticketId.replace(/-/g, '')}@${domain}`
}

interface SendArgs {
  to: string
  subject: string
  html: string
  replyTo?: string
  headers?: Record<string, string>
  attachments?: { filename: string; content: Buffer; contentType?: string }[]
}

export async function sendEmail({ to, subject, html, replyTo, headers, attachments }: SendArgs): Promise<void> {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[mail] SMTP no configurado. Se omite envío a ${to}: ${subject}`)
    }
    return
  }
  await transporter().sendMail({
    from: FROM_EMAIL,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(headers ? { headers } : {}),
    ...(attachments?.length ? { attachments } : {}),
  })
}
