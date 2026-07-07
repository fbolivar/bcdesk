import { NextRequest, NextResponse } from 'next/server'
import { checkSlaEscalations } from '@/features/admin/services/automation.service'

// Called by Vercel Cron or external scheduler every 15 minutes
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await checkSlaEscalations()
  return NextResponse.json(result)
}
