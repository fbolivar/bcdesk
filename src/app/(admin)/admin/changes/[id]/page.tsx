import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Play, Flag,
  GitPullRequest, User, Calendar, AlertTriangle,
} from 'lucide-react'
import {
  updateChangeStatus,
  submitForApproval,
  approveChange,
  rejectChange,
} from '@/features/admin/services/changes.service'
import { getApprovalState, decideApproval } from '@/features/admin/services/approval-engine.service'

interface Props { params: Promise<{ id: string }> }

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-[#334155] text-[#94A3B8]',
  submitted: 'bg-[#3B82F6]/20 text-[#3B82F6]',
  approved: 'bg-[#10B981]/20 text-[#10B981]',
  rejected: 'bg-[#EF4444]/20 text-[#EF4444]',
  in_progress: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  done: 'bg-[#6366F1]/20 text-[#6366F1]',
  cancelled: 'bg-[#334155] text-[#64748B]',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Enviado a CAB',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  in_progress: 'En progreso',
  done: 'Completado',
  cancelled: 'Cancelado',
}
const TYPE_COLOR: Record<string, string> = {
  standard: 'bg-[#6366F1]/20 text-[#6366F1]',
  normal: 'bg-[#3B82F6]/20 text-[#3B82F6]',
  emergency: 'bg-[#EF4444]/20 text-[#EF4444]',
}
const TYPE_LABEL: Record<string, string> = {
  standard: 'Estándar',
  normal: 'Normal',
  emergency: 'Emergencia',
}
const RISK_COLOR: Record<string, string> = {
  low: 'bg-[#10B981]/20 text-[#10B981]',
  medium: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  high: 'bg-[#EF4444]/20 text-[#EF4444]',
  critical: 'bg-[#DC2626]/20 text-[#DC2626]',
}
const RISK_LABEL: Record<string, string> = {
  low: 'Riesgo bajo',
  medium: 'Riesgo medio',
  high: 'Riesgo alto',
  critical: 'Riesgo crítico',
}

const WORKFLOW_STEPS = [
  { key: 'draft', label: 'Borrador' },
  { key: 'submitted', label: 'En revisión CAB' },
  { key: 'approved', label: 'Aprobado' },
  { key: 'in_progress', label: 'En progreso' },
  { key: 'done', label: 'Completado' },
]

function getWorkflowStepIndex(status: string): number {
  if (status === 'rejected' || status === 'cancelled') return -1
  return WORKFLOW_STEPS.findIndex(s => s.key === status)
}

export default async function ChangeDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agent'].includes(profile.role)) redirect('/dashboard')

  const isAdmin = profile.role === 'admin'

  const { data: change } = await supabase
    .from('changes')
    .select('*, creator:profiles!changes_created_by_fkey(id, full_name)')
    .eq('id', id)
    .single()
  if (!change) redirect('/admin/changes')

  const { data: approvals } = await supabase
    .from('change_approvals')
    .select('*, profiles!change_approvals_approver_id_fkey(id, full_name)')
    .eq('change_id', id)
    .order('responded_at', { ascending: false })

  // Estado del workflow de aprobación (si aplica)
  const approvalState = await getApprovalState('change', id)

  const currentStepIndex = getWorkflowStepIndex(change.status)
  const isRejectedOrCancelled = change.status === 'rejected' || change.status === 'cancelled'

  // Bind server actions (no inline closures)
  const submitAction = submitForApproval.bind(null, id)
  const approveActionBase = approveChange.bind(null, id)
  const rejectActionBase = rejectChange.bind(null, id)
  const startAction = updateChangeStatus.bind(null, id, 'in_progress')
  const doneAction = updateChangeStatus.bind(null, id, 'done')
  const cancelAction = updateChangeStatus.bind(null, id, 'cancelled')
  const reopenAction = updateChangeStatus.bind(null, id, 'draft')

  const creator = Array.isArray(change.creator) ? change.creator[0] : change.creator

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/changes" className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors w-fit">
        <ArrowLeft size={14} /> Volver a cambios
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-[#F1F5F9] truncate">{change.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[change.change_type] ?? 'bg-[#334155] text-[#94A3B8]'}`}>
              {TYPE_LABEL[change.change_type] ?? change.change_type}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[change.status] ?? 'bg-[#334155] text-[#94A3B8]'}`}>
              {STATUS_LABEL[change.status] ?? change.status}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${RISK_COLOR[change.risk_level] ?? 'bg-[#334155] text-[#94A3B8]'}`}>
              <AlertTriangle size={10} className="inline mr-1" />
              {RISK_LABEL[change.risk_level] ?? change.risk_level}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── LEFT PANEL: Details ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Main info */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#F1F5F9]">Detalles del cambio</h2>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {creator && (
                <div className="flex items-center gap-2">
                  <User size={13} className="text-[#64748B]" />
                  <span className="text-[#64748B]">Creado por:</span>
                  <span className="text-[#F1F5F9]">{creator.full_name ?? '—'}</span>
                </div>
              )}
              {change.planned_start && (
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-[#64748B]" />
                  <span className="text-[#64748B]">Inicio:</span>
                  <span className="text-[#F1F5F9] text-xs">
                    {new Date(change.planned_start).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              )}
              {change.planned_end && (
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-[#64748B]" />
                  <span className="text-[#64748B]">Fin:</span>
                  <span className="text-[#F1F5F9] text-xs">
                    {new Date(change.planned_end).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              )}
            </div>

            {change.description && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Descripción / Justificación</p>
                <p className="text-sm text-[#F1F5F9] whitespace-pre-wrap leading-relaxed">{change.description}</p>
              </div>
            )}

            {change.rollback_plan && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Plan de rollback</p>
                <p className="text-sm text-[#F1F5F9] whitespace-pre-wrap leading-relaxed">{change.rollback_plan}</p>
              </div>
            )}
          </div>

          {/* Workflow de aprobación multi-paso */}
          {approvalState && (
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <GitPullRequest size={15} className="text-[#3B82F6]" />
                <h2 className="text-sm font-semibold text-[#F1F5F9]">Aprobación: {approvalState.workflowName}</h2>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  approvalState.status === 'approved' ? 'bg-[#10B981]/20 text-[#10B981]' :
                  approvalState.status === 'rejected' ? 'bg-[#EF4444]/20 text-[#EF4444]' :
                  'bg-[#F59E0B]/20 text-[#F59E0B]'
                }`}>
                  {approvalState.status === 'approved' ? 'Aprobado' : approvalState.status === 'rejected' ? 'Rechazado' : 'En curso'}
                </span>
              </div>
              <div className="space-y-2">
                {approvalState.steps.map(s => (
                  <div key={s.index} className="flex items-start gap-3 px-3 py-2.5 bg-[#0F172A] rounded-lg">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${
                      s.state === 'done' ? 'bg-[#10B981] text-white' :
                      s.state === 'current' ? 'bg-[#3B82F6] text-white' :
                      'bg-[#334155] text-[#94A3B8]'
                    }`}>
                      {s.state === 'done' ? <CheckCircle size={12} /> : s.index}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#F1F5F9]">{s.step.name}</p>
                      <p className="text-[11px] text-[#64748B]">
                        {s.step.approver_type === 'role'
                          ? (s.step.approver_role === 'admin' ? 'Cualquier admin' : 'Cualquier agente')
                          : 'Usuario asignado'}
                        {s.step.mode === 'all' ? ' · todos' : ' · cualquiera'}
                      </p>
                      {s.decisions.map((d, di) => (
                        <p key={di} className={`text-[11px] mt-0.5 ${d.decision === 'approved' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                          {d.decision === 'approved' ? '✓' : '✕'} {d.approver_name}{d.comment ? ` — ${d.comment}` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approvals history */}
          {(approvals ?? []).length > 0 && (
            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#F1F5F9]">Historial de decisiones CAB</h2>
              {(approvals ?? []).map((a: Record<string, unknown>) => {
                const approver = Array.isArray(a.profiles) ? (a.profiles as Record<string, unknown>[])[0] : a.profiles as Record<string, unknown> | null
                const status = a.status as string
                const comment = a.comment as string | null
                return (
                  <div key={a.id as string} className="flex items-start justify-between gap-3 px-3 py-2.5 bg-[#0F172A] rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#F1F5F9]">{approver?.full_name as string ?? '—'}</p>
                      {comment && <p className="text-xs text-[#94A3B8] mt-0.5">{comment}</p>}
                      {Boolean(a.responded_at) && (
                        <p className="text-[10px] text-[#64748B] mt-1">
                          {new Date(a.responded_at as string).toLocaleString('es-CO')}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                      status === 'approved' ? 'bg-[#10B981]/20 text-[#10B981]' :
                      status === 'rejected' ? 'bg-[#EF4444]/20 text-[#EF4444]' :
                      'bg-[#F59E0B]/20 text-[#F59E0B]'
                    }`}>
                      {status === 'approved' ? 'Aprobado' : status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: CAB Workflow ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5 space-y-5">
            <h2 className="text-sm font-semibold text-[#F1F5F9]">Flujo CAB</h2>

            {/* Timeline */}
            {!isRejectedOrCancelled && (
              <div className="space-y-0">
                {WORKFLOW_STEPS.map((step, i) => {
                  const isActive = i === currentStepIndex
                  const isDone = i < currentStepIndex
                  return (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          isDone ? 'bg-[#10B981]' :
                          isActive ? 'bg-[#3B82F6]' :
                          'bg-[#334155]'
                        }`}>
                          {isDone ? (
                            <CheckCircle size={12} className="text-white" />
                          ) : isActive ? (
                            <Clock size={12} className="text-white animate-pulse" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-[#475569]" />
                          )}
                        </div>
                        {i < WORKFLOW_STEPS.length - 1 && (
                          <div className={`w-0.5 h-6 ${isDone ? 'bg-[#10B981]' : 'bg-[#334155]'}`} />
                        )}
                      </div>
                      <p className={`text-sm pt-0.5 ${
                        isActive ? 'text-[#F1F5F9] font-medium' :
                        isDone ? 'text-[#10B981]' :
                        'text-[#475569]'
                      }`}>
                        {step.label}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Rejected / Cancelled state */}
            {isRejectedOrCancelled && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                change.status === 'rejected' ? 'bg-[#EF4444]/10 border border-[#EF4444]/30' : 'bg-[#334155]/50 border border-[#475569]'
              }`}>
                <XCircle size={14} className={change.status === 'rejected' ? 'text-[#EF4444]' : 'text-[#64748B]'} />
                <span className="text-sm text-[#F1F5F9]">
                  {change.status === 'rejected' ? 'Cambio rechazado por CAB' : 'Cambio cancelado'}
                </span>
              </div>
            )}

            <div className="border-t border-[#334155] pt-4 space-y-3">
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Acciones</p>

              {/* DRAFT → submit for approval */}
              {change.status === 'draft' && (
                <form action={submitAction}>
                  <button type="submit"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
                    <GitPullRequest size={14} /> Enviar para aprobación CAB
                  </button>
                </form>
              )}

              {/* SUBMITTED con workflow multi-paso */}
              {change.status === 'submitted' && approvalState && approvalState.status === 'pending' && (
                approvalState.canActNow ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[#94A3B8]">
                      Paso {approvalState.currentStep}: <span className="text-[#F1F5F9]">{approvalState.steps[approvalState.currentStep - 1]?.step.name}</span> — tu decisión:
                    </p>
                    <form action={decideApproval.bind(null, approvalState.requestId, 'approved')} className="space-y-2">
                      <textarea name="comment" rows={2} placeholder="Comentario (opcional)…"
                        className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-xs focus:outline-none focus:border-[#10B981] placeholder-[#475569] resize-none" />
                      <button type="submit"
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] text-sm font-medium transition-colors border border-[#10B981]/30">
                        <CheckCircle size={14} /> Aprobar paso
                      </button>
                    </form>
                    <form action={decideApproval.bind(null, approvalState.requestId, 'rejected')} className="space-y-2">
                      <textarea name="reason" rows={2} placeholder="Razón del rechazo (opcional)…"
                        className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-xs focus:outline-none focus:border-[#EF4444] placeholder-[#475569] resize-none" />
                      <button type="submit"
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-[#EF4444] text-sm font-medium transition-colors border border-[#EF4444]/30">
                        <XCircle size={14} /> Rechazar
                      </button>
                    </form>
                  </div>
                ) : (
                  <p className="text-xs text-[#64748B] text-center py-2">
                    Pendiente del paso {approvalState.currentStep} ({approvalState.steps[approvalState.currentStep - 1]?.step.name}). No eres el aprobador de este paso.
                  </p>
                )
              )}

              {/* SUBMITTED sin workflow → aprobación simple de admin (legacy) */}
              {change.status === 'submitted' && !approvalState && isAdmin && (
                <div className="space-y-2">
                  <form action={approveActionBase} className="space-y-2">
                    <textarea
                      name="comment"
                      rows={2}
                      placeholder="Comentario de aprobación (opcional)…"
                      className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-xs focus:outline-none focus:border-[#10B981] placeholder-[#475569] resize-none"
                    />
                    <button type="submit"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] text-sm font-medium transition-colors border border-[#10B981]/30">
                      <CheckCircle size={14} /> Aprobar cambio
                    </button>
                  </form>

                  <form action={rejectActionBase} className="space-y-2">
                    <textarea
                      name="reason"
                      rows={2}
                      required
                      placeholder="Razón del rechazo (requerido)…"
                      className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-xs focus:outline-none focus:border-[#EF4444] placeholder-[#475569] resize-none"
                    />
                    <button type="submit"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-[#EF4444] text-sm font-medium transition-colors border border-[#EF4444]/30">
                      <XCircle size={14} /> Rechazar cambio
                    </button>
                  </form>
                </div>
              )}

              {change.status === 'submitted' && !approvalState && !isAdmin && (
                <p className="text-xs text-[#64748B] text-center py-2">
                  Pendiente de revisión por un administrador CAB.
                </p>
              )}

              {/* APPROVED → start implementation */}
              {change.status === 'approved' && (
                <form action={startAction}>
                  <button type="submit"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 text-[#F59E0B] text-sm font-medium transition-colors border border-[#F59E0B]/30">
                    <Play size={14} /> Iniciar implementación
                  </button>
                </form>
              )}

              {/* IN_PROGRESS → mark as done */}
              {change.status === 'in_progress' && (
                <form action={doneAction}>
                  <button type="submit"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#6366F1]/20 hover:bg-[#6366F1]/30 text-[#6366F1] text-sm font-medium transition-colors border border-[#6366F1]/30">
                    <Flag size={14} /> Marcar como completado
                  </button>
                </form>
              )}

              {/* REJECTED → reopen as draft */}
              {change.status === 'rejected' && (
                <form action={reopenAction}>
                  <button type="submit"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#334155] hover:bg-[#475569] text-[#94A3B8] text-sm font-medium transition-colors">
                    Volver a borrador
                  </button>
                </form>
              )}

              {/* Cancel (for draft, submitted, approved, in_progress) */}
              {['draft', 'submitted', 'approved', 'in_progress'].includes(change.status) && (
                <form action={cancelAction}>
                  <button type="submit"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-transparent hover:bg-[#EF4444]/10 text-[#64748B] hover:text-[#EF4444] text-xs transition-colors border border-[#334155] hover:border-[#EF4444]/30">
                    Cancelar cambio
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
