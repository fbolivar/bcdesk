import { createServiceClient } from '@/lib/supabase/service'
import { saveInboundAttachment } from '@/lib/email/inbound-attachments'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Sube UN adjunto a un ticket ya creado. Se separa de /api/email/inbound para
 * que cada archivo viaje en su propia petición y no choque con el límite de
 * body de Vercel (~4.5MB) — así la creación del ticket nunca se bloquea.
 * Body: { ticketId, commentId?, filename, mimeType, contentBase64 }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.EMAIL_INBOUND_SECRET?.trim()
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  let p: { ticketId?: string; commentId?: string; filename?: string; mimeType?: string; contentBase64?: string }
  try {
    p = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!p.ticketId || !p.filename || !p.contentBase64) {
    return NextResponse.json({ ok: false, error: 'Faltan campos: ticketId, filename, contentBase64' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // uploaded_by es NOT NULL → usamos el creador del ticket (o un admin activo).
  const { data: ticket } = await supabase
    .from('tickets').select('id, created_by').eq('id', p.ticketId).maybeSingle()
  if (!ticket) return NextResponse.json({ ok: false, error: 'Ticket no encontrado' }, { status: 404 })

  let uploadedBy = ticket.created_by as string | null
  if (!uploadedBy) {
    const { data: admin } = await supabase
      .from('profiles').select('id').eq('role', 'admin').eq('is_active', true).limit(1).maybeSingle()
    uploadedBy = admin?.id ?? null
  }
  if (!uploadedBy) return NextResponse.json({ ok: false, error: 'Sin autor para el adjunto' }, { status: 500 })

  const ok = await saveInboundAttachment(supabase, p.ticketId, p.commentId ?? null, uploadedBy, {
    filename: p.filename, mimeType: p.mimeType, contentBase64: p.contentBase64,
  })

  return NextResponse.json({ ok, saved: ok })
}
