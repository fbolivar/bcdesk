'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sendVisitReportEmail } from '@/lib/email/ticket-emails'
import { getOrgResponsibleEmails } from '@/lib/email/org-recipients'
import { bogotaLocalToISO } from '@/lib/date'
import { mailConfigured } from '@/lib/email/mailer'
import { visitTypeMeta } from './labels'
import { buildVisitReportPdf, type VisitRow } from '@/lib/visits/build-report'

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

  // Número de visita atómico y único: VT-YYYY-NNNN (nunca reutiliza al borrar).
  const year = new Date().getFullYear()
  const { data: numData, error: numErr } = await supabase.rpc('next_doc_number', { p_prefix: 'VT', p_year: year })
  if (numErr || !numData) throw new Error(`No se pudo generar el número de visita: ${numErr?.message ?? 'sin dato'}`)
  const visitNumber = numData as string

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
    scheduled_at: bogotaLocalToISO(formData.get('scheduled_at') as string),
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
    scheduled_at: bogotaLocalToISO(formData.get('scheduled_at') as string),
    started_at: bogotaLocalToISO(formData.get('started_at') as string),
    ended_at: bogotaLocalToISO(formData.get('ended_at') as string),
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

export async function sendVisitReport(formData: FormData) {
  const { supabase } = await requireStaff()
  const id = formData.get('id') as string
  const basePath = base(formData)

  const fail = (why: string) => redirect(`${basePath}/visits/${id}?sent=error&why=${encodeURIComponent(why.slice(0, 180))}`)

  // Sin SMTP configurado en el servidor: se avisa explícitamente.
  if (!mailConfigured()) redirect(`${basePath}/visits/${id}?sent=nomail`)

  let built: { pdf: Buffer; visit: VisitRow } | null
  try {
    built = await buildVisitReportPdf(supabase, id)
  } catch (e) {
    fail(`PDF: ${e instanceof Error ? e.message : String(e)}`); return
  }
  if (!built) redirect(`${basePath}/visits/${id}?sent=error`)
  const v = built.visit
  const org = v.organizations
  const pdf = built.pdf

  // Destinatarios: SOLO el/los responsable(s) de la organización, no todos los
  // usuarios (el acta lleva datos operativos/privados). Ver getOrgResponsibleEmails.
  const recipients = await getOrgResponsibleEmails(supabase, v.organization_id)
  if (!recipients.length) redirect(`${basePath}/visits/${id}?sent=noclient`)

  // 2) Enviar el correo con el PDF adjunto.
  try {
    await sendVisitReportEmail({
      to: recipients.join(', '), orgName: org?.name,
      visitNumber: v.visit_number, title: v.title, typeLabel: visitTypeMeta(v.visit_type)?.label ?? v.visit_type,
      attachment: { filename: `${v.visit_number}.pdf`, content: pdf },
    })
  } catch (e) {
    fail(`Correo: ${e instanceof Error ? e.message : String(e)}`)
    return
  }

  await supabase.from('technical_visits').update({ report_sent_at: new Date().toISOString() }).eq('id', id)
  revalidatePath(`${basePath}/visits/${id}`)
  redirect(`${basePath}/visits/${id}?sent=1`)
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
