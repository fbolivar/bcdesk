import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildRmmReportPdf, type RmmReport } from '@/features/rmm/rmm-report-pdf'
import { getBrand } from '@/lib/email/branding'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const org = url.searchParams.get('org') || null
  const now = new Date()
  const month = url.searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const pMonth = `${month}-01`

  // rmm_monthly_report es SECURITY DEFINER con guarda de rol; se llama con el
  // cliente RLS (JWT admin) para que get_my_role() resuelva a 'admin'.
  const { data: report, error } = await supabase.rpc('rmm_monthly_report', { p_org: org, p_month: pMonth })
  if (error || !report || !(report as { current?: unknown }).current) {
    return NextResponse.json({ error: 'No se pudo generar el reporte' }, { status: 500 })
  }

  let orgLabel = 'Consolidado (todas las organizaciones)'
  if (org) {
    const { data: o } = await supabase.from('organizations').select('name').eq('id', org).maybeSingle()
    orgLabel = o?.name ?? 'Organización'
  }

  const [y, m] = month.split('-').map(Number)
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  const r = report as unknown as Omit<RmmReport, 'orgLabel' | 'monthLabel'>
  const brand = await getBrand()
  const pdf = await buildRmmReportPdf(brand, { ...r, orgLabel, monthLabel })

  const slug = (org ? orgLabel : 'consolidado').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rmm_${slug}_${month}.pdf"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
