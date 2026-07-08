import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock, Send, CornerLeftUp, Paperclip, Receipt } from 'lucide-react'
import { SLATimer } from '@/shared/components/sla-timer'
import { PriorityBadge, StatusBadge } from '@/shared/components/priority-badge'
import { AutoSubmitSelect } from '@/shared/components/auto-submit-select'
import { updateTicketStatus, updateTicketPriority, addComment, assignTicket } from '@/features/tickets/services/agent.service'
import { SplitTicketButton } from '@/features/tickets/components/split-ticket-button'
import { SubtasksList } from '@/features/tickets/components/subtasks-list'
import { AiAssistantPanel } from '@/features/tickets/components/ai-assistant-panel'
import { ApprovalPanel } from '@/features/admin/components/approval-panel'
import { StartRemoteSession } from '@/features/remote/start-remote-session'
import { TicketAssetsPanel } from '@/features/admin/components/ticket-assets-panel'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Ticket, TicketComment, TicketStatus, TicketPriority, Profile } from '@/lib/supabase/types'

interface Props { params: Promise<{ id: string }> }

type Att = { id: string; file_name: string; file_url: string; mime_type: string | null; file_size_bytes: number | null }

/** Grid de adjuntos: preview inline para imágenes, enlace para el resto. */
function AttachmentGrid({ atts, signed }: { atts: Att[]; signed: Map<string, string> }) {
  if (!atts.length) return null
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {atts.map(a => {
        const url = signed.get(a.id) ?? a.file_url
        const isImg = (a.mime_type ?? '').startsWith('image/')
        return isImg ? (
          <a key={a.id} href={url} target="_blank" rel="noreferrer" title={a.file_name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={a.file_name} className="h-24 w-24 object-cover rounded-lg border border-[#E6EBF2]" />
          </a>
        ) : (
          <a key={a.id} href={url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#1789FC] hover:underline">
            <Paperclip size={12} /> {a.file_name}
          </a>
        )
      })}
    </div>
  )
}

export default async function AdminTicketDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, organizations(name), parent:parent_ticket_id(id, ticket_number, title)')
    .eq('id', id)
    .single()

  if (!ticket) notFound()

  const [commentsRes, agentsRes, requesterRes, ticketAttsRes] = await Promise.all([
    supabase.from('ticket_comments')
      .select('*, profiles!author_id(full_name, role), ticket_attachments(id, file_name, file_url, mime_type, file_size_bytes)')
      .eq('ticket_id', id).order('created_at', { ascending: true }),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'agent']).eq('is_active', true),
    ticket.created_by
      ? supabase.from('profiles').select('full_name, email').eq('id', ticket.created_by).single()
      : Promise.resolve({ data: null }),
    supabase.from('ticket_attachments')
      .select('id, file_name, file_url, mime_type, file_size_bytes')
      .eq('ticket_id', id).is('comment_id', null),
  ])

  const t = ticket as Ticket & { parent?: { id: string; ticket_number: number; title: string } | null }
  const comments = (commentsRes.data ?? []) as (TicketComment & { profiles?: Profile; ticket_attachments?: Att[] })[]
  const ticketAtts = (ticketAttsRes.data ?? []) as Att[]

  // Firma URLs (bucket privado) para todos los adjuntos del ticket y de comentarios.
  const allAtts: Att[] = [...ticketAtts, ...comments.flatMap(c => c.ticket_attachments ?? [])]
  const signed = new Map<string, string>()
  await Promise.all(allAtts.map(async a => {
    const path = a.file_url.split('/ticket-attachments/')[1]
    if (!path) { signed.set(a.id, a.file_url); return }
    const { data } = await supabase.storage.from('ticket-attachments').createSignedUrl(decodeURIComponent(path), 3600)
    signed.set(a.id, data?.signedUrl ?? a.file_url)
  }))
  const agents = agentsRes.data ?? []
  const requester = requesterRes.data as { full_name: string; email: string } | null

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
    redirect(`/admin/tickets/${id}`)
  }
  async function handlePriorityChange(formData: FormData) {
    'use server'
    await updateTicketPriority(id, formData.get('priority') as TicketPriority)
    redirect(`/admin/tickets/${id}`)
  }
  async function handleAssign(formData: FormData) {
    'use server'
    await assignTicket(id, formData.get('agent_id') as string)
    redirect(`/admin/tickets/${id}`)
  }
  async function handleAddComment(formData: FormData) {
    'use server'
    const content = formData.get('content') as string
    const isInternal = formData.get('is_internal') === 'on'
    if (content?.trim()) await addComment(id, content, isInternal)
    redirect(`/admin/tickets/${id}`)
  }

  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/admin/tickets" className="inline-flex items-center gap-2 text-sm text-[#5B6B7C] hover:text-[#0B2545]">
        <ArrowLeft size={14} /> Volver a tickets
      </Link>

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-xs text-[#5B6B7C]">#{t.ticket_number}</span>
            <span className="text-xs text-[#5B6B7C]">{(t as { organizations?: { name: string } }).organizations?.name}</span>
            {t.parent && (
              <Link
                href={`/admin/tickets/${t.parent.id}`}
                className="inline-flex items-center gap-1 text-xs text-[#1789FC] bg-[#1789FC]/10 border border-[#1789FC]/20 px-2 py-0.5 rounded-full hover:bg-[#1789FC]/20 transition-colors"
              >
                <CornerLeftUp size={10} />
                Ticket padre: #{t.parent.ticket_number}
              </Link>
            )}
          </div>
          <h1 className="text-xl font-semibold text-[#0B2545]">{t.title}</h1>
          <p className="text-sm text-[#5B6B7C] mt-1">{t.description}</p>
          <AttachmentGrid atts={ticketAtts} signed={signed} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={t.priority} />
          <StatusBadge status={t.status} />
          <SplitTicketButton parentId={t.id} isSubtask={!!t.parent_ticket_id} />
          {t.organization_id && (
            <Link
              href={`/admin/invoices?org=${t.organization_id}&ticket=${t.id}&desc=${encodeURIComponent(`Ticket #${t.ticket_number} — ${t.title}`)}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E6EBF2] text-[#10B981] bg-[#FFFFFF] hover:bg-[#10B981]/10 transition-colors"
            >
              <Receipt size={13} /> Facturar
            </Link>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <SLATimer dueAt={t.sla_resolution_due_at} createdAt={t.created_at} />
          <div className="mt-3 pt-3 border-t border-[#E6EBF2]/50 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[#5B6B7C]">Creado</span>
              <span className="text-[#5B6B7C]">{format(new Date(t.created_at), 'dd MMM yyyy', { locale: es })}</span>
            </div>
            {t.first_response_at && (
              <div className="flex justify-between text-xs">
                <span className="text-[#5B6B7C]">1ra respuesta</span>
                <span className="text-[#10B981]">{format(new Date(t.first_response_at), 'dd MMM HH:mm', { locale: es })}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-[#5B6B7C]">Estado</p>
          <form action={handleStatusChange}>
            <AutoSubmitSelect name="status" defaultValue={t.status}
              options={statusOptions.map(s => ({ value: s, label: statusLabels[s] }))}
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors" />
          </form>
          <p className="text-xs font-medium text-[#5B6B7C]">Prioridad</p>
          <form action={handlePriorityChange}>
            <AutoSubmitSelect name="priority" defaultValue={t.priority}
              options={priorityOptions.map(p => ({ value: p, label: priorityLabels[p] }))}
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors" />
          </form>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-[#5B6B7C]">Asignar a</p>
          <form action={handleAssign}>
            <AutoSubmitSelect name="agent_id" defaultValue={t.assigned_to ?? ''}
              options={[{ value: '', label: 'Sin asignar' }, ...agents.map(a => ({ value: a.id, label: a.full_name }))]}
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors" />
          </form>
        </div>
      </div>

      {/* Aprobación (solicitudes de servicio) */}
      <ApprovalPanel entityType="service_request" entityId={id} />

      {/* Asistente IA */}
      <AiAssistantPanel ticketId={id} />

      {/* Activos afectados (CMDB) */}
      <TicketAssetsPanel ticketId={id} />

      {/* Soporte remoto */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
        <p className="text-xs font-medium text-[#5B6B7C] mb-2.5">🖥️ Soporte remoto — la sesión queda registrada en este ticket</p>
        <div className="flex gap-2 flex-wrap">
          <StartRemoteSession basePath="/admin" mode="screen" ticketId={id} compact />
          <StartRemoteSession basePath="/admin" mode="control" ticketId={id} compact />
        </div>
      </div>

      {/* Subtasks */}
      <SubtasksList parentId={id} />

      {/* Comments */}
      <div>
        <h2 className="text-sm font-semibold text-[#0B2545] mb-3">Conversación ({comments.length})</h2>
        <div className="space-y-3 mb-4">
          {comments.map(c => (
            <div key={c.id} className={`p-4 rounded-xl border ${c.is_internal ? 'bg-[#F59E0B]/5 border-[#F59E0B]/20' : 'bg-[#FFFFFF] border-[#E6EBF2]'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-[#E6EBF2] flex items-center justify-center text-xs">{c.profiles?.full_name?.charAt(0)}</div>
                <span className="text-xs font-medium text-[#5B6B7C]">{c.profiles?.full_name}</span>
                {c.is_internal && (
                  <span className="flex items-center gap-1 text-[10px] text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded-full">
                    <Lock size={9} /> Nota interna
                  </span>
                )}
                <span className="text-[10px] text-[#5B6B7C] ml-auto">
                  {formatDistanceToNow(new Date(c.created_at), { locale: es, addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-[#0B2545]">{c.content}</p>
              <AttachmentGrid atts={c.ticket_attachments ?? []} signed={signed} />
            </div>
          ))}
        </div>
        <form action={handleAddComment} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 space-y-3">
          <textarea name="content" rows={3} placeholder="Escribe un comentario..."
            className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#1789FC] transition-colors resize-none text-sm" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="is_internal" className="w-4 h-4 rounded border-[#E6EBF2] bg-[#F4F7FB] accent-[#F59E0B]" />
              <span className="text-xs text-[#5B6B7C] flex items-center gap-1"><Lock size={11} /> Nota interna</span>
            </label>
            <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Send size={14} /> Enviar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
