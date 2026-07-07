import { createServiceClient } from '@/lib/supabase/service'
import { validateUploadMeta } from '@/lib/storage/upload-guard'

type Supa = ReturnType<typeof createServiceClient>

export type InboundAttachment = {
  filename: string
  mimeType?: string
  size?: number
  contentBase64?: string
}

/**
 * Sube UN adjunto (base64) al bucket ticket-attachments y lo enlaza al ticket
 * (y opcionalmente al comentario). Devuelve true si se guardó, false si se
 * omitió (validación/errores). Nunca lanza: es best-effort.
 */
export async function saveInboundAttachment(
  supabase: Supa,
  ticketId: string,
  commentId: string | null,
  uploadedBy: string,
  att: InboundAttachment,
): Promise<boolean> {
  if (!att.contentBase64 || !att.filename) return false
  let buffer: Buffer
  try { buffer = Buffer.from(att.contentBase64, 'base64') } catch { return false }

  const mime = att.mimeType || 'application/octet-stream'
  const invalid = validateUploadMeta(buffer.length, mime)
  if (invalid) { console.warn(`[inbound] adjunto omitido "${att.filename}": ${invalid}`); return false }

  const ext = att.filename.includes('.') ? att.filename.split('.').pop() : 'bin'
  const path = `${ticketId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('ticket-attachments').upload(path, buffer, { contentType: mime })
  if (upErr) { console.warn(`[inbound] fallo subida "${att.filename}": ${upErr.message}`); return false }

  const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(path)
  const { error: dbErr } = await supabase.from('ticket_attachments').insert({
    ticket_id: ticketId, comment_id: commentId, uploaded_by: uploadedBy,
    file_name: att.filename, file_url: publicUrl, file_size_bytes: buffer.length, mime_type: mime,
  })
  return !dbErr
}

/** Sube varios adjuntos y devuelve cuántos se guardaron. */
export async function saveInboundAttachments(
  supabase: Supa, ticketId: string, commentId: string | null, uploadedBy: string,
  attachments: InboundAttachment[] | undefined,
): Promise<number> {
  if (!attachments?.length) return 0
  let saved = 0
  for (const att of attachments) {
    if (await saveInboundAttachment(supabase, ticketId, commentId, uploadedBy, att)) saved++
  }
  return saved
}
