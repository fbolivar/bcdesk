import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY no está configurado')
  return new Stripe(key)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const invoiceId = session.metadata?.invoice_id

    if (invoiceId && session.payment_status === 'paid') {
      const supabase = createServiceClient()
      await supabase.from('invoices').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: 'stripe',
        payment_reference: session.payment_intent as string,
      }).eq('id', invoiceId)
    }
  }

  return NextResponse.json({ received: true })
}
