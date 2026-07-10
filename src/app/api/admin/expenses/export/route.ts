import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeProfitability } from '@/features/expenses/report'

/** Exporta el reporte de rentabilidad a CSV (separado por ';' y con BOM,
 *  para que Excel en español lo abra con acentos y columnas correctas). */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const org = url.searchParams.get('org') || undefined
  const from = url.searchParams.get('from') || undefined
  const to = url.searchParams.get('to') || undefined

  const { rows, costNoTicket, totalRev, totalCost } = await computeProfitability(supabase, { org, from, to })

  const esc = (v: string | number) => {
    const s = String(v).replace(/"/g, '""')
    return /[";\n]/.test(s) ? `"${s}"` : s
  }
  const n = (x: number) => Math.round(x) // COP sin decimales
  const lines: string[] = []
  lines.push(['Servicio', 'Cliente', 'Cobrado neto', 'Gastos', 'Margen', '%'].join(';'))
  for (const r of rows) {
    lines.push([
      esc(`${r.number ? `#${r.number} ` : ''}${r.title}`), esc(r.org),
      n(r.revenue), n(r.cost), n(r.margin), r.pct !== null ? Math.round(r.pct) : '',
    ].join(';'))
  }
  if (costNoTicket > 0) {
    lines.push([esc('Gastos sin ticket (visitas/otros)'), '', 0, n(costNoTicket), n(-costNoTicket), ''].join(';'))
  }
  lines.push(['TOTAL', '', n(totalRev), n(totalCost), n(totalRev - totalCost), ''].join(';'))

  const csv = '﻿' + lines.join('\r\n')
  const stamp = (from || 'inicio') + '_' + (to || 'hoy')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rentabilidad_${stamp}.csv"`,
    },
  })
}
