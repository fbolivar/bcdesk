import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { authenticateAgent } from '@/lib/rmm/auth'
import { rmmRateLimit } from '@/lib/rmm/rate-limit'

export const runtime = 'nodejs'

const numOrNull = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function POST(req: NextRequest) {
  const auth = await authenticateAgent(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rl = await rmmRateLimit(auth.endpoint.id, 'heartbeat')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })
  }

  let body: Record<string, unknown> = {}
  try { body = (await req.json()) as Record<string, unknown> } catch { /* body vacío */ }
  const m = (body.metrics ?? {}) as Record<string, unknown>

  const admin = createServiceClient()

  const { error: metricErr } = await admin.from('endpoint_metrics').insert({
    endpoint_id: auth.endpoint.id,
    cpu_pct: numOrNull(m.cpu_pct),
    ram_pct: numOrNull(m.ram_pct),
    disk_free_pct: numOrNull(m.disk_free_pct),
    uptime_seconds: numOrNull(m.uptime_seconds),
  })
  if (metricErr) return NextResponse.json({ error: 'No se pudo registrar el heartbeat' }, { status: 500 })

  await admin.from('endpoints').update({
    status: 'online',
    last_seen_at: new Date().toISOString(),
    ...(typeof body.hostname === 'string' ? { hostname: body.hostname.slice(0, 255) } : {}),
    ...(typeof body.agent_version === 'string' ? { agent_version: body.agent_version.slice(0, 50) } : {}),
  }).eq('id', auth.endpoint.id)

  return NextResponse.json({ ok: true, next_heartbeat_seconds: 300 })
}
