import { createServiceClient } from '@/lib/supabase/service'
import { sendInvoiceReminderEmail } from '@/lib/email/ticket-emails'
import { formatMoney } from '@/lib/format/currency'
import { fmtDateOnly } from '@/lib/date'

/** Marca como vencidas las cuentas de cobro pasadas de fecha y envía un
 *  recordatorio de pago al cliente (sin reenviar si ya se recordó en <3 días).
 *  Pensado para ejecutarse desde el cron. Usa service client (sin sesión). */
export async function runInvoiceReminders() {
  const supabase = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_usd, currency, due_date, status, organization_id, reminder_sent_at, organizations(name)')
    .in('status', ['sent', 'overdue'])
    .lt('due_date', today)

  let reminded = 0
  for (const inv of invoices ?? []) {
    if (inv.status === 'sent') {
      await supabase.from('invoices').update({ status: 'overdue' }).eq('id', inv.id)
    }
    if (inv.reminder_sent_at && inv.reminder_sent_at > threeDaysAgo) continue

    const { data: clients } = await supabase
      .from('profiles').select('email')
      .eq('organization_id', inv.organization_id).eq('role', 'client').eq('is_active', true)
    const recipients = (clients ?? []).map(c => c.email as string).filter(Boolean)
    if (!recipients.length) continue

    const org = (Array.isArray(inv.organizations) ? inv.organizations[0] : inv.organizations) as { name?: string } | null
    const days = Math.floor((Date.parse(today) - Date.parse(String(inv.due_date))) / (24 * 3600 * 1000))

    await sendInvoiceReminderEmail({
      to: recipients.join(', '), orgName: org?.name,
      invoiceNumber: inv.invoice_number, amount: formatMoney(inv.total_usd, inv.currency),
      dueDate: fmtDateOnly(inv.due_date), invoiceId: inv.id, daysOverdue: days,
    }).catch(() => {})
    await supabase.from('invoices').update({ reminder_sent_at: new Date().toISOString() }).eq('id', inv.id)
    reminded++
  }
  return { checked: invoices?.length ?? 0, reminded }
}
