'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { startApprovalRequest } from './approval-engine.service'

export async function createChange(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('changes').insert({
    title: formData.get('title') as string,
    description: formData.get('description') as string || null,
    change_type: formData.get('change_type') as string || 'standard',
    priority: formData.get('priority') as string || 'medium',
    risk_level: formData.get('risk_level') as string || 'low',
    planned_start: formData.get('planned_start') as string || null,
    planned_end: formData.get('planned_end') as string || null,
    rollback_plan: formData.get('rollback_plan') as string || null,
    created_by: user?.id,
  })
  revalidatePath('/admin/changes')
}

export async function updateChangeStatus(id: string, status: string, _formData?: FormData) {
  const supabase = await createClient()
  await supabase.from('changes').update({
    status,
    updated_at: new Date().toISOString(),
    ...(status === 'in_progress' ? { actual_start: new Date().toISOString() } : {}),
    ...(status === 'done' || status === 'cancelled' ? { actual_end: new Date().toISOString() } : {}),
  }).eq('id', id)
  revalidatePath('/admin/changes')
  revalidatePath(`/admin/changes/${id}`)
}

export async function respondToChangeApproval(approvalId: string, changeId: string, decision: 'approved' | 'rejected', comment: string) {
  const supabase = await createClient()
  await supabase.from('change_approvals').update({
    status: decision,
    comment,
    responded_at: new Date().toISOString(),
  }).eq('id', approvalId)

  // Check if all approvals are done
  const { data: approvals } = await supabase
    .from('change_approvals')
    .select('status')
    .eq('change_id', changeId)

  const allApproved = approvals?.every(a => a.status === 'approved')
  const anyRejected = approvals?.some(a => a.status === 'rejected')

  if (anyRejected) {
    await supabase.from('changes').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', changeId)
  } else if (allApproved) {
    await supabase.from('changes').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', changeId)
  }

  revalidatePath(`/admin/changes/${changeId}`)
}

export async function addChangeApprover(changeId: string, approverId: string) {
  const supabase = await createClient()
  await supabase.from('change_approvals').insert({ change_id: changeId, approver_id: approverId })
  await supabase.from('changes').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', changeId)
  revalidatePath(`/admin/changes/${changeId}`)
}

export async function submitForApproval(changeId: string, _formData?: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('changes')
    .update({ status: 'submitted', updated_at: new Date().toISOString() })
    .eq('id', changeId)

  // Si hay un workflow de aprobación activo para cambios, inícialo.
  await startApprovalRequest('change', changeId)

  revalidatePath('/admin/changes')
  revalidatePath(`/admin/changes/${changeId}`)
}

export async function approveChange(changeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return

  const comment = formData.get('comment') as string | null

  await supabase
    .from('changes')
    .update({
      status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', changeId)

  await supabase.from('change_approvals').insert({
    change_id: changeId,
    approver_id: user.id,
    status: 'approved',
    comment: comment || null,
    responded_at: new Date().toISOString(),
  })

  revalidatePath('/admin/changes')
  revalidatePath(`/admin/changes/${changeId}`)
}

export async function rejectChange(changeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return

  const reason = formData.get('reason') as string | null

  await supabase
    .from('changes')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', changeId)

  await supabase.from('change_approvals').insert({
    change_id: changeId,
    approver_id: user.id,
    status: 'rejected',
    comment: reason || null,
    responded_at: new Date().toISOString(),
  })

  revalidatePath('/admin/changes')
  revalidatePath(`/admin/changes/${changeId}`)
}
