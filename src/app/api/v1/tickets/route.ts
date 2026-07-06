import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateOrgToken, unauthorized } from '@/lib/api/org-token'

export async function GET(req: NextRequest) {
  const auth = await validateOrgToken(req)
  if (!auth) return unauthorized()

  const supabase = createServiceClient()
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id, title, status, priority, category, created_at, updated_at')
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ error: 'Error al obtener tickets.' }, { status: 500 })
  return Response.json({ data: tickets, meta: { count: tickets?.length ?? 0 } })
}

export async function POST(req: NextRequest) {
  const auth = await validateOrgToken(req)
  if (!auth) return unauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'El cuerpo de la solicitud debe ser JSON válido.' }, { status: 400 })
  }

  const payload = (body ?? {}) as Record<string, unknown>
  if (typeof payload.title !== 'string' || !payload.title.trim()) {
    return Response.json({ error: 'El campo "title" es requerido.' }, { status: 422 })
  }

  const supabase = createServiceClient()
  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      title: payload.title,
      description: typeof payload.description === 'string' ? payload.description : '',
      priority: typeof payload.priority === 'string' ? payload.priority : 'medium',
      category: typeof payload.category === 'string' ? payload.category : 'other',
      status: 'open',
      organization_id: auth.organizationId,
      source_channel: 'api',
    })
    .select('id, title, status, priority, category, created_at')
    .single()

  if (error) return Response.json({ error: 'Error al crear el ticket.' }, { status: 500 })
  return Response.json({ data: ticket }, { status: 201 })
}
