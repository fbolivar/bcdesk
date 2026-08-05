import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/api/require-admin'

export const runtime = 'nodejs'

/**
 * Renombra un endpoint RMM: fija `display_name` (alias amigable). NO tocamos
 * `hostname` porque el agente lo reporta en cada heartbeat y lo sobrescribiría;
 * el alias vive aparte y la UI muestra display_name ?? hostname.
 * Enviar name vacío/null borra el alias (vuelve a mostrarse el hostname real).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { id } = await params

  const body = (await req.json().catch(() => ({}))) as { name?: unknown }
  const raw = typeof body.name === 'string' ? body.name.trim() : ''
  const displayName = raw ? raw.slice(0, 120) : null

  const admin = createServiceClient()
  const { data: ep } = await admin.from('endpoints').select('id').eq('id', id).maybeSingle()
  if (!ep) return NextResponse.json({ error: 'Endpoint no encontrado' }, { status: 404 })

  const { error } = await admin.from('endpoints').update({ display_name: displayName }).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo renombrar el equipo' }, { status: 500 })

  await admin.from('audit_logs').insert({
    actor_id: guard.user.id, action: 'rmm.endpoint_renamed',
    resource_type: 'endpoint', resource_id: id, new_values: { display_name: displayName },
  })

  return NextResponse.json({ ok: true, display_name: displayName })
}
