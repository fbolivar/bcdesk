'use client'

import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { MonitorDot, Wifi, AlertTriangle, ArrowRight } from 'lucide-react'

export type FleetHealth = {
  summary: { total: number; online: number; with_active_alert: number }
  top5: { endpoint_id: string; hostname: string | null; org: string; tickets: number }[]
  trend: { week: string; rmm: number; manual: number }[]
  active_alerts: { ticket_id: string; ticket_number: number; title: string; priority: string; hostname: string | null; org: string; created_at: string }[]
}

const PRIORITY_COLOR: Record<string, string> = { low: '#10B981', medium: '#F59E0B', high: '#EF4444', critical: '#B91C1C' }
const PRIORITY_LABEL: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' }

export function FleetHealthSection({ data }: { data: FleetHealth }) {
  const { summary, top5, trend, active_alerts } = data
  const onlinePct = summary.total > 0 ? Math.round((summary.online / summary.total) * 100) : 0
  const alertPct = summary.total > 0 ? Math.round((summary.with_active_alert / summary.total) * 100) : 0

  const chart = trend.map(t => ({
    label: new Date(t.week + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
    RMM: t.rmm, Manual: t.manual,
  }))

  const cards = [
    { label: 'Endpoints totales', value: `${summary.total}`, sub: 'activos en la flota', icon: MonitorDot, color: '#00D4AA' },
    { label: 'En línea ahora', value: `${onlinePct}%`, sub: `${summary.online} de ${summary.total}`, icon: Wifi, color: '#10B981' },
    { label: 'Con alerta activa', value: `${alertPct}%`, sub: `${summary.with_active_alert} equipos`, icon: AlertTriangle, color: alertPct > 0 ? '#EF4444' : '#94A3B8' },
  ]

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0B2545' }}>
        <MonitorDot size={16} className="text-[#0E9E86]" /> Salud de flota RMM
      </h2>

      {/* Cards resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${c.color}18`, color: c.color }}><Icon size={18} /></div>
              <div className="text-2xl font-bold" style={{ color: '#0B2545' }}>{c.value}</div>
              <div className="text-[11px] mt-0.5" style={{ color: '#5B6B7C' }}>{c.label} · {c.sub}</div>
            </div>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Tendencia 8 semanas */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold" style={{ color: '#0B2545' }}>Tickets RMM vs. manuales · 8 semanas</h3>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5" style={{ color: '#5B6B7C' }}><span className="w-2.5 h-2.5 rounded-full bg-[#00D4AA]" /> RMM</span>
              <span className="flex items-center gap-1.5" style={{ color: '#5B6B7C' }}><span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" /> Manual</span>
            </div>
          </div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6EBF2" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E6EBF2' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="RMM" stroke="#00D4AA" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="Manual" stroke="#8B5CF6" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 5 endpoints por tickets RMM */}
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#0B2545' }}>Top 5 equipos · tickets RMM (30d)</h3>
          {top5.length === 0 ? (
            <p className="text-xs" style={{ color: '#94A3B8' }}>Sin tickets RMM en el periodo.</p>
          ) : (
            <div className="space-y-2.5">
              {top5.map((e, i) => (
                <Link key={e.endpoint_id} href={`/admin/rmm/endpoints/${e.endpoint_id}`}
                  className="flex items-center gap-3 group">
                  <span className="text-[11px] font-bold w-4 shrink-0" style={{ color: '#94A3B8' }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate group-hover:text-[#0E9E86]" style={{ color: '#0B2545' }}>{e.hostname ?? '(sin nombre)'}</p>
                    <p className="text-[10px] truncate" style={{ color: '#94A3B8' }}>{e.org}</p>
                  </div>
                  <span className="text-xs font-semibold shrink-0" style={{ color: '#00D4AA' }}>{e.tickets}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alertas activas sin resolver */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E6EBF2' }}>
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0B2545' }}>
            <AlertTriangle size={15} className="text-[#EF4444]" /> Alertas activas sin resolver
            {active_alerts.length > 0 && <span className="text-xs font-normal" style={{ color: '#94A3B8' }}>({active_alerts.length})</span>}
          </h3>
          <Link href="/admin/tickets?source=rmm" className="flex items-center gap-1 text-xs" style={{ color: '#00D4AA' }}>Ver tickets <ArrowRight size={12} /></Link>
        </div>
        {active_alerts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: '#94A3B8' }}>Sin alertas activas 🎉</p>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F4F7FB' }}>
            {active_alerts.map(a => (
              <Link key={a.ticket_id} href={`/admin/tickets/${a.ticket_id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-[#F7F9FC] transition-colors">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[a.priority] ?? '#94A3B8' }} />
                <span className="font-mono text-xs shrink-0" style={{ color: '#00D4AA' }}>#{a.ticket_number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate" style={{ color: '#0B2545' }}>{a.title}</p>
                  <p className="text-[10px] truncate" style={{ color: '#94A3B8' }}>{a.org}</p>
                </div>
                <span className="text-[10px] font-medium shrink-0" style={{ color: PRIORITY_COLOR[a.priority] ?? '#94A3B8' }}>{PRIORITY_LABEL[a.priority] ?? a.priority}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
