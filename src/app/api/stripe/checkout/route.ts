import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY no está configurado')
  return new Stripe(key)
}

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

  // Monedas que Stripe trata como CERO decimales (el monto va sin x100).
  // COP NO está aquí: Stripe lo maneja con 2 decimales, así que sí lleva x100.
  const STRIPE_ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'])
  const currency = (inv.currency ?? 'usd').toLowerCase()
  const minor = STRIPE_ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100
  const toAmount = (n: number) => Math.round(n * minor)

  const lineItems = inv.invoice_items?.length
    ? inv.invoice_items.map((item: { description: string; quantity: number; unit_price_usd: number }) => ({
        price_data: {
          currency,
          product_data: { name: item.description },
          unit_amount: toAmount(item.unit_price_usd),
        },
        quantity: item.quantity,
      }))
    : [{
        price_data: {
          currency,
          product_data: { name: `Factura ${inv.invoice_number}` },
          unit_amount: toAmount(inv.total_usd),
        },
        quantity: 1,
      }]

  const session = await getStripe().checkout.sessions.create({
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
