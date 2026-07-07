import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateOrgToken, unauthorized } from '@/lib/api/org-token'

const PRIORITIES = ['low', 'medium', 'high', 'critical']
const CATEGORIES = ['hardware', 'software', 'network', 'access', 'email', 'security', 'application', 'service_request', 'support', 'other', 'development', 'billing', 'onboarding']

export async function GET(req: NextRequest) {
  const auth = await validateOrgToken(req)
  if (!auth) return unauthorized()

  const supabase = createServiceClient()
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id, ticket_number, title, status, priority, category, requester_email, external_ref, created_at, updated_at, resolved_at')
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

  const p = (body ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

  const title = str(p.title)
  if (!title) return Response.json({ error: 'El campo "title" es requerido.' }, { status: 422 })

  const priority = PRIORITIES.includes(str(p.priority)) ? str(p.priority) : 'medium'
  const category = CATEGORIES.includes(str(p.category)) ? str(p.category) : 'other'
  const requesterEmail = str(p.requester_email) || str(p.email) || null
  const externalRef = str(p.external_ref) || str(p.external_id) || null

  const supabase = createServiceClient()

  // created_by es NOT NULL: se atribuye al staff que creó el token de integración
  // (fallback: cualquier admin activo). El solicitante real va en requester_email.
  let createdBy = auth.createdBy
  if (!createdBy) {
    const { data: admin } = await supabase.from('profiles').select('id').eq('role', 'admin').eq('is_active', true).limit(1).maybeSingle()
    createdBy = admin?.id ?? null
  }
  if (!createdBy) return Response.json({ error: 'No hay un usuario para atribuir el ticket.' }, { status: 500 })

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      title,
      description: str(p.description),
      priority,
      category,
      status: 'open',
      organization_id: auth.organizationId,
      created_by: createdBy,
      requester_email: requesterEmail,
      external_ref: externalRef,
      source: 'api',
      source_channel: 'api',
    })
    .select('id, ticket_number, title, status, priority, category, requester_email, external_ref, created_at')
    .single()

  if (error) return Response.json({ error: 'Error al crear el ticket.' }, { status: 500 })
  return Response.json({ data: ticket }, { status: 201 })
}
