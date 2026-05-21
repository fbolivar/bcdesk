'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Sin permisos')
  return { supabase, user }
}

export async function createAutomationRule(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const category = formData.get('category') as string
  const priority = formData.get('priority') as string
  const agentId = formData.get('agent_id') as string

  const conditions: Record<string, string> = {}
  if (category) conditions.category = category
  if (priority) conditions.priority = priority

  await supabase.from('automation_rules').insert({
    name: formData.get('name') as string,
    trigger_event: 'ticket.created',
    conditions,
    actions: { assign_to: agentId },
    created_by: user.id,
  })
  revalidatePath('/admin/settings/automation')
}

export async function toggleAutomationRule(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = formData.get('id') as string
  const current = formData.get('is_active') === 'true'
  await supabase.from('automation_rules').update({ is_active: !current }).eq('id', id)
  revalidatePath('/admin/settings/automation')
}

export async function deleteAutomationRule(formData: FormData) {
  const { supabase } = await requireAdmin()
  await supabase.from('automation_rules').delete().eq('id', formData.get('id') as string)
  revalidatePath('/admin/settings/automation')
}

export async function applyAutomationRules(ticketId: string, category: string, priority: string) {
  const supabase = await createClient()

  const { data: rules } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('trigger_event', 'ticket.created')
    .eq('is_active', true)

  let assigned = false

  if (rules && rules.length > 0) {
    for (const rule of rules) {
      const conditions = rule.conditions as Record<string, string> | null
      const actions = rule.actions as Record<string, string> | null

      const matchCategory = !conditions?.category || conditions.category === category
      const matchPriority = !conditions?.priority || conditions.priority === priority

      if (matchCategory && matchPriority && actions?.assign_to) {
        await supabase.from('tickets').update({ assigned_to: actions.assign_to }).eq('id', ticketId)
        await supabase.from('automation_rules').update({
          execution_count: (rule.execution_count ?? 0) + 1,
          last_executed_at: new Date().toISOString(),
        }).eq('id', rule.id)
        assigned = true
        break
      }
    }
  }

  // Round-robin fallback: assign to agent with fewest open tickets
  if (!assigned) {
    await applyRoundRobin(supabase, ticketId)
  }
}

async function applyRoundRobin(supabase: Awaited<ReturnType<typeof createClient>>, ticketId: string) {
  const { data: agents } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'agent'])
    .eq('is_active', true)

  if (!agents || agents.length === 0) return

  // Count open tickets per agent
  const counts = await Promise.all(
    agents.map(async (a) => {
      const { count } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', a.id)
        .not('status', 'in', '("resolved","closed","cancelled")')
      return { id: a.id, count: count ?? 0 }
    })
  )

  const leastBusy = counts.sort((a, b) => a.count - b.count)[0]
  if (leastBusy) {
    await supabase.from('tickets').update({ assigned_to: leastBusy.id }).eq('id', ticketId)
  }
}

// Check tickets approaching SLA breach and create notifications
export async function checkSlaEscalations() {
  const { createServiceClient } = await import('@/lib/supabase/service')
  const supabase = createServiceClient()

  // Find tickets whose SLA will breach in the next 30 minutes
  const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const { data: atRisk } = await supabase
    .from('tickets')
    .select('id, ticket_number, title, assigned_to, sla_resolution_due_at')
    .not('status', 'in', '("resolved","closed","cancelled")')
    .lte('sla_resolution_due_at', soon)
    .gte('sla_resolution_due_at', now)
    .eq('sla_breached', false)

  if (!atRisk || atRisk.length === 0) return { escalated: 0 }

  for (const ticket of atRisk) {
    // Create notification in audit_log as an alert
    await supabase.from('audit_log').insert({
      ticket_id: ticket.id,
      actor_id: null,
      action: 'sla_warning',
      new_value: `SLA vence a las ${new Date(ticket.sla_resolution_due_at).toLocaleTimeString('es-CO')}`,
    })

    // Mark sla_breached if actually past due
    await supabase.from('tickets').update({ sla_breached: true })
      .lt('sla_resolution_due_at', now)
      .eq('id', ticket.id)
      .not('status', 'in', '("resolved","closed","cancelled")')
  }

  return { escalated: atRisk.length }
}
