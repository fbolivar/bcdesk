import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyCsat } from '@/lib/email/csat'
import { getBrand } from '@/lib/email/branding'

export const runtime = 'nodejs'

const EMOJIS = ['😞', '😕', '😐', '😊', '😄']

async function page(title: string, bodyHtml: string, status = 200): Promise<Response> {
  const brand = await getBrand()
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · ${brand.name}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#F4F7FB;color:#5B6B7C;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
    .card{max-width:460px;width:100%;background:#fff;border:1px solid #E6EBF2;border-radius:16px;overflow:hidden;text-align:center}
    .head{background:${brand.color};color:#fff;padding:20px;font-size:16px;font-weight:700}
    .body{padding:28px 24px}
    h1{color:#0B2545;font-size:20px;margin:0 0 10px}
    p{font-size:14px;line-height:1.6;margin:0 0 12px}
    textarea{width:100%;box-sizing:border-box;border:1px solid #E6EBF2;border-radius:10px;padding:10px;font-size:14px;font-family:inherit;resize:vertical;min-height:80px}
    button{margin-top:12px;background:${brand.color};color:#fff;border:0;border-radius:10px;padding:11px 22px;font-size:14px;font-weight:600;cursor:pointer}
    .foot{padding:14px;border-top:1px solid #E6EBF2;font-size:11px;color:#94A3B8}
  </style></head><body>
  <div class="card">
    <div class="head">${brand.name}</div>
    <div class="body">${bodyHtml}</div>
    <div class="foot">${brand.name} · ${brand.supportEmail}</div>
  </div></body></html>`
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ticketId = searchParams.get('t') ?? ''
  const score = Number(searchParams.get('s'))
  const sig = searchParams.get('sig') ?? ''

  if (!ticketId || !(score >= 1 && score <= 5) || !verifyCsat(ticketId, score, sig)) {
    return page('Enlace inválido', '<h1>Enlace no válido</h1><p>El enlace de calificación es incorrecto o está incompleto.</p>', 400)
  }

  const supabase = createServiceClient()
  const { data: ticket } = await supabase.from('tickets').select('id, ticket_number').eq('id', ticketId).maybeSingle()
  if (!ticket) {
    return page('Caso no encontrado', '<h1>No encontramos tu caso</h1><p>Es posible que el ticket ya no exista.</p>', 404)
  }

  await supabase.from('tickets').update({ satisfaction_score: score }).eq('id', ticketId)

  const body = `
    <div style="font-size:44px;margin-bottom:6px">${EMOJIS[score - 1]}</div>
    <h1>¡Gracias por calificar!</h1>
    <p>Registramos tu calificación de <strong style="color:#0B2545">${score}/5</strong> para el caso <strong>#${ticket.ticket_number}</strong>.</p>
    <p style="margin-top:16px">¿Quieres agregar un comentario? (opcional)</p>
    <form method="post" action="/api/csat">
      <input type="hidden" name="t" value="${ticketId}">
      <input type="hidden" name="s" value="${score}">
      <input type="hidden" name="sig" value="${sig}">
      <textarea name="comment" placeholder="Cuéntanos qué tal fue la atención..."></textarea>
      <button type="submit">Enviar comentario</button>
    </form>`
  return page('Gracias', body)
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const ticketId = String(form.get('t') ?? '')
  const score = Number(form.get('s'))
  const sig = String(form.get('sig') ?? '')
  const comment = String(form.get('comment') ?? '').slice(0, 2000).trim()

  if (!ticketId || !(score >= 1 && score <= 5) || !verifyCsat(ticketId, score, sig)) {
    return page('Enlace inválido', '<h1>Enlace no válido</h1><p>No pudimos validar tu comentario.</p>', 400)
  }

  const supabase = createServiceClient()
  const update: Record<string, unknown> = { satisfaction_score: score }
  if (comment) update.satisfaction_comment = comment
  await supabase.from('tickets').update(update).eq('id', ticketId)

  return page('Gracias', `
    <div style="font-size:44px;margin-bottom:6px">🙌</div>
    <h1>¡Gracias!</h1>
    <p>Tu calificación de <strong style="color:#0B2545">${score}/5</strong>${comment ? ' y tu comentario' : ''} quedaron registrados. Valoramos mucho tu opinión.</p>`)
}
