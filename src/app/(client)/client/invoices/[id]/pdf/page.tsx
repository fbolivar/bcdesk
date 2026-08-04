import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect, notFound } from 'next/navigation'
import type { Invoice, InvoiceItem } from '@/lib/supabase/types'
import { getBrand } from '@/lib/email/branding'
import { InvoiceDocument } from '@/features/invoices/invoice-document'

interface Props { params: Promise<{ id: string }> }

export default async function ClientInvoicePdfPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) redirect('/client/dashboard')

  // Factura del cliente: acotada a SU organización (la RLS ya lo garantiza; el
  // .eq extra deja el intento explícito). invoice_items tiene su propia RLS.
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, organizations(name, legal_name, tax_id, address, phone), invoice_items(*)')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle()
  if (!invoice) notFound()

  // El perfil de facturación (emisor: nombre, banco, declaraciones) es del proveedor,
  // no de la org del cliente → se lee con service_role para que aparezca en el PDF.
  const [{ data: bp }, brand] = await Promise.all([
    createServiceClient().from('billing_profile').select('*').limit(1).maybeSingle(),
    getBrand(),
  ])

  const inv = invoice as Invoice & { organizations?: Record<string, string | null>; invoice_items?: InvoiceItem[]; doc_type?: string | null; doc_type_other?: string | null }

  return (
    <InvoiceDocument
      inv={inv}
      items={inv.invoice_items ?? []}
      billing={(bp ?? {}) as Record<string, string | null>}
      brand={brand}
      backHref={`/client/invoices/${id}`}
    />
  )
}
