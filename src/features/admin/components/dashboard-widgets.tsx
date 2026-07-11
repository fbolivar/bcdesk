'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

/* ─────────────────────────────────────────────────────────────
   Contador animado (count-up con easeOutCubic)
   ───────────────────────────────────────────────────────────── */
export function AnimatedCounter({
  value, duration = 1100, decimals = 0, prefix = '', suffix = '',
}: { value: number; duration?: number; decimals?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef<number | undefined>(undefined)

  useEffect(() => {
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(value * eased)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [value, duration])

  return <span>{prefix}{display.toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>
}

const tooltipStyle = {
  background: '#FFFFFF', border: '1px solid #E6EBF2', borderRadius: 10,
  fontSize: 12, boxShadow: '0 8px 24px rgba(16,24,40,0.10)', padding: '8px 12px',
}

/* ─────────────────────────────────────────────────────────────
   Sparkline (mini área sin ejes)
   ───────────────────────────────────────────────────────────── */
export function Sparkline({ data, color = '#00D4AA', height = 40 }: { data: number[]; color?: string; height?: number }) {
  const chartData = data.map((v, i) => ({ i, v }))
  const id = `spark-${color.replace('#', '')}`
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive animationDuration={900} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ─────────────────────────────────────────────────────────────
   KPI Card (contador animado + sparkline + delta) con tilt 3D
   ───────────────────────────────────────────────────────────── */
export interface KpiCardProps {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  spark: number[]
  delta?: string
  deltaUp?: boolean
  href?: string
  suffix?: string
  decimals?: number
  index?: number
}

export function KpiCard(p: KpiCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: React.MouseEvent) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `perspective(900px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-3px)`
  }
  function onLeave() {
    const el = ref.current
    if (el) el.style.transform = 'perspective(900px) rotateX(0) rotateY(0) translateY(0)'
  }

  const Wrapper: React.ElementType = p.href ? 'a' : 'div'

  return (
    <Wrapper
      {...(p.href ? { href: p.href } : {})}
      ref={ref as never}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="block rounded-2xl p-5 relative overflow-hidden animate-fade-in-up"
      style={{
        background: '#FFFFFF', border: '1px solid #E6EBF2',
        boxShadow: '0 1px 3px rgba(16,24,40,0.04)',
        transition: 'transform 0.15s ease, box-shadow 0.2s ease',
        animationDelay: `${(p.index ?? 0) * 70}ms`, opacity: 0,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* accent glow */}
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-[0.10]" style={{ background: p.color, filter: 'blur(24px)' }} />
      <div className="relative flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${p.color}18`, color: p.color }}>
          {p.icon}
        </div>
        {p.delta && (
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ color: p.deltaUp ? '#10B981' : '#EF4444', background: p.deltaUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
            {p.delta}
          </span>
        )}
      </div>
      <div className="relative text-[28px] font-bold tracking-tight leading-none" style={{ color: '#0B2545' }}>
        <AnimatedCounter value={p.value} suffix={p.suffix} decimals={p.decimals} />
      </div>
      <div className="relative text-xs mt-1.5 mb-2" style={{ color: '#5B6B7C' }}>{p.label}</div>
      <div className="relative -mx-1 -mb-1">
        <Sparkline data={p.spark} color={p.color} height={34} />
      </div>
    </Wrapper>
  )
}

/* ─────────────────────────────────────────────────────────────
   Trend chart: creados vs resueltos (área con gradiente)
   ───────────────────────────────────────────────────────────── */
export function TrendChart({ data }: { data: { day: string; creados: number; resueltos: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="gCreados" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D4AA" stopOpacity={0.30} />
            <stop offset="100%" stopColor="#00D4AA" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gResueltos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="creados" name="Creados" stroke="#00D4AA" strokeWidth={2.5} fill="url(#gCreados)" isAnimationActive animationDuration={1000} />
        <Area type="monotone" dataKey="resueltos" name="Resueltos" stroke="#10B981" strokeWidth={2.5} fill="url(#gResueltos)" isAnimationActive animationDuration={1200} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ─────────────────────────────────────────────────────────────
   Donut de estados con etiqueta central
   ───────────────────────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: 'Abierto', color: '#00D4AA' },
  in_progress: { label: 'En progreso', color: '#8B5CF6' },
  waiting_client: { label: 'Esp. cliente', color: '#F59E0B' },
  resolved: { label: 'Resuelto', color: '#10B981' },
  closed: { label: 'Cerrado', color: '#94A3B8' },
  cancelled: { label: 'Cancelado', color: '#CBD5E1' },
}

export function StatusDonut({ data }: { data: { status: string; count: number }[] }) {
  const chart = data.map(d => ({ name: STATUS_META[d.status]?.label ?? d.status, value: d.count, color: STATUS_META[d.status]?.color ?? '#94A3B8' }))
  const total = chart.reduce((s, d) => s + d.value, 0)
  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: 130, height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chart} dataKey="value" innerRadius={44} outerRadius={62} paddingAngle={2} stroke="none" isAnimationActive animationDuration={900}>
              {chart.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold" style={{ color: '#0B2545' }}>{total}</span>
          <span className="text-[10px]" style={{ color: '#94A3B8' }}>activos</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {chart.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="flex-1" style={{ color: '#5B6B7C' }}>{d.name}</span>
            <span className="font-semibold" style={{ color: '#0B2545' }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Barras de prioridad
   ───────────────────────────────────────────────────────────── */
const PRIORITY_META: Record<string, { label: string; color: string }> = {
  critical: { label: 'Crítica', color: '#EF4444' },
  high: { label: 'Alta', color: '#F59E0B' },
  medium: { label: 'Media', color: '#00D4AA' },
  low: { label: 'Baja', color: '#94A3B8' },
}

export function PriorityBars({ data }: { data: { priority: string; count: number }[] }) {
  const order = ['critical', 'high', 'medium', 'low']
  const chart = order.map(p => ({ name: PRIORITY_META[p].label, value: data.find(d => d.priority === p)?.count ?? 0, color: PRIORITY_META[p].color }))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 4 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#5B6B7C', fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0, 212, 170,0.05)' }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive animationDuration={900}>
          {chart.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ─────────────────────────────────────────────────────────────
   Medidor radial (SLA compliance)
   ───────────────────────────────────────────────────────────── */
export function SlaGauge({ value }: { value: number }) {
  const color = value >= 90 ? '#10B981' : value >= 75 ? '#F59E0B' : '#EF4444'
  const data = [{ name: 'sla', value, fill: color }]
  return (
    <div className="relative" style={{ width: '100%', height: 190 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={220} endAngle={-40} barSize={16}>
          <defs>
            <linearGradient id="gGauge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.7} />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          </defs>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={12} fill="url(#gGauge)" background={{ fill: '#EEF2F7' }} isAnimationActive animationDuration={1200} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: 8 }}>
        <span className="text-3xl font-bold" style={{ color: '#0B2545' }}><AnimatedCounter value={value} suffix="%" /></span>
        <span className="text-[11px]" style={{ color: '#5B6B7C' }}>Cumplimiento SLA</span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Ranking con barras animadas (agentes, clientes…)
   ───────────────────────────────────────────────────────────── */
export interface RankItem { label: string; sub?: string; value: number; badge?: string }

export function RankList({ items, color = '#00D4AA', unit = '' }: { items: RankItem[]; color?: string; unit?: string }) {
  const [grown, setGrown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setGrown(true), 60); return () => clearTimeout(t) }, [])
  const max = Math.max(1, ...items.map(i => i.value))

  if (items.length === 0) {
    return <p className="text-sm text-center py-6" style={{ color: '#94A3B8' }}>Sin datos aún</p>
  }

  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{ background: i === 0 ? `${color}20` : '#F1F5F9', color: i === 0 ? color : '#94A3B8' }}>
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate" style={{ color: '#0B2545' }}>{it.label}</span>
              <span className="text-xs font-semibold shrink-0 ml-2" style={{ color }}>{it.value}{unit}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#EEF2F7' }}>
              <div className="h-full rounded-full"
                style={{
                  width: grown ? `${(it.value / max) * 100}%` : '0%',
                  background: `linear-gradient(90deg, ${color}, ${color}bb)`,
                  transition: `width 900ms cubic-bezier(0.22,1,0.36,1) ${i * 80}ms`,
                }} />
            </div>
            {it.sub && <p className="text-[10px] mt-0.5 truncate" style={{ color: '#94A3B8' }}>{it.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
