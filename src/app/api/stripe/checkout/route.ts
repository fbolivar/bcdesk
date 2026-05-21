import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2025-04-30.basil' })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { invoiceId } = await req.json()
  if (!invoiceId) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 })

  const { data: inv } = await supabase
    .from('invoices')
    .select('*, organizations(*), invoice_items(*)')
    .eq('id', invoiceId)
    .single()

  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (inv.status === 'paid') return NextResponse.json({ error: 'Already paid' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const lineItems = inv.invoice_items?.length
    ? inv.invoice_items.map((item: { description: string; quantity: number; unit_price_usd: number }) => ({
        price_data: {
          currency: (inv.currency ?? 'usd').toLowerCase(),
          product_data: { name: item.description },
          unit_amount: Math.round(item.unit_price_usd * 100),
        },
        quantity: item.quantity,
      }))
    : [{
        price_data: {
          currency: (inv.currency ?? 'usd').toLowerCase(),
          product_data: { name: `Factura ${inv.invoice_number}` },
          unit_amount: Math.round(inv.total_usd * 100),
        },
        quantity: 1,
      }]

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    success_url: `${appUrl}/client/invoices?paid=1`,
    cancel_url: `${appUrl}/client/invoices`,
    metadata: { invoice_id: invoiceId },
    customer_email: user.email,
  })

  // Save session URL so it can be reopened later
  await supabase.from('invoices').update({
    stripe_payment_url: session.url,
    stripe_session_id: session.id,
  }).eq('id', invoiceId)

  return NextResponse.json({ url: session.url })
}
