import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock, Paperclip } from 'lucide-react'
import { SLATimer } from '@/shared/components/sla-timer'
import { PriorityBadge, StatusBadge } from '@/shared/components/priority-badge'
import { AutoSubmitSelect } from '@/shared/components/auto-submit-select'
import { updateTicketStatus, updateTicketPriority, assignTicket, updateTicketTags } from '@/features/tickets/services/agent.service'
import { ReplyBox } from '@/features/tickets/components/reply-box'
import { signAttachmentUrls } from '@/lib/storage/sign'
import { TagsEditor } from '@/features/tickets/components/tags-editor'
import { TICKET_CATEGORY_LABELS } from '@/lib/tickets/categories'
import { StartRemoteSession } from '@/features/remote/start-remote-session'
import { TicketAssetsPanel } from '@/features/admin/components/ticket-assets-panel'
import { TicketTimeline } from '@/features/tickets/components/ticket-timeline'
import { MergeTicketModal } from '@/features/tickets/components/merge-ticket-modal'
import { TicketPresence } from '@/features/tickets/components/ticket-presence'
import { ApplyMacroButton } from '@/features/tickets/components/apply-macro-button'
import { TimeTracker } from '@/features/tickets/components/time-tracker'
import { CustomFieldsPanel } from '@/features/tickets/components/custom-fields-panel'
import { AiAssistantPanel } from '@/features/tickets/components/ai-assistant-panel'
import { ApprovalPanel } from '@/features/admin/components/approval-panel'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Ticket, TicketComment, TicketStatus, TicketPriority, Profile } from '@/lib/supabase/types'
import { ClientContextPanel } from '@/features/tickets/components/client-context-panel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AgentTicketDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!myProfile || !['admin', 'agent'].includes(myProfile.role)) redirect('/dashboard')

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, organizations(name), created_by_profile:profiles!created_by(full_name, email), assigned_to_profile:profiles!assigned_to(full_name, job_title)')
    .eq('id', id).single()

  if (!ticket) notFound()

  const [commentsRes, agentsRes, auditRes, mergeTargetsRes, cannedRes, macrosRes, timeLogsRes, customFieldsRes, customValuesRes] = await Promise.all([
    supabase.from('ticket_comments')
      .select('*, profiles!author_id(full_name, role), ticket_attachments(id, file_name, file_url, file_size_bytes)')
      .eq('ticket_id', id).order('created_at', { ascending: true }),
    supabase.from('profiles').select('id, full_name, job_title').in('role', ['admin', 'agent']).eq('is_active', true),
    supabase.from('audit_logs')
      .select('*, profiles!actor_id(full_name)')
      .eq('resource_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('tickets').select('id, ticket_number, title, status')
      .not('id', 'eq', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('canned_responses').select('id, title, content, category').eq('is_active', true).order('title'),
    supabase.from('macros').select('id, name, actions').eq('is_active', true).order('name'),
    supabase.from('time_logs').select('*, profiles!agent_id(full_name)').eq('ticket_id', id).order('logged_at', { ascending: false }),
    supabase.from('custom_fields').select('*').eq('is_active', true).or(`category.is.null,category.eq.${ticket.category}`).order('order_index'),
    supabase.from('ticket_custom_values').select('field_id, value').eq('ticket_id', id),
  ])

  const t = ticket as Ticket & {
    organizations?: { name: string }
    created_by_profile?: { full_name: string; email: string }
    assigned_to_profile?: { full_name: string; job_title: string }
  }
  const comments = (commentsRes.data ?? []) as (TicketComment & {
    profiles?: Profile
    ticket_attachments?: { id: string; file_name: string; file_url: string; file_size_bytes: number }[]
  })[]
  const agents = agentsRes.data ?? []
  const signed = await signAttachmentUrls(supabase, comments.flatMap(c => c.ticket_attachments ?? []))
  const auditEntries = (auditRes.data ?? []) as {
    id: string; action: string; new_values: Record<string, unknown> | null
    old_values: Record<string, unknown> | null; created_at: string
    profiles?: { full_name: string } | null
  }[]
  const mergeTargets = (mergeTargetsRes.data ?? []) as { id: string; ticket_number: number; title: string; status: string }[]
  const cannedResponses = cannedRes.data ?? []
  const macros = macrosRes.data ?? []
  const timeLogs = timeLogsRes.data ?? []
  const customFields = customFieldsRes.data ?? []
  const customValues = customValuesRes.data ?? []

  const categoryLabels = TICKET_CATEGORY_LABELS as Record<string, string>
  const statusOptions: TicketStatus[] = ['open', 'in_progress', 'waiting_client', 'resolved', 'closed', 'cancelled']
  const statusLabels: Record<TicketStatus, string> = {
    open: 'Abierto', in_progress: 'En progreso', waiting_client: 'Esperando cliente',
    resolved: 'Resuelto', closed: 'Cerrado', cancelled: 'Cancelado',
  }
  const priorityOptions: TicketPriority[] = ['low', 'medium', 'high', 'critical']
  const priorityLabels: Record<TicketPriority, string> = {
    low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica',
  }

  async function handleStatusChange(formData: FormData) {
    'use server'
    await updateTicketStatus(id, formData.get('status') as TicketStatus)
  }
  async function handlePriorityChange(formData: FormData) {
    'use server'
    await updateTicketPriority(id, formData.get('priority') as TicketPriority)
  }
  async function handleAssign(formData: FormData) {
    'use server'
    await assignTicket(id, formData.get('agent_id') as string)
  }
  return (
    <div className="max-w-screen-xl">
      <div className="flex gap-6 items-start">
        {/* Columna principal */}
        <div className="flex-1 min-w-0 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <Link href="/agent/tickets" className="inline-flex items-center gap-2 text-sm text-[#5B6B7C] hover:text-[#0B2545]">
                <ArrowLeft size={14} /> Volver a tickets
              </Link>
              <TicketPresence ticketId={id} userId={user.id} userName={myProfile.full_name ?? myProfile.role} />
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-mono text-[#5B6B7C]">#{t.ticket_number}</span>
                  <span className="text-xs text-[#5B6B7C]">{categoryLabels[t.category]}</span>
                  <span className="text-xs text-[#5B6B7C]">·</span>
                  <span className="text-xs text-[#5B6B7C]">{(t as { organizations?: { name: string } }).organizations?.name}</span>
                </div>
                <h1 className="text-xl font-semibold text-[#0B2545]">{t.title}</h1>
                <p className="text-sm text-[#5B6B7C] mt-1 leading-relaxed">{t.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
                <MergeTicketModal currentTicketId={id} tickets={mergeTargets} />
                <ApplyMacroButton ticketId={id} macros={macros as any} />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* SLA */}
            <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
              <SLATimer dueAt={t.sla_resolution_due_at} createdAt={t.created_at} />
              <div className="mt-3 pt-3 border-t border-[#E6EBF2]/50 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-[#5B6B7C]">Creado</span>
                  <span className="text-xs text-[#5B6B7C]">{format(new Date(t.created_at), 'dd MMM yyyy HH:mm', { locale: es })}</span>
                </div>
                {t.first_response_at && (
                  <div className="flex justify-between">
                    <span className="text-xs text-[#5B6B7C]">1ra respuesta</span>
                    <span className="text-xs text-[#10B981]">{format(new Date(t.first_response_at), 'dd MMM HH:mm', { locale: es })}</span>
                  </div>
                )}
                {t.satisfaction_score && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#5B6B7C]">CSAT</span>
                    <span className="text-sm">{'⭐'.repeat(t.satisfaction_score)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Change status + priority */}
            <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 space-y-3">
              <p className="text-xs font-medium text-[#5B6B7C]">Cambiar estado</p>
              <form action={handleStatusChange}>
                <AutoSubmitSelect name="status" defaultValue={t.status}
                  options={statusOptions.map(s => ({ value: s, label: statusLabels[s] }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] transition-colors" />
              </form>
              <p className="text-xs font-medium text-[#5B6B7C] pt-1">Prioridad</p>
              <form action={handlePriorityChange}>
                <AutoSubmitSelect name="priority" defaultValue={t.priority}
                  options={priorityOptions.map(p => ({ value: p, label: priorityLabels[p] }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] transition-colors" />
              </form>
            </div>

            {/* Assign + tags */}
            <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 space-y-3">
              <p className="text-xs font-medium text-[#5B6B7C]">Asignado a</p>
              <form action={handleAssign}>
                <AutoSubmitSelect name="agent_id" defaultValue={t.assigned_to ?? ''}
                  options={[{ value: '', label: 'Sin asignar' }, ...agents.map(a => ({ value: a.id, label: a.full_name }))]}
                  className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] transition-colors" />
              </form>
              <TagsEditor ticketId={id} initialTags={t.tags ?? []} onUpdate={updateTicketTags} />
            </div>
          </div>

          {/* Custom fields */}
          <CustomFieldsPanel ticketId={id} fields={customFields as any} values={customValues} />

          {/* Time tracker */}
          <TimeTracker ticketId={id} initialLogs={timeLogs as any} />

          {/* Activos afectados (CMDB) */}
          <TicketAssetsPanel ticketId={id} />

          {/* Soporte remoto */}
          <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
            <p className="text-xs font-medium text-[#5B6B7C] mb-2.5">🖥️ Soporte remoto — la sesión queda registrada en este ticket</p>
            <div className="flex gap-2 flex-wrap">
              <StartRemoteSession basePath="/agent" mode="screen" ticketId={id} compact />
              <StartRemoteSession basePath="/agent" mode="control" ticketId={id} compact />
            </div>
          </div>

          {/* Aprobación (solicitudes de servicio) */}
          <ApprovalPanel entityType="service_request" entityId={id} />

          {/* Asistente IA */}
          <AiAssistantPanel ticketId={id} />

          {/* Comments */}
          <div>
            <h2 className="text-sm font-semibold text-[#0B2545] mb-3">
              Conversación <span className="text-[#5B6B7C] font-normal">({comments.length})</span>
            </h2>

            <div className="space-y-3 mb-4">
              {comments.length === 0 && (
                <p className="text-sm text-[#5B6B7C] py-4 text-center bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl">Sin mensajes aún.</p>
              )}
              {comments.map(comment => {
                const isInternal = comment.is_internal
                return (
                  <div key={comment.id} className={`p-4 rounded-xl border ${
                    isInternal ? 'bg-[#F59E0B]/5 border-[#F59E0B]/20' : 'bg-[#FFFFFF] border-[#E6EBF2]'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-[#E6EBF2] flex items-center justify-center text-xs">
                        {comment.profiles?.full_name?.charAt(0) ?? '?'}
                      </div>
                      <span className="text-xs font-medium text-[#5B6B7C]">{comment.profiles?.full_name}</span>
                      {isInternal && (
                        <span className="flex items-center gap-1 text-[10px] text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded-full">
                          <Lock size={9} /> Nota interna
                        </span>
                      )}
                      <span className="text-[10px] text-[#5B6B7C] ml-auto">
                        {formatDistanceToNow(new Date(comment.created_at), { locale: es, addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-[#0B2545] leading-relaxed">{comment.content}</p>
                    {comment.ticket_attachments && comment.ticket_attachments.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-2">
                        {comment.ticket_attachments.map(a => (
                          <a key={a.id} href={signed.get(a.id) ?? a.file_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-xs text-[#0E9E86] hover:underline">
                            <Paperclip size={11} /> {a.file_name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <ReplyBox ticketId={id} cannedResponses={cannedResponses} />

            <TicketTimeline entries={auditEntries} />
          </div>
        </div>

        {/* Columna derecha: contexto del cliente */}
        {t.created_by && (
          <div className="w-72 xl:w-80 shrink-0 hidden lg:block">
            <ClientContextPanel clientId={t.created_by} ticketId={id} />
          </div>
        )}
      </div>
    </div>
  )
}

