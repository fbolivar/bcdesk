import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateUpload } from '@/lib/storage/upload-guard'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const ticketId = formData.get('ticketId') as string | null
  const commentId = formData.get('commentId') as string | null

  if (!ticketId) return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 })

  // Verifica acceso al ticket vía RLS: si el usuario no puede verlo, no puede adjuntar.
  const { data: ticket } = await supabase.from('tickets').select('id').eq('id', ticketId).maybeSingle()
  if (!ticket) return NextResponse.json({ error: 'Ticket no accesible' }, { status: 403 })

  const files = formData.getAll('files') as File[]
  if (files.length === 0) return NextResponse.json({ uploaded: [] })

  const results: { name: string; url: string }[] = []

  for (const file of files) {
    if (!(file instanceof File)) continue
    if (validateUpload(file)) continue // salta archivos de tipo/tamaño no permitido

    const ext = file.name.split('.').pop() ?? 'bin'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const path = commentId
      ? `comments/${commentId}/${safeName}`
      : `${ticketId}/${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('ticket-attachments')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) continue

    const { data: { publicUrl } } = supabase.storage
      .from('ticket-attachments')
      .getPublicUrl(path)

    const { error: dbError } = await supabase.from('ticket_attachments').insert({
      ticket_id: ticketId,
      comment_id: commentId ?? null,
      uploaded_by: user.id,
      file_name: file.name,
      file_url: publicUrl,
      file_size_bytes: file.size,
      mime_type: file.type,
    })

    if (!dbError) {
      results.push({ name: file.name, url: publicUrl })
    }
  }

  return NextResponse.json({ uploaded: results })
}
