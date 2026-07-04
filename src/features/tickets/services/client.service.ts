'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { TicketCategory, TicketPriority } from '@/lib/supabase/types'
import { applyAutomationRules } from '@/features/admin/services/automation.service'
import { sendTicketCreatedEmail } from '@/lib/email/ticket-emails'
import { TICKET_CATEGORY_VALUES } from '@/lib/tickets/categories'

const createTicketSchema = z.object({
  title: z.string().min(5, 'Título muy corto').max(200),
  description: z.string().min(20, 'Describe el problema con más detalle'),
  category: z.enum(TICKET_CATEGORY_VALUES as [string, ...string[]]),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
})

export async function createTicket(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('Sin organización asignada')

  const parsed = createTicketSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    category: formData.get('category'),
    priority: formData.get('priority'),
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  // Get SLA policy (por prioridad; robusto a 0 o varias)
  const { data: slaPolicy } = await supabase
    .from('sla_policies')
    .select('id, response_time_minutes, resolution_time_minutes')
    .eq('priority', parsed.data.priority)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const now = new Date()
  const slaResponseDue = slaPolicy
    ? new Date(now.getTime() + slaPolicy.response_time_minutes * 60000).toISOString()
    : null
  const slaResolutionDue = slaPolicy
    ? new Date(now.getTime() + slaPolicy.resolution_time_minutes * 60000).toISOString()
    : null

  const { data: ticket, error } = await supabase.from('tickets').insert({
    organization_id: profile.organization_id,
    created_by: user.id,
    title: parsed.data.title,
    description: parsed.data.description,
    category: parsed.data.category as TicketCategory,
    priority: parsed.data.priority as TicketPriority,
    sla_policy_id: slaPolicy?.id ?? null,
    sla_response_due_at: slaResponseDue,
    sla_resolution_due_at: slaResolutionDue,
  }).select().single()

  if (error) throw new Error(error.message)

  // Apply automation rules (auto-assign)
  await applyAutomationRules(ticket.id, parsed.data.category, parsed.data.priority)

  // Audit log
  await supabase.from('audit_log').insert({
    actor_id: user.id,
    entity_type: 'ticket',
    entity_id: ticket.id,
    action: 'created',
    new_values: { title: ticket.title, category: ticket.category, priority: ticket.priority },
  })

  // Email notification (fire & forget — don't await to avoid blocking redirect)
  const { data: clientProfile } = await supabase
    .from('profiles').select('full_name, email').eq('id', user.id).single()
  if (clientProfile) {
    sendTicketCreatedEmail({
      to: clientProfile.email,
      clientName: clientProfile.full_name,
      ticketNumber: ticket.ticket_number,
      ticketTitle: ticket.title,
      ticketId: ticket.id,
    }).catch(() => {})
  }

  redirect(`/client/tickets/${ticket.id}`)
}

export async function reopenTicket(ticketId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('profiles').select('organization_id').eq('id', user.id).single()

  const { data: ticket } = await supabase
    .from('tickets').select('organization_id').eq('id', ticketId).single()

  if (!ticket || ticket.organization_id !== profile?.organization_id) throw new Error('Sin permiso')

  // La RLS de tickets solo permite UPDATE a admin/agent; el cliente ya está
  // autorizado por la verificación de propiedad, así que escribimos con service-role.
  await createServiceClient().from('tickets').update({
    status: 'open',
    resolved_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', ticketId)

  redirect(`/client/tickets/${ticketId}`)
}

export async function rateTicket(ticketId: string, score: number, comment: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('profiles').select('organization_id').eq('id', user.id).single()
  const { data: ticket } = await supabase
    .from('tickets').select('organization_id').eq('id', ticketId).single()
  if (!ticket || ticket.organization_id !== profile?.organization_id) throw new Error('Sin permiso')

  // La RLS de tickets solo permite UPDATE a admin/agent; el cliente ya está
  // autorizado por la verificación de propiedad, así que escribimos con service-role.
  await createServiceClient().from('tickets').update({
    satisfaction_score: score,
    satisfaction_comment: comment || null,
  }).eq('id', ticketId)

  revalidatePath(`/client/tickets/${ticketId}`)
}

export async function addClientComment(ticketId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    author_id: user.id,
    content,
    is_internal: false,
  })

  if (error) return { error: error.message }
  return { success: true }
}
