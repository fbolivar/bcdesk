'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hashPassword } from '@/lib/auth/password'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Role } from '@/lib/supabase/types'
import { randomBytes } from 'crypto'
import { sendInvoiceEmail } from '@/lib/email/ticket-emails'
import { formatMoney } from '@/lib/format/currency'
import { fmtDateOnly } from '@/lib/date'

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

  const { error } = await supabase.from('organizations').insert({
    name,
    slug,
    industry: formData.get('industry') as string || null,
    website: formData.get('website') as string || null,
    phone: formData.get('phone') as string || null,
  }).select().single()

  if (error) throw new Error(error.message)
  revalidatePath('/admin/settings/team')
  redirect('/admin/settings/team')
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
    currency: (formData.get('currency') as string) || 'COP',
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

  // Ítems por línea (desglose por servicio). Si vienen, definen el subtotal.
  type LineItem = { description: string; quantity: number; unit_price: number }
  let items: LineItem[] = []
  const itemsRaw = formData.get('items') as string | null
  if (itemsRaw) {
    try {
      const parsed = JSON.parse(itemsRaw) as LineItem[]
      items = (parsed ?? [])
        .map(it => ({ description: String(it.description ?? '').trim(), quantity: Number(it.quantity) || 0, unit_price: Number(it.unit_price) || 0 }))
        .filter(it => it.description && it.quantity > 0)
    } catch { /* ignora JSON inválido */ }
  }

  const subtotal = items.length
    ? items.reduce((s, it) => s + it.quantity * it.unit_price, 0)
    : Number(formData.get('subtotal_usd') || 0)
  const taxPct = Number(formData.get('tax_percent') ?? 0)
  const taxUsd = (subtotal * taxPct) / 100
  const total = subtotal + taxUsd

  const { data, error } = await supabase.from('invoices').insert({
    invoice_number: invoiceNumber,
    organization_id: formData.get('organization_id') as string,
    project_id: formData.get('project_id') as string || null,
    ticket_id: (formData.get('ticket_id') as string) || null,
    created_by: user.id,
    status: 'draft',
    subtotal_usd: subtotal,
    tax_percent: taxPct,
    tax_usd: taxUsd,
    total_usd: total,
    currency: (formData.get('currency') as string) || 'COP',
    due_date: formData.get('due_date') as string,
    notes: formData.get('notes') as string || null,
  }).select().single()

  if (error) throw new Error(error.message)

  if (items.length) {
    await supabase.from('invoice_items').insert(items.map(it => ({
      invoice_id: data.id,
      description: it.description,
      quantity: it.quantity,
      unit_price_usd: it.unit_price,
      total_usd: it.quantity * it.unit_price,
    })))
  }

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

  // Email de la cuenta de cobro al/los usuario(s) cliente de la organización.
  const { data: inv } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_usd, currency, due_date, organization_id, organizations(name)')
    .eq('id', invoiceId).single()

  if (inv?.organization_id) {
    const { data: clients } = await supabase
      .from('profiles')
      .select('email')
      .eq('organization_id', inv.organization_id)
      .eq('role', 'client')
      .eq('is_active', true)
    const recipients = (clients ?? []).map(c => c.email).filter(Boolean)
    if (recipients.length) {
      const org = Array.isArray(inv.organizations) ? inv.organizations[0] : inv.organizations
      await sendInvoiceEmail({
        to: recipients.join(', '),
        orgName: (org as { name?: string } | null)?.name,
        invoiceNumber: inv.invoice_number,
        amount: formatMoney(inv.total_usd, inv.currency),
        dueDate: fmtDateOnly(inv.due_date),
        invoiceId: inv.id,
      }).catch(() => {})
    }
  }

  redirect(`/admin/invoices/${invoiceId}`)
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const { supabase } = await requireAdmin()
  await supabase.from('profiles').update({ is_active: isActive }).eq('id', userId)
}

export async function changeUserRole(formData: FormData) {
  const { supabase } = await requireAdmin()
  const userId = formData.get('user_id') as string
  const role = formData.get('role') as Role
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

function generateTempPassword(): string {
  // ~12 caracteres legibles con buena entropía.
  return randomBytes(9).toString('base64url')
}

const createUserSchema = z.object({
  full_name: z.string().min(2, 'Nombre requerido'),
  email: z.string().email('Email inválido'),
  role: z.enum(['admin', 'agent', 'client']),
  organization_id: z.string().uuid().nullable().optional(),
})

/**
 * Crea un usuario directamente con una contraseña temporal (sin invitación por email).
 * Devuelve la contraseña temporal UNA sola vez para que el admin la comparta.
 * Los clientes se vinculan a una organización (organization_id).
 */
export async function createUserDirect(input: { full_name: string; email: string; role: Role; organization_id?: string | null }) {
  await requireAdmin()

  const parsed = createUserSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  // Un cliente sin organización no puede ver su dashboard ni abrir tickets.
  if (parsed.data.role === 'client' && !parsed.data.organization_id) {
    return { error: 'Selecciona la organización del cliente.' }
  }

  const email = parsed.data.email.trim().toLowerCase()
  const admin = createServiceClient()

  const { data: existing } = await admin.from('profiles')
    .select('id, role, is_active').ilike('email', email).maybeSingle()
  if (existing) {
    const roleLabel = existing.role === 'admin' ? 'Administrador' : existing.role === 'agent' ? 'Agente' : 'Cliente'
    const estado = existing.is_active ? 'activo' : 'inactivo'
    return { error: `Ya existe un usuario con ese email (${roleLabel}, ${estado}). Búscalo en la lista de usuarios; puedes activarlo o cambiarle el rol.` }
  }

  const tempPassword = generateTempPassword()
  const password_hash = await hashPassword(tempPassword)

  const { error } = await admin.from('profiles').insert({
    email,
    full_name: parsed.data.full_name.trim(),
    role: parsed.data.role,
    organization_id: parsed.data.role === 'client' ? parsed.data.organization_id : null,
    password_hash,
    is_active: true,
  })
  if (error) return { error: 'No se pudo crear el usuario. Intenta de nuevo.' }

  revalidatePath('/admin/settings/team')
  return { tempPassword, email }
}

const updateUserSchema = z.object({
  full_name: z.string().min(2, 'Nombre requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
})

/** Edita nombre, email y teléfono de un usuario (admin). */
export async function updateUser(input: { userId: string; full_name: string; email: string; phone?: string }) {
  await requireAdmin()
  const parsed = updateUserSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const email = parsed.data.email.trim().toLowerCase()
  const admin = createServiceClient()

  // El email no puede chocar con otro usuario.
  const { data: clash } = await admin.from('profiles')
    .select('id').ilike('email', email).neq('id', input.userId).maybeSingle()
  if (clash) return { error: 'Ese email ya está en uso por otro usuario.' }

  const { error } = await admin.from('profiles').update({
    full_name: parsed.data.full_name.trim(),
    email,
    phone: parsed.data.phone?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', input.userId)
  if (error) return { error: 'No se pudo actualizar el usuario.' }

  revalidatePath('/admin/settings/team')
  return { success: true }
}

/** Genera una nueva contraseña temporal para un usuario y la devuelve una vez (admin). */
export async function resetUserPassword(userId: string) {
  await requireAdmin()
  const tempPassword = generateTempPassword()
  const password_hash = await hashPassword(tempPassword)
  const admin = createServiceClient()
  const { error } = await admin.from('profiles').update({ password_hash, updated_at: new Date().toISOString() }).eq('id', userId)
  if (error) return { error: 'No se pudo restablecer la contraseña.' }
  return { tempPassword }
}

/** Fija una contraseña específica para un usuario (admin). */
export async function setUserPassword(userId: string, newPassword: string) {
  await requireAdmin()
  if (!newPassword || newPassword.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  const password_hash = await hashPassword(newPassword)
  const admin = createServiceClient()
  const { error } = await admin.from('profiles').update({ password_hash, updated_at: new Date().toISOString() }).eq('id', userId)
  if (error) return { error: 'No se pudo actualizar la contraseña.' }
  return { success: true }
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
