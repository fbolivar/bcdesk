import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/api/require-admin'
import { validateCommand } from '@/lib/rmm/commands'

export const runtime = 'nodejs'

// POST: encola un comando del catálogo cerrado para el endpoint.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { id } = await params

  const body = (await req.json().catch(() => ({}))) as { command_type?: unknown; payload?: unknown }
  const valid = validateCommand(body.command_type, body.payload)
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 })

  const admin = createServiceClient()

  // No encolar a un endpoint deshabilitado.
  const { data: ep } = await admin.from('endpoints').select('id, disabled_at').eq('id', id).maybeSingle()
  if (!ep) return NextResponse.json({ error: 'Endpoint no encontrado' }, { status: 404 })
  if (ep.disabled_at) return NextResponse.json({ error: 'El endpoint está deshabilitado' }, { status: 409 })

  const { data: command, error } = await admin.from('endpoint_commands').insert({
    endpoint_id: id,
    command_type: valid.type,
    payload: valid.payload,
    requested_by: guard.user.id,
  }).select('id, command_type, status, created_at').single()
  if (error || !command) return NextResponse.json({ error: 'No se pudo encolar el comando' }, { status: 500 })

  // Auditoría: todo comando ejecutado queda registrado (aquí, al encolarse).
  await admin.from('audit_logs').insert({
    actor_id: guard.user.id, action: 'rmm.command_queued',
    resource_type: 'endpoint', resource_id: id, new_values: { command_type: valid.type, payload: valid.payload },
  })

  return NextResponse.json({ command }, { status: 201 })
}
