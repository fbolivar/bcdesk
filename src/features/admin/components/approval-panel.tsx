import { CheckCircle, XCircle, GitPullRequest } from 'lucide-react'
import { getApprovalState, decideApproval } from '@/features/admin/services/approval-engine.service'

/**
 * Panel de aprobación reutilizable. Renderiza el estado del workflow para cualquier
 * entidad (change | service_request | purchase) y, si el usuario actual es el
 * aprobador del paso actual, muestra los botones de decisión.
 * No renderiza nada si la entidad no tiene un workflow de aprobación activo.
 */
export async function ApprovalPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const state = await getApprovalState(entityType, entityId)
  if (!state) return null

  const currentStepName = state.steps[state.currentStep - 1]?.step.name

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <GitPullRequest size={15} className="text-[#3B82F6]" />
        <h2 className="text-sm font-semibold text-[#1E293B]">Aprobación: {state.workflowName}</h2>
        <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium ${
          state.status === 'approved' ? 'bg-[#10B981]/20 text-[#10B981]' :
          state.status === 'rejected' ? 'bg-[#EF4444]/20 text-[#EF4444]' :
          'bg-[#F59E0B]/20 text-[#F59E0B]'
        }`}>
          {state.status === 'approved' ? 'Aprobado' : state.status === 'rejected' ? 'Rechazado' : 'En curso'}
        </span>
      </div>

      <div className="space-y-2">
        {state.steps.map(s => (
          <div key={s.index} className="flex items-start gap-3 px-3 py-2.5 bg-[#F4F7FB] rounded-lg">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${
              s.state === 'done' ? 'bg-[#10B981] text-white' :
              s.state === 'current' ? 'bg-[#3B82F6] text-white' :
              'bg-[#E6EBF2] text-[#64748B]'
            }`}>
              {s.state === 'done' ? <CheckCircle size={12} /> : s.index}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#1E293B]">{s.step.name}</p>
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

      {/* Acciones de decisión para el aprobador del paso actual */}
      {state.status === 'pending' && state.canActNow && (
        <div className="border-t border-[#E6EBF2] pt-3 space-y-2">
          <p className="text-[11px] text-[#64748B]">
            Paso {state.currentStep}: <span className="text-[#1E293B]">{currentStepName}</span> — tu decisión:
          </p>
          <form action={decideApproval.bind(null, state.requestId, 'approved')} className="space-y-2">
            <textarea name="comment" rows={2} placeholder="Comentario (opcional)…"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-xs focus:outline-none focus:border-[#10B981] placeholder-[#CBD5E1] resize-none" />
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] text-sm font-medium transition-colors border border-[#10B981]/30">
              <CheckCircle size={14} /> Aprobar paso
            </button>
          </form>
          <form action={decideApproval.bind(null, state.requestId, 'rejected')} className="space-y-2">
            <textarea name="reason" rows={2} placeholder="Razón del rechazo (opcional)…"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-xs focus:outline-none focus:border-[#EF4444] placeholder-[#CBD5E1] resize-none" />
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-[#EF4444] text-sm font-medium transition-colors border border-[#EF4444]/30">
              <XCircle size={14} /> Rechazar
            </button>
          </form>
        </div>
      )}

      {state.status === 'pending' && !state.canActNow && (
        <p className="text-xs text-[#64748B] text-center py-1">
          Pendiente del paso {state.currentStep} ({currentStepName}).
        </p>
      )}
    </div>
  )
}
