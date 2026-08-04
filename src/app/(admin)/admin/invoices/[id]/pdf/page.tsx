import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { Invoice, InvoiceItem } from '@/lib/supabase/types'
import { getBrand } from '@/lib/email/branding'
import { InvoiceDocument } from '@/features/invoices/invoice-document'

interface Props { params: Promise<{ id: string }> }

export default async function InvoicePdfPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const [{ data: invoice }, { data: bp }, brand] = await Promise.all([
    supabase.from('invoices').select('*, organizations(*), invoice_items(*)').eq('id', id).single(),
    supabase.from('billing_profile').select('*').limit(1).maybeSingle(),
    getBrand(),
  ])
  if (!invoice) notFound()

  const inv = invoice as Invoice & { organizations?: Record<string, string | null>; invoice_items?: InvoiceItem[]; doc_type?: string | null; doc_type_other?: string | null }

  return (
    <InvoiceDocument
      inv={inv}
      items={inv.invoice_items ?? []}
      billing={(bp ?? {}) as Record<string, string | null>}
      brand={brand}
      backHref={`/admin/invoices/${id}`}
    />
  )
}
