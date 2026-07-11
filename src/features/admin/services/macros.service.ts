'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getRequestIp } from '@/lib/audit/request-ip'

export async function createMacro(formData: FormData) {
  const supabase = await createClient()
  const rawActions = formData.get('actions') as string
  let actions = []
  try { actions = JSON.parse(rawActions) } catch { actions = [] }

  await supabase.from('macros').insert({
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    actions,
  })
  revalidatePath('/admin/settings/macros')
}

export async function updateMacro(id: string, formData: FormData) {
  const supabase = await createClient()
  const rawActions = formData.get('actions') as string
  let actions = []
  try { actions = JSON.parse(rawActions) } catch { actions = [] }

  await supabase.from('macros').update({
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    actions,
  }).eq('id', id)
  revalidatePath('/admin/settings/macros')
}

export async function toggleMacro(id: string, active: boolean) {
  const supabase = await createClient()
  await supabase.from('macros').update({ is_active: active }).eq('id', id)
  revalidatePath('/admin/settings/macros')
}

export async function deleteMacro(id: string) {
  const supabase = await createClient()
  await supabase.from('macros').delete().eq('id', id)
  revalidatePath('/admin/settings/macros')
}

export async function applyMacro(macroId: string, ticketId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: macro } = await supabase.from('macros').select('*').eq('id', macroId).single()
  if (!macro) return { error: 'Macro not found' }

  const actions = macro.actions as Array<{ type: string; value: string }>
  const updates: Record<string, unknown> = {}
  let commentContent: string | null = null
  let tags: string[] | null = null

  for (const action of actions) {
    switch (action.type) {
      case 'set_status':   updates.status = action.value; break
      case 'set_priority': updates.priority = action.value; break
      case 'assign_to':    updates.assigned_to = action.value; break
      case 'add_tag':      tags = action.value.split(',').map(t => t.trim()).filter(Boolean); break
      case 'add_comment':  commentContent = action.value; break
    }
  }

  // Apply ticket updates
  if (Object.keys(updates).length > 0) {
    await supabase.from('tickets').update(updates).eq('id', ticketId)
  }

  // Apply tags
  if (tags) {
    const { data: ticket } = await supabase.from('tickets').select('tags').eq('id', ticketId).single()
    const existing: string[] = ticket?.tags ?? []
    const merged = [...new Set([...existing, ...tags])]
    await supabase.from('tickets').update({ tags: merged }).eq('id', ticketId)
  }

  // Add comment
  if (commentContent) {
    await supabase.from('ticket_comments').insert({
      ticket_id: ticketId,
      author_id: user.id,
      content: commentContent,
      is_internal: false,
    })
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    resource_type: 'ticket',
    resource_id: ticketId,
    actor_id: user.id,
    action: 'macro_applied',
    new_values: { macro: macro.name },
    ip_address: await getRequestIp(),
  })

  // Increment use count
  await supabase.from('macros').update({ use_count: (macro.use_count ?? 0) + 1 }).eq('id', macroId)

  revalidatePath(`/agent/tickets/${ticketId}`)
  revalidatePath(`/admin/tickets/${ticketId}`)
  return { ok: true }
}
