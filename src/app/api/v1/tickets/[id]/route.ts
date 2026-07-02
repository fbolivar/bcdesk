import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

function validateApiKey(req: NextRequest): boolean {
  const key = req.headers.get('x-api-key')
  return Boolean(key && key.trim().length > 0)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateApiKey(req)) {
    return Response.json(
      { error: 'No autorizado. Incluye el header x-api-key con tu clave API.' },
      { status: 401 }
    )
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('id, subject, description, status, priority, category, created_at, updated_at, resolved_at')
    .eq('id', id)
    .single()

  if (error || !ticket) {
    return Response.json({ error: 'Ticket no encontrado.' }, { status: 404 })
  }

  return Response.json({ data: ticket })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateApiKey(req)) {
    return Response.json(
      { error: 'No autorizado. Incluye el header x-api-key con tu clave API.' },
      { status: 401 }
    )
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'El cuerpo de la solicitud debe ser JSON válido.' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'El cuerpo de la solicitud debe ser un objeto JSON.' }, { status: 422 })
  }

  const supabase = createServiceClient()
  const payload = body as Record<string, unknown>

  const allowed = ['subject', 'description', 'status', 'priority', 'category']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in payload) updates[key] = payload[key]
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No se proporcionaron campos válidos para actualizar.' }, { status: 422 })
  }

  const { data: ticket, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error || !ticket) {
    return Response.json({ error: 'Error al actualizar el ticket.' }, { status: 500 })
  }

  return Response.json({ data: ticket })
}
