'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
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

/** Autoriza editar/eliminar un comentario. Reglas:
 *  - admin: puede sobre cualquier comentario NO automático (los del sistema, p. ej.
 *    "sesión de control remoto", quedan como registro y no se tocan).
 *  - agent: solo sobre los suyos y NO internos ajenos… en realidad: solo los suyos.
 *  - client: solo los suyos.
 *  Los comentarios automáticos (is_automated) no son editables ni borrables por nadie. */
async function authorizeCommentMutation(commentId: string): Promise<
  | { ok: true; ticketId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const admin = createServiceClient()
  const { data: c } = await admin
    .from('ticket_comments').select('id, ticket_id, author_id, is_automated').eq('id', commentId).maybeSingle()
  if (!c) return { ok: false, error: 'El comentario no existe.' }
  if (c.is_automated) return { ok: false, error: 'Los registros automáticos del sistema no se pueden editar.' }

  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = me?.role === 'admin'
  const isAuthor = c.author_id === user.id
  if (!isAdmin && !isAuthor) return { ok: false, error: 'Solo puedes editar tus propios mensajes.' }

  return { ok: true, ticketId: c.ticket_id as string }
}

/** Edita el contenido de un comentario (marca edited_at). */
export async function updateComment(commentId: string, content: string): Promise<{ error?: string }> {
  const trimmed = content.trim()
  if (!trimmed) return { error: 'El mensaje no puede quedar vacío.' }
  if (trimmed.length > 10000) return { error: 'El mensaje es demasiado largo.' }

  const auth = await authorizeCommentMutation(commentId)
  if (!auth.ok) return { error: auth.error }

  const admin = createServiceClient()
  const now = new Date().toISOString()
  const { error } = await admin.from('ticket_comments')
    .update({ content: trimmed, edited_at: now, updated_at: now }).eq('id', commentId)
  if (error) return { error: 'No se pudo guardar el cambio.' }

  revalidatePath(`/admin/tickets/${auth.ticketId}`)
  revalidatePath(`/agent/tickets/${auth.ticketId}`)
  revalidatePath(`/client/tickets/${auth.ticketId}`)
  return {}
}

/** Elimina un comentario (y sus adjuntos por cascada de FK). */
export async function deleteComment(commentId: string): Promise<{ error?: string }> {
  const auth = await authorizeCommentMutation(commentId)
  if (!auth.ok) return { error: auth.error }

  const admin = createServiceClient()
  const { error } = await admin.from('ticket_comments').delete().eq('id', commentId)
  if (error) return { error: 'No se pudo eliminar el mensaje.' }

  revalidatePath(`/admin/tickets/${auth.ticketId}`)
  revalidatePath(`/agent/tickets/${auth.ticketId}`)
  revalidatePath(`/client/tickets/${auth.ticketId}`)
  return {}
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

  // El DELETE va por service_role: tickets tiene RLS SIN política de DELETE, así
  // que por el cliente RLS no se borraría ninguna fila (sin error). La autorización
  // ya se validó arriba (rol admin).
  const admin = createServiceClient()
  // Desenganchar los vínculos NO ACTION (todos nulables) para no bloquear el DELETE.
  await admin.from('chat_sessions').update({ ticket_id: null }).eq('ticket_id', ticketId)
  await admin.from('multichannel_messages').update({ ticket_id: null }).eq('ticket_id', ticketId)
  await admin.from('survey_responses').update({ ticket_id: null }).eq('ticket_id', ticketId)

  const { error } = await admin.from('tickets').delete().eq('id', ticketId)
  if (error) return { error: 'No se pudo eliminar el ticket. Intenta de nuevo.' }

  // Auditar el borrado: el resource_id apunta al ticket ya inexistente, pero
  // queda constancia de quién lo eliminó y cuál era.
  await admin.from('audit_logs').insert({
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

/** Pausa o reanuda el SLA del ticket. En pausa, el reloj de resolución no corre
 *  (el cron de SLA lo salta) y al reanudar se empuja el vencimiento por el tiempo
 *  pausado. Restringido a admin/agente (la RPC lo valida server-side). */
export async function setTicketSlaPause(ticketId: string, paused: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin' && me?.role !== 'agent') return { error: 'Sin permisos.' }

  const { error } = await supabase.rpc(paused ? 'ticket_pause_sla' : 'ticket_resume_sla', { p_ticket: ticketId })
  if (error) return { error: 'No se pudo actualizar la pausa del SLA.' }

  revalidatePath(`/admin/tickets/${ticketId}`)
  revalidatePath(`/agent/tickets/${ticketId}`)
  return {}
}
