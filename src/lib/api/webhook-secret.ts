import { NextRequest } from 'next/server'

/**
 * Verifica un secreto compartido para webhooks entrantes.
 * El proveedor debe enviar el secreto en el header `x-webhook-secret` o en
 * el query `?secret=`. FALLA CERRADO: si la env no está configurada, rechaza
 * (mejor que aceptar payloads anónimos).
 */
export function verifyWebhookSecret(req: NextRequest, envName: string): boolean {
  const expected = process.env[envName]?.trim()
  if (!expected) return false
  const provided = (
    req.headers.get('x-webhook-secret') ||
    new URL(req.url).searchParams.get('secret') ||
    ''
  ).trim()
  return provided.length > 0 && provided === expected
}
