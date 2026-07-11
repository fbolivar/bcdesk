import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const priority = (formData.get('priority') as string) || 'medium'

  // SLA por prioridad (si hay una política activa, calcula las fechas límite).
  const { data: slaPolicy } = await supabase
    .from('sla_policies')
    .select('id, response_time_minutes, resolution_time_minutes')
    .eq('priority', priority)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const now = Date.now()
  const slaResponseDue = slaPolicy ? new Date(now + slaPolicy.response_time_minutes * 60000).toISOString() : null
  const slaResolutionDue = slaPolicy ? new Date(now + slaPolicy.resolution_time_minutes * 60000).toISOString() : null

  const { data: ticket, error } = await supabase.from('tickets').insert({
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    category: (formData.get('category') as string) || 'support',
    priority,
    status: 'open',
    created_by: user.id,
    organization_id: profile?.organization_id ?? null,
    source_channel: 'web',
    sla_policy_id: slaPolicy?.id ?? null,
    sla_response_due_at: slaResponseDue,
    sla_resolution_due_at: slaResolutionDue,
  }).select('id, ticket_number, title, priority').single()

  if (error) return NextResponse.json({ error }, { status: 400 })

  // Aviso al equipo (correo + push).
  const { notifyStaffNewTicket } = await import('@/features/tickets/services/notify')
  notifyStaffNewTicket({
    ticketId: ticket.id, ticketNumber: ticket.ticket_number,
    title: ticket.title, priority: ticket.priority,
  }).catch(() => {})

  return NextResponse.json({ id: ticket.id })
}
