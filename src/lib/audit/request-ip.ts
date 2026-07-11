import { headers } from 'next/headers'

/** IP de origen de la petición actual.
 *  Vercel/proxies la exponen en x-forwarded-for (lista: la primera es el cliente).
 *  Devuelve null fuera de contexto de petición (ej. crons). */
export async function getRequestIp(): Promise<string | null> {
  try {
    const h = await headers()
    const xff = h.get('x-forwarded-for')
    if (xff) {
      const first = xff.split(',')[0].trim()
      if (first) return first
    }
    return h.get('x-real-ip')?.trim() || null
  } catch {
    return null
  }
}
