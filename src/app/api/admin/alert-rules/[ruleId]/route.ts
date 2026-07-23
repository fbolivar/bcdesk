import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/api/require-admin'
import { validateRule } from '@/lib/rmm/alert-rule-validation'

export const runtime = 'nodejs'

// PATCH: edita threshold/severity/cooldown/is_active (u otros campos) de una regla.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { ruleId } = await params

  const body = await req.json().catch(() => ({}))
  const v = validateRule(body, true)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const admin = createServiceClient()
  const { data, error } = await admin.from('endpoint_alert_rules')
    .update(v.value).eq('id', ruleId)
    .select('id, metric, operator, threshold, severity, action, cooldown_minutes, is_active')
    .single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo actualizar la regla' }, { status: 500 })

  await admin.from('audit_logs').insert({
    actor_id: guard.user.id, action: 'rmm.alert_rule_updated',
    resource_type: 'alert_rule', resource_id: ruleId, new_values: v.value,
  })
  return NextResponse.json({ rule: data })
}

// DELETE: elimina una regla.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { ruleId } = await params

  const admin = createServiceClient()
  const { error } = await admin.from('endpoint_alert_rules').delete().eq('id', ruleId)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar la regla' }, { status: 500 })

  await admin.from('audit_logs').insert({
    actor_id: guard.user.id, action: 'rmm.alert_rule_deleted',
    resource_type: 'alert_rule', resource_id: ruleId, new_values: {},
  })
  return NextResponse.json({ ok: true })
}
