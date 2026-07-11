'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function generateInvoiceFromContract(contractId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') throw new Error('Sin permiso')

  const { data: contract } = await supabase
    .from('service_contracts')
    .select('*, organizations(id, name)')
    .eq('id', contractId)
    .single()

  if (!contract) throw new Error('Contract not found')

  const org = Array.isArray(contract.organizations) ? contract.organizations[0] : contract.organizations

  // Get un-billed time logs for this org
  const { data: timeLogs } = await supabase
    .from('time_logs')
    .select('*, tickets(title)')
    .eq('billed', false)
    .in('ticket_id', (
      await supabase
        .from('tickets')
        .select('id')
        .eq('organization_id', org?.id)
        .then(r => r.data?.map(t => t.id) ?? [])
    ))

  const logs = timeLogs ?? []
  if (logs.length === 0) return { error: 'No hay horas sin facturar para esta organización' }

  const totalMinutes = logs.reduce((sum: number, l: { minutes: number }) => sum + (l.minutes ?? 0), 0)
  const totalHours = totalMinutes / 60
  const hourlyRate = 150000 // COP por hora — ajustable al editar la cuenta de cobro

  // Ítems: una línea por entrada de tiempo (horas x tarifa).
  const items = logs.map((l: { tickets?: unknown; minutes: number }) => {
    const ticket = Array.isArray(l.tickets) ? l.tickets[0] : l.tickets
    const qty = Math.round((l.minutes / 60) * 100) / 100
    return {
      description: `Soporte: ${(ticket as { title?: string })?.title ?? 'Actividad de soporte'}`,
      quantity: qty,
      unit_price_usd: hourlyRate,
      total_usd: Math.round(qty * hourlyRate),
    }
  })
  const subtotal = items.reduce((s, it) => s + it.total_usd, 0)

  // Número atómico y único; cuenta de cobro (sin IVA por defecto, ajustable).
  const year = new Date().getFullYear()
  const { data: numData, error: numErr } = await supabase.rpc('next_doc_number', { p_prefix: 'BC', p_year: year })
  if (numErr || !numData) return { error: 'No se pudo generar el número de factura' }
  const invoiceNumber = numData as string
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  const { data: invoice, error } = await supabase.from('invoices').insert({
    invoice_number: invoiceNumber,
    organization_id: org?.id,
    created_by: user.id,
    status: 'draft',
    doc_type: 'cuenta_cobro',
    currency: 'COP',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    subtotal_usd: subtotal,
    tax_percent: 0,
    tax_usd: 0,
    total_usd: subtotal,
    notes: `Generada desde el contrato "${contract.name}": ${logs.length} entradas de tiempo, ${totalHours.toFixed(2)} horas.`,
  }).select('id').single()

  if (error) return { error: error.message }

  await supabase.from('invoice_items').insert(items.map(it => ({ invoice_id: invoice.id, ...it })))

  // Mark logs as billed
  await supabase
    .from('time_logs')
    .update({ billed: true })
    .in('id', logs.map((l: { id: string }) => l.id))

  // Update used_hours on contract
  await supabase
    .from('service_contracts')
    .update({ used_hours: (contract.used_hours ?? 0) + totalHours })
    .eq('id', contractId)

  revalidatePath('/admin/contracts')
  revalidatePath('/admin/invoices')

  return { invoiceId: invoice.id, totalHours, itemCount: logs.length }
}
