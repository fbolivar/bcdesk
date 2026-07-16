import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hashOrgToken } from '@/lib/api/org-token-crypto'
import { computeSla } from '@/lib/tickets/sla'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-widget-token',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  // Solo por header (no por query string: acabaría en logs/referrer).
  const token = req.headers.get('x-widget-token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401, headers: CORS })

  const supabase = createServiceClient()

  // Validate token and get organization
  const { data: apiToken } = await supabase
    .from('org_api_tokens')
    .select('id, organization_id, is_active')
    .eq('token_hash', await hashOrgToken(token))
    .single()

  if (!apiToken?.is_active) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS })

  // Update last_used_at
  supabase.from('org_api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', apiToken.id).then(() => {})

  const body = await req.json()
  const { name, email, subject, message, category } = body

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'Missing required fields: name, email, subject, message' }, { status: 400, headers: CORS })
  }

  // created_by es NOT NULL y antes no se enviaba: el insert fallaba SIEMPRE, así
  // que el widget nunca creó un solo ticket. Quien escribe desde un sitio
  // externo no suele tener perfil, así que se atribuye al suyo si existe y, si
  // no, a un admin activo (mismo criterio que el correo entrante).
  const { data: senderProfile } = await supabase
    .from('profiles').select('id').eq('email', email).maybeSingle()

  let createdBy = senderProfile?.id ?? null
  if (!createdBy) {
    const { data: admin } = await supabase
      .from('profiles').select('id')
      .eq('role', 'admin').eq('is_active', true)
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
    createdBy = admin?.id ?? null
  }
  if (!createdBy) {
    return NextResponse.json({ error: 'No hay un autor por defecto' }, { status: 500, headers: CORS })
  }

  // SLA por prioridad, igual que en el resto de la app.
  const sla = await computeSla(supabase, 'medium')

  // ticket_number NO se calcula a mano: la columna tiene default nextval(...).
  // Hacerlo con max()+1 abría una colisión si entraban dos tickets a la vez.
  const { data: ticket, error } = await supabase.from('tickets').insert({
    title: subject.substring(0, 200),
    description: `**${name}** (${email})\n\n${message}`.substring(0, 5000),
    status: 'open',
    priority: 'medium',
    category: category ?? 'support',
    source: 'widget',
    source_channel: 'widget',
    requester_email: email,
    organization_id: apiToken.organization_id,
    created_by: createdBy,
    ...sla,
  }).select('id, ticket_number').single()

  if (error) {
    console.error('[widget] no se pudo crear el ticket', error.message)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500, headers: CORS })
  }

  return NextResponse.json({ ok: true, ticket_number: ticket.ticket_number }, { status: 201, headers: CORS })
}
