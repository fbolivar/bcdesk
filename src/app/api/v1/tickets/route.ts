import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

function validateApiKey(req: NextRequest): boolean {
  const key = req.headers.get('x-api-key')
  return Boolean(key && key.trim().length > 0)
}

export async function GET(req: NextRequest) {
  if (!validateApiKey(req)) {
    return Response.json(
      { error: 'No autorizado. Incluye el header x-api-key con tu clave API.' },
      { status: 401 }
    )
  }

  const supabase = createServiceClient()

  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id, subject, status, priority, category, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return Response.json({ error: 'Error al obtener tickets.' }, { status: 500 })
  }

  return Response.json({
    data: tickets,
    meta: { count: tickets?.length ?? 0 },
  })
}

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return Response.json(
      { error: 'No autorizado. Incluye el header x-api-key con tu clave API.' },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'El cuerpo de la solicitud debe ser JSON válido.' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('subject' in body) ||
    typeof (body as Record<string, unknown>).subject !== 'string'
  ) {
    return Response.json({ error: 'El campo "subject" es requerido.' }, { status: 422 })
  }

  const supabase = createServiceClient()
  const payload = body as Record<string, unknown>

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      subject: payload.subject,
      description: typeof payload.description === 'string' ? payload.description : '',
      priority: typeof payload.priority === 'string' ? payload.priority : 'medium',
      category: typeof payload.category === 'string' ? payload.category : 'other',
      status: 'open',
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: 'Error al crear el ticket.' }, { status: 500 })
  }

  return Response.json({ data: ticket }, { status: 201 })
}
