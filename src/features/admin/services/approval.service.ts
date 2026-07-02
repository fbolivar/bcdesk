'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export interface ApprovalStep {
  id: string
  name: string
  approver_type: 'role' | 'user'
  approver_role?: 'admin' | 'agent'
  approver_id?: string
  mode: 'any' | 'all'
}

export interface ApprovalWorkflow {
  id: string
  name: string
  entity_type: string
  steps: ApprovalStep[]
  is_active: boolean
  trigger_conditions?: Record<string, unknown>
  created_at?: string
}

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') throw new Error('No autorizado')
  return user
}

export async function listApprovalWorkflows(): Promise<ApprovalWorkflow[]> {
  await requireAdmin()
  const admin = createServiceClient()
  const { data } = await admin
    .from('approval_workflows')
    .select('id, name, entity_type, steps, is_active, trigger_conditions, created_at')
    .order('created_at', { ascending: false })
  return (data ?? []).map(w => ({
    ...w,
    steps: Array.isArray(w.steps) ? (w.steps as ApprovalStep[]) : [],
  })) as ApprovalWorkflow[]
}

interface SaveInput {
  id?: string
  name: string
  entity_type: string
  steps: ApprovalStep[]
  is_active: boolean
}

export async function saveApprovalWorkflow(input: SaveInput) {
  await requireAdmin()
  if (!input.name?.trim()) return { error: 'El nombre es obligatorio.' }
  if (!input.steps || input.steps.length === 0) return { error: 'Agrega al menos un paso de aprobación.' }

  const admin = createServiceClient()
  const payload = {
    name: input.name.trim(),
    entity_type: input.entity_type,
    steps: input.steps,
    is_active: input.is_active,
  }

  if (input.id) {
    const { error } = await admin.from('approval_workflows').update(payload).eq('id', input.id)
    if (error) return { error: 'No se pudo guardar el workflow.' }
    revalidatePath('/admin/settings/approvals')
    return { success: true, id: input.id }
  } else {
    const { data, error } = await admin.from('approval_workflows').insert(payload).select('id').single()
    if (error) return { error: 'No se pudo crear el workflow.' }
    revalidatePath('/admin/settings/approvals')
    return { success: true, id: data.id }
  }
}

export async function deleteApprovalWorkflow(id: string) {
  await requireAdmin()
  const admin = createServiceClient()
  const { error } = await admin.from('approval_workflows').delete().eq('id', id)
  if (error) return { error: 'No se pudo eliminar.' }
  revalidatePath('/admin/settings/approvals')
  return { success: true }
}
