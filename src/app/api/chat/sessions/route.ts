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
  const token = req.headers.get('x-widget-token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401, headers: CORS })

  const supabase = createServiceClient()

  const { data: apiToken } = await supabase
    .from('org_api_tokens').select('id, organization_id, is_active').eq('token_hash', await hashOrgToken(token)).single()
  if (!apiToken?.is_active) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS })

  const { visitor_name, visitor_email } = await req.json()
  if (!visitor_name) return NextResponse.json({ error: 'visitor_name required' }, { status: 400, headers: CORS })

  const { data: session, error } = await supabase.from('chat_sessions').insert({
    token_id: apiToken.id,
    visitor_name,
    visitor_email: visitor_email || null,
    status: 'waiting',
  }).select('id').single()

  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500, headers: CORS })

  return NextResponse.json({ session_id: session.id }, { status: 201, headers: CORS })
}
