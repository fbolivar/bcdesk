import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateOrgToken, hashOrgToken, tokenPrefix } from '@/lib/api/org-token-crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Auto-registro del agente (instalador GENÉRICO). El agente presenta el token de
 * enrolamiento del cliente (Authorization: Bearer) y su machine_id; el servidor
 * crea —o reutiliza, si ese machine_id ya existe— su endpoint y le devuelve SU
 * token individual, que el agente guarda y usa para el heartbeat.
 *
 * Idempotente por (organization_id, machine_id): reinstalar el mismo equipo no
 * crea un endpoint nuevo, solo rota su token.
 */
function extractToken(req: Request): string {
  const auth = req.headers.get('authorization') ?? ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  return (req.headers.get('x-agent-token') ?? '').trim()
}

export async function POST(req: NextRequest) {
  const enrollRaw = extractToken(req)
  if (!enrollRaw) return NextResponse.json({ error: 'Falta el token de enrolamiento' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { hostname?: unknown; os?: unknown; machine_id?: unknown }
  const os = body.os === 'windows' || body.os === 'linux' ? body.os : null
  if (!os) return NextResponse.json({ error: "os debe ser 'windows' o 'linux'" }, { status: 400 })
  const hostname = typeof body.hostname === 'string' && body.hostname.trim() ? body.hostname.trim().slice(0, 255) : null
  const machineId = typeof body.machine_id === 'string' && body.machine_id.trim() ? body.machine_id.trim().slice(0, 200) : null

  const admin = createServiceClient()

  // Buscar el cliente por el hash del enroll token (mismo esquema SHA-256).
  const enrollHash = await hashOrgToken(enrollRaw)
  const { data: org } = await admin
    .from('organizations')
    .select('id, rmm_enabled')
    .eq('rmm_enroll_token_hash', enrollHash)
    .maybeSingle()

  if (!org) return NextResponse.json({ error: 'Token de enrolamiento inválido' }, { status: 401 })
  if (!org.rmm_enabled) return NextResponse.json({ error: 'RMM inactivo para este cliente' }, { status: 403 })

  const raw = generateOrgToken()
  const token_hash = await hashOrgToken(raw)
  const token_prefix = tokenPrefix(raw)

  // Reutilizar el endpoint si ya existe ese machine_id en el cliente.
  if (machineId) {
    const { data: existing } = await admin
      .from('endpoints')
      .select('id, disabled_at')
      .eq('organization_id', org.id)
      .eq('machine_id', machineId)
      .maybeSingle()

    if (existing) {
      if (existing.disabled_at) {
        return NextResponse.json({ error: 'Este equipo está deshabilitado' }, { status: 403 })
      }
      const { error: updErr } = await admin.from('endpoints').update({
        token_hash, token_prefix, status: 'pending',
        ...(hostname ? { hostname } : {}),
      }).eq('id', existing.id)
      if (updErr) return NextResponse.json({ error: 'No se pudo re-enrolar el equipo' }, { status: 500 })

      await admin.from('audit_logs').insert({
        actor_id: null, action: 'rmm.endpoint_reenrolled',
        resource_type: 'endpoint', resource_id: existing.id, new_values: { organization_id: org.id, machine_id: machineId },
      })
      return NextResponse.json({ token: raw }, { status: 200 })
    }
  }

  // Crear un endpoint nuevo. La inserción puede chocar con el índice único si dos
  // agentes del mismo equipo enrolan a la vez → reintentar como update.
  const { data: created, error: insErr } = await admin.from('endpoints').insert({
    organization_id: org.id, hostname, os, machine_id: machineId,
    token_hash, token_prefix, status: 'pending', created_by: null,
  }).select('id').single()

  if (insErr) {
    // 23505 = unique_violation: otro request ganó la carrera. Reintentar update.
    if (machineId && insErr.code === '23505') {
      const { data: existing } = await admin
        .from('endpoints').select('id').eq('organization_id', org.id).eq('machine_id', machineId).maybeSingle()
      if (existing) {
        await admin.from('endpoints').update({ token_hash, token_prefix, status: 'pending', ...(hostname ? { hostname } : {}) }).eq('id', existing.id)
        return NextResponse.json({ token: raw }, { status: 200 })
      }
    }
    return NextResponse.json({ error: 'No se pudo enrolar el equipo' }, { status: 500 })
  }

  await admin.from('audit_logs').insert({
    actor_id: null, action: 'rmm.endpoint_enrolled',
    resource_type: 'endpoint', resource_id: created.id, new_values: { organization_id: org.id, os, hostname, machine_id: machineId },
  })
  return NextResponse.json({ token: raw }, { status: 201 })
}
