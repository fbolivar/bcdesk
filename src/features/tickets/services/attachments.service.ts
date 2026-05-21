'use server'

import { createClient } from '@/lib/supabase/server'

export async function uploadTicketAttachment(
  ticketId: string,
  commentId: string | null,
  file: File
): Promise<{ url: string; id: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const ext = file.name.split('.').pop()
  const path = `${ticketId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('ticket-attachments')
    .upload(path, file, { contentType: file.type })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(path)

  const { data, error: dbError } = await supabase.from('ticket_attachments').insert({
    ticket_id: ticketId,
    comment_id: commentId,
    uploaded_by: user.id,
    file_name: file.name,
    file_url: publicUrl,
    file_size_bytes: file.size,
    mime_type: file.type,
  }).select('id').single()

  if (dbError) return { error: dbError.message }
  return { url: publicUrl, id: data.id }
}
