import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/api/require-admin'

export const runtime = 'nodejs'

/**
 * Da de baja un endpoint (ajuste #2). Efecto:
 *  - disabled_at = now() y status = 'disabled'.
 *  - El token queda invalidado al instante: authenticateAgent responde 401
 *    apenas ve disabled_at/status (el hash permanece en BD solo para auditoría).
 *  - NO se reactiva. Si se necesita el equipo otra vez, se da de alta un
 *    endpoint NUEVO con token nuevo.
 *  - Los comandos que quedaron pendientes se marcan 'expired' (nunca correrán).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { id } = await params

  const admin = createServiceClient()
  const { data: ep } = await admin.from('endpoints').select('id, disabled_at').eq('id', id).maybeSingle()
  if (!ep) return NextResponse.json({ error: 'Endpoint no encontrado' }, { status: 404 })
  if (ep.disabled_at) return NextResponse.json({ ok: true, already_disabled: true })

  const now = new Date().toISOString()
  const { error } = await admin.from('endpoints')
    .update({ status: 'disabled', disabled_at: now }).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo deshabilitar el endpoint' }, { status: 500 })

  await admin.from('endpoint_commands')
    .update({ status: 'expired', completed_at: now })
    .eq('endpoint_id', id).in('status', ['pending', 'running'])

  await admin.from('audit_logs').insert({
    actor_id: guard.user.id, action: 'rmm.endpoint_disabled',
    resource_type: 'endpoint', resource_id: id, new_values: { disabled_at: now },
  })

  return NextResponse.json({ ok: true })
}
