import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSecret } from '@/lib/api/webhook-secret'

// Compatible with Twilio WhatsApp and Meta WhatsApp Business API
export async function POST(req: NextRequest) {
  // Configura el webhook con ?secret=<WHATSAPP_VERIFY_TOKEN> en la URL.
  if (!verifyWebhookSecret(req, 'WHATSAPP_VERIFY_TOKEN')) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const supabase = createServiceClient()
  const contentType = req.headers.get('content-type') ?? ''

  let from = '', body = '', externalId = ''

  if (contentType.includes('application/json')) {
    // Meta WhatsApp Business
    const data = await req.json()
    const entry = data?.entry?.[0]?.changes?.[0]?.value
    const msg = entry?.messages?.[0]
    if (!msg) return NextResponse.json({ ok: true }) // verification ping
    from = msg.from ?? ''
    body = msg.text?.body ?? msg.image?.caption ?? '[media]'
    externalId = msg.id ?? ''
  } else {
    // Twilio
    const formData = await req.formData()
    from = formData.get('From') as string ?? ''
    body = formData.get('Body') as string ?? ''
    externalId = formData.get('MessageSid') as string ?? ''
  }

  if (!from) return NextResponse.json({ ok: false })

  await supabase.from('multichannel_messages').insert({
    channel: 'whatsapp',
    external_id: externalId,
    from_address: from,
    body: body.substring(0, 5000),
    raw_payload: { from, body },
  })

  return NextResponse.json({ ok: true })
}

// Meta webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}
