import nodemailer from 'nodemailer'

/**
 * Transporte de correo saliente vía SMTP de Google Workspace.
 * Autentica con la cuenta soporte@fernandobolivar.app usando una App Password
 * (GMAIL_APP_PASSWORD). El envío queda alineado con SPF/DKIM/DMARC de Google
 * automáticamente porque sale por los propios servidores de Gmail.
 */

const GMAIL_USER = process.env.GMAIL_USER?.trim() ?? ''
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '') ?? ''

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
export const FROM_EMAIL =
  process.env.MAIL_FROM ?? (GMAIL_USER ? `HexDesk <${GMAIL_USER}>` : 'HexDesk <soporte@fernandobolivar.app>')

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
 * Gmail entrega los +alias al mismo buzón, y el alias sobrevive en el header
 * To de la respuesta → el receptor lo usa para reconectar la respuesta al
 * ticket original en vez de crear uno nuevo.
 */
export function replyToForTicket(ticketId: string): string | undefined {
  if (!GMAIL_USER || !ticketId) return undefined
  const [local, domain] = GMAIL_USER.split('@')
  if (!local || !domain) return undefined
  return `${local}+t${ticketId.replace(/-/g, '')}@${domain}`
}

interface SendArgs {
  to: string
  subject: string
  html: string
  replyTo?: string
  headers?: Record<string, string>
}

export async function sendEmail({ to, subject, html, replyTo, headers }: SendArgs): Promise<void> {
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
  })
}
