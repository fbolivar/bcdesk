import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Event Management: ingesta de alertas de monitoreo → incidentes (tickets).
 * Autenticado con token de organización (x-api-key). Deduplica por fingerprint:
 * - status 'firing': crea un incidente nuevo o correlaciona con uno abierto.
 * - status 'resolved': resuelve el incidente abierto asociado.
 *
 * Body JSON:
 * { source?, severity?, host?, metric?, summary, description?, status?, fingerprint? }
 */

const SEVERITY_TO_PRIORITY: Record<string, string> = {
  critical: 'critical', fatal: 'critical', emergency: 'critical',
  high: 'high', error: 'high', major: 'high',
  warning: 'medium', warn: 'medium', minor: 'medium',
  info: 'low', information: 'low', low: 'low',
}

const OPEN_STATUSES = ['open', 'in_progress', 'waiting_client']

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')?.trim()
  if (!apiKey) return Response.json({ error: 'Falta el header x-api-key.' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: token } = await supabase
    .from('org_api_tokens')
    .select('id, organization_id, is_active, created_by')
    .eq('token', apiKey)
    .maybeSingle()

  if (!token || !token.is_active) {
    return Response.json({ error: 'Token inválido o inactivo.' }, { status: 401 })
  }
  if (!token.organization_id) {
    return Response.json({ error: 'El token no está asociado a una organización.' }, { status: 422 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'El cuerpo debe ser JSON válido.' }, { status: 400 })
  }

  const summary = (body.summary as string)?.trim()
  if (!summary) return Response.json({ error: 'summary es obligatorio.' }, { status: 422 })

  const orgId = token.organization_id
  const source = (body.source as string) || 'monitoring'
  const severity = ((body.severity as string) || 'warning').toLowerCase()
  const host = (body.host as string) || null
  const metric = (body.metric as string) || null
  const description = (body.description as string) || null
  const status = (body.status as string) === 'resolved' ? 'resolved' : 'firing'
  const fingerprint = (body.fingerprint as string) || `${source}:${host ?? ''}:${metric ?? summary}`
  const priority = SEVERITY_TO_PRIORITY[severity] ?? 'medium'
  const now = new Date().toISOString()

  // Creador del sistema (los tickets requieren created_by NOT NULL).
  const systemUserId = token.created_by ?? (await (async () => {
    const { data } = await supabase.from('profiles').select('id').eq('role', 'admin').eq('is_active', true).limit(1).maybeSingle()
    return data?.id ?? null
  })())
  if (!systemUserId) {
    return Response.json({ error: 'No hay un administrador para atribuir el incidente.' }, { status: 500 })
  }

  const logEvent = async (action: string, ticketId: string | null) => {
    await supabase.from('monitoring_events').insert({
      organization_id: orgId, source, severity, host, metric, summary, description,
      status, fingerprint, action, ticket_id: ticketId,
    })
    await supabase.from('org_api_tokens').update({ last_used_at: now }).eq('id', token.id)
  }

  const addComment = async (ticketId: string, content: string) => {
    await supabase.from('ticket_comments').insert({
      ticket_id: ticketId, author_id: systemUserId, content, is_internal: true, is_automated: true,
    })
  }

  // Buscar incidente abierto asociado al fingerprint.
  let openTicketId: string | null = null
  const { data: lastEv } = await supabase
    .from('monitoring_events')
    .select('ticket_id')
    .eq('fingerprint', fingerprint).eq('organization_id', orgId)
    .not('ticket_id', 'is', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (lastEv?.ticket_id) {
    const { data: t } = await supabase.from('tickets').select('id, status').eq('id', lastEv.ticket_id).maybeSingle()
    if (t && OPEN_STATUSES.includes(t.status)) openTicketId = t.id
  }

  // ── RESOLVED ──────────────────────────────────────────────
  if (status === 'resolved') {
    if (openTicketId) {
      await supabase.from('tickets').update({ status: 'resolved', resolved_at: now, updated_at: now }).eq('id', openTicketId)
      await addComment(openTicketId, `✅ Alerta resuelta automáticamente por el monitoreo (${source}).`)
      await logEvent('resolved', openTicketId)
      return Response.json({ ok: true, action: 'resolved', ticket_id: openTicketId })
    }
    await logEvent('noop', null)
    return Response.json({ ok: true, action: 'noop', ticket_id: null })
  }

  // ── FIRING: correlacionar ─────────────────────────────────
  if (openTicketId) {
    await addComment(openTicketId, `🔁 La alerta se disparó de nuevo (${severity}). ${summary}`)
    await logEvent('correlated', openTicketId)
    return Response.json({ ok: true, action: 'correlated', ticket_id: openTicketId })
  }

  // ── FIRING: crear incidente ───────────────────────────────
  const title = host ? `[${host}] ${summary}` : summary
  const { data: ticket, error } = await supabase.from('tickets').insert({
    title,
    description: description ?? summary,
    priority,
    category: 'support',
    status: 'open',
    organization_id: orgId,
    created_by: systemUserId,
    source: 'monitoring',
    source_channel: 'api',
    tags: [source, severity, ...(host ? [host] : [])],
  }).select('id').single()

  if (error || !ticket) {
    return Response.json({ error: 'No se pudo crear el incidente.' }, { status: 500 })
  }

  // Vincular al activo por hostname (para análisis de impacto).
  if (host) {
    const { data: asset } = await supabase
      .from('assets').select('id').ilike('name', host).eq('organization_id', orgId).maybeSingle()
    if (asset) await supabase.from('ticket_assets').insert({ ticket_id: ticket.id, asset_id: asset.id })
  }

  await logEvent('created', ticket.id)
  return Response.json({ ok: true, action: 'created', ticket_id: ticket.id })
}
