import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateOrgToken, unauthorized } from '@/lib/api/org-token'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateOrgToken(req)
  if (!auth) return unauthorized()

  const { id } = await params
  const supabase = createServiceClient()
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('id, ticket_number, title, description, status, priority, category, requester_email, external_ref, created_at, updated_at, resolved_at')
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .single()

  if (error || !ticket) return Response.json({ error: 'Ticket no encontrado.' }, { status: 404 })
  return Response.json({ data: ticket })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateOrgToken(req)
  if (!auth) return unauthorized()

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'El cuerpo de la solicitud debe ser JSON válido.' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'El cuerpo debe ser un objeto JSON.' }, { status: 422 })
  }

  const supabase = createServiceClient()
  const payload = body as Record<string, unknown>
  const allowed = ['title', 'description', 'status', 'priority', 'category', 'external_ref']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) if (key in payload) updates[key] = payload[key]

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No se proporcionaron campos válidos para actualizar.' }, { status: 422 })
  }

  const { data: ticket, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .select('id, ticket_number, title, status, priority, category, external_ref, updated_at, resolved_at')
    .single()

  if (error || !ticket) return Response.json({ error: 'Error al actualizar el ticket.' }, { status: 500 })
  return Response.json({ data: ticket })
}
