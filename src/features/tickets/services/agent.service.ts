'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { TicketStatus, TicketPriority } from '@/lib/supabase/types'
import { sendCommentNotificationEmail, sendStatusChangedEmail, sendCsatRequestEmail } from '@/lib/email/ticket-emails'
import { sendPushToUser } from '@/lib/push/send'
import { getRequestIp } from '@/lib/audit/request-ip'
import { computeSla } from '@/lib/tickets/sla'

const STATUS_LABELS_PUSH: Record<string, string> = {
  open: 'Abierto', in_progress: 'En progreso', waiting_client: 'Esperando tu respuesta',
  resolved: 'Resuelto', closed: 'Cerrado', cancelled: 'Cancelado',
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase
    .from('tickets')
    .update({
      status,
      ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)

  if (error) throw new Error(error.message)

  await supabase.from('audit_logs').insert({
    actor_id: user.id, action: 'status_changed',
    resource_type: 'ticket', resource_id: ticketId,
    old_values: { status: (await supabase.from('tickets').select('status').eq('id', ticketId).single()).data?.status },
    new_values: { status },
    ip_address: await getRequestIp(),
  })

  // Email client on status change — al solicitante real (requester_email para
  // tickets por correo) o, si no, al perfil que creó el ticket.
  const { data: ticketData } = await supabase
    .from('tickets')
    .select('ticket_number, title, organization_id, requester_email, created_by, profiles!created_by(full_name, email)')
    .eq('id', ticketId).single()
  if (ticketData) {
    const td = ticketData as unknown as { ticket_number: number; title: string; requester_email: string | null; created_by: string | null; profiles?: { full_name: string; email: string } | { full_name: string; email: string }[] }
    const cp = Array.isArray(td.profiles) ? td.profiles[0] : td.profiles
    const to = td.requester_email || cp?.email || null
    const clientName = cp?.full_name || 'Cliente'
    // Push al cliente que creó el ticket.
    if (td.created_by) {
      sendPushToUser(td.created_by, `Ticket #${td.ticket_number}: ${STATUS_LABELS_PUSH[status] ?? status}`, td.title, `/client/tickets/${ticketId}`).catch(() => {})
    }
    if (to) {
      sendStatusChangedEmail({
        to, clientName,
        ticketNumber: td.ticket_number, ticketTitle: td.title,
        newStatus: status, ticketId,
      }).catch(() => {})

      // Send CSAT request when resolving (only once)
      if (status === 'resolved') {
        const { data: existing } = await supabase
          .from('tickets').select('csat_email_sent_at').eq('id', ticketId).single()
        if (!existing?.csat_email_sent_at) {
          await supabase.from('tickets').update({ csat_email_sent_at: new Date().toISOString() }).eq('id', ticketId)
          sendCsatRequestEmail({
            to, clientName,
            ticketNumber: td.ticket_number, ticketTitle: td.title,
            ticketId,
          }).catch(() => {})
        }
      }
    }
  }

  revalidatePath(`/agent/tickets/${ticketId}`)
  revalidatePath('/agent/tickets')
  revalidatePath('/agent/dashboard')
}

export async function updateTicketPriority(ticketId: string, priority: TicketPriority) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  // Recalcular el SLA con la nueva prioridad. Las políticas son globales por
  // prioridad: sla_policies no tiene organization_id (antes se pedía esa
  // columna aquí, la consulta fallaba en silencio y este update borraba el SLA).
  const slaFields = await computeSla(supabase, priority)

  const { error } = await supabase
    .from('tickets')
    .update({ priority, ...slaFields, updated_at: new Date().toISOString() })
    .eq('id', ticketId)

  if (error) throw new Error(error.message)

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'ticket.priority_changed',
    resource_type: 'ticket',
    resource_id: ticketId,
    new_values: { priority, sla_policy_id: slaFields.sla_policy_id },
    ip_address: await getRequestIp(),
  })

  revalidatePath(`/agent/tickets/${ticketId}`)
  revalidatePath('/agent/tickets')
  revalidatePath('/agent/dashboard')
  revalidatePath(`/admin/tickets/${ticketId}`)
  revalidatePath('/admin/tickets')
}

export async function addComment(ticketId: string, content: string, isInternal: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  if (!content.trim()) throw new Error('El comentario no puede estar vacío')

  const { data: inserted, error } = await supabase.from('ticket_comments').insert({
    ticket_id: ticketId, author_id: user.id,
    content: content.trim(), is_internal: isInternal, is_automated: false,
  }).select('id').single()

  if (error) throw new Error(error.message)

  // Auto-asignar al agente si el ticket no tiene asignado aún
  const { data: agentProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (['admin', 'agent'].includes(agentProfile?.role ?? '')) {
    await supabase.from('tickets')
      .update({ assigned_to: user.id, updated_at: new Date().toISOString() })
      .eq('id', ticketId).is('assigned_to', null)
  }

  if (!isInternal) {
    await supabase.from('tickets')
      .update({ first_response_at: new Date().toISOString() })
      .eq('id', ticketId).is('first_response_at', null)

    // Notify client via email
    const { data: ticketData } = await supabase
      .from('tickets')
      .select('ticket_number, title, created_by, profiles!created_by(full_name, email)')
      .eq('id', ticketId).single()
    const { data: authorProfile } = await supabase
      .from('profiles').select('full_name, role').eq('id', user.id).single()

    if (ticketData) {
      const td = ticketData as unknown as { ticket_number: number; title: string; created_by: string | null; profiles?: { full_name: string; email: string } | { full_name: string; email: string }[] }
      const cp = Array.isArray(td.profiles) ? td.profiles[0] : td.profiles
      if (cp) {
        sendCommentNotificationEmail({
          to: cp.email, recipientName: cp.full_name,
          authorName: authorProfile?.full_name ?? 'Equipo BC',
          ticketNumber: td.ticket_number, ticketTitle: td.title,
          commentPreview: content.slice(0, 200),
          ticketId, isInternal, recipientRole: 'client',
        }).catch(() => {})
      }
      // Push al cliente que creó el ticket (solo respuestas visibles).
      if (td.created_by) {
        sendPushToUser(td.created_by, `Respuesta en tu ticket #${td.ticket_number}`, content.slice(0, 120), `/client/tickets/${ticketId}`).catch(() => {})
      }
    }
  }

  revalidatePath(`/agent/tickets/${ticketId}`)
  revalidatePath(`/admin/tickets/${ticketId}`)
  revalidatePath(`/client/tickets/${ticketId}`)

  return { id: inserted.id as string }
}

export async function updateTicketTags(ticketId: string, tags: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  await supabase.from('tickets').update({ tags, updated_at: new Date().toISOString() }).eq('id', ticketId)
  await supabase.from('audit_logs').insert({
    actor_id: user.id, resource_type: 'ticket', resource_id: ticketId,
    action: 'tags_updated', new_values: { tags },
    ip_address: await getRequestIp(),
  })
  revalidatePath(`/agent/tickets/${ticketId}`)
  revalidatePath(`/admin/tickets/${ticketId}`)
}

export async function mergeTickets(sourceId: string, targetId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  // Move comments from source to target
  await supabase.from('ticket_comments').update({ ticket_id: targetId }).eq('ticket_id', sourceId)
  // Move attachments
  await supabase.from('ticket_attachments').update({ ticket_id: targetId }).eq('ticket_id', sourceId)
  // Close source with merged status
  await supabase.from('tickets').update({
    status: 'merged', merged_into: targetId, updated_at: new Date().toISOString(),
  }).eq('id', sourceId)

  const mergeIp = await getRequestIp()
  await supabase.from('audit_logs').insert([
    { actor_id: user.id, resource_type: 'ticket', resource_id: sourceId, action: 'merged', new_values: { merged_into: targetId }, ip_address: mergeIp },
    { actor_id: user.id, resource_type: 'ticket', resource_id: targetId, action: 'merged', new_values: { merged_from: sourceId }, ip_address: mergeIp },
  ])

  revalidatePath('/agent/tickets')
  revalidatePath('/admin/tickets')
}

export async function incrementCannedUse(id: string) {
  const supabase = await createClient()
  await supabase.rpc('increment_canned_use', { canned_id: id }).single()
}

/**
 * Elimina un ticket DE FORMA PERMANENTE. Solo admin.
 *
 * Barandas, porque el borrado es irreversible y toca contabilidad:
 *  - Se NIEGA si el ticket tiene una cuenta de cobro asociada (la factura
 *    quedaría huérfana) o horas ya facturadas (time_logs.billed = true), que
 *    time_logs borraría en cascada destruyendo la base de un cobro emitido.
 *  - Antes de borrar, desengancha los vínculos con regla NO ACTION
 *    (chat_sessions, multichannel_messages, survey_responses); si no, el DELETE
 *    fallaría por llave foránea.
 *  - Lo demás (comentarios, adjuntos, campos, horas NO facturadas) se borra en
 *    cascada por la definición de las FKs.
 *
 * Devuelve { error } si no se puede; en éxito redirige a la bandeja.
 */
export async function deleteTicket(ticketId: string): Promise<{ error: string } | never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return { error: 'Solo un administrador puede eliminar tickets.' }

  const { data: ticket } = await supabase
    .from('tickets').select('ticket_number, title').eq('id', ticketId).maybeSingle()
  if (!ticket) return { error: 'El ticket no existe.' }

  // Baranda 1: cuenta de cobro asociada.
  const { count: invCount } = await supabase
    .from('invoices').select('id', { count: 'exact', head: true }).eq('ticket_id', ticketId)
  if ((invCount ?? 0) > 0) {
    return { error: 'No se puede eliminar: el ticket tiene una cuenta de cobro asociada. Anúlala primero o archiva el ticket.' }
  }

  // Baranda 2: horas ya facturadas (se borrarían en cascada).
  const { count: billedCount } = await supabase
    .from('time_logs').select('id', { count: 'exact', head: true }).eq('ticket_id', ticketId).eq('billed', true)
  if ((billedCount ?? 0) > 0) {
    return { error: 'No se puede eliminar: el ticket tiene horas ya facturadas. Elimínalo solo si no afecta un cobro emitido.' }
  }

  // Desenganchar los vínculos NO ACTION (todos nulables) para no bloquear el DELETE.
  await supabase.from('chat_sessions').update({ ticket_id: null }).eq('ticket_id', ticketId)
  await supabase.from('multichannel_messages').update({ ticket_id: null }).eq('ticket_id', ticketId)
  await supabase.from('survey_responses').update({ ticket_id: null }).eq('ticket_id', ticketId)

  const { error } = await supabase.from('tickets').delete().eq('id', ticketId)
  if (error) return { error: 'No se pudo eliminar el ticket. Intenta de nuevo.' }

  // Auditar el borrado: el resource_id apunta al ticket ya inexistente, pero
  // queda constancia de quién lo eliminó y cuál era.
  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'ticket.deleted',
    resource_type: 'ticket',
    resource_id: ticketId,
    new_values: { ticket_number: ticket.ticket_number, title: ticket.title },
    ip_address: await getRequestIp(),
  })

  revalidatePath('/admin/tickets')
  revalidatePath('/agent/tickets')
  redirect('/admin/tickets')
}

export async function assignTicket(ticketId: string, agentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase
    .from('tickets')
    .update({ assigned_to: agentId, updated_at: new Date().toISOString() })
    .eq('id', ticketId)

  if (error) throw new Error(error.message)

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'ticket.assigned',
    resource_type: 'ticket',
    resource_id: ticketId,
    new_values: { assigned_to: agentId },
    ip_address: await getRequestIp(),
  })

  revalidatePath(`/agent/tickets/${ticketId}`)
  revalidatePath('/agent/tickets')
  revalidatePath('/agent/dashboard')
}
