'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createTask(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: lastTask } = await supabase
    .from('project_tasks')
    .select('order_index')
    .eq('project_id', projectId)
    .eq('status', 'todo')
    .order('order_index', { ascending: false })
    .limit(1)
    .single()

  await supabase.from('project_tasks').insert({
    project_id: projectId,
    title: formData.get('title') as string,
    description: formData.get('description') as string || null,
    status: 'todo',
    assignee_id: formData.get('assignee_id') as string || null,
    due_date: formData.get('due_date') as string || null,
    order_index: (lastTask?.order_index ?? -1) + 1,
  })

  revalidatePath(`/admin/projects/${projectId}`)
}

export async function updateTaskStatus(taskId: string, status: string, projectId: string) {
  const supabase = await createClient()
  await supabase.from('project_tasks').update({ status }).eq('id', taskId)
  revalidatePath(`/admin/projects/${projectId}`)
}

export async function deleteTask(taskId: string, projectId: string) {
  const supabase = await createClient()
  await supabase.from('project_tasks').delete().eq('id', taskId)
  revalidatePath(`/admin/projects/${projectId}`)
}

export async function updateTaskOrder(taskId: string, newStatus: string, newOrder: number, projectId: string) {
  const supabase = await createClient()
  await supabase.from('project_tasks').update({ status: newStatus, order_index: newOrder }).eq('id', taskId)
  revalidatePath(`/admin/projects/${projectId}`)
}
