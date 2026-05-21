'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TicketPriority, TicketCategory } from '@/lib/supabase/types'

interface SubtaskInput {
  title: string
  assignee_id?: string
}

interface ParentTicketData {
  organization_id: string
  priority: TicketPriority
  category: TicketCategory
}

export async function splitTicket(parentId: string, subtasks: SubtaskInput[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: parent } = await supabase
    .from('tickets')
    .select('organization_id, priority, category')
    .eq('id', parentId)
    .single<ParentTicketData>()

  if (!parent) throw new Error('Ticket no encontrado')

  const rows = subtasks.map((s) => ({
    title: s.title,
    description: `Subtarea de ticket #${parentId.slice(0, 8)}`,
    status: 'open' as const,
    priority: parent.priority,
    category: parent.category,
    organization_id: parent.organization_id,
    created_by: user.id,
    assigned_to: s.assignee_id ?? null,
    parent_ticket_id: parentId,
    source_channel: 'internal',
  }))

  const { error } = await supabase.from('tickets').insert(rows)
  if (error) throw error

  revalidatePath(`/admin/tickets/${parentId}`)
  revalidatePath('/admin/tickets')
}
