'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface DayPrediction {
  date: string
  day: string
  predicted: number
}

interface PredictionResponse {
  predictions: DayPrediction[]
  total: number
  trend: 'up' | 'down' | 'stable'
  basedOnDays: number
  prediction: null | unknown
  message?: string
}

export function VolumePrediction() {
  const [data, setData] = useState<PredictionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/ai/predict-volume')
      .then(r => r.json())
      .then((d: PredictionResponse) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <div className="h-4 w-48 bg-[#E6EBF2] rounded animate-pulse mb-4" />
        <div className="flex items-end gap-2 h-24">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-[#E6EBF2] rounded-t animate-pulse"
              style={{ height: `${40 + Math.random() * 60}%` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <p className="text-sm text-[#5B6B7C]">No se pudo cargar la predicción de volumen.</p>
      </div>
    )
  }

  if (!data.predictions || data.prediction === null && data.message) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-2">Predicción de volumen (próximos 7 días)</h2>
        <p className="text-sm text-[#5B6B7C]">{data.message ?? 'No hay suficientes datos históricos para generar una predicción.'}</p>
      </div>
    )
  }

  const maxVal = Math.max(...data.predictions.map(p => p.predicted), 1)

  const TrendIcon = data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus
  const trendLabel = data.trend === 'up' ? 'Alta' : data.trend === 'down' ? 'Baja' : 'Estable'
  const trendColor =
    data.trend === 'up' ? '#EF4444' : data.trend === 'down' ? '#10B981' : '#00D4AA'

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#0B2545]">Predicción de volumen (próximos 7 días)</h2>
          <p className="text-xs text-[#5B6B7C] mt-0.5">
            Basado en datos de los últimos {data.basedOnDays} días · Total estimado:{' '}
            <span className="text-[#0B2545] font-medium">{data.total} tickets</span>
          </p>
        </div>
        <span
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: `${trendColor}1A`, color: trendColor }}
        >
          <TrendIcon size={12} />
          {trendLabel}
        </span>
      </div>

      {/* Mini bar chart — CSS puro */}
      <div className="flex items-end gap-2" style={{ height: '96px' }}>
        {data.predictions.map(pred => {
          const heightPct = maxVal > 0 ? Math.max((pred.predicted / maxVal) * 100, 4) : 4
          return (
            <div key={pred.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
              {/* Tooltip */}
              <div
                className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-10"
              >
                <div
                  className="px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap"
                  style={{ background: '#0D1117', color: '#0B2545', border: '1px solid #E6EBF2' }}
                >
                  {pred.predicted} ticket{pred.predicted !== 1 ? 's' : ''}
                </div>
                <div
                  className="w-1.5 h-1.5 rotate-45"
                  style={{ background: '#E6EBF2', marginTop: '-4px' }}
                />
              </div>

              {/* Bar */}
              <div
                className="w-full rounded-t transition-all duration-300"
                style={{
                  height: `${heightPct}%`,
                  background: 'linear-gradient(180deg, #00D4AA 0%, #00B392 100%)',
                  opacity: 0.85,
                }}
              />

              {/* Day label */}
              <span className="text-[10px] text-[#5B6B7C] mt-1 leading-none">{pred.day}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
