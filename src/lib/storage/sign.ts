import type { createClient } from '@/lib/supabase/server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

/** Firma las URLs de adjuntos del bucket privado `ticket-attachments`.
 *  Devuelve un mapa id → URL firmada (o la original si no se puede firmar). */
export async function signAttachmentUrls(
  supabase: ServerClient,
  atts: { id: string; file_url: string }[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  await Promise.all(atts.map(async a => {
    const path = a.file_url?.split('/ticket-attachments/')[1]
    if (!path) { map.set(a.id, a.file_url); return }
    const { data } = await supabase.storage.from('ticket-attachments').createSignedUrl(decodeURIComponent(path), expiresIn)
    map.set(a.id, data?.signedUrl ?? a.file_url)
  }))
  return map
}
