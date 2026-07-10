'use client'

import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'

const COLORS = ['#1789FC', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#64748B']
const axis = { fill: '#5B6B7C', fontSize: 11 }
const fmtK = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n))

function Box({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-lg px-3 py-2 text-xs shadow-sm">{children}</div>
}

export function TicketsTrendChart({ data }: { data: { month: string; creados: number; resueltos: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
        <XAxis dataKey="month" tick={axis} />
        <YAxis tick={axis} allowDecimals={false} />
        <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
          <Box><p className="text-[#5B6B7C] mb-1">{label}</p>{payload.map((p, i) => <p key={i} style={{ color: p.color as string }}>{p.name}: <b>{p.value as number}</b></p>)}</Box>
        ) : null} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="creados" name="Creados" stroke="#1789FC" strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="resueltos" name="Resueltos" stroke="#10B981" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function StatusDonut({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}
          label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip content={({ active, payload }) => active && payload?.length ? <Box><p className="text-[#0B2545] font-semibold">{payload[0].name}: {payload[0].value as number}</p></Box> : null} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function FinanceChart({ data }: { data: { month: string; ingresos: number; gastos: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
        <XAxis dataKey="month" tick={axis} />
        <YAxis tick={axis} tickFormatter={fmtK} />
        <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
          <Box><p className="text-[#5B6B7C] mb-1">{label}</p>{payload.map((p, i) => <p key={i} style={{ color: p.color as string }}>{p.name}: <b>${(p.value as number).toLocaleString()}</b></p>)}</Box>
        ) : null} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="ingresos" name="Ingresos netos" fill="#10B981" radius={[3, 3, 0, 0]} />
        <Bar dataKey="gastos" name="Gastos" fill="#F59E0B" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TopClientsChart({ data }: { data: { name: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 16, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" horizontal={false} />
        <XAxis type="number" tick={axis} tickFormatter={fmtK} />
        <YAxis type="category" dataKey="name" tick={axis} width={110} />
        <Tooltip content={({ active, payload }) => active && payload?.length ? <Box><p className="text-[#0B2545] font-semibold">${(payload[0].value as number).toLocaleString()}</p></Box> : null} />
        <Bar dataKey="revenue" name="Ingreso neto" radius={[0, 3, 3, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
