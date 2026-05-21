import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

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

  // Validate token
  const { data: apiToken } = await supabase
    .from('org_api_tokens').select('id, is_active').eq('token', token).single()
  if (!apiToken?.is_active) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS })

  const { session_id, content } = await req.json()
  if (!session_id || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: CORS })

  const { data: msg, error } = await supabase.from('chat_messages').insert({
    session_id, content, sender_type: 'visitor',
  }).select('id, created_at').single()

  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500, headers: CORS })

  return NextResponse.json({ id: msg.id, created_at: msg.created_at }, { status: 201, headers: CORS })
}
