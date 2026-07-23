import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { RmmOrgPanel } from '@/features/rmm/rmm-org-panel'
import {
  ArrowLeft, Ticket, MessageSquare, CheckCircle, FileText, FileSignature,
  Building2, Mail, CalendarDays, Briefcase, Clock,
} from 'lucide-react'

interface Props { params: Promise<{ id: string }> }

// ─── Types ────────────────────────────────────────────────────────────────────

type TimelineEventType =
  | 'ticket_created'
  | 'ticket_resolved'
  | 'comment_added'
  | 'invoice_sent'
  | 'contract_signed'

interface TimelineEvent {
  id: string
  type: TimelineEventType
  date: string
  title: string
  subtitle: string | null
  href: string | null
}

interface ContractRow {
  id: string
  name: string
  contract_type: string
  support_tier: string
  status: string
  start_date: string
  end_date: string
}

interface InvoiceRow {
  id: string
  invoice_number: string
  total_usd: number
  status: string
  due_date: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `hace ${months} mes${months > 1 ? 'es' : ''}`
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const EVENT_CONFIG: Record<TimelineEventType, {
  Icon: React.ElementType
  iconBg: string
  iconColor: string
  lineDot: string
}> = {
  ticket_created: {
    Icon: Ticket,
    iconBg: 'bg-[#00D4AA]/15',
    iconColor: 'text-[#0E9E86]',
    lineDot: 'bg-[#00D4AA]',
  },
  ticket_resolved: {
    Icon: CheckCircle,
    iconBg: 'bg-[#10B981]/15',
    iconColor: 'text-[#10B981]',
    lineDot: 'bg-[#10B981]',
  },
  comment_added: {
    Icon: MessageSquare,
    iconBg: 'bg-[#CBD5E1]/30',
    iconColor: 'text-[#5B6B7C]',
    lineDot: 'bg-[#CBD5E1]',
  },
  invoice_sent: {
    Icon: FileText,
    iconBg: 'bg-[#F59E0B]/15',
    iconColor: 'text-[#F59E0B]',
    lineDot: 'bg-[#F59E0B]',
  },
  contract_signed: {
    Icon: FileSignature,
    iconBg: 'bg-[#8B5CF6]/15',
    iconColor: 'text-[#8B5CF6]',
    lineDot: 'bg-[#8B5CF6]',
  },
}

const EVENT_LABEL: Record<TimelineEventType, string> = {
  ticket_created: 'Ticket creado',
  ticket_resolved: 'Ticket resuelto',
  comment_added: 'Comentario añadido',
  invoice_sent: 'Factura enviada',
  contract_signed: 'Contrato activo',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientTimelinePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  // Load client profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, job_title, role, created_at, organization_id')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  // Load organization
  const orgRes = profile.organization_id
    ? await supabase.from('organizations').select('id, name, rmm_enabled').eq('id', profile.organization_id).single()
    : { data: null }
  const org = orgRes.data as { id: string; name: string; rmm_enabled?: boolean } | null

  // Parallel data fetches
  const [ticketsRes, commentsRes, invoicesRes, contractsRes] = await Promise.all([
    // All tickets created by this user
    supabase
      .from('tickets')
      .select('id, ticket_number, title, status, created_at, resolved_at, satisfaction_score, organization_id')
      .eq('created_by', id)
      .order('created_at', { ascending: false }),

    // Comments by this user on any ticket
    supabase
      .from('ticket_comments')
      .select('id, ticket_id, content, created_at')
      .eq('author_id', id)
      .order('created_at', { ascending: false }),

    // Invoices for the org
    org
      ? supabase
          .from('invoices')
          .select('id, invoice_number, total_usd, status, due_date, issue_date, created_at')
          .eq('organization_id', org.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as InvoiceRow[] }),

    // Contracts for the org
    org
      ? supabase
          .from('service_contracts')
          .select('id, name, contract_type, support_tier, status, start_date, end_date, created_at')
          .eq('organization_id', org.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as ContractRow[] }),
  ])

  const tickets = ticketsRes.data ?? []
  const comments = commentsRes.data ?? []
  const invoices = (invoicesRes.data ?? []) as InvoiceRow[]
  const contracts = (contractsRes.data ?? []) as ContractRow[]

  // ─── Metrics ────────────────────────────────────────────────────────────────
  const totalTickets = tickets.length
  const openTickets = tickets.filter(t => !['resolved', 'closed', 'cancelled'].includes(t.status)).length
  const activeContracts = contracts.filter(c => c.status === 'active').length

  const scoresWithValues = tickets.filter(t => t.satisfaction_score !== null && t.satisfaction_score !== undefined)
  const avgSatisfaction = scoresWithValues.length > 0
    ? (scoresWithValues.reduce((sum, t) => sum + (t.satisfaction_score as number), 0) / scoresWithValues.length).toFixed(1)
    : null

  // ─── Build timeline ─────────────────────────────────────────────────────────
  const events: TimelineEvent[] = []

  // Ticket created events
  tickets.forEach(t => {
    events.push({
      id: `ticket-created-${t.id}`,
      type: 'ticket_created',
      date: t.created_at,
      title: `Ticket #${t.ticket_number}: ${t.title}`,
      subtitle: null,
      href: `/admin/tickets/${t.id}`,
    })
  })

  // Ticket resolved events
  tickets.filter(t => t.resolved_at).forEach(t => {
    events.push({
      id: `ticket-resolved-${t.id}`,
      type: 'ticket_resolved',
      date: t.resolved_at as string,
      title: `Ticket #${t.ticket_number} resuelto`,
      subtitle: t.title,
      href: `/admin/tickets/${t.id}`,
    })
  })

  // Comment events (show truncated content)
  comments.forEach(c => {
    const preview = c.content.length > 80 ? c.content.slice(0, 80) + '...' : c.content
    events.push({
      id: `comment-${c.id}`,
      type: 'comment_added',
      date: c.created_at,
      title: `Comentario en ticket`,
      subtitle: preview,
      href: c.ticket_id ? `/admin/tickets/${c.ticket_id}` : null,
    })
  })

  // Invoice events
  invoices.forEach(inv => {
    if (['sent', 'paid', 'overdue'].includes(inv.status)) {
      events.push({
        id: `invoice-${inv.id}`,
        type: 'invoice_sent',
        date: inv.due_date,
        title: `Factura ${inv.invoice_number}`,
        subtitle: `$${inv.total_usd.toLocaleString('es-CO')} · ${inv.status}`,
        href: `/admin/invoices/${inv.id}`,
      })
    }
  })

  // Contract events
  contracts.forEach(c => {
    if (c.status === 'active') {
      events.push({
        id: `contract-${c.id}`,
        type: 'contract_signed',
        date: c.start_date,
        title: `Contrato: ${c.name}`,
        subtitle: `${c.contract_type} · ${c.support_tier}`,
        href: `/admin/contracts`,
      })
    }
  })

  // Sort chronologically descending
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // ─── Sidebar data ────────────────────────────────────────────────────────────
  const activeContractsList = contracts.filter(c => c.status === 'active')
  const pendingInvoices = invoices.filter(i => ['sent', 'overdue'].includes(i.status))

  const roleBadgeStyle = profile.role === 'admin'
    ? 'bg-[#00D4AA]/15 text-[#0E9E86]'
    : profile.role === 'agent'
    ? 'bg-[#00D4AA]/15 text-[#00D4AA]'
    : 'bg-[#10B981]/15 text-[#10B981]'

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Back */}
      <Link href="/admin/clients" className="inline-flex items-center gap-1.5 text-sm text-[#5B6B7C] hover:text-[#0B2545] transition-colors">
        <ArrowLeft size={14} /> Volver a clientes
      </Link>

      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00D4AA] to-[#8B5CF6] flex items-center justify-center text-white text-xl font-bold shrink-0">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-[#0B2545]">{profile.full_name}</h1>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${roleBadgeStyle}`}>
                  {profile.role}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-sm text-[#5B6B7C]">
                  <Mail size={12} className="text-[#CBD5E1]" />
                  {profile.email}
                </span>
                {profile.job_title && (
                  <span className="flex items-center gap-1 text-sm text-[#5B6B7C]">
                    <Briefcase size={12} className="text-[#CBD5E1]" />
                    {profile.job_title}
                  </span>
                )}
                {org && (
                  <span className="flex items-center gap-1 text-sm text-[#5B6B7C]">
                    <Building2 size={12} className="text-[#CBD5E1]" />
                    {org.name}
                  </span>
                )}
                <span className="flex items-center gap-1 text-sm text-[#5B6B7C]">
                  <CalendarDays size={12} className="text-[#CBD5E1]" />
                  Desde {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-2xl font-bold text-[#0B2545]">{totalTickets}</p>
          <p className="text-xs text-[#5B6B7C] mt-0.5">Total tickets</p>
        </div>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-2xl font-bold text-[#F59E0B]">{openTickets}</p>
          <p className="text-xs text-[#5B6B7C] mt-0.5">Tickets abiertos</p>
        </div>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-2xl font-bold text-[#10B981]">{activeContracts}</p>
          <p className="text-xs text-[#5B6B7C] mt-0.5">Contratos activos</p>
        </div>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          {avgSatisfaction !== null ? (
            <>
              <p className="text-2xl font-bold text-[#0E9E86]">{avgSatisfaction}<span className="text-sm text-[#5B6B7C]">/5</span></p>
              <p className="text-xs text-[#5B6B7C] mt-0.5">Satisfacción prom.</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-[#CBD5E1]">—</p>
              <p className="text-xs text-[#5B6B7C] mt-0.5">Satisfacción prom.</p>
            </>
          )}
        </div>
      </div>

      {/* Main content + Sidebar */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-4">
            Timeline de actividad
            {events.length > 0 && (
              <span className="ml-2 text-xs text-[#5B6B7C] font-normal">{events.length} eventos</span>
            )}
          </h2>

          {events.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
              <Clock size={28} className="text-[#E6EBF2] mx-auto mb-3" />
              <p className="text-[#5B6B7C] text-sm">Sin actividad registrada aún.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-5 top-2 bottom-2 w-px bg-[#FFFFFF] border-l border-[#E6EBF2]" />

              <div className="space-y-1">
                {events.map(event => {
                  const cfg = EVENT_CONFIG[event.type]
                  const Icon = cfg.Icon
                  const label = EVENT_LABEL[event.type]

                  return (
                    <div key={event.id} className="relative flex gap-4 group">
                      {/* Icon dot */}
                      <div className={`relative z-10 w-10 h-10 rounded-full ${cfg.iconBg} flex items-center justify-center shrink-0 mt-0.5 border border-[#FFFFFF]`}>
                        <Icon size={15} className={cfg.iconColor} />
                      </div>

                      {/* Content card */}
                      <div className="flex-1 bg-[#FFFFFF] border border-[#E6EBF2]/50 rounded-xl px-4 py-3 mb-2 hover:border-[#E6EBF2] transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.iconColor} mr-2`}>
                              {label}
                            </span>
                            <span className="text-[11px] text-[#CBD5E1]">{relativeTime(event.date)}</span>

                            <p className="text-sm text-[#0B2545] font-medium mt-0.5 leading-snug">
                              {event.title}
                            </p>
                            {event.subtitle && (
                              <p className="text-xs text-[#5B6B7C] mt-0.5 leading-relaxed">{event.subtitle}</p>
                            )}
                          </div>
                          {event.href && (
                            <Link
                              href={event.href}
                              className="shrink-0 text-[11px] text-[#0E9E86] hover:underline mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Ver →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Active contracts */}
          <div>
            <h3 className="text-sm font-semibold text-[#0B2545] mb-3">Contratos activos</h3>
            {activeContractsList.length === 0 ? (
              <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 text-center">
                <FileSignature size={20} className="text-[#E6EBF2] mx-auto mb-2" />
                <p className="text-xs text-[#5B6B7C]">Sin contratos activos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeContractsList.map(c => (
                  <div key={c.id} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0B2545] truncate">{c.name}</p>
                        <p className="text-xs text-[#5B6B7C] mt-0.5">{c.contract_type} · {c.support_tier}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] font-medium shrink-0">
                        Activo
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-xs text-[#5B6B7C]">
                      <CalendarDays size={11} />
                      <span>{formatDate(c.start_date)} – {formatDate(c.end_date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending invoices */}
          <div>
            <h3 className="text-sm font-semibold text-[#0B2545] mb-3">Facturas pendientes</h3>
            {pendingInvoices.length === 0 ? (
              <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 text-center">
                <FileText size={20} className="text-[#E6EBF2] mx-auto mb-2" />
                <p className="text-xs text-[#5B6B7C]">Sin facturas pendientes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingInvoices.map(inv => (
                  <Link
                    key={inv.id}
                    href={`/admin/invoices/${inv.id}`}
                    className="block bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 hover:border-[#F59E0B]/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[#0B2545] font-mono">{inv.invoice_number}</p>
                        <p className="text-xs text-[#5B6B7C] mt-0.5">Vence {formatDate(inv.due_date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#0B2545]">${inv.total_usd.toLocaleString('es-CO')}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          inv.status === 'overdue'
                            ? 'bg-[#EF4444]/15 text-[#EF4444]'
                            : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                        }`}>
                          {inv.status === 'overdue' ? 'Vencida' : 'Enviada'}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Módulo RMM (solo aparece si el cliente tiene organización) */}
      {org && <RmmOrgPanel organizationId={org.id} initialEnabled={!!org.rmm_enabled} />}
    </div>
  )
}
