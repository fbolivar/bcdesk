import { createServiceClient } from '@/lib/supabase/service'

/**
 * Rate limiting de /api/rmm/* respaldado en tabla (serverless-safe: no hay
 * estado en memoria entre invocaciones de Vercel). Ventana fija por
 * (endpoint_id, route). Mismo enfoque que el limitador de login.
 *
 * Aproximado bajo carrera concurrente (como el de login) — suficiente para
 * frenar el abuso de un token filtrado, que es el objetivo.
 */

export type RmmRoute = 'heartbeat' | 'inventory' | 'commands_pending' | 'commands_result'

// Límites por ruta: ventana en ms y máximo de peticiones en esa ventana.
const LIMITS: Record<RmmRoute, { max: number; windowMs: number }> = {
  heartbeat:        { max: 20,  windowMs: 5 * 60 * 1000 },   // esperado 1/5min; 20 tolera reintentos
  inventory:        { max: 5,   windowMs: 60 * 60 * 1000 },  // esperado 1/24h
  commands_pending: { max: 30,  windowMs: 60 * 1000 },       // poll 1/min; ráfagas ok
  commands_result:  { max: 60,  windowMs: 5 * 60 * 1000 },
}

export async function rmmRateLimit(
  endpointId: string,
  route: RmmRoute,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const { max, windowMs } = LIMITS[route]
  const admin = createServiceClient()
  const now = Date.now()

  const { data } = await admin
    .from('rmm_rate_limits')
    .select('window_start, request_count')
    .eq('endpoint_id', endpointId)
    .eq('route', route)
    .maybeSingle()

  let windowStart = now
  let count = 1
  if (data) {
    const ws = new Date(data.window_start).getTime()
    if (now - ws < windowMs) {
      windowStart = ws
      count = (data.request_count ?? 0) + 1
    }
  }

  if (count > max) {
    const retry = Math.ceil((windowStart + windowMs - now) / 1000)
    return { allowed: false, retryAfterSeconds: Math.max(1, retry) }
  }

  await admin.from('rmm_rate_limits').upsert(
    { endpoint_id: endpointId, route, window_start: new Date(windowStart).toISOString(), request_count: count },
    { onConflict: 'endpoint_id,route' },
  )
  return { allowed: true, retryAfterSeconds: 0 }
}
