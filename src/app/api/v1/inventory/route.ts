import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Ingesta de inventario para el auto-descubrimiento de CMDB.
 * Un agente instalado en los endpoints reporta su hardware/software vía POST,
 * autenticado con un token de organización (header x-api-key). El activo se
 * crea o actualiza (match por serial o por hostname dentro de la organización).
 *
 * Body JSON:
 * { hostname, serial_number?, asset_type?, manufacturer?, model?, os?, cpu?,
 *   ram_gb?, mac?, ip?, location?, software?: string[] }
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')?.trim()
  if (!apiKey) {
    return Response.json({ error: 'Falta el header x-api-key.' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: token } = await supabase
    .from('org_api_tokens')
    .select('id, organization_id, is_active')
    .eq('token', apiKey)
    .maybeSingle()

  if (!token || !token.is_active) {
    return Response.json({ error: 'Token inválido o inactivo.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'El cuerpo debe ser JSON válido.' }, { status: 400 })
  }

  const hostname = (body.hostname as string)?.trim()
  if (!hostname) {
    return Response.json({ error: 'hostname es obligatorio.' }, { status: 422 })
  }

  const serial = (body.serial_number as string)?.trim() || null
  const orgId = token.organization_id

  // Buscar activo existente: por serial (si existe) o por nombre dentro de la organización.
  let existing: { id: string } | null = null
  if (serial) {
    const { data } = await supabase
      .from('assets').select('id')
      .eq('serial_number', serial)
      .eq('organization_id', orgId)
      .maybeSingle()
    existing = data
  }
  if (!existing) {
    const { data } = await supabase
      .from('assets').select('id')
      .ilike('name', hostname)
      .eq('organization_id', orgId)
      .maybeSingle()
    existing = data
  }

  const now = new Date().toISOString()
  const metadata = {
    os: body.os ?? null,
    cpu: body.cpu ?? null,
    ram_gb: body.ram_gb ?? null,
    mac: body.mac ?? null,
    ip: body.ip ?? null,
    software: Array.isArray(body.software) ? body.software : [],
    discovered_at: now,
  }

  const fields = {
    name: hostname,
    asset_type: (body.asset_type as string) || 'hardware',
    manufacturer: (body.manufacturer as string) || null,
    model: (body.model as string) || null,
    serial_number: serial,
    location: (body.location as string) || null,
    organization_id: orgId,
    metadata,
    source: 'discovery',
    last_seen_at: now,
    updated_at: now,
  }

  let assetId: string
  let created = false
  if (existing) {
    await supabase.from('assets').update(fields).eq('id', existing.id)
    assetId = existing.id
  } else {
    const { data, error } = await supabase
      .from('assets')
      .insert({ ...fields, status: 'active' })
      .select('id')
      .single()
    if (error || !data) {
      return Response.json({ error: 'No se pudo registrar el activo.' }, { status: 500 })
    }
    assetId = data.id
    created = true
  }

  // Registrar uso del token
  await supabase.from('org_api_tokens').update({ last_used_at: now }).eq('id', token.id)

  return Response.json({ ok: true, asset_id: assetId, created })
}
