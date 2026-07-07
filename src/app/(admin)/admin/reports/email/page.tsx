import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'
import { WeeklyTicketsChart, CategoryPieChart, StatusBarChart } from '@/features/admin/components/reports-charts'
import { subDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TICKET_CATEGORY_LABELS } from '@/lib/tickets/categories'

export default async function EmailMetricsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  // Datos con service client (métricas globales, sin filtros de RLS)
  const svc = createServiceClient()
  const { data: emailTickets } = await svc
    .from('tickets')
    .select('id, status, category, priority, created_at, resolved_at, first_response_at, sla_breached, requester_email')
    .eq('source_channel', 'email')

  const tickets = emailTickets ?? []
  const ids = tickets.map(t => t.id)

  let withAttachment = 0
  if (ids.length) {
    const { data: atts } = await svc.from('ticket_attachments').select('ticket_id').in('ticket_id', ids)
    withAttachment = new Set((atts ?? []).map(a => a.ticket_id)).size
  }

  const now = new Date()
  const last7 = tickets.filter(t => new Date(t.created_at) >= subDays(now, 7)).length
  const last30 = tickets.filter(t => new Date(t.created_at) >= subDays(now, 30)).length
  const open = tickets.filter(t => !['resolved', 'closed', 'cancelled', 'merged'].includes(t.status)).length
  const resolved = tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length

  const respondable = tickets.filter(t => t.first_response_at)
  const avgFirstRespMin = respondable.length
    ? respondable.reduce((a, t) => a + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()) / 60000, 0) / respondable.length
    : null

  const slaConsidered = tickets.filter(t => t.status !== 'cancelled').length
  const slaBreached = tickets.filter(t => t.sla_breached).length
  const slaCompliance = slaConsidered ? Math.round(((slaConsidered - slaBreached) / slaConsidered) * 100) : 100
  const attachPct = tickets.length ? Math.round((withAttachment / tickets.length) * 100) : 0

  // Volumen diario (últimos 14 días)
  const dailyData = Array.from({ length: 14 }, (_, i) => {
    const day = subDays(now, 13 - i)
    const key = format(day, 'yyyy-MM-dd')
    return {
      week: format(day, 'dd MMM', { locale: es }),
      tickets: tickets.filter(t => format(new Date(t.created_at), 'yyyy-MM-dd') === key).length,
    }
  })

  const categoryLabels = TICKET_CATEGORY_LABELS as Record<string, string>
  const categoryData = Object.entries(categoryLabels)
    .map(([cat, name]) => ({ name, value: tickets.filter(t => t.category === cat).length }))
    .filter(d => d.value > 0)

  const statusLabels: Record<string, string> = {
    open: 'Abiertos', in_progress: 'En progreso', waiting_client: 'Esperando', resolved: 'Resueltos', closed: 'Cerrados',
  }
  const statusData = Object.entries(statusLabels).map(([s, label]) => ({
    status: label, count: tickets.filter(t => t.status === s).length,
  }))

  const priorityData = ['critical', 'high', 'medium', 'low'].map(p => ({
    priority: p, total: tickets.filter(t => t.priority === p).length,
  }))
  const priorityColors: Record<string, string> = {
    critical: 'bg-[#EF4444]', high: 'bg-[#F59E0B]', medium: 'bg-[#1789FC]', low: 'bg-[#5B6B7C]',
  }
  const priorityLabels: Record<string, string> = { critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo' }
  const maxPriority = Math.max(1, ...priorityData.map(p => p.total))

  // Top remitentes
  const bySender = new Map<string, number>()
  for (const t of tickets) {
    const e = t.requester_email || '(desconocido)'
    bySender.set(e, (bySender.get(e) ?? 0) + 1)
  }
  const topSenders = [...bySender.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

  function fmtMin(min: number | null) {
    if (min === null) return '—'
    if (min < 60) return `${Math.round(min)}m`
    return `${(min / 60).toFixed(1)}h`
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/reports" className="inline-flex items-center gap-2 text-sm text-[#5B6B7C] hover:text-[#0B2545]">
        <ArrowLeft size={14} /> Volver a Reportes
      </Link>

      <div className="flex items-center gap-2">
        <Mail size={18} className="text-[#1789FC]" />
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">Métricas de correo</h1>
          <p className="text-sm text-[#5B6B7C] mt-0.5">Tickets recibidos por email (soporte@)</p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-10 text-center">
          <Mail size={28} className="mx-auto mb-2 text-[#CBD5E1]" />
          <p className="text-sm text-[#5B6B7C]">Aún no hay tickets creados por correo.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total por correo', value: tickets.length, sub: `${last7} en 7d · ${last30} en 30d` },
              { label: 'Abiertos', value: open, sub: `${resolved} resueltos` },
              { label: '1ra respuesta prom.', value: fmtMin(avgFirstRespMin), sub: `${respondable.length} con respuesta` },
              { label: 'SLA cumplimiento', value: `${slaCompliance}%`, sub: `${slaBreached} incumplidos` },
            ].map(k => (
              <div key={k.label} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
                <p className="text-2xl font-bold text-[#0B2545]">{k.value}</p>
                <p className="text-xs text-[#5B6B7C] mt-0.5">{k.label}</p>
                <p className="text-[10px] text-[#CBD5E1] mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Con adjunto', value: `${attachPct}%`, sub: `${withAttachment} tickets` },
              { label: 'Resueltos', value: resolved, sub: `${tickets.length ? Math.round((resolved / tickets.length) * 100) : 0}% del total` },
              { label: 'Críticos + Altos', value: tickets.filter(t => ['critical', 'high'].includes(t.priority)).length, sub: 'por prioridad' },
              { label: 'Remitentes únicos', value: bySender.size, sub: 'clientes distintos' },
            ].map(k => (
              <div key={k.label} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
                <p className="text-xl font-bold text-[#0B2545]">{k.value}</p>
                <p className="text-xs text-[#5B6B7C] mt-0.5">{k.label}</p>
                <p className="text-[10px] text-[#CBD5E1] mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Volumen por día (últimos 14 días)</h2>
              <WeeklyTicketsChart data={dailyData} />
            </div>
            <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Por categoría (IA)</h2>
              <CategoryPieChart data={categoryData} />
            </div>
            <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Por estado</h2>
              <StatusBarChart data={statusData} />
            </div>

            <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Por prioridad (IA)</h2>
              <div className="space-y-3">
                {priorityData.map(p => (
                  <div key={p.priority} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#5B6B7C]">{priorityLabels[p.priority]}</span>
                      <span className="text-[#5B6B7C]">{p.total}</span>
                    </div>
                    <div className="h-2 bg-[#E6EBF2] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${priorityColors[p.priority]}`}
                        style={{ width: `${(p.total / maxPriority) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Top remitentes</h2>
              <div className="space-y-2">
                {topSenders.map(([email, count]) => (
                  <div key={email} className="flex items-center justify-between text-xs">
                    <span className="text-[#5B6B7C] truncate mr-2">{email}</span>
                    <span className="text-[#0B2545] font-medium shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
