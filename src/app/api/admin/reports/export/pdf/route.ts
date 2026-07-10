import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeReportData, defaultRange } from '@/features/reports/data'
import { buildReportPdf } from '@/features/reports/pdf'
import { getBrand } from '@/lib/email/branding'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const def = defaultRange()
  const from = url.searchParams.get('from') || def.from
  const to = url.searchParams.get('to') || def.to

  const [data, brand] = await Promise.all([
    computeReportData(supabase, { from, to }),
    getBrand(),
  ])
  const pdf = await buildReportPdf(brand, data)

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte_${from}_${to}.pdf"`,
    },
  })
}
