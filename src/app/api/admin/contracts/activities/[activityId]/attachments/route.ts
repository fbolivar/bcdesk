import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/api/require-admin'
import { validateUpload } from '@/lib/storage/upload-guard'

export const runtime = 'nodejs'

const BUCKET = 'ticket-attachments' // bucket privado reutilizado para adjuntos

// POST: sube uno o más documentos y los asocia a la actividad.
export async function POST(req: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { activityId } = await params

  const admin = createServiceClient()
  const { data: activity } = await admin.from('contract_activities').select('id').eq('id', activityId).maybeSingle()
  if (!activity) return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 })

  let formData: FormData
  try { formData = await req.formData() } catch { return NextResponse.json({ error: 'Formulario inválido' }, { status: 400 }) }

  const files = formData.getAll('files') as File[]
  if (files.length === 0) return NextResponse.json({ uploaded: [] })

  const uploaded: { id: string; name: string }[] = []
  for (const file of files) {
    if (!(file instanceof File)) continue
    if (validateUpload(file)) continue // salta tipos/tamaños no permitidos

    const ext = file.name.split('.').pop() ?? 'bin'
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const path = `contract-activities/${activityId}/${safe}`

    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
    if (upErr) continue
    const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path)

    const { data: row, error: dbErr } = await admin.from('contract_activity_attachments').insert({
      activity_id: activityId,
      uploaded_by: guard.user.id,
      file_name: file.name,
      file_url: publicUrl,
      file_size_bytes: file.size,
      mime_type: file.type,
    }).select('id').single()
    if (!dbErr && row) uploaded.push({ id: row.id, name: file.name })
  }

  return NextResponse.json({ uploaded })
}

// DELETE: elimina un adjunto (?id=).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { activityId } = await params
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const admin = createServiceClient()
  const { data: att } = await admin.from('contract_activity_attachments')
    .select('id, file_url, activity_id').eq('id', id).eq('activity_id', activityId).maybeSingle()
  if (!att) return NextResponse.json({ error: 'Adjunto no encontrado' }, { status: 404 })

  const path = att.file_url?.split(`/${BUCKET}/`)[1]
  if (path) await admin.storage.from(BUCKET).remove([decodeURIComponent(path)])
  await admin.from('contract_activity_attachments').delete().eq('id', id)

  return NextResponse.json({ ok: true })
}
