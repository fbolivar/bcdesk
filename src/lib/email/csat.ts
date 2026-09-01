import { createHmac, timingSafeEqual } from 'crypto'
import { APP_URL } from './mailer'

/**
 * Enlaces de CSAT de 1 clic (sin login). Cada enlace lleva una firma HMAC sobre
 * "ticketId:score" para que nadie pueda falsear la calificación. El endpoint
 * público /api/csat valida la firma antes de registrar el puntaje.
 */
function secret(): string {
  // Fail-closed: sin un secreto real, no se firma ni valida (evita que alguien
  // falsee calificaciones con un secreto público). Antes caía a 'dev-csat-secret'.
  const s = process.env.CSAT_SECRET || process.env.EMAIL_INBOUND_SECRET
  if (!s) throw new Error('CSAT_SECRET no configurado')
  return s
}

export function signCsat(ticketId: string, score: number): string {
  return createHmac('sha256', secret()).update(`${ticketId}:${score}`).digest('hex')
}

export function verifyCsat(ticketId: string, score: number, sig: string): boolean {
  if (!sig) return false
  const expected = signCsat(ticketId, score)
  const a = Buffer.from(expected)
  const b = Buffer.from(sig)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function csatUrl(ticketId: string, score: number): string {
  const sig = signCsat(ticketId, score)
  return `${APP_URL}/api/csat?t=${encodeURIComponent(ticketId)}&s=${score}&sig=${sig}`
}
