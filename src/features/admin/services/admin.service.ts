'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Role } from '@/lib/supabase/types'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Sin permisos de administrador')
  return { supabase, user }
}

export async function createInvitation(email: string, organizationId: string | null, role: Role) {
  const { supabase, user } = await requireAdmin()

  const { data, error } = await supabase.from('invitations').insert({
    email,
    organization_id: organizationId,
    role,
    invited_by: user.id,
  }).select().single()

  if (error) return { error: error.message }
  return { token: data.token }
}

export async function createOrganization(formData: FormData) {
  const { supabase } = await requireAdmin()

  const name = formData.get('name') as string
  const slug = (formData.get('name') as string).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const { data, error } = await supabase.from('organizations').insert({
    name,
    slug,
    industry: formData.get('industry') as string || null,
    website: formData.get('website') as string || null,
    phone: formData.get('phone') as string || null,
  }).select().single()

  if (error) throw new Error(error.message)
  redirect(`/admin/clients/${data.id}`)
}

export async function createProject(formData: FormData) {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase.from('projects').insert({
    organization_id: formData.get('organization_id') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    status: 'planning',
    start_date: formData.get('start_date') as string || null,
    end_date: formData.get('end_date') as string || null,
    budget_usd: formData.get('budget_usd') ? Number(formData.get('budget_usd')) : null,
  }).select().single()

  if (error) throw new Error(error.message)
  redirect(`/admin/projects/${data.id}`)
}

export async function updateProjectProgress(projectId: string, progress: number) {
  const { supabase } = await requireAdmin()
  await supabase.from('projects').update({ progress_percent: progress }).eq('id', projectId)
}

export async function createInvoice(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  // Generate invoice number: BC-YYYY-NNNN
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('invoices').select('*', { count: 'exact', head: true })
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  const invoiceNumber = `BC-${year}-${seq}`

  const subtotal = Number(formData.get('subtotal_usd'))
  const taxPct = Number(formData.get('tax_percent') ?? 0)
  const taxUsd = (subtotal * taxPct) / 100
  const total = subtotal + taxUsd

  const { data, error } = await supabase.from('invoices').insert({
    invoice_number: invoiceNumber,
    organization_id: formData.get('organization_id') as string,
    project_id: formData.get('project_id') as string || null,
    created_by: user.id,
    status: 'draft',
    subtotal_usd: subtotal,
    tax_percent: taxPct,
    tax_usd: taxUsd,
    total_usd: total,
    due_date: formData.get('due_date') as string,
    notes: formData.get('notes') as string || null,
  }).select().single()

  if (error) throw new Error(error.message)
  redirect(`/admin/invoices/${data.id}`)
}

export async function updateInvoiceStatus(invoiceId: string, status: string, paymentMethod?: string, reference?: string) {
  const { supabase } = await requireAdmin()

  const updates: Record<string, unknown> = { status }
  if (status === 'paid') {
    updates.paid_at = new Date().toISOString()
    updates.payment_method = paymentMethod ?? null
    updates.payment_reference = reference ?? null
  }

  await supabase.from('invoices').update(updates).eq('id', invoiceId)
  redirect(`/admin/invoices/${invoiceId}`)
}

export async function sendInvoice(invoiceId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoiceId)
  redirect(`/admin/invoices/${invoiceId}`)
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const { supabase } = await requireAdmin()
  await supabase.from('profiles').update({ is_active: isActive }).eq('id', userId)
}

export async function changeUserRole(formData: FormData) {
  const { supabase } = await requireAdmin()
  const userId = formData.get('user_id') as string
  const role = formData.get('role') as 'admin' | 'agent'
  await supabase.from('profiles').update({ role }).eq('id', userId)
  redirect('/admin/settings/team')
}

export async function updateSlaPolicy(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = formData.get('id') as string
  await supabase.from('sla_policies').update({
    name: formData.get('name') as string,
    response_time_minutes: Number(formData.get('response_time_minutes')),
    resolution_time_minutes: Number(formData.get('resolution_time_minutes')),
    escalate_after_minutes: formData.get('escalate_after_minutes')
      ? Number(formData.get('escalate_after_minutes'))
      : null,
  }).eq('id', id)
  redirect('/admin/settings/sla')
}

export async function toggleSlaPolicy(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = formData.get('id') as string
  const current = formData.get('is_active') === 'true'
  await supabase.from('sla_policies').update({ is_active: !current }).eq('id', id)
  redirect('/admin/settings/sla')
}

export async function cancelInvitation(formData: FormData) {
  const { supabase } = await requireAdmin()
  const invitationId = formData.get('invitation_id') as string
  await supabase.from('invitations').delete().eq('id', invitationId)
  redirect('/admin/settings/team')
}

export async function bulkUpdateTickets(formData: FormData) {
  const { supabase } = await requireAdmin()
  const ids = formData.getAll('ids') as string[]
  if (ids.length === 0) return
  const action = formData.get('action') as string

  if (action === 'close') {
    await supabase.from('tickets').update({ status: 'closed' }).in('id', ids)
  } else if (action === 'resolve') {
    await supabase.from('tickets')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .in('id', ids)
  } else if (action === 'assign') {
    const agentId = formData.get('agent_id') as string
    if (agentId) await supabase.from('tickets').update({ assigned_to: agentId }).in('id', ids)
  }

  revalidatePath('/admin/tickets')
}
