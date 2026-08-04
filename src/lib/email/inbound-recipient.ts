/**
 * Solo el buzón de SOPORTE genera tickets. Un correo dirigido a otra dirección
 * del dominio (p. ej. la personal fbolivarb@) NO debe abrir ticket.
 *
 * Devuelve true si el destinatario es SUPPORT_EMAIL, incluyendo los +alias de
 * respuesta (soporte+t{uuid}@dominio). Si el proveedor no envía el campo `to`,
 * devuelve true (no podemos determinar el destinatario → no descartamos, para no
 * perder correos legítimos por un campo faltante).
 */
export function isAddressedToSupport(to: string | undefined | null): boolean {
  if (!to) return true
  const support = (process.env.SUPPORT_EMAIL || 'soporte@fernandobolivar.app').toLowerCase()
  const [local, domain] = support.split('@')
  if (!local || !domain) return true
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // soporte@dominio  o  soporte+loquesea@dominio  (en cualquier parte del campo To)
  const re = new RegExp(`${esc(local)}(\\+[^@\\s>,;]+)?@${esc(domain)}`, 'i')
  return re.test(to)
}
