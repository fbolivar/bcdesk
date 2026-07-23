import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { authenticateAgent } from '@/lib/rmm/auth'
import { rmmRateLimit } from '@/lib/rmm/rate-limit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = await authenticateAgent(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rl = await rmmRateLimit(auth.endpoint.id, 'commands_result')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })
  }

  let body: Record<string, unknown> = {}
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const commandId = typeof body.command_id === 'string' ? body.command_id : null
  const status = body.status === 'done' || body.status === 'failed' ? body.status : null
  if (!commandId || !status) return NextResponse.json({ error: 'command_id y status son obligatorios' }, { status: 400 })

  const result = (body.result ?? {}) as Record<string, unknown>
  const admin = createServiceClient()

  // El comando debe pertenecer a ESTE endpoint (el token no puede reportar por otro).
  const { data: cmd } = await admin
    .from('endpoint_commands')
    .select('id, endpoint_id')
    .eq('id', commandId)
    .eq('endpoint_id', auth.endpoint.id)
    .maybeSingle()
  if (!cmd) return NextResponse.json({ error: 'Comando no encontrado para este endpoint' }, { status: 404 })

  const { error } = await admin.from('endpoint_commands').update({
    status,
    result: {
      stdout: typeof result.stdout === 'string' ? result.stdout.slice(0, 20000) : null,
      stderr: typeof result.stderr === 'string' ? result.stderr.slice(0, 20000) : null,
      exit_code: Number.isFinite(Number(result.exit_code)) ? Number(result.exit_code) : null,
    },
    completed_at: new Date().toISOString(),
  }).eq('id', commandId)
  if (error) return NextResponse.json({ error: 'No se pudo registrar el resultado' }, { status: 500 })

  // Auditoría: el resultado de una ejecución queda registrado (actor = agente, sin usuario).
  await admin.from('audit_logs').insert({
    actor_id: null,
    action: 'rmm.command_result',
    resource_type: 'endpoint',
    resource_id: auth.endpoint.id,
    new_values: { command_id: commandId, status },
  })

  return NextResponse.json({ ok: true })
}
