import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface SubscribeBody {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  userAgent?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as SubscribeBody

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: body.endpoint,
    p256dh: body.keys?.p256dh,
    auth: body.keys?.auth,
    user_agent: body.userAgent ?? null,
  }, { onConflict: 'endpoint' })

  if (error) { console.error('[push/subscribe]', error.message); return NextResponse.json({ error: 'No se pudo suscribir' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json() as { endpoint: string }
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
