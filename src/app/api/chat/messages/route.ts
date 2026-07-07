import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hashOrgToken } from '@/lib/api/org-token-crypto'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-widget-token',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/** Valida el widget-token y que la sesión pertenezca a ese token. */
async function authorizeSession(
  supabase: ReturnType<typeof createServiceClient>,
  token: string | null,
  sessionId: string | null,
) {
  if (!token || !sessionId) return null
  const { data: apiToken } = await supabase
    .from('org_api_tokens').select('id, is_active').eq('token_hash', await hashOrgToken(token)).single()
  if (!apiToken?.is_active) return null
  const { data: session } = await supabase
    .from('chat_sessions').select('id, token_id, status').eq('id', sessionId).single()
  if (!session || session.token_id !== apiToken.id) return null
  return session
}

// Enviar un mensaje del visitante.
export async function POST(req: NextRequest) {
  const token = req.headers.get('x-widget-token')
  const supabase = createServiceClient()

  const { session_id, content } = await req.json()
  if (!session_id || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: CORS })

  const session = await authorizeSession(supabase, token, session_id)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  if (session.status === 'closed') return NextResponse.json({ error: 'Chat cerrado' }, { status: 409, headers: CORS })

  const clean = String(content).slice(0, 2000)
  const { data: msg, error } = await supabase.from('chat_messages').insert({
    session_id, content: clean, sender_type: 'visitor',
  }).select('id, created_at').single()

  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500, headers: CORS })

  return NextResponse.json({ id: msg.id, created_at: msg.created_at }, { status: 201, headers: CORS })
}

// Sondeo del visitante: mensajes nuevos + estado de la sesión (reemplaza el Realtime anon).
export async function GET(req: NextRequest) {
  const token = req.headers.get('x-widget-token')
  const sessionId = req.nextUrl.searchParams.get('session_id')
  const after = req.nextUrl.searchParams.get('after')
  const supabase = createServiceClient()

  const session = await authorizeSession(supabase, token, sessionId)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })

  let query = supabase
    .from('chat_messages')
    .select('id, content, sender_type, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(100)
  if (after) query = query.gt('created_at', after)

  const { data: messages } = await query

  return NextResponse.json(
    { messages: messages ?? [], status: session.status },
    { status: 200, headers: CORS },
  )
}
