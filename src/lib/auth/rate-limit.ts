import { createServiceClient } from '@/lib/supabase/service'

/**
 * Rate limiting de login respaldado en BD (funciona en serverless / múltiples instancias).
 * Cuenta intentos fallidos por clave (email) dentro de una ventana; al superar el máximo,
 * bloquea temporalmente. Se escribe con el service role (la tabla tiene RLS sin políticas).
 */

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutos
const BLOCK_MS = 15 * 60 * 1000 // bloqueo de 15 minutos

export interface RateLimitStatus {
  blocked: boolean
  retryAfterSeconds: number
}

/** Comprueba si la clave está bloqueada actualmente. */
export async function checkRateLimit(key: string): Promise<RateLimitStatus> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('auth_login_attempts')
    .select('blocked_until')
    .eq('key', key.toLowerCase())
    .maybeSingle()

  const blockedUntil = data?.blocked_until ? new Date(data.blocked_until).getTime() : 0
  const now = Date.now()
  if (blockedUntil > now) {
    return { blocked: true, retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000) }
  }
  return { blocked: false, retryAfterSeconds: 0 }
}

/** Registra un intento fallido; bloquea si se supera el máximo dentro de la ventana. */
export async function registerFailedAttempt(key: string): Promise<void> {
  const admin = createServiceClient()
  const k = key.toLowerCase()
  const now = Date.now()

  const { data } = await admin
    .from('auth_login_attempts')
    .select('attempts, window_start')
    .eq('key', k)
    .maybeSingle()

  let attempts = 1
  let windowStart = new Date(now).toISOString()

  if (data) {
    const windowStartMs = new Date(data.window_start).getTime()
    if (now - windowStartMs < WINDOW_MS) {
      attempts = (data.attempts ?? 0) + 1
      windowStart = new Date(windowStartMs).toISOString()
    }
  }

  const blockedUntil = attempts >= MAX_ATTEMPTS ? new Date(now + BLOCK_MS).toISOString() : null

  await admin.from('auth_login_attempts').upsert({
    key: k,
    attempts,
    window_start: windowStart,
    blocked_until: blockedUntil,
    updated_at: new Date(now).toISOString(),
  })
}

/** Limpia los intentos tras un login exitoso. */
export async function clearAttempts(key: string): Promise<void> {
  const admin = createServiceClient()
  await admin.from('auth_login_attempts').delete().eq('key', key.toLowerCase())
}
