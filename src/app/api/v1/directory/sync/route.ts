import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Sincronización de directorio (AD/LDAP).
 * Un job on-prem (con acceso a Active Directory) envía el listado de usuarios.
 * Aquí se aprovisionan/actualizan/desactivan los perfiles marcados como 'ldap'.
 *
 * Body JSON:
 * {
 *   users: [{ email, full_name, job_title?, phone?, external_id?, active? }],
 *   deactivate_missing?: boolean,   // desactiva perfiles ldap ausentes del lote
 *   default_role?: 'client' | 'agent'
 * }
 *
 * Los usuarios nuevos se crean sin contraseña: la establecen con "Olvidé mi contraseña".
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')?.trim()
  if (!apiKey) return Response.json({ error: 'Falta el header x-api-key.' }, { status: 401 })

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

  const users = body.users
  if (!Array.isArray(users)) {
    return Response.json({ error: 'users debe ser un arreglo.' }, { status: 422 })
  }

  const defaultRole = body.default_role === 'agent' ? 'agent' : 'client'
  const now = new Date().toISOString()
  const orgId = token.organization_id

  let created = 0
  let updated = 0
  const seenEmails: string[] = []

  for (const raw of users as Record<string, unknown>[]) {
    const email = (raw.email as string)?.trim().toLowerCase()
    if (!email) continue
    seenEmails.push(email)

    const active = raw.active === undefined ? true : Boolean(raw.active)
    const common = {
      full_name: (raw.full_name as string) || email,
      job_title: (raw.job_title as string) || null,
      phone: (raw.phone as string) || null,
      is_active: active,
      auth_source: 'ldap',
      external_id: (raw.external_id as string) || null,
      directory_synced_at: now,
      updated_at: now,
    }

    const { data: existing } = await supabase
      .from('profiles').select('id').eq('email', email).maybeSingle()

    if (existing) {
      await supabase.from('profiles').update(common).eq('id', existing.id)
      updated++
    } else {
      const { error } = await supabase.from('profiles').insert({
        email,
        role: defaultRole,
        organization_id: orgId,
        ...common,
      })
      if (!error) created++
    }
  }

  // Desprovisionar: desactiva perfiles ldap de esta organización que ya no están en el directorio.
  let deactivated = 0
  if (body.deactivate_missing === true && seenEmails.length > 0) {
    const { data: toDeactivate } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('auth_source', 'ldap')
      .eq('organization_id', orgId)
      .eq('is_active', true)

    const missing = (toDeactivate ?? []).filter(p => !seenEmails.includes(p.email.toLowerCase()))
    for (const p of missing) {
      await supabase.from('profiles').update({ is_active: false, directory_synced_at: now }).eq('id', p.id)
      deactivated++
    }
  }

  await supabase.from('org_api_tokens').update({ last_used_at: now }).eq('id', token.id)

  return Response.json({ ok: true, created, updated, deactivated })
}
