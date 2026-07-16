/** Buzones que nunca corresponden a una persona pidiendo soporte. */
const NO_REPLY_LOCALPARTS = [
  'no-reply', 'noreply', 'no_reply', 'do-not-reply', 'donotreply', 'donot-reply',
  'mailer-daemon', 'postmaster', 'bounce', 'bounces', 'notification', 'notifications',
]

export function hasNoReplyLocalpart(email: string): boolean {
  const lp = (email.split('@')[0] || '').toLowerCase()
  return NO_REPLY_LOCALPARTS.some(x => lp.includes(x))
}

/**
 * Correo masivo/automático que NO debe abrir ticket: boletines y avisos de
 * servicios (Cloudflare, Google…). Antes todo correo entrante se volvía ticket
 * y llenaba la bandeja de ruido.
 *
 * Se detecta por dos vías:
 *  1) remitente no-reply / notifications (nadie pide soporte desde ahí);
 *  2) cabeceras estándar de correo masivo, que es la señal fiable para el
 *     marketing enviado desde una dirección normal (ej. cloudflare@e.cloudflare.com).
 *
 * IMPORTANTE: el llamador debe eximir a los remitentes CON perfil en HexDesk.
 * Un usuario real registrado nunca se filtra, sea cual sea su dirección.
 */
export function isBulkMail(email: string, headers?: Record<string, unknown> | null): boolean {
  if (hasNoReplyLocalpart(email)) return true

  const h: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers ?? {})) h[k.toLowerCase()] = String(v ?? '')

  if (h['list-unsubscribe'] || h['list-id']) return true
  if (/\b(bulk|list|junk)\b/i.test(h['precedence'] ?? '')) return true
  if (/auto-(generated|replied)/i.test(h['auto-submitted'] ?? '')) return true
  return false
}
