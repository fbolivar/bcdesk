'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getBrand } from '@/lib/email/branding'
import { buildVisitPdf, type VisitPdfImage } from '@/lib/visits/pdf'
import { sendVisitReportEmail } from '@/lib/email/ticket-emails'
import { mailConfigured } from '@/lib/email/mailer'
import { visitTypeMeta, visitStatusLabel } from './labels'

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

export async function sendVisitReport(formData: FormData) {
  const { supabase } = await requireStaff()
  const id = formData.get('id') as string
  const basePath = base(formData)

  const { data: visit } = await supabase.from('technical_visits')
    .select('*, organizations(name, address, phone), technician:profiles!technician_id(full_name, email)')
    .eq('id', id).single()
  if (!visit) redirect(`${basePath}/visits/${id}?sent=error`)

  const v = visit as {
    organization_id: string; visit_number: string; visit_type: string; status: string
    title: string; location: string | null; contact_name: string | null
    scheduled_at: string | null; started_at: string | null; ended_at: string | null
    materials: string | null; work_performed: string | null; findings: string | null
    recommendations: string | null; client_signoff: string | null
    organizations: { name: string; address: string | null; phone: string | null } | null
    technician: { full_name: string | null; email: string | null } | null
  }
  const org = v.organizations
  const tech = v.technician

  // Destinatarios: usuarios cliente activos de la organización de la visita.
  const { data: clients } = await supabase.from('profiles')
    .select('email').eq('organization_id', v.organization_id).eq('role', 'client').eq('is_active', true)
  const recipients = (clients ?? []).map(c => c.email as string).filter(Boolean)
  if (!recipients.length) redirect(`${basePath}/visits/${id}?sent=noclient`)

  // Descarga la evidencia (png/jpeg) para embeberla en el PDF.
  const { data: attachments } = await supabase.from('technical_visit_attachments')
    .select('file_url, mime_type').eq('visit_id', id).order('created_at')
  const images: VisitPdfImage[] = []
  for (const a of attachments ?? []) {
    const mime = ((a.mime_type as string) ?? '').toLowerCase()
    if (!mime.includes('png') && !mime.includes('jpeg') && !mime.includes('jpg')) continue
    const path = (a.file_url as string)?.split('/ticket-attachments/')[1]
    if (!path) continue
    const { data: blob } = await supabase.storage.from('ticket-attachments').download(decodeURIComponent(path))
    if (!blob) continue
    images.push({ bytes: new Uint8Array(await blob.arrayBuffer()), mime })
  }

  const fdate = (val: string | null) => (val ? format(new Date(val), "dd 'de' MMMM yyyy, HH:mm", { locale: es }) : '—')
  const typeLabel = visitTypeMeta(v.visit_type)?.label ?? v.visit_type
  const fail = (why: string) => redirect(`${basePath}/visits/${id}?sent=error&why=${encodeURIComponent(why.slice(0, 180))}`)

  // Sin SMTP configurado en el servidor: se avisa explícitamente.
  if (!mailConfigured()) redirect(`${basePath}/visits/${id}?sent=nomail`)

  // 1) Generar el PDF del acta.
  let pdf: Buffer
  try {
    const brand = await getBrand()
    pdf = await buildVisitPdf(brand, {
      visit_number: v.visit_number, title: v.title, typeLabel,
      statusLabel: visitStatusLabel(v.status),
      client: { name: org?.name ?? '—', address: org?.address, phone: org?.phone },
      technician: { name: tech?.full_name, email: tech?.email },
      site: v.location, contact: v.contact_name,
      scheduled: fdate(v.scheduled_at), started: fdate(v.started_at), ended: fdate(v.ended_at),
      materials: v.materials, work_performed: v.work_performed, findings: v.findings,
      recommendations: v.recommendations, client_signoff: v.client_signoff,
      generatedAt: format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es }),
      images,
    })
  } catch (e) {
    fail(`PDF: ${e instanceof Error ? e.message : String(e)}`)
    return
  }

  // 2) Enviar el correo con el PDF adjunto.
  try {
    await sendVisitReportEmail({
      to: recipients.join(', '), orgName: org?.name,
      visitNumber: v.visit_number, title: v.title, typeLabel,
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
