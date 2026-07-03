'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { startApprovalRequest } from './approval-engine.service'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function requireStaff() {
  const user = await getCurrentUser()
  if (!user || !['admin', 'agent'].includes(user.role)) throw new Error('No autorizado')
  return user
}

export async function createPurchaseRequest(formData: FormData) {
  const user = await requireStaff()
  const supabase = await createClient()

  const { data, error } = await supabase.from('purchase_requests').insert({
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    vendor: (formData.get('vendor') as string) || null,
    amount: parseFloat(formData.get('amount') as string) || 0,
    currency: (formData.get('currency') as string) || 'USD',
    status: 'draft',
    requested_by: user.id,
    organization_id: user.organization_id,
  }).select('id').single()

  if (error) return
  revalidatePath('/admin/purchases')
  if (data) redirect(`/admin/purchases/${data.id}`)
}

export async function submitPurchaseForApproval(id: string, _formData?: FormData) {
  await requireStaff()
  const supabase = await createClient()

  await supabase.from('purchase_requests').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', id)

  // Arranca el workflow de aprobación de compras si hay uno activo.
  await startApprovalRequest('purchase', id)

  revalidatePath('/admin/purchases')
  revalidatePath(`/admin/purchases/${id}`)
}

export async function cancelPurchaseRequest(id: string, _formData?: FormData) {
  await requireStaff()
  const supabase = await createClient()
  await supabase.from('purchase_requests').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/admin/purchases')
  revalidatePath(`/admin/purchases/${id}`)
}

export async function deletePurchaseRequest(id: string, _formData?: FormData) {
  await requireStaff()
  const supabase = await createClient()
  await supabase.from('purchase_requests').delete().eq('id', id)
  revalidatePath('/admin/purchases')
  redirect('/admin/purchases')
}
