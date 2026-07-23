import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/api/require-admin'
import { generateOrgToken, hashOrgToken, tokenPrefix } from '@/lib/api/org-token-crypto'

export const runtime = 'nodejs'

const OFFLINE_MS = 10 * 60 * 1000 // sin heartbeat en 10 min → offline en la lista

// GET: lista de endpoints del cliente + última métrica de cada uno.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { id: orgId } = await params

  const admin = createServiceClient()
  const { data: endpoints } = await admin
    .from('endpoints')
    .select('id, hostname, os, status, last_seen_at, agent_version, created_at, disabled_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  const eps = endpoints ?? []

  // Última métrica por endpoint vía RPC (LATERAL, un seek por endpoint) — no
  // escanea todas las métricas, así que el tiempo es plano con la retención.
  const latest: Record<string, { cpu_pct: number | null; ram_pct: number | null; disk_free_pct: number | null }> = {}
  if (eps.length > 0) {
    const { data: metrics } = await admin.rpc('rmm_latest_metrics', { p_org: orgId })
    for (const m of (metrics ?? []) as { endpoint_id: string; cpu_pct: number | null; ram_pct: number | null; disk_free_pct: number | null }[]) {
      latest[m.endpoint_id] = { cpu_pct: m.cpu_pct, ram_pct: m.ram_pct, disk_free_pct: m.disk_free_pct }
    }
  }

  const now = Date.now()
  const list = eps.map(e => ({
    ...e,
    online: !e.disabled_at && !!e.last_seen_at && now - new Date(e.last_seen_at).getTime() < OFFLINE_MS,
    latest: latest[e.id] ?? null,
  }))

  return NextResponse.json({ endpoints: list })
}

// POST: da de alta un endpoint PARA este cliente y genera su token (se muestra 1 vez).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { id: orgId } = await params

  const body = (await req.json().catch(() => ({}))) as { hostname?: unknown; os?: unknown }
  const os = body.os === 'windows' || body.os === 'linux' ? body.os : null
  if (!os) return NextResponse.json({ error: "os debe ser 'windows' o 'linux'" }, { status: 400 })
  const hostname = typeof body.hostname === 'string' && body.hostname.trim() ? body.hostname.trim().slice(0, 255) : null

  const admin = createServiceClient()

  // Gate rmm_enabled a nivel API (además del trigger de BD).
  const { data: org } = await admin.from('organizations').select('rmm_enabled').eq('id', orgId).maybeSingle()
  if (!org) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  if (!org.rmm_enabled) {
    return NextResponse.json({ error: 'El módulo RMM no está activo para este cliente. Actívalo primero.' }, { status: 409 })
  }

  const raw = generateOrgToken()
  const { data: endpoint, error } = await admin.from('endpoints').insert({
    organization_id: orgId,
    hostname,
    os,
    token_hash: await hashOrgToken(raw),
    token_prefix: tokenPrefix(raw),
    created_by: guard.user.id,
  }).select('id, hostname, os, status, created_at').single()

  if (error || !endpoint) {
    return NextResponse.json({ error: 'No se pudo crear el endpoint.' }, { status: 500 })
  }

  await admin.from('audit_logs').insert({
    actor_id: guard.user.id, action: 'rmm.endpoint_created',
    resource_type: 'endpoint', resource_id: endpoint.id, new_values: { organization_id: orgId, os, hostname },
  })

  const serverUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return NextResponse.json({
    endpoint,
    // El token se muestra UNA sola vez. En la BD solo queda su hash.
    token: raw,
    install: {
      server_url: serverUrl,
      config_path: os === 'windows'
        ? 'C:\\ProgramData\\HexDeskAgent\\config.yaml'
        : '/etc/hexdesk-agent/config.yaml',
      config_contents: `server_url: "${serverUrl}"\ntoken: "${raw}"\n`,
      note: 'Guarda el token ahora: no se volverá a mostrar. El agente lo lee del archivo de config, nunca embebido en el binario.',
    },
  }, { status: 201 })
}
