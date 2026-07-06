import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

type InboundEmailPayload = {
  from: string
  subject: string
  text?: string
  html?: string
  to?: string
}

type ProfileRow = {
  id: string
  organization_id: string | null
}

function parseFromEmail(from: string): { email: string; name: string } {
  const match = from.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() }
  }
  return { name: from.trim(), email: from.trim() }
}

export async function POST(req: NextRequest) {
  // Fail-closed: sin EMAIL_INBOUND_SECRET configurado o sin coincidir, se rechaza.
  const secret = process.env.EMAIL_INBOUND_SECRET?.trim()
  const provided = req.headers.get('x-webhook-secret')
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  let payload: InboundEmailPayload
  try {
    payload = (await req.json()) as InboundEmailPayload
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { from, subject, text, html } = payload

  if (!from || !subject) {
    return NextResponse.json({ ok: false, error: 'Missing required fields: from, subject' }, { status: 400 })
  }

  const { email: fromEmail } = parseFromEmail(from)
  const body = text ?? html ?? ''
  const cleanSubject = subject.replace(/^(Re:|Fwd?:)\s*/gi, '').trim() || 'Consulta por email'

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id')
    .eq('email', fromEmail)
    .maybeSingle() as { data: ProfileRow | null }

  const description = profile
    ? body.substring(0, 5000)
    : `De: ${fromEmail}\n\n${body.substring(0, 5000)}`

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      title: cleanSubject.substring(0, 200),
      description,
      status: 'open',
      priority: 'medium',
      category: 'support',
      source_channel: 'email',
      created_by: profile?.id ?? null,
      organization_id: profile?.organization_id ?? null,
    })
    .select('id, ticket_number, title, status, created_at')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ticket })
}
