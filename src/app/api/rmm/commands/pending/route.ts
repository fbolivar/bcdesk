import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { authenticateAgent } from '@/lib/rmm/auth'
import { rmmRateLimit } from '@/lib/rmm/rate-limit'

export const runtime = 'nodejs'

/**
 * El agente hace polling aquí (cada ~1 min). Devuelve los comandos pendientes
 * de ESTE endpoint (derivado del token) y los marca 'running' con picked_at.
 *
 * MVP: short-poll (respuesta inmediata), no long-poll con conexión abierta:
 * mantener la función colgada en serverless cuesta tiempo de ejecución y no
 * aporta en fase 1. El agente ya consulta cada minuto. El contrato no cambia.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateAgent(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rl = await rmmRateLimit(auth.endpoint.id, 'commands_pending')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })
  }

  const admin = createServiceClient()
  const { data: pending } = await admin
    .from('endpoint_commands')
    .select('id, command_type, payload')
    .eq('endpoint_id', auth.endpoint.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10)

  const commands = pending ?? []
  if (commands.length > 0) {
    await admin
      .from('endpoint_commands')
      .update({ status: 'running', picked_at: new Date().toISOString() })
      .in('id', commands.map(c => c.id))
      .eq('status', 'pending') // solo los que siguen pendientes (evita pisar carreras)
  }

  return NextResponse.json({ commands })
}
