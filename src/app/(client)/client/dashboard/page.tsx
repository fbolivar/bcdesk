import { fmtDateOnly } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { bogotaDayKey } from '@/lib/date'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Ticket, Briefcase, FileText, AlertTriangle, Plus, Activity, ArrowRight, Timer, CheckCircle2, Clock,
} from 'lucide-react'
import { StatusBadge, PriorityBadge } from '@/shared/components/priority-badge'
import {
  KpiCard, TrendChart, StatusDonut, PriorityBars, SlaGauge, AnimatedCounter,
} from '@/features/admin/components/dashboard-widgets'
import type { Invoice } from '@/lib/supabase/types'

const ACTIVE_FILTER = '("resolved","closed","cancelled")'
function dayKey(d: Date) { return bogotaDayKey(d) }

export default async function ClientDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('organization_id, full_name').eq('id', user.id).single()

  if (!profile?.organization_id) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle size={40} className="text-[#F59E0B] mb-4" />
        <h2 className="text-lg font-semibold text-[#0B2545]">Sin organización asignada</h2>
        <p className="text-sm text-[#5B6B7C] mt-2">Contacta a tu administrador para completar la configuración.</p>
      </div>
    )
  }

  const orgId = profile.organization_id
  const now = new Date()
  const since30 = new Date(now.getTime() - 30 * 864e5).toISOString()

  const [{ data: activeT }, { data: created30 }, { data: resolved30 }, { data: projectsList }, { data: invoicesList }] = await Promise.all([
    supabase.from('tickets')
      .select('id, ticket_number, title, status, priority, created_at, profiles!assigned_to(full_name)')
      .eq('organization_id', orgId).not('status', 'in', ACTIVE_FILTER)
      .order('created_at', { ascending: false }).limit(300),
    supabase.from('tickets').select('created_at').eq('organization_id', orgId).gte('created_at', since30).limit(1000),
    supabase.from('tickets').select('resolved_at, sla_breached').eq('organization_id', orgId).not('resolved_at', 'is', null).gte('resolved_at', since30).limit(1000),
    supabase.from('projects').select('id, name, progress_percent, status').eq('organization_id', orgId).not('status', 'in', '("completed","cancelled")').order('created_at', { ascending: false }).limit(6),
    supabase.from('invoices').select('*').eq('organization_id', orgId).in('status', ['sent', 'overdue']).order('due_date', { ascending: true }).limit(6),
  ])

  type T = { id: string; ticket_number: number; title: string; status: string; priority: string; created_at: string; profiles?: { full_name: string } | { full_name: string }[] | null }
  const active = (activeT ?? []) as T[]
  const agentName = (p: T['profiles']) => (Array.isArray(p) ? p[0]?.full_name : p?.full_name) ?? null

  const openCount = active.filter(t => t.status === 'open').length
  const inProgress = active.filter(t => t.status === 'in_progress').length
  const waiting = active.filter(t => t.status === 'waiting_client').length
  const projects = (projectsList ?? []) as { id: string; name: string; progress_percent: number; status: string }[]
  const invoices = (invoicesList ?? []) as Invoice[]
  const pendingTotal = invoices.reduce((s, i) => s + (i.total_usd ?? 0), 0)

  const resolvedArr = (resolved30 ?? []) as { resolved_at: string; sla_breached: boolean | null }[]
  const resolvedTotal = resolvedArr.length
  const breached = resolvedArr.filter(t => t.sla_breached).length
  const slaCompliance = resolvedTotal > 0 ? Math.round(((resolvedTotal - breached) / resolvedTotal) * 100) : 100

  const statusAgg: Record<string, number> = {}; active.forEach(t => { statusAgg[t.status] = (statusAgg[t.status] ?? 0) + 1 })
  const byStatus = Object.entries(statusAgg).map(([status, count]) => ({ status, count }))
  const priorityAgg: Record<string, number> = {}; active.forEach(t => { priorityAgg[t.priority] = (priorityAgg[t.priority] ?? 0) + 1 })
  const byPriority = Object.entries(priorityAgg).map(([priority, count]) => ({ priority, count }))

  const createdByDay: Record<string, number> = {}; (created30 ?? []).forEach((t: { created_at: string }) => { const k = dayKey(new Date(t.created_at)); createdByDay[k] = (createdByDay[k] ?? 0) + 1 })
  const resolvedByDay: Record<string, number> = {}; resolvedArr.forEach(t => { const k = dayKey(new Date(t.resolved_at)); resolvedByDay[k] = (resolvedByDay[k] ?? 0) + 1 })
  const days: { day: string; creados: number; resueltos: number }[] = []
  for (let i = 13; i >= 0; i--) { const d = new Date(now.getTime() - i * 864e5); const k = dayKey(d); days.push({ day: `${d.getDate()}/${d.getMonth() + 1}`, creados: createdByDay[k] ?? 0, resueltos: resolvedByDay[k] ?? 0 }) }
  const spark = (obj: Record<string, number>) => { const o: number[] = []; for (let i = 6; i >= 0; i--) o.push(obj[dayKey(new Date(now.getTime() - i * 864e5))] ?? 0); return o }
  const gentle = (b: number) => [b * 0.6, b * 0.9, b * 0.7, b, b * 0.85, b * 1.1, b].map(Math.round)

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const dateStr = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const recent = active.slice(0, 6)

  const kpis = [
    { label: 'Tickets abiertos', value: openCount, icon: <Ticket size={18} />, color: '#00D4AA', spark: spark(createdByDay), href: '/client/tickets' },
    { label: 'En progreso', value: inProgress, icon: <Activity size={18} />, color: '#06B6D4', spark: gentle(Math.max(1, inProgress)), href: '/client/tickets' },
    { label: 'Esperan tu respuesta', value: waiting, icon: <Timer size={18} />, color: '#F59E0B', spark: gentle(Math.max(1, waiting)), delta: waiting > 0 ? 'acción' : 'ok', deltaUp: waiting === 0, href: '/client/tickets' },
    { label: 'Proyectos activos', value: projects.length, icon: <Briefcase size={18} />, color: '#10B981', spark: gentle(Math.max(1, projects.length)), href: '/client/projects' },
    { label: 'Facturas pendientes', value: invoices.length, icon: <FileText size={18} />, color: '#8B5CF6', spark: gentle(Math.max(1, invoices.length)), href: '/client/invoices' },
  ]

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse-glow" /> En vivo
            </span>
            <span className="text-sm capitalize" style={{ color: '#5B6B7C' }}>{dateStr}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#0B2545' }}>
            {greeting}, {profile.full_name.split(' ')[0]} 👋
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#5B6B7C' }}>Resumen de tu cuenta y soporte</p>
        </div>
        <Link href="/client/tickets/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
          style={{ background: '#00D4AA', boxShadow: '0 4px 14px rgba(0, 212, 170,0.35)' }}>
          <Plus size={16} /> Nuevo ticket
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((k, i) => <KpiCard key={k.label} {...k} index={i} />)}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0B2545' }}><Activity size={15} className="text-[#0E9E86]" /> Actividad de soporte · 14 días</h2>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5" style={{ color: '#5B6B7C' }}><span className="w-2.5 h-2.5 rounded-full bg-[#00D4AA]" /> Creados</span>
              <span className="flex items-center gap-1.5" style={{ color: '#5B6B7C' }}><span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Resueltos</span>
            </div>
          </div>
          <TrendChart data={days} />
        </div>
        <div className="rounded-2xl p-5 flex flex-col" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: '#0B2545' }}>Nivel de servicio</h2>
          <SlaGauge value={slaCompliance} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            <div className="text-center rounded-xl py-2" style={{ background: '#F7F9FC' }}>
              <div className="text-lg font-bold" style={{ color: '#10B981' }}><AnimatedCounter value={resolvedTotal} /></div>
              <div className="text-[10px]" style={{ color: '#5B6B7C' }}>Resueltos 30d</div>
            </div>
            <div className="text-center rounded-xl py-2" style={{ background: '#F7F9FC' }}>
              <div className="text-lg font-bold" style={{ color: '#8B5CF6' }}>${pendingTotal.toLocaleString('es-CO')}</div>
              <div className="text-[10px]" style={{ color: '#5B6B7C' }}>Saldo pendiente</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#0B2545' }}>Mis tickets por estado</h2>
          <StatusDonut data={byStatus} />
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#0B2545' }}>Mis tickets por prioridad</h2>
          <PriorityBars data={byPriority} />
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0B2545' }}><Briefcase size={15} className="text-[#10B981]" /> Proyectos</h2>
            <Link href="/client/projects" className="text-xs" style={{ color: '#00D4AA' }}>Ver todos</Link>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#94A3B8' }}>Sin proyectos activos</p>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 4).map(p => {
                const pct = p.progress_percent ?? 0
                return (
                  <Link key={p.id} href="/client/projects" className="flex items-center gap-3">
                    <div className="relative shrink-0" style={{ width: 40, height: 40 }}>
                      <svg width="40" height="40" className="-rotate-90">
                        <circle cx="20" cy="20" r="16" fill="none" stroke="#E6EBF2" strokeWidth="3.5" />
                        <circle cx="20" cy="20" r="16" fill="none" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 16}`} strokeDashoffset={`${2 * Math.PI * 16 * (1 - pct / 100)}`} />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color: '#0B2545' }}>{pct}%</span>
                    </div>
                    <p className="text-sm font-medium truncate flex-1" style={{ color: '#0B2545' }}>{p.name}</p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent tickets */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E6EBF2' }}>
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0B2545' }}><Clock size={15} className="text-[#0E9E86]" /> Tickets recientes</h2>
          <Link href="/client/tickets" className="flex items-center gap-1 text-xs" style={{ color: '#00D4AA' }}>Ver todos <ArrowRight size={12} /></Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <CheckCircle2 size={32} className="mx-auto mb-3 text-[#CBD5E1]" />
            <p className="text-sm" style={{ color: '#5B6B7C' }}>No tienes tickets activos</p>
            <Link href="/client/tickets/new" className="mt-3 inline-block text-sm" style={{ color: '#00D4AA' }}>Crear tu primer ticket →</Link>
          </div>
        ) : (
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #E6EBF2' }}>
                {['#', 'Título', 'Prioridad', 'Estado', 'Agente'].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map(t => (
                <tr key={t.id} className="transition-colors hover:bg-[rgba(0, 212, 170,0.04)]" style={{ borderBottom: '1px solid #F4F7FB' }}>
                  <td className="px-5 py-3"><Link href={`/client/tickets/${t.id}`} className="font-mono text-xs hover:underline" style={{ color: '#00D4AA' }}>#{t.ticket_number}</Link></td>
                  <td className="px-5 py-3"><Link href={`/client/tickets/${t.id}`} className="text-xs line-clamp-1 max-w-[240px] transition-colors hover:text-[#0E9E86]" style={{ color: '#0B2545' }}>{t.title}</Link></td>
                  <td className="px-5 py-3"><PriorityBadge priority={t.priority as never} /></td>
                  <td className="px-5 py-3"><StatusBadge status={t.status as never} /></td>
                  <td className="px-5 py-3 text-xs" style={{ color: '#94A3B8' }}>{agentName(t.profiles) ?? 'Sin asignar'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #E6EBF2' }}>
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0B2545' }}><FileText size={15} className="text-[#F59E0B]" /> Facturas pendientes</h2>
          </div>
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #E6EBF2' }}>
                {['Número', 'Emisión', 'Vencimiento', 'Total', 'Estado'].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="transition-colors hover:bg-[rgba(0, 212, 170,0.04)]" style={{ borderBottom: '1px solid #F4F7FB' }}>
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: '#5B6B7C' }}>{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-xs" style={{ color: '#5B6B7C' }}>{fmtDateOnly(inv.issue_date)}</td>
                  <td className="px-5 py-3 text-xs" style={{ color: '#5B6B7C' }}>{fmtDateOnly(inv.due_date)}</td>
                  <td className="px-5 py-3 font-medium text-xs" style={{ color: '#0B2545' }}>${inv.total_usd.toLocaleString()} {inv.currency}</td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={inv.status === 'overdue' ? { background: 'rgba(239,68,68,0.15)', color: '#EF4444' } : { background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                      {inv.status === 'overdue' ? 'Vencida' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}
