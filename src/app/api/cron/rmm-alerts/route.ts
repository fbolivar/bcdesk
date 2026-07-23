import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runRmmAlerts } from '@/lib/rmm/run-alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// La lógica vive en runRmmAlerts() para poder ejecutar el MISMO código path
// desde pruebas sin exponer el CRON_SECRET. El route solo autentica.
async function run(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runRmmAlerts(createServiceClient())
  return NextResponse.json(result)
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
