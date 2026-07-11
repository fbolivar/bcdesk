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

/** Avisa (push + email al agente asignado) de los tickets con SLA por vencer
 *  en las próximas 24h o ya vencidos, una sola vez por ticket. Pensado para el
 *  cron diario `sla-check`. */
export async function checkSlaEscalations() {
  const { createServiceClient } = await import('@/lib/supabase/service')
  const { sendPushToUser } = await import('@/lib/push/send')
  const { sendEmail, mailConfigured } = await import('@/lib/email/mailer')
  const supabase = createServiceClient()

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const { data: atRisk } = await supabase
    .from('tickets')
    .select('id, ticket_number, title, assigned_to, sla_resolution_due_at')
    .not('status', 'in', '("resolved","closed","cancelled")')
    .not('sla_resolution_due_at', 'is', null)
    .lte('sla_resolution_due_at', in24h)
    .is('sla_alert_sent_at', null)

  if (!atRisk || atRisk.length === 0) return { escalated: 0 }

  const smtp = mailConfigured()
  for (const ticket of atRisk) {
    const dueAt = new Date(ticket.sla_resolution_due_at)
    const overdue = dueAt < now
    const when = dueAt.toLocaleString('es-CO')

    // Marca como alertado (evita repetir) y vencido si aplica.
    await supabase.from('tickets')
      .update({ sla_alert_sent_at: now.toISOString(), ...(overdue ? { sla_breached: true } : {}) })
      .eq('id', ticket.id)

    await supabase.from('audit_log').insert({
      actor_id: null, entity_type: 'ticket', entity_id: ticket.id,
      action: overdue ? 'sla_breached' : 'sla_warning',
      new_values: { sla_resolution_due_at: ticket.sla_resolution_due_at, overdue },
    })

    if (ticket.assigned_to) {
      sendPushToUser(
        ticket.assigned_to,
        `SLA ${overdue ? 'VENCIDO' : 'por vencer'} · Ticket #${ticket.ticket_number}`,
        ticket.title, `/agent/tickets/${ticket.id}`,
      ).catch(() => {})

      if (smtp) {
        const { data: ag } = await supabase.from('profiles').select('email').eq('id', ticket.assigned_to).single()
        if (ag?.email) {
          sendEmail({
            to: ag.email,
            subject: `[SLA ${overdue ? 'vencido' : 'por vencer'}] Ticket #${ticket.ticket_number}`,
            html: `<p>El ticket <b>#${ticket.ticket_number} - ${ticket.title}</b> tiene el SLA de resolución <b>${overdue ? 'vencido' : 'por vencer'}</b> (${when}).</p><p>Atiéndelo cuanto antes.</p>`,
          }).catch(() => {})
        }
      }
    }
  }

  return { escalated: atRisk.length }
}
