import { createServiceClient } from '@/lib/supabase/service'

export async function logAudit(params: {
  actorId?: string
  actorEmail?: string
  action: string
  resourceType: string
  resourceId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
}) {
  try {
    const supabase = createServiceClient()
    await supabase.from('audit_logs').insert({
      actor_id: params.actorId ?? null,
      actor_email: params.actorEmail ?? null,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      old_values: params.oldValues ?? null,
      new_values: params.newValues ?? null,
      ip_address: params.ipAddress ?? null,
    })
  } catch {
    // Never block main flow on audit failure
  }
}
