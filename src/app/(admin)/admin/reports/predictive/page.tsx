import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrendingUp, AlertCircle } from 'lucide-react'

function linearRegression(data: number[]): { slope: number; intercept: number } {
  const n = data.length
  if (n < 2) return { slope: 0, intercept: data[0] ?? 0 }
  const xs = data.map((_, i) => i)
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = data.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * data[i], 0)
  const sumX2 = xs.reduce((s, x) => s + x * x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

export default async function PredictivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // Get last 12 weeks of ticket data
  const twelveWeeksAgo = new Date()
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)

  const { data: tickets } = await supabase
    .from('tickets')
    .select('created_at, status, priority, category, resolved_at')
    .gte('created_at', twelveWeeksAgo.toISOString())
    .order('created_at')

  const list = tickets ?? []

  // Build weekly buckets
  const weeklyData: Record<string, { created: number; resolved: number; priorities: Record<string, number> }> = {}

  for (const t of list) {
    const date = new Date(t.created_at)
    const monday = new Date(date)
    monday.setDate(date.getDate() - date.getDay() + 1)
    const weekKey = monday.toISOString().split('T')[0]
    if (!weeklyData[weekKey]) weeklyData[weekKey] = { created: 0, resolved: 0, priorities: {} }
    weeklyData[weekKey].created++
    if (t.status === 'resolved' || t.status === 'closed') weeklyData[weekKey].resolved++
    weeklyData[weekKey].priorities[t.priority ?? 'medium'] = (weeklyData[weekKey].priorities[t.priority ?? 'medium'] ?? 0) + 1
  }

  const weeks = Object.keys(weeklyData).sort()
  const createdSeries = weeks.map(w => weeklyData[w].created)
  const resolvedSeries = weeks.map(w => weeklyData[w].resolved)

  // Forecast next 4 weeks
  const { slope, intercept } = linearRegression(createdSeries)
  const forecasts = Array.from({ length: 4 }, (_, i) => {
    const predicted = Math.max(0, Math.round(intercept + slope * (createdSeries.length + i)))
    const lastMonday = weeks.length > 0 ? new Date(weeks[weeks.length - 1]) : new Date()
    const forecastDate = new Date(lastMonday)
    forecastDate.setDate(lastMonday.getDate() + (i + 1) * 7)
    return { week: forecastDate.toISOString().split('T')[0], predicted }
  })

  const avgWeekly = createdSeries.length > 0 ? Math.round(createdSeries.reduce((a, b) => a + b, 0) / createdSeries.length) : 0
  const trend = slope > 0.5 ? 'creciente' : slope < -0.5 ? 'decreciente' : 'estable'
  const trendColor = slope > 0.5 ? 'text-[#EF4444]' : slope < -0.5 ? 'text-[#10B981]' : 'text-[#F59E0B]'

  // Resolution rate
  const totalCreated = createdSeries.reduce((a, b) => a + b, 0)
  const totalResolved = resolvedSeries.reduce((a, b) => a + b, 0)
  const resolutionRate = totalCreated > 0 ? Math.round((totalResolved / totalCreated) * 100) : 0

  // Busiest day of week
  const byDow: Record<number, number> = {}
  for (const t of list) {
    const dow = new Date(t.created_at).getDay()
    byDow[dow] = (byDow[dow] ?? 0) + 1
  }
  const busiestDow = Object.entries(byDow).sort((a, b) => b[1] - a[1])[0]
  const dowNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  // Category distribution
  const byCat: Record<string, number> = {}
  for (const t of list) {
    const cat = t.category ?? 'sin categoría'
    byCat[cat] = (byCat[cat] ?? 0) + 1
  }
  const topCategories = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const maxBarVal = Math.max(...createdSeries, 1)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Analítica predictiva</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Forecast de volumen de tickets y detección de tendencias — últimas 12 semanas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-xs text-[#5B6B7C] mb-1">Promedio semanal</p>
          <p className="text-2xl font-bold text-[#0B2545]">{avgWeekly}</p>
          <p className="text-xs text-[#CBD5E1] mt-0.5">tickets/semana</p>
        </div>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-xs text-[#5B6B7C] mb-1">Tendencia</p>
          <p className={`text-2xl font-bold ${trendColor}`}>{trend}</p>
          <p className="text-xs text-[#CBD5E1] mt-0.5">{slope > 0 ? `+${slope.toFixed(1)}` : slope.toFixed(1)} tickets/sem</p>
        </div>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-xs text-[#5B6B7C] mb-1">Tasa resolución</p>
          <p className={`text-2xl font-bold ${resolutionRate >= 80 ? 'text-[#10B981]' : resolutionRate >= 60 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>{resolutionRate}%</p>
          <p className="text-xs text-[#CBD5E1] mt-0.5">{totalResolved}/{totalCreated} tickets</p>
        </div>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-xs text-[#5B6B7C] mb-1">Día más ocupado</p>
          <p className="text-2xl font-bold text-[#0B2545]">{busiestDow ? dowNames[parseInt(busiestDow[0])] : '—'}</p>
          <p className="text-xs text-[#CBD5E1] mt-0.5">{busiestDow ? `${busiestDow[1]} tickets histórico` : ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Weekly volume chart */}
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Volumen histórico (12 semanas)</h2>
          {weeks.length > 0 ? (
            <div className="space-y-2">
              {weeks.slice(-8).map((w, i) => {
                const val = weeklyData[w].created
                const pct = Math.round((val / maxBarVal) * 100)
                return (
                  <div key={w} className="flex items-center gap-3">
                    <span className="text-xs text-[#CBD5E1] w-20 shrink-0">{w.slice(5)}</span>
                    <div className="flex-1 h-5 bg-[#F4F7FB] rounded overflow-hidden">
                      <div className="h-full bg-[#1789FC] rounded transition-all flex items-center pl-2"
                        style={{ width: `${pct}%` }}>
                        <span className="text-[10px] text-white font-bold">{val}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-[#CBD5E1]">Sin datos suficientes.</p>
          )}
        </div>

        {/* Forecast */}
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-1">Forecast próximas 4 semanas</h2>
          <p className="text-xs text-[#CBD5E1] mb-4">Regresión lineal sobre histórico de 12 semanas</p>
          <div className="space-y-3">
            {forecasts.map(f => {
              const pct = Math.round((f.predicted / Math.max(avgWeekly * 2, 1)) * 100)
              const isHigh = f.predicted > avgWeekly * 1.2
              return (
                <div key={f.week}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#5B6B7C]">Sem. {f.week.slice(5)}</span>
                    <span className={`font-semibold ${isHigh ? 'text-[#F59E0B]' : 'text-[#0B2545]'}`}>
                      ~{f.predicted} tickets {isHigh ? '⚠️' : ''}
                    </span>
                  </div>
                  <div className="h-2 bg-[#F4F7FB] rounded-full">
                    <div className={`h-full rounded-full ${isHigh ? 'bg-[#F59E0B]' : 'bg-[#8B5CF6]'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          {slope > 1 && (
            <div className="mt-4 flex items-start gap-2 px-3 py-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg">
              <AlertCircle size={12} className="text-[#EF4444] shrink-0 mt-0.5" />
              <p className="text-xs text-[#EF4444]">Tendencia creciente detectada. Considera ampliar el equipo o revisión de automatizaciones.</p>
            </div>
          )}
        </div>
      </div>

      {/* Top categories */}
      {topCategories.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-[#1789FC]" /> Top categorías de tickets
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {topCategories.map(([cat, count]) => (
              <div key={cat} className="bg-[#F4F7FB] rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-[#0B2545]">{count}</p>
                <p className="text-xs text-[#5B6B7C] mt-1 truncate">{cat}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
