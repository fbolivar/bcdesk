import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { authenticateAgent } from '@/lib/rmm/auth'
import { rmmRateLimit } from '@/lib/rmm/rate-limit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = await authenticateAgent(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rl = await rmmRateLimit(auth.endpoint.id, 'inventory')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })
  }

  let body: Record<string, unknown> = {}
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { error } = await admin.from('endpoint_inventory').insert({
    endpoint_id: auth.endpoint.id,
    os_version: typeof body.os_version === 'string' ? body.os_version.slice(0, 255) : null,
    installed_apps: Array.isArray(body.installed_apps) ? body.installed_apps : [],
    hotfixes: Array.isArray(body.hotfixes) ? body.hotfixes : [],
  })
  if (error) return NextResponse.json({ error: 'No se pudo guardar el inventario' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
