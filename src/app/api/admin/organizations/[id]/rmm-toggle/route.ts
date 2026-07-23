import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/api/require-admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { id } = await params

  const body = (await req.json().catch(() => ({}))) as { enabled?: unknown }
  const enabled = body.enabled === true

  const admin = createServiceClient()
  const { error } = await admin.from('organizations').update({ rmm_enabled: enabled }).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo actualizar el módulo RMM' }, { status: 500 })

  await admin.from('audit_logs').insert({
    actor_id: guard.user.id, action: 'rmm.toggle',
    resource_type: 'organization', resource_id: id, new_values: { rmm_enabled: enabled },
  })

  return NextResponse.json({ ok: true, rmm_enabled: enabled })
}
