'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function requireStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agent'].includes(profile.role)) throw new Error('Sin permiso')
  return { supabase, user }
}

/** Registra un gasto ligado a un ticket y/o una visita. */
export async function createExpense(formData: FormData) {
  const { supabase, user } = await requireStaff()

  const ticketId = (formData.get('ticket_id') as string) || null
  const visitId = (formData.get('visit_id') as string) || null
  const category = ((formData.get('category') as string) || '').trim()
  const description = ((formData.get('description') as string) || '').trim() || null
  const amount = parseFloat(String(formData.get('amount') ?? '0').replace(/[^0-9.]/g, '')) || 0
  const spentAt = (formData.get('spent_at') as string) || null
  const redirectTo = (formData.get('redirect_to') as string) || '/admin/expenses'

  if (!ticketId && !visitId) throw new Error('El gasto debe ligarse a un ticket o a una visita')
  if (!category) throw new Error('La categoría es obligatoria')
  if (amount <= 0) throw new Error('El monto debe ser mayor que cero')

  // Deriva la organización desde el ticket o la visita.
  let organizationId: string | null = null
  if (ticketId) {
    const { data } = await supabase.from('tickets').select('organization_id').eq('id', ticketId).single()
    organizationId = data?.organization_id ?? null
  } else if (visitId) {
    const { data } = await supabase.from('technical_visits').select('organization_id').eq('id', visitId).single()
    organizationId = data?.organization_id ?? null
  }

  // Guarda la categoría si es nueva (para reusarla en el selector).
  await supabase.from('service_expense_categories').upsert({ name: category }, { onConflict: 'name' })

  const { error } = await supabase.from('service_expenses').insert({
    organization_id: organizationId,
    ticket_id: ticketId,
    visit_id: visitId,
    category,
    description,
    amount,
    spent_at: spentAt || undefined,
    created_by: user.id,
  })
  if (error) throw new Error(`No se pudo registrar el gasto: ${error.message}`)

  revalidatePath(redirectTo)
  redirect(`${redirectTo}?exp=1`)
}

export async function deleteExpense(formData: FormData) {
  const { supabase } = await requireStaff()
  const id = formData.get('id') as string
  const redirectTo = (formData.get('redirect_to') as string) || '/admin/expenses'
  const { error } = await supabase.from('service_expenses').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(redirectTo)
  redirect(`${redirectTo}?exp=del`)
}
