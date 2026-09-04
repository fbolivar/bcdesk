import type { createClient } from '@/lib/supabase/server'
import { buildVisitPdf, type VisitPdfImage } from '@/lib/visits/pdf'
import { getBrand } from '@/lib/email/branding'
import { visitTypeMeta, visitStatusLabel } from '@/features/visits/labels'
import { fmtDateTime } from '@/lib/date'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export type VisitRow = {
  organization_id: string; visit_number: string; visit_type: string; status: string
  title: string; location: string | null; contact_name: string | null
  scheduled_at: string | null; started_at: string | null; ended_at: string | null
  materials: string | null; work_performed: string | null; findings: string | null
  recommendations: string | null; client_signoff: string | null
  organizations: { name: string; address: string | null; phone: string | null } | null
  technician: { full_name: string | null; email: string | null } | null
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

/** Genera el acta de visita como PDF real (documento A4 profesional, sin la app).
 *  Se usa para descargar/ver y para adjuntar al correo. Recibe un cliente Supabase
 *  ya autenticado (RLS). Devuelve el PDF y la fila de la visita, o null si no existe. */
export async function buildVisitReportPdf(
  supabase: SupabaseServer,
  id: string,
): Promise<{ pdf: Buffer; visit: VisitRow } | null> {
  const { data: visit } = await supabase.from('technical_visits')
    .select('*, organizations(name, address, phone), technician:profiles!technician_id(full_name, email)')
    .eq('id', id).single()
  if (!visit) return null
  const v = visit as VisitRow
  const org = v.organizations
  const tech = v.technician

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

  const fdate = (val: string | null) => (val ? fmtDateTime(val) : null) // hora de Colombia, compacto
  const brand = await getBrand()
  const pdf = await buildVisitPdf(brand, {
    visit_number: v.visit_number, title: v.title, typeLabel: visitTypeMeta(v.visit_type)?.label ?? v.visit_type,
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
  return { pdf, visit: v }
}
