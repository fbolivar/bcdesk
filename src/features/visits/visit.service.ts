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

function base(formData: FormData) {
  return (formData.get('base_path') as string) || '/admin'
}

export async function createVisit(formData: FormData) {
  const { supabase, user } = await requireStaff()

  const year = new Date().getFullYear()
  const { count } = await supabase.from('technical_visits').select('*', { count: 'exact', head: true })
  const visitNumber = `VT-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`

  const { data, error } = await supabase.from('technical_visits').insert({
    visit_number: visitNumber,
    organization_id: formData.get('organization_id') as string,
    visit_type: (formData.get('visit_type') as string) || 'support',
    status: 'scheduled',
    technician_id: (formData.get('technician_id') as string) || user.id,
    ticket_id: (formData.get('ticket_id') as string) || null,
    title: formData.get('title') as string,
    location: (formData.get('location') as string) || null,
    contact_name: (formData.get('contact_name') as string) || null,
    scheduled_at: (formData.get('scheduled_at') as string) || null,
    created_by: user.id,
  }).select('id').single()

  if (error) throw new Error(`No se pudo crear la visita: ${error.message}`)
  redirect(`${base(formData)}/visits/${data.id}`)
}

export async function updateVisit(formData: FormData) {
  const { supabase } = await requireStaff()
  const id = formData.get('id') as string

  const { error } = await supabase.from('technical_visits').update({
    organization_id: formData.get('organization_id') as string,
    visit_type: formData.get('visit_type') as string,
    technician_id: (formData.get('technician_id') as string) || null,
    title: formData.get('title') as string,
    location: (formData.get('location') as string) || null,
    contact_name: (formData.get('contact_name') as string) || null,
    scheduled_at: (formData.get('scheduled_at') as string) || null,
    started_at: (formData.get('started_at') as string) || null,
    ended_at: (formData.get('ended_at') as string) || null,
    work_performed: (formData.get('work_performed') as string) || null,
    findings: (formData.get('findings') as string) || null,
    recommendations: (formData.get('recommendations') as string) || null,
    materials: (formData.get('materials') as string) || null,
    client_signoff: (formData.get('client_signoff') as string) || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  if (error) throw new Error(`No se pudo guardar: ${error.message}`)
  revalidatePath(`${base(formData)}/visits/${id}`)
  redirect(`${base(formData)}/visits/${id}?saved=1`)
}

export async function setVisitStatus(formData: FormData) {
  const { supabase } = await requireStaff()
  const id = formData.get('id') as string
  const status = formData.get('status') as string
  const now = new Date().toISOString()

  const patch: Record<string, unknown> = { status, updated_at: now }
  if (status === 'in_progress') patch.started_at = now
  if (status === 'completed') patch.ended_at = now

  const { error } = await supabase.from('technical_visits').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`${base(formData)}/visits/${id}`)
}

export async function deleteVisit(formData: FormData) {
  const { supabase } = await requireStaff()
  const id = formData.get('id') as string
  await supabase.from('technical_visits').delete().eq('id', id)
  redirect(`${base(formData)}/visits`)
}

export async function deleteVisitAttachment(formData: FormData) {
  const { supabase } = await requireStaff()
  const attId = formData.get('attachment_id') as string
  const visitId = formData.get('visit_id') as string
  await supabase.from('technical_visit_attachments').delete().eq('id', attId)
  revalidatePath(`${base(formData)}/visits/${visitId}`)
}
