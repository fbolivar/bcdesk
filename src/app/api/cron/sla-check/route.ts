import { NextRequest, NextResponse } from 'next/server'
import { checkSlaEscalations } from '@/features/admin/services/automation.service'

// Único sistema de SLA de la app. Lo dispara Vercel Cron cada 10 minutos
// (ver vercel.json); Vercel inyecta el CRON_SECRET automáticamente.
//
// Antes corría una vez al día y convivía con un cron en la BD
// (run_sla_escalations, cada 5 min) que usaba otras columnas: avisos duplicados
// por canales distintos y estado inconsistente. Ese job se eliminó; la lógica
// completa (campanita + push + correo) vive aquí.
//
// Es idempotente: sla_alert_sent_at / sla_breach_notified_at evitan repetir el
// aviso aunque se ejecute cada 10 minutos.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await checkSlaEscalations()
  return NextResponse.json(result)
}
