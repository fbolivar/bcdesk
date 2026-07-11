'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function logTime(ticketId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const hours = parseFloat(formData.get('hours') as string) || 0
  const minutes = Math.round(hours * 60)
  if (minutes <= 0) return

  await supabase.from('time_logs').insert({
    ticket_id: ticketId,
    agent_id: user.id,
    minutes,
    description: formData.get('description') as string || null,
  })

  await supabase.from('audit_logs').insert({
    resource_type: 'ticket',
    resource_id: ticketId,
    actor_id: user.id,
    action: 'time_logged',
    new_values: { hours: `${hours}h` },
  })

  revalidatePath(`/agent/tickets/${ticketId}`)
  revalidatePath(`/admin/tickets/${ticketId}`)
}

export async function deleteTimeLog(logId: string, ticketId: string) {
  const supabase = await createClient()
  await supabase.from('time_logs').delete().eq('id', logId)
  revalidatePath(`/agent/tickets/${ticketId}`)
}
