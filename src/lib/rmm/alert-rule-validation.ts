// Validación compartida de reglas de alerta (API create/update).

export const METRICS = ['cpu_pct', 'ram_pct', 'disk_free_pct', 'offline'] as const
export const OPERATORS = ['>', '>=', '<', '<='] as const
export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export const ACTIONS = ['create_ticket', 'notify'] as const

export type RuleInput = {
  metric?: unknown; operator?: unknown; threshold?: unknown
  severity?: unknown; action?: unknown; cooldown_minutes?: unknown; is_active?: unknown
}

/** Valida y normaliza campos presentes. `partial` permite updates parciales. */
export function validateRule(input: RuleInput, partial = false):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string } {
  const out: Record<string, unknown> = {}
  const need = (k: string) => !partial && input[k as keyof RuleInput] === undefined

  if (input.metric !== undefined || need('metric')) {
    if (!METRICS.includes(input.metric as never)) return { ok: false, error: 'metric inválida' }
    out.metric = input.metric
  }
  if (input.operator !== undefined || need('operator')) {
    if (!OPERATORS.includes(input.operator as never)) return { ok: false, error: 'operator inválido' }
    out.operator = input.operator
  }
  if (input.threshold !== undefined || need('threshold')) {
    const n = Number(input.threshold)
    if (!Number.isFinite(n)) return { ok: false, error: 'threshold debe ser numérico' }
    out.threshold = n
  }
  if (input.severity !== undefined || need('severity')) {
    if (!SEVERITIES.includes(input.severity as never)) return { ok: false, error: 'severity inválida' }
    out.severity = input.severity
  }
  if (input.action !== undefined || need('action')) {
    if (!ACTIONS.includes(input.action as never)) return { ok: false, error: 'action inválida' }
    out.action = input.action
  }
  if (input.cooldown_minutes !== undefined || need('cooldown_minutes')) {
    const n = Number(input.cooldown_minutes)
    if (!Number.isInteger(n) || n < 0 || n > 100000) return { ok: false, error: 'cooldown_minutes inválido' }
    out.cooldown_minutes = n
  }
  if (input.is_active !== undefined) {
    if (typeof input.is_active !== 'boolean') return { ok: false, error: 'is_active debe ser booleano' }
    out.is_active = input.is_active
  }
  if (Object.keys(out).length === 0) return { ok: false, error: 'nada que actualizar' }
  return { ok: true, value: out }
}
