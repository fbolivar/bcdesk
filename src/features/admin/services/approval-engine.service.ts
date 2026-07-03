'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import type { ApprovalStep } from './approval.service'

/**
 * Motor de ejecución de workflows de aprobación.
 * Al enviar una entidad (p.ej. un cambio/RFC) a aprobación, si existe un workflow
 * activo para ese tipo, se crea un approval_request que avanza paso a paso según
 * las decisiones de los aprobadores elegibles. Al completar todos los pasos, la
 * entidad se marca aprobada; si un paso se rechaza, se marca rechazada.
 */

interface RequestRow {
  id: string
  workflow_id: string
  entity_type: string
  entity_id: string
  current_step: number
  status: string
  requested_by: string | null
  completed_at: string | null
}

interface DecisionRow {
  id: string
  step: number
  approver_id: string
  decision: string
  comment: string | null
  decided_at: string
}

export interface ApprovalStateStep {
  index: number // 1-based
  step: ApprovalStep
  state: 'done' | 'current' | 'pending'
  decisions: { approver_name: string; decision: string; comment: string | null; decided_at: string }[]
}

export interface ApprovalState {
  requestId: string
  workflowName: string
  status: string // pending | approved | rejected
  currentStep: number
  steps: ApprovalStateStep[]
  canActNow: boolean // el usuario actual puede decidir el paso actual
}

function stepEligible(step: ApprovalStep, role: string, userId: string): boolean {
  if (step.approver_type === 'user') return step.approver_id === userId
  return step.approver_role === role
}

interface EntityConfig {
  table: string
  approvedStatus: string
  rejectedStatus: string
  paths: (id: string) => string[]
}

// Configuración por tipo de entidad: tabla destino, estados al aprobar/rechazar y rutas a revalidar.
const ENTITY_CONFIG: Record<string, EntityConfig> = {
  change: {
    table: 'changes',
    approvedStatus: 'approved',
    rejectedStatus: 'rejected',
    paths: id => [`/admin/changes/${id}`, '/admin/changes'],
  },
  service_request: {
    table: 'tickets',
    approvedStatus: 'open',
    rejectedStatus: 'cancelled',
    paths: id => [`/admin/tickets/${id}`, `/agent/tickets/${id}`, `/client/tickets/${id}`],
  },
  purchase: {
    table: 'purchase_requests',
    approvedStatus: 'approved',
    rejectedStatus: 'rejected',
    paths: id => [`/admin/purchases/${id}`, '/admin/purchases'],
  },
}

/** Inicia un workflow de aprobación para una entidad, si hay uno activo.
 *  Cualquier usuario autenticado puede iniciarlo (es el solicitante, no el aprobador). */
export async function startApprovalRequest(entityType: string, entityId: string) {
  const user = await getCurrentUser()
  if (!user) return { started: false }

  const admin = createServiceClient()

  // Ya existe una solicitud activa/terminada para esta entidad
  const { data: existing } = await admin
    .from('approval_requests')
    .select('id')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing) return { started: false, requestId: existing.id }

  // Buscar workflow activo para este tipo de entidad
  const { data: workflow } = await admin
    .from('approval_workflows')
    .select('id, steps')
    .eq('entity_type', entityType)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!workflow || !Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    return { started: false }
  }

  const { data: req } = await admin
    .from('approval_requests')
    .insert({
      workflow_id: workflow.id,
      entity_type: entityType,
      entity_id: entityId,
      current_step: 1,
      status: 'pending',
      requested_by: user.id,
    })
    .select('id')
    .single()

  return { started: true, requestId: req?.id }
}

/** Estado de aprobación de una entidad para renderizar en la UI. */
export async function getApprovalState(entityType: string, entityId: string): Promise<ApprovalState | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const admin = createServiceClient()

  const { data: request } = await admin
    .from('approval_requests')
    .select('id, workflow_id, entity_type, entity_id, current_step, status, requested_by, completed_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<RequestRow>()

  if (!request) return null

  const { data: workflow } = await admin
    .from('approval_workflows')
    .select('name, steps')
    .eq('id', request.workflow_id)
    .single()

  const wfSteps = (Array.isArray(workflow?.steps) ? workflow!.steps : []) as ApprovalStep[]

  const { data: decisions } = await admin
    .from('approval_decisions')
    .select('id, step, approver_id, decision, comment, decided_at')
    .eq('request_id', request.id)
    .order('decided_at', { ascending: true })

  const decisionRows = (decisions ?? []) as DecisionRow[]
  const approverIds = [...new Set(decisionRows.map(d => d.approver_id))]
  const nameById = new Map<string, string>()
  if (approverIds.length > 0) {
    const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', approverIds)
    for (const p of profs ?? []) nameById.set(p.id, p.full_name)
  }

  const steps: ApprovalStateStep[] = wfSteps.map((s, i) => {
    const idx = i + 1
    const stepDecisions = decisionRows
      .filter(d => d.step === idx)
      .map(d => ({
        approver_name: nameById.get(d.approver_id) ?? 'Usuario',
        decision: d.decision,
        comment: d.comment,
        decided_at: d.decided_at,
      }))
    let state: 'done' | 'current' | 'pending' = 'pending'
    if (request.status === 'approved' || idx < request.current_step) state = 'done'
    else if (idx === request.current_step && request.status === 'pending') state = 'current'
    else if (request.status === 'rejected' && idx === request.current_step) state = 'current'
    return { index: idx, step: s, state, decisions: stepDecisions }
  })

  // ¿Puede el usuario actuar en el paso actual?
  let canActNow = false
  if (request.status === 'pending') {
    const currentStep = wfSteps[request.current_step - 1]
    if (currentStep && stepEligible(currentStep, user.role, user.id)) {
      const alreadyDecided = decisionRows.some(d => d.step === request.current_step && d.approver_id === user.id)
      canActNow = !alreadyDecided
    }
  }

  return {
    requestId: request.id,
    workflowName: workflow?.name ?? 'Workflow',
    status: request.status,
    currentStep: request.current_step,
    steps,
    canActNow,
  }
}

/** Registra una decisión del usuario actual sobre el paso actual y avanza el workflow. */
export async function decideApproval(requestId: string, decision: 'approved' | 'rejected', formData?: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const comment = (formData?.get('comment') as string) || (formData?.get('reason') as string) || null
  const admin = createServiceClient()

  const { data: request } = await admin
    .from('approval_requests')
    .select('id, workflow_id, entity_type, entity_id, current_step, status')
    .eq('id', requestId)
    .maybeSingle<RequestRow>()

  if (!request || request.status !== 'pending') return

  const { data: workflow } = await admin
    .from('approval_workflows')
    .select('steps')
    .eq('id', request.workflow_id)
    .single()
  const wfSteps = (Array.isArray(workflow?.steps) ? workflow!.steps : []) as ApprovalStep[]
  const stepCfg = wfSteps[request.current_step - 1]
  if (!stepCfg) return

  if (!stepEligible(stepCfg, user.role, user.id)) return

  // Evitar doble decisión del mismo usuario en el mismo paso
  const { data: prior } = await admin
    .from('approval_decisions')
    .select('id')
    .eq('request_id', requestId)
    .eq('step', request.current_step)
    .eq('approver_id', user.id)
    .maybeSingle()
  if (prior) return

  await admin.from('approval_decisions').insert({
    request_id: requestId,
    step: request.current_step,
    approver_id: user.id,
    decision,
    comment,
    decided_at: new Date().toISOString(),
  })

  const config = ENTITY_CONFIG[request.entity_type]
  const revalidate = () => {
    if (config) for (const p of config.paths(request.entity_id)) revalidatePath(p)
  }

  // Rechazo → termina la solicitud y la entidad
  if (decision === 'rejected') {
    await admin.from('approval_requests').update({ status: 'rejected', completed_at: new Date().toISOString() }).eq('id', requestId)
    if (config) await admin.from(config.table).update({ status: config.rejectedStatus, updated_at: new Date().toISOString() }).eq('id', request.entity_id)
    revalidate()
    return
  }

  // Aprobación → evaluar si el paso está completo
  let stepComplete = false
  if (stepCfg.mode === 'any' || stepCfg.approver_type === 'user') {
    stepComplete = true
  } else {
    // mode 'all' con rol: requiere que todos los usuarios activos de ese rol aprueben
    const { count: eligibleCount } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', stepCfg.approver_role ?? 'admin')
      .eq('is_active', true)
    const { data: stepApprovals } = await admin
      .from('approval_decisions')
      .select('approver_id')
      .eq('request_id', requestId)
      .eq('step', request.current_step)
      .eq('decision', 'approved')
    const approvedCount = new Set((stepApprovals ?? []).map(d => d.approver_id)).size
    stepComplete = approvedCount >= (eligibleCount ?? 1)
  }

  if (stepComplete) {
    if (request.current_step < wfSteps.length) {
      await admin.from('approval_requests').update({ current_step: request.current_step + 1 }).eq('id', requestId)
    } else {
      await admin.from('approval_requests').update({ status: 'approved', completed_at: new Date().toISOString() }).eq('id', requestId)
      if (config) await admin.from(config.table).update({ status: config.approvedStatus, updated_at: new Date().toISOString() }).eq('id', request.entity_id)
    }
  }

  revalidate()
}
