'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

type Point = { day: string; up_pct: number }

function barColor(v: number): string {
  if (v >= 99) return '#10B981'
  if (v >= 95) return '#00D4AA'
  if (v >= 80) return '#F59E0B'
  return '#EF4444'
}

export function ClientUptimeChart({ data }: { data: Point[] }) {
  const chart = data.map(d => ({
    label: new Date(d.day + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
    up: d.up_pct,
  }))

  if (chart.length === 0) return <p className="text-xs text-[#5B6B7C]">Sin datos de disponibilidad todavía.</p>

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <BarChart data={chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E6EBF2" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} minTickGap={20} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94A3B8' }} unit="%" />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E6EBF2' }}
            formatter={(v) => [`${v}%`, 'Disponibilidad']}
          />
          <Bar dataKey="up" radius={[2, 2, 0, 0]}>
            {chart.map((c, i) => <Cell key={i} fill={barColor(c.up)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
