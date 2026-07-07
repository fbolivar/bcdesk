import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hashOrgToken } from '@/lib/api/org-token-crypto'

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
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

  const supabase = createServiceClient()

  // Validate token and get organization
  const { data: apiToken } = await supabase
    .from('org_api_tokens')
    .select('id, organization_id, is_active')
    .eq('token_hash', await hashOrgToken(token))
    .single()

  if (!apiToken?.is_active) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  // Update last_used_at
  supabase.from('org_api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', apiToken.id).then(() => {})

  const body = await req.json()
  const { name, email, subject, message, category } = body

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'Missing required fields: name, email, subject, message' }, { status: 400 })
  }

  // Get next ticket number
  const { data: lastTicket } = await supabase
    .from('tickets')
    .select('ticket_number')
    .order('ticket_number', { ascending: false })
    .limit(1)
    .single()

  const nextNumber = (lastTicket?.ticket_number ?? 0) + 1

  const { data: ticket, error } = await supabase.from('tickets').insert({
    ticket_number: nextNumber,
    title: subject.substring(0, 200),
    description: `**${name}** (${email})\n\n${message}`.substring(0, 5000),
    status: 'open',
    priority: 'medium',
    category: category ?? 'support',
    source: 'widget',
    requester_email: email,
    organization_id: apiToken.organization_id,
  }).select('id, ticket_number').single()

  if (error) return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })

  return NextResponse.json({ ok: true, ticket_number: ticket.ticket_number }, { status: 201, headers: CORS })
}
