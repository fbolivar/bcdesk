import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateUpload } from '@/lib/storage/upload-guard'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agent'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Formulario inválido' }, { status: 400 })
  }

  const visitId = formData.get('visit_id') as string | null
  if (!visitId) return NextResponse.json({ error: 'Falta visit_id' }, { status: 400 })

  const files = formData.getAll('files') as File[]
  if (files.length === 0) return NextResponse.json({ uploaded: [] })

  const results: { name: string; url: string }[] = []

  for (const file of files) {
    if (!(file instanceof File)) continue
    if (validateUpload(file)) continue // salta archivos de tipo/tamaño no permitido
    const ext = file.name.split('.').pop() ?? 'bin'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const path = `visits/${visitId}/${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('ticket-attachments')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) continue

    const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(path)

    const { error: dbError } = await supabase.from('technical_visit_attachments').insert({
      visit_id: visitId,
      uploaded_by: user.id,
      file_name: file.name,
      file_url: publicUrl,
      file_size_bytes: file.size,
      mime_type: file.type,
    })
    if (!dbError) results.push({ name: file.name, url: publicUrl })
  }

  return NextResponse.json({ uploaded: results })
}
