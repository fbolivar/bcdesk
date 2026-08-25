'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow, isPast, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'

interface SLATimerProps {
  dueAt: string | null
  createdAt: string
  compact?: boolean
  pausedAt?: string | null
  /** Estado del ticket. Si es final (resuelto/cerrado/…) el reloj se detiene y se
   *  muestra el RESULTADO del SLA, no una cuenta regresiva viva. */
  status?: string | null
  /** Hora de resolución: define si el SLA se cumplió (resuelto ≤ vencimiento). */
  resolvedAt?: string | null
}

const FINAL_STATES = ['resolved', 'closed', 'cancelled', 'merged']

export function SLATimer({ dueAt, createdAt, compact = false, pausedAt = null, status = null, resolvedAt = null }: SLATimerProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Ticket en estado FINAL: el SLA ya no corre. Se muestra el resultado congelado.
  if (status && FINAL_STATES.includes(status)) {
    if (status === 'cancelled' || status === 'merged') {
      const txt = status === 'cancelled' ? 'Cancelado' : 'Fusionado'
      if (compact) return <span className="text-xs font-medium text-[#5B6B7C]">{txt}</span>
      return (
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#5B6B7C]">SLA</span>
          <span className="text-xs font-medium text-[#5B6B7C]">{txt}</span>
        </div>
      )
    }
    // resuelto / cerrado
    let txt = 'Cerrado', color = 'text-[#5B6B7C]'
    if (dueAt && resolvedAt) {
      const met = new Date(resolvedAt).getTime() <= new Date(dueAt).getTime()
      txt = met ? 'SLA cumplido ✓' : 'SLA incumplido'
      color = met ? 'text-[#10B981]' : 'text-[#EF4444]'
    }
    if (compact) return <span className={`text-xs font-medium ${color}`}>{txt}</span>
    return (
      <div className="flex justify-between items-center">
        <span className="text-xs text-[#5B6B7C]">SLA</span>
        <span className={`text-xs font-medium ${color}`}>{txt}</span>
      </div>
    )
  }

  if (!dueAt) return <span className="text-xs text-[#5B6B7C]">Sin SLA</span>

  // En pausa: el reloj no corre. Se muestra el estado en vez de la cuenta regresiva.
  if (pausedAt) {
    const pausedLabel = 'SLA en pausa'
    if (compact) return <span className="text-xs font-medium text-[#F59E0B]">⏸ {pausedLabel}</span>
    return (
      <div className="flex justify-between items-center">
        <span className="text-xs text-[#5B6B7C]">SLA</span>
        <span className="text-xs font-medium text-[#F59E0B] inline-flex items-center gap-1">⏸ {pausedLabel}</span>
      </div>
    )
  }

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
