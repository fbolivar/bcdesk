'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow, isPast, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'

interface SLATimerProps {
  dueAt: string | null
  createdAt: string
  compact?: boolean
}

export function SLATimer({ dueAt, createdAt, compact = false }: SLATimerProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!dueAt) return <span className="text-xs text-[#5B6B7C]">Sin SLA</span>

  const due = new Date(dueAt)
  const created = new Date(createdAt)
  const totalMinutes = differenceInMinutes(due, created)
  const remainingMinutes = differenceInMinutes(due, new Date())
  const percentRemaining = Math.max(0, Math.min(100, (remainingMinutes / totalMinutes) * 100))
  const breached = isPast(due)

  const barColor = breached
    ? 'bg-[#EF4444]'
    : percentRemaining < 20
    ? 'bg-[#EF4444]'
    : percentRemaining < 50
    ? 'bg-[#F59E0B]'
    : 'bg-[#10B981]'

  const textColor = breached
    ? 'text-[#EF4444]'
    : percentRemaining < 20
    ? 'text-[#EF4444]'
    : percentRemaining < 50
    ? 'text-[#F59E0B]'
    : 'text-[#10B981]'

  const label = breached
    ? `Vencido ${formatDistanceToNow(due, { locale: es, addSuffix: true })}`
    : `Vence ${formatDistanceToNow(due, { locale: es, addSuffix: true })}`

  if (compact) {
    return (
      <span className={`text-xs font-medium font-mono ${textColor}`}>
        {label}
      </span>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-[#5B6B7C]">SLA</span>
        <span className={`text-xs font-medium font-mono ${textColor}`}>{label}</span>
      </div>
      <div className="h-1.5 bg-[#E6EBF2] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${breached ? 100 : percentRemaining}%` }}
        />
      </div>
    </div>
  )
}
