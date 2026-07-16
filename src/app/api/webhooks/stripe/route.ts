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
      // Monto realmente recibido: Stripe lo da en centavos (COP incluido).
      const received = typeof session.amount_total === 'number' ? session.amount_total / 100 : null

      const { error } = await supabase.from('invoices').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: 'stripe',
        payment_reference: session.payment_intent as string,
        ...(received != null ? { amount_received: received } : {}),
      }).eq('id', invoiceId)

      // NO devolver 200 si no se pudo registrar el pago: con 200 Stripe da el
      // evento por entregado y NUNCA reintenta, así que la cuenta quedaría sin
      // marcar como pagada para siempre y el cliente seguiría recibiendo
      // recordatorios de mora habiendo pagado ya. Con 500, Stripe reintenta.
      if (error) {
        console.error('[stripe] no se pudo marcar la factura como pagada', { invoiceId, error: error.message })
        return NextResponse.json({ error: 'No se pudo registrar el pago' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}
