import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeReportData } from '@/features/reports/data'
import { buildContractReportPdf } from '@/features/contracts/report-pdf'
import { getBrand } from '@/lib/email/branding'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['admin', 'agent'].includes(me.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: contract } = await supabase
    .from('service_contracts')
    .select('*, organizations(name, legal_name, tax_id, address)')
    .eq('id', id).single()
  if (!contract) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const url = new URL(req.url)
  const from = url.searchParams.get('from') || String(contract.start_date).slice(0, 10)
  const to = url.searchParams.get('to') || String(contract.end_date).slice(0, 10)
  const org = contract.organization_id as string

  const [{ data: acts }, { data: bp }, brand, report, { count: visits }] = await Promise.all([
    supabase.from('contract_activities').select('*').eq('contract_id', id)
      .gte('activity_date', from).lte('activity_date', to).order('activity_date'),
    supabase.from('billing_profile').select('*').limit(1).maybeSingle(),
    getBrand(),
    computeReportData(supabase, { from, to, org }),
    supabase.from('technical_visits').select('id', { count: 'exact', head: true })
      .eq('organization_id', org).gte('created_at', from).lte('created_at', to + 'T23:59:59'),
  ])

  const activities = (acts ?? []).map(a => ({
    activity_date: a.activity_date as string, description: a.description as string,
    hours: Number(a.hours ?? 0), obligation: a.obligation as string | null, result: a.result as string | null,
  }))
  const totalHours = activities.reduce((s, a) => s + a.hours, 0)
  const orgRel = (Array.isArray(contract.organizations) ? contract.organizations[0] : contract.organizations) as
    { name: string; legal_name: string | null; tax_id: string | null; address: string | null } | null
  const b = (bp ?? {}) as Record<string, string | null>

  const pdf = await buildContractReportPdf(brand, {
    contract: {
      name: contract.name, contract_type: contract.contract_type,
      start_date: contract.start_date, end_date: contract.end_date,
      included_hours: Number(contract.included_hours ?? 0), notes: contract.notes,
    },
    client: { name: orgRel?.name ?? 'Cliente', legal_name: orgRel?.legal_name, tax_id: orgRel?.tax_id, address: orgRel?.address },
    issuer: { name: b.issuer_name, role: b.issuer_role, cc: b.issuer_cc, cc_city: b.issuer_cc_city, city: b.issuer_city, email: b.issuer_email, phone: b.issuer_phone },
    period: { from, to },
    activities,
    summary: {
      tickets: report.kpis.total, resolved: report.kpis.resolved, slaCompliance: report.kpis.slaCompliance,
      visits: visits ?? 0, totalHours: Math.round(totalHours * 10) / 10,
    },
    generatedAt: to,
  })

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="informe_gestion_${from}_${to}.pdf"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
