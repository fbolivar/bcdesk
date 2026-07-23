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
    .select('id, ticket_number, title, assigned_to, sla_resolution_due_at, sla_alert_sent_at, sla_breach_notified_at')
    .not('status', 'in', '("resolved","closed","cancelled")')
    .not('sla_resolution_due_at', 'is', null)
    .is('sla_paused_at', null) // los tickets en pausa no cuentan tiempo de SLA
    .lte('sla_resolution_due_at', in24h)

  if (!atRisk || atRisk.length === 0) return { escalated: 0 }

  const smtp = mailConfigured()

  // Avisa por los TRES canales y ESPERA el despacho (evita que el runtime
  // serverless los descarte al retornar).
  //
  // Este es ahora el único sistema de SLA. Antes convivía con un cron en la BD
  // (run_sla_escalations) que corría cada 5 min y usaba otras columnas: se
  // duplicaban los avisos y el estado quedaba inconsistente. Al unificar aquí
  // había que recuperar dos cosas que solo hacía aquel:
  //   1) la campanita (notifications), única alerta visible sin salir de la app;
  //   2) avisar cuando el ticket NO tiene agente asignado — antes se hacía
  //      `return` y no se enteraba nadie, justo en el caso más peligroso.
  async function alertStaff(
    ticket: { id: string; ticket_number: number; title: string; assigned_to: string | null; sla_resolution_due_at: string },
    overdue: boolean,
  ) {
    type Recipient = { id: string; email: string | null; role: string }
    let recipients: Recipient[] = []

    if (ticket.assigned_to) {
      const { data } = await supabase
        .from('profiles').select('id, email, role')
        .eq('id', ticket.assigned_to).eq('is_active', true).maybeSingle()
      if (data) recipients = [data as Recipient]
    }
    // Sin agente asignado (o si está inactivo): avisar a todo el staff activo.
    if (recipients.length === 0) {
      const { data } = await supabase
        .from('profiles').select('id, email, role')
        .in('role', ['admin', 'agent']).eq('is_active', true)
      recipients = (data ?? []) as Recipient[]
    }
    if (recipients.length === 0) return

    const when = new Date(ticket.sla_resolution_due_at).toLocaleString('es-CO')
    const title = `SLA ${overdue ? 'VENCIDO' : 'por vencer'} · Ticket #${ticket.ticket_number}`
    const linkFor = (role: string) => `/${role === 'admin' ? 'admin' : 'agent'}/tickets/${ticket.id}`

    await supabase.from('notifications').insert(
      recipients.map(r => ({ user_id: r.id, type: 'sla', title, body: ticket.title, link: linkFor(r.role) })),
    )

    const jobs: Promise<unknown>[] = []
    for (const r of recipients) {
      jobs.push(sendPushToUser(r.id, title, ticket.title, linkFor(r.role)))
      if (smtp && r.email) {
        jobs.push(sendEmail({
          to: r.email,
          subject: `[SLA ${overdue ? 'vencido' : 'por vencer'}] Ticket #${ticket.ticket_number}`,
          html: `<p>El ticket <b>#${ticket.ticket_number} - ${ticket.title}</b> tiene el SLA de resolución <b>${overdue ? 'vencido' : 'por vencer'}</b> (${when}).</p><p>Atiéndelo cuanto antes.</p>`,
        }))
      }
    }
    await Promise.allSettled(jobs)
  }

  let escalated = 0
  for (const ticket of atRisk) {
    const overdue = new Date(ticket.sla_resolution_due_at) < now

    if (overdue && !ticket.sla_breach_notified_at) {
      // Hito VENCIDO (llega aunque ya se hubiera avisado "por vencer").
      await alertStaff(ticket, true)
      await supabase.from('tickets').update({
        sla_breached: true,
        sla_breach_notified_at: now.toISOString(),
        ...(ticket.sla_alert_sent_at ? {} : { sla_alert_sent_at: now.toISOString() }),
      }).eq('id', ticket.id)
      await supabase.from('audit_logs').insert({
        actor_id: null, resource_type: 'ticket', resource_id: ticket.id, action: 'sla_breached',
        new_values: { sla_resolution_due_at: ticket.sla_resolution_due_at },
      })
      escalated++
    } else if (!overdue && !ticket.sla_alert_sent_at) {
      // Hito por vencer.
      await alertStaff(ticket, false)
      await supabase.from('tickets').update({ sla_alert_sent_at: now.toISOString() }).eq('id', ticket.id)
      await supabase.from('audit_logs').insert({
        actor_id: null, resource_type: 'ticket', resource_id: ticket.id, action: 'sla_warning',
        new_values: { sla_resolution_due_at: ticket.sla_resolution_due_at },
      })
      escalated++
    }
  }

  return { escalated }
}
