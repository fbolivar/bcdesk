import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail, mailConfigured } from '@/lib/email/mailer'
import { getBrand } from '@/lib/email/branding'
import { computeReportData } from '@/features/reports/data'
import { buildReportPdf } from '@/features/reports/pdf'
import { formatMoney } from '@/lib/format/currency'

export const runtime = 'nodejs'

const FREQ_LABEL: Record<string, string> = { daily: 'diario', weekly: 'semanal', monthly: 'mensual' }

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()

  const { data: reports } = await supabase
    .from('scheduled_reports')
    .select('*')
    .eq('is_active', true)
    .lte('next_send_at', now.toISOString())

  if (!reports?.length) return NextResponse.json({ sent: 0 })

  const brand = await getBrand()
  let sent = 0

  for (const report of reports) {
    try {
      const freq = report.frequency as string
      const fromD = new Date()
      if (freq === 'daily') fromD.setDate(fromD.getDate() - 1)
      else if (freq === 'weekly') fromD.setDate(fromD.getDate() - 7)
      else fromD.setMonth(fromD.getMonth() - 1)
      const from = fromD.toISOString().slice(0, 10)
      const to = now.toISOString().slice(0, 10)

      const recipients = ((report.recipients as string[] | null) ?? []).filter(Boolean)
      if (recipients.length && mailConfigured()) {
        const data = await computeReportData(
          supabase as unknown as Parameters<typeof computeReportData>[0],
          { from, to, org: (report.organization_id as string) || undefined },
        )
        const pdf = await buildReportPdf(brand, data)
        const k = data.kpis
        const html = `
          <div style="font-family:system-ui,sans-serif;color:#0B2545">
            <h2 style="margin:0 0 4px">Reporte ${FREQ_LABEL[freq] ?? freq} — ${report.name}</h2>
            <p style="color:#5B6B7C;margin:0 0 16px">${data.orgLabel} · ${from} a ${to}</p>
            <table cellpadding="8" style="border-collapse:collapse;font-size:13px">
              <tr>
                <td style="background:#F4F7FB;border:1px solid #E6EBF2"><b>Tickets</b><br>${k.total}</td>
                <td style="background:#F4F7FB;border:1px solid #E6EBF2"><b>Resueltos</b><br>${k.resolved}</td>
                <td style="background:#F4F7FB;border:1px solid #E6EBF2"><b>SLA</b><br>${k.slaCompliance}%</td>
                <td style="background:#F4F7FB;border:1px solid #E6EBF2"><b>Ingreso neto</b><br>${formatMoney(k.netRevenue, 'COP')}</td>
                <td style="background:#F4F7FB;border:1px solid #E6EBF2"><b>Margen</b><br>${formatMoney(k.margin, 'COP')}</td>
              </tr>
            </table>
            <p style="color:#5B6B7C;font-size:12px;margin-top:16px">Reporte completo adjunto en PDF. Generado automáticamente por ${brand.name}.</p>
          </div>`
        await sendEmail({
          to: recipients.join(', '),
          subject: `[${brand.name}] Reporte ${FREQ_LABEL[freq] ?? freq}: ${report.name}`,
          html,
          attachments: [{ filename: `reporte_${from}_${to}.pdf`, content: pdf, contentType: 'application/pdf' }],
        }).catch(() => {})
        sent++
      }
    } catch { /* un reporte que falle no bloquea a los demás */ }

    const nextSend = new Date()
    if (report.frequency === 'daily') nextSend.setDate(nextSend.getDate() + 1)
    else if (report.frequency === 'weekly') nextSend.setDate(nextSend.getDate() + 7)
    else nextSend.setMonth(nextSend.getMonth() + 1)
    await supabase.from('scheduled_reports').update({
      last_sent_at: now.toISOString(), next_send_at: nextSend.toISOString(),
    }).eq('id', report.id)
  }

  return NextResponse.json({ sent })
}
