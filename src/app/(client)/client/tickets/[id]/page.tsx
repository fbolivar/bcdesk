import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, Paperclip } from 'lucide-react'
import { SLATimer } from '@/shared/components/sla-timer'
import { PriorityBadge, StatusBadge } from '@/shared/components/priority-badge'
import { reopenTicket, rateTicket } from '@/features/tickets/services/client.service'
import { CsatRating } from '@/features/tickets/components/csat-rating'
import { ClientCommentForm } from '@/features/tickets/components/client-comment-form'
import { ApprovalPanel } from '@/features/admin/components/approval-panel'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Ticket, TicketComment } from '@/lib/supabase/types'
import { TICKET_CATEGORY_LABELS } from '@/lib/tickets/categories'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClientTicketDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('organization_id').eq('id', user.id).single()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, organizations(name)')
    .eq('id', id).single()

  const ownTicket = ticket?.created_by === user.id
  const orgTicket = profile?.organization_id != null && ticket?.organization_id === profile.organization_id
  if (!ticket || (!ownTicket && !orgTicket)) notFound()

  const { data: assignedProfile } = ticket.assigned_to
    ? await supabase.from('profiles').select('full_name, job_title').eq('id', ticket.assigned_to).single()
    : { data: null }

  const [commentsRes, attachmentsRes] = await Promise.all([
    supabase.from('ticket_comments')
      .select('*, profiles!author_id(full_name, role), ticket_attachments(id, file_name, file_url, mime_type, file_size_bytes)')
      .eq('ticket_id', id).eq('is_internal', false).order('created_at', { ascending: true }),
    supabase.from('ticket_attachments').select('*').eq('ticket_id', id).is('comment_id', null),
  ])

  const t = ticket as Ticket & { organizations?: { name: string } }
  const commentList = (commentsRes.data ?? []) as (TicketComment & {
    profiles?: { full_name: string; role: string }
    ticket_attachments?: { id: string; file_name: string; file_url: string; mime_type: string; file_size_bytes: number }[]
  })[]

  async function handleRate(score: number, comment: string) {
    'use server'
    await rateTicket(id, score, comment)
  }

  const categoryLabels = TICKET_CATEGORY_LABELS as Record<string, string>

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/client/tickets" className="inline-flex items-center gap-2 text-sm text-[#5B6B7C] hover:text-[#0B2545] mb-4">
          <ArrowLeft size={14} /> Volver a tickets
        </Link>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-[#5B6B7C]">#{t.ticket_number}</span>
              <span className="text-xs text-[#5B6B7C]">·</span>
              <span className="text-xs text-[#5B6B7C]">{categoryLabels[t.category]}</span>
            </div>
            <h1 className="text-xl font-semibold text-[#0B2545]">{t.title}</h1>
            {t.tags && t.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {t.tags.map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#E6EBF2] text-[#5B6B7C]">{tag}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={t.priority} />
            <StatusBadge status={t.status} />
          </div>
        </div>
      </div>

      {/* SLA + info */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 space-y-3">
          <SLATimer dueAt={t.sla_resolution_due_at} createdAt={t.created_at} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-2 border-t border-[#E6EBF2]/50">
            <div>
              <p className="text-xs text-[#5B6B7C] mb-0.5">Creado</p>
              <p className="text-[#5B6B7C]">{format(new Date(t.created_at), 'dd MMM yyyy', { locale: es })}</p>
            </div>
            <div>
              <p className="text-xs text-[#5B6B7C] mb-0.5">Asignado a</p>
              <p className="text-[#5B6B7C]">
                {assignedProfile?.full_name ?? 'Sin asignar'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-xs text-[#5B6B7C] mb-2">Descripción original</p>
          <p className="text-sm text-[#5B6B7C] leading-relaxed">{t.description}</p>
          {(attachmentsRes.data ?? []).length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#E6EBF2]/50 space-y-1">
              <p className="text-[10px] text-[#5B6B7C] mb-1">Adjuntos</p>
              {(attachmentsRes.data ?? []).map(a => (
                <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-[#1789FC] hover:underline">
                  <Paperclip size={11} /> {a.file_name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Aprobación (solicitudes de servicio) */}
      <ApprovalPanel entityType="service_request" entityId={id} />

      {/* Comments */}
      <div>
        <h2 className="text-sm font-semibold text-[#0B2545] mb-3">
          Conversación <span className="text-[#5B6B7C] font-normal">({commentList.length})</span>
        </h2>

        <div className="space-y-3 mb-4">
          {commentList.length === 0 && (
            <p className="text-sm text-[#5B6B7C] py-4 text-center">Sin mensajes aún. Escribe el primero.</p>
          )}
          {commentList.map(comment => {
            const isAgent = comment.profiles?.role !== 'client'
            return (
              <div key={comment.id} className={`flex gap-3 ${!isAgent ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                  isAgent ? 'bg-[#1789FC]/20 text-[#1789FC]' : 'bg-[#E6EBF2] text-[#5B6B7C]'
                }`}>
                  {comment.profiles?.full_name?.charAt(0) ?? '?'}
                </div>
                <div className={`flex-1 max-w-[80%]`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-[#5B6B7C]">{comment.profiles?.full_name}</span>
                    {isAgent && <span className="text-[10px] text-[#1789FC] bg-[#1789FC]/10 px-1.5 py-0.5 rounded-full">Equipo BC</span>}
                    <span className="text-[10px] text-[#5B6B7C]">
                      {formatDistanceToNow(new Date(comment.created_at), { locale: es, addSuffix: true })}
                    </span>
                  </div>
                  <div className={`px-4 py-3 rounded-xl text-sm text-[#0B2545] leading-relaxed ${
                    isAgent ? 'bg-[#FFFFFF] border border-[#E6EBF2]' : 'bg-[#1789FC]/20 border border-[#1789FC]/30'
                  }`}>
                    {comment.content}
                    {comment.ticket_attachments && comment.ticket_attachments.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                        {comment.ticket_attachments.map(a => (
                          <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-xs text-[#1789FC] hover:underline">
                            <Paperclip size={11} /> {a.file_name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {['open', 'in_progress', 'waiting_client'].includes(t.status) && (
          <ClientCommentForm ticketId={id} />
        )}

        {['resolved', 'closed'].includes(t.status) && (
          <div className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-[#10B981]">
                {t.status === 'resolved' ? 'Ticket resuelto ✓' : 'Ticket cerrado'}
              </p>
              <form action={async () => { 'use server'; await reopenTicket(id) }}>
                <button type="submit"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#F59E0B]/10 text-xs font-medium transition-colors">
                  <RotateCcw size={12} /> Reabrir
                </button>
              </form>
            </div>
            {!t.satisfaction_score ? (
              <CsatRating onRate={handleRate} />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm">{'⭐'.repeat(t.satisfaction_score)}</span>
                <span className="text-xs text-[#5B6B7C]">Tu calificación</span>
                {t.satisfaction_comment && (
                  <span className="text-xs text-[#5B6B7C] italic">"{t.satisfaction_comment}"</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
