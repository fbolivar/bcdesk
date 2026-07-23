import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/api/require-admin'
import { validateRule } from '@/lib/rmm/alert-rule-validation'

export const runtime = 'nodejs'

// GET: reglas de alerta de la organización.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { id } = await params

  const admin = createServiceClient()
  const { data } = await admin.from('endpoint_alert_rules')
    .select('id, metric, operator, threshold, severity, action, cooldown_minutes, is_active, created_at')
    .eq('organization_id', id)
    .order('metric').order('threshold')
  return NextResponse.json({ rules: data ?? [] })
}

// POST: crea una regla nueva.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const v = validateRule(body, false)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const admin = createServiceClient()
  const { data, error } = await admin.from('endpoint_alert_rules')
    .insert({ organization_id: id, ...v.value })
    .select('id, metric, operator, threshold, severity, action, cooldown_minutes, is_active, created_at')
    .single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo crear la regla' }, { status: 500 })

  await admin.from('audit_logs').insert({
    actor_id: guard.user.id, action: 'rmm.alert_rule_created',
    resource_type: 'organization', resource_id: id, new_values: v.value,
  })
  return NextResponse.json({ rule: data }, { status: 201 })
}
