'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createProblem(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('problems').insert({
    title: formData.get('title') as string,
    description: formData.get('description') as string || null,
    priority: formData.get('priority') as string || 'medium',
    created_by: user?.id,
  })
  revalidatePath('/admin/problems')
}

export async function updateProblem(id: string, formData: FormData) {
  const supabase = await createClient()
  await supabase.from('problems').update({
    title: formData.get('title') as string,
    description: formData.get('description') as string || null,
    status: formData.get('status') as string,
    priority: formData.get('priority') as string,
    root_cause: formData.get('root_cause') as string || null,
    workaround: formData.get('workaround') as string || null,
    resolved_at: formData.get('status') === 'resolved' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  revalidatePath('/admin/problems')
  revalidatePath(`/admin/problems/${id}`)
}

export async function linkTicketToProblem(problemId: string, ticketId: string) {
  const supabase = await createClient()
  await supabase.from('problem_incidents').insert({ problem_id: problemId, ticket_id: ticketId })
  await supabase.from('tickets').update({ problem_id: problemId }).eq('id', ticketId)
  revalidatePath(`/admin/problems/${problemId}`)
}

export async function unlinkTicketFromProblem(problemId: string, ticketId: string) {
  const supabase = await createClient()
  await supabase.from('problem_incidents').delete()
    .eq('problem_id', problemId).eq('ticket_id', ticketId)
  await supabase.from('tickets').update({ problem_id: null }).eq('id', ticketId)
  revalidatePath(`/admin/problems/${problemId}`)
}
