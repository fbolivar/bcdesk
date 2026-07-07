/**
 * Tokens de organización: se generan en claro (se muestran UNA vez al admin),
 * pero en la BD solo se guarda su hash SHA-256. Un volcado de la BD no expone
 * tokens usables. La validación hashea el token entrante y compara por hash.
 * Usa Web Crypto (disponible en node y edge).
 */

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')

/** Genera un token aleatorio de 256 bits en hex (64 chars). */
export function generateOrgToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/** Hash SHA-256 (hex) del token, para almacenar/consultar. */
export async function hashOrgToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return toHex(digest)
}

/** Prefijo mostrable (para reconocer la clave en la UI sin exponerla). */
export function tokenPrefix(raw: string): string {
  return raw.slice(0, 8)
}
