import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeReportData, defaultRange } from '@/features/reports/data'
import ExcelJS from 'exceljs'

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
  const org = url.searchParams.get('org') || undefined
  const d = await computeReportData(supabase, { from, to, org })
  const k = d.kpis

  const wb = new ExcelJS.Workbook()
  wb.creator = 'HexDesk'
  const NAVY = 'FF0B2545'

  const addSheet = (name: string, headers: string[], rows: (string | number | null)[][], moneyCols: number[] = []) => {
    const ws = wb.addWorksheet(name)
    ws.addRow(headers)
    const head = ws.getRow(1)
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    head.alignment = { vertical: 'middle' }
    rows.forEach(r => ws.addRow(r))
    headers.forEach((h, i) => {
      const col = ws.getColumn(i + 1)
      let max = h.length
      rows.forEach(r => { const v = r[i]; if (v != null) max = Math.max(max, String(v).length) })
      col.width = Math.min(42, max + 4)
      if (moneyCols.includes(i)) col.numFmt = '#,##0'
    })
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    return ws
  }

  addSheet('Resumen', ['Indicador', 'Valor'], [
    ['Periodo', `${from} a ${to}`],
    ['Tickets (total)', k.total], ['Abiertos', k.open], ['Resueltos', k.resolved],
    ['SLA cumplimiento (%)', k.slaCompliance], ['Resolución promedio (h)', k.avgResolutionHrs],
    ['1ª respuesta promedio (min)', k.avgFirstRespMin], ['CSAT promedio', k.avgCsat],
    ['Ingreso neto (COP)', k.netRevenue], ['Gastos (COP)', k.totalExpenses], ['Margen (COP)', k.margin],
    ['Margen (%)', k.marginPct ?? ''],
  ])
  addSheet('Tendencia', ['Mes', 'Creados', 'Resueltos'], d.monthly.map(m => [m.month, m.creados, m.resueltos]))
  addSheet('Finanzas', ['Mes', 'Ingresos', 'Gastos', 'Margen'], d.financeMonthly.map(m => [m.month, m.ingresos, m.gastos, m.margen]), [1, 2, 3])
  addSheet('Por estado', ['Estado', 'Cantidad'], d.byStatus.map(s => [s.label, s.count]))
  addSheet('Por prioridad', ['Prioridad', 'Cantidad'], d.byPriority.map(p => [p.label, p.count]))
  addSheet('Por categoría', ['Categoría', 'Cantidad'], d.byCategory.map(c => [c.name, c.value]))
  addSheet('Top clientes', ['Cliente', 'Ingreso neto', 'Tickets'], d.topClients.map(c => [c.name, c.revenue, c.tickets]), [1])
  addSheet('Agentes', ['Agente', 'Asignados', 'Cerrados', 'Tasa cierre (%)', 'CSAT', '1ª resp (min)'],
    d.agents.map(a => [a.name, a.total, a.closed, a.closeRate, a.avgCsat !== null ? Math.round(a.avgCsat * 10) / 10 : '', a.avgFirstRespMin ?? '']))

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reporte_${from}_${to}.xlsx"`,
    },
  })
}
