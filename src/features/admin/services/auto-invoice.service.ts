'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function generateInvoiceFromContract(contractId: string) {
  const supabase = await createClient()

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
  const hourlyRate = 150000 // COP per hour — could be configurable per contract

  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  const { data: invoice, error } = await supabase.from('invoices').insert({
    invoice_number: invoiceNumber,
    organization_id: org?.id,
    status: 'draft',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    subtotal: totalHours * hourlyRate,
    tax_rate: 19,
    tax_amount: totalHours * hourlyRate * 0.19,
    total: totalHours * hourlyRate * 1.19,
    notes: `Factura generada automáticamente desde contrato: ${contract.name}. ${logs.length} entradas de tiempo. ${totalHours.toFixed(2)} horas totales.`,
    items: logs.map((l: { tickets?: unknown; minutes: number }) => {
      const ticket = Array.isArray(l.tickets) ? l.tickets[0] : l.tickets
      return {
        description: `Soporte: ${(ticket as { title?: string })?.title ?? 'Ticket sin título'}`,
        quantity: (l.minutes / 60).toFixed(2),
        unit: 'horas',
        unit_price: hourlyRate,
        total: (l.minutes / 60) * hourlyRate,
      }
    }),
  }).select('id').single()

  if (error) return { error: error.message }

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
