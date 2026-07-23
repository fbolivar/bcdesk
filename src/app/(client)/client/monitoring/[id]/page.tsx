import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Cpu, MemoryStick, HardDrive, Activity } from 'lucide-react'
import { ClientUptimeChart } from '@/features/rmm/client-uptime-chart'

export const dynamic = 'force-dynamic'

const OFFLINE_MS = 10 * 60 * 1000

const PRIORITY_LABEL: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Crítica' }
const PRIORITY_COLOR: Record<string, string> = { low: '#10B981', medium: '#F59E0B', high: '#EF4444', urgent: '#B91C1C' }
const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto', in_progress: 'En progreso', waiting_client: 'Esperando', resolved: 'Resuelto', closed: 'Cerrado', cancelled: 'Cancelado',
}

const pct = (v: number | null | undefined) => (v == null ? '—' : `${Number(v).toFixed(0)}%`)

export default async function ClientEndpointDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS: solo si el endpoint es de la org del cliente (y activo). Si no, no existe para él.
  const { data: endpoint } = await supabase
    .from('endpoints')
    .select('id, hostname, os, status, last_seen_at, agent_version, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!endpoint) redirect('/client/monitoring')

  const [{ data: uptime }, { data: latestRows }, { data: incidents }] = await Promise.all([
    supabase.rpc('rmm_endpoint_uptime', { p_endpoint: id, p_days: 30 }),
    supabase.from('endpoint_metrics')
      .select('cpu_pct, ram_pct, disk_free_pct, recorded_at')
      .eq('endpoint_id', id).order('recorded_at', { ascending: false }).limit(1),
    supabase.from('tickets')
      .select('id, title, priority, status, created_at')
      .eq('source_endpoint_id', id).order('created_at', { ascending: false }).limit(50),
  ])

  const uptimeSeries = (uptime ?? []) as { day: string; up_pct: number }[]
  const avgUptime = uptimeSeries.length
    ? Math.round((uptimeSeries.reduce((s, d) => s + Number(d.up_pct), 0) / uptimeSeries.length) * 10) / 10
    : null
  const latest = latestRows?.[0] ?? null
  const online = !!endpoint.last_seen_at && Date.now() - new Date(endpoint.last_seen_at).getTime() < OFFLINE_MS
  const rows = (incidents ?? []) as { id: string; title: string; priority: string; status: string; created_at: string }[]

  return (
    <div className="space-y-5 max-w-4xl">
      <Link href="/client/monitoring" className="inline-flex items-center gap-1.5 text-sm text-[#5B6B7C] hover:text-[#0B2545]">
        <ArrowLeft size={15} /> Mis equipos
      </Link>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">{endpoint.hostname ?? '(sin nombre)'}</h1>
          <p className="text-xs text-[#5B6B7C]">{endpoint.os ?? '—'} · agente {endpoint.agent_version ?? '—'}</p>
        </div>
        {online ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-[#10B981] font-medium"><span className="w-2 h-2 rounded-full bg-[#10B981]" /> En línea</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] font-medium"><span className="w-2 h-2 rounded-full bg-[#CBD5E1]" /> Fuera de línea</span>
        )}
      </div>

      {/* Telemetría actual */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Cpu, label: 'CPU', value: pct(latest?.cpu_pct), color: '#EF4444' },
          { icon: MemoryStick, label: 'RAM', value: pct(latest?.ram_pct), color: '#F59E0B' },
          { icon: HardDrive, label: 'Disco libre', value: pct(latest?.disk_free_pct), color: '#00D4AA' },
        ].map(m => {
          const Icon = m.icon
          return (
            <div key={m.label} className="bg-white border border-[#E6EBF2] rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-[#5B6B7C]"><Icon size={13} style={{ color: m.color }} /> {m.label}</div>
              <p className="text-2xl font-semibold text-[#0B2545] mt-1">{m.value}</p>
            </div>
          )
        })}
      </div>

      {/* Disponibilidad 30 días */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#0B2545] flex items-center gap-1.5"><Activity size={15} className="text-[#0E9E86]" /> Disponibilidad (30 días)</h2>
          {avgUptime != null && <span className="text-sm font-semibold" style={{ color: avgUptime >= 99 ? '#10B981' : avgUptime >= 95 ? '#00D4AA' : avgUptime >= 80 ? '#F59E0B' : '#EF4444' }}>{avgUptime}% promedio</span>}
        </div>
        <ClientUptimeChart data={uptimeSeries} />
      </div>

      {/* Historial de incidentes */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-3">Historial de incidentes</h2>
        {rows.length === 0 ? (
          <p className="text-xs text-[#5B6B7C]">Sin incidentes registrados para este equipo.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(t => (
              <Link key={t.id} href={`/client/tickets/${t.id}`}
                className="flex items-center gap-3 border-b border-[#E6EBF2]/60 pb-2 hover:bg-[#F4F7FB] rounded px-1 -mx-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[t.priority] ?? '#94A3B8' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#0B2545] truncate">{t.title}</p>
                  <p className="text-[10px] text-[#94A3B8]">{new Date(t.created_at).toLocaleString('es-CO')}</p>
                </div>
                <span className="text-[10px] font-medium shrink-0" style={{ color: PRIORITY_COLOR[t.priority] ?? '#94A3B8' }}>{PRIORITY_LABEL[t.priority] ?? t.priority}</span>
                <span className="text-[10px] text-[#5B6B7C] shrink-0 w-20 text-right">{STATUS_LABEL[t.status] ?? t.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
