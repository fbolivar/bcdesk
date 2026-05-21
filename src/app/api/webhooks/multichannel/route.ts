import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

// Generic multichannel webhook: POST { channel, from_address, from_name?, subject?, body, external_id? }
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const data = await req.json()

  const { channel, from_address, from_name, subject, body, external_id } = data

  if (!channel || !from_address || !body) {
    return NextResponse.json({ error: 'Missing channel, from_address or body' }, { status: 400 })
  }

  const validChannels = ['email', 'whatsapp', 'twitter', 'instagram', 'sms', 'telegram']
  if (!validChannels.includes(channel)) {
    return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
  }

  await supabase.from('multichannel_messages').insert({
    channel,
    external_id: external_id ?? null,
    from_address,
    from_name: from_name ?? null,
    subject: subject ?? null,
    body: String(body).substring(0, 10000),
    raw_payload: data,
  })

  return NextResponse.json({ ok: true })
}
