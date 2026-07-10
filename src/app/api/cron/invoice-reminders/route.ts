import { NextRequest, NextResponse } from 'next/server'
import { runInvoiceReminders } from '@/features/admin/services/invoice-reminders'

// Ejecutar diariamente (Vercel Cron o scheduler externo). Marca vencidas y
// envía recordatorios de pago. Protegido con CRON_SECRET, igual que sla-check.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runInvoiceReminders()
  return NextResponse.json(result)
}
