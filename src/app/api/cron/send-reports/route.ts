import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

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

  if (!reports?.length) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0

  for (const report of reports) {
    const data = await buildReportData(supabase, report)
    await sendReportEmail(report, data)

    const nextSend = new Date()
    if (report.frequency === 'daily') nextSend.setDate(nextSend.getDate() + 1)
    else if (report.frequency === 'weekly') nextSend.setDate(nextSend.getDate() + 7)
    else nextSend.setMonth(nextSend.getMonth() + 1)

    await supabase.from('scheduled_reports').update({
      last_sent_at: now.toISOString(),
      next_send_at: nextSend.toISOString(),
    }).eq('id', report.id)

    sent++
  }

  return NextResponse.json({ sent })
}

async function buildReportData(supabase: ReturnType<typeof createServiceClient>, report: Record<string, unknown>) {
  const from = new Date()
  const freq = report.frequency as string
  if (freq === 'daily') from.setDate(from.getDate() - 1)
  else if (freq === 'weekly') from.setDate(from.getDate() - 7)
  else from.setMonth(from.getMonth() - 1)

  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, status, priority, created_at, resolved_at')
    .gte('created_at', from.toISOString())

  const list = tickets ?? []
  const open = list.filter(t => t.status === 'open').length
  const resolved = list.filter(t => t.status === 'resolved').length
  const urgent = list.filter(t => t.priority === 'urgent').length

  return { total: list.length, open, resolved, urgent, from: from.toLocaleDateString('es-CO') }
}

async function sendReportEmail(report: Record<string, unknown>, data: Record<string, unknown>) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const recipients = report.recipients as string[]
  const freq = report.frequency as string
  const freqLabel: Record<string, string> = { daily: 'diario', weekly: 'semanal', monthly: 'mensual' }

  const html = `
    <h2>Reporte ${freqLabel[freq] ?? freq} — ${report.name}</h2>
    <p>Período desde: ${data.from}</p>
    <table border="1" cellpadding="8" style="border-collapse:collapse;margin-top:16px">
      <tr><th>Total tickets</th><th>Abiertos</th><th>Resueltos</th><th>Urgentes</th></tr>
      <tr><td>${data.total}</td><td>${data.open}</td><td>${data.resolved}</td><td>${data.urgent}</td></tr>
    </table>
    <p style="margin-top:16px;color:#5B6B7C;font-size:12px">Este reporte fue generado automáticamente por HexDesk.</p>
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'HexDesk <noreply@bcfabric.co>',
      to: recipients,
      subject: `[HexDesk] Reporte ${freqLabel[freq] ?? freq}: ${report.name}`,
      html,
    }),
  }).catch(() => {})
}
