import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(_req: NextRequest) {
  const supabase = createServiceClient()

  // Datos históricos: tickets por día, últimas 4 semanas
  const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
  const { data: tickets } = await supabase
    .from('tickets')
    .select('created_at')
    .gte('created_at', since)

  if (!tickets || tickets.length === 0) {
    return Response.json({ prediction: null, message: 'Datos insuficientes' })
  }

  // Agrupar por día de la semana (0=Dom...6=Sab)
  const byDow: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  tickets.forEach(t => {
    const dow = new Date(t.created_at).getDay()
    byDow[dow].push(1)
  })

  // Promedio por día de la semana
  const avgByDow = Object.fromEntries(
    Object.entries(byDow).map(([dow, vals]) => [dow, vals.length > 0 ? Math.round(vals.length / 4) : 0])
  )

  // Predicción próximos 7 días
  const predictions = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000)
    const dow = date.getDay()
    return {
      date: date.toISOString().split('T')[0],
      day: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dow],
      predicted: avgByDow[dow] ?? 0,
    }
  })

  const total = predictions.reduce((s, p) => s + p.predicted, 0)
  const weeklyAvg = tickets.length / 4
  const trend = total > weeklyAvg ? 'up' : total < weeklyAvg * 0.8 ? 'down' : 'stable'

  return Response.json({ predictions, total, trend, basedOnDays: 28 })
}
