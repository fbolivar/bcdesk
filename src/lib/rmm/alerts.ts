/**
 * Evaluación PURA de reglas de alerta RMM (sin BD, testeable directo).
 * La usa el cron /api/cron/rmm-alerts.
 */

export type AlertMetric = 'cpu_pct' | 'ram_pct' | 'disk_free_pct' | 'offline'
export type AlertOperator = '>' | '>=' | '<' | '<='
export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface AlertRule {
  metric: AlertMetric
  operator: AlertOperator
  threshold: number
  severity: Severity
}

export interface LatestMetric {
  cpu_pct: number | null
  ram_pct: number | null
  disk_free_pct: number | null
}

function compare(value: number, op: AlertOperator, threshold: number): boolean {
  switch (op) {
    case '>':  return value > threshold
    case '>=': return value >= threshold
    case '<':  return value < threshold
    case '<=': return value <= threshold
  }
}

/**
 * ¿La regla se dispara para este endpoint?
 *
 * IMPORTANTE — 'offline' NO se evalúa contra endpoint_metrics. Se compara
 * (nowMs - lastSeenMs) en MINUTOS contra el threshold de la regla. Si el
 * endpoint nunca reportó (lastSeenMs = null), se considera desconectado
 * (minutos = Infinito). El resto de métricas (cpu/ram/disk) sí salen de la
 * última fila de métricas; si aún no hay métrica, no se puede evaluar y no
 * dispara.
 */
export function ruleTriggers(
  rule: AlertRule,
  latest: LatestMetric | null,
  lastSeenMs: number | null,
  nowMs: number,
): boolean {
  if (rule.metric === 'offline') {
    const minutesSinceSeen = lastSeenMs === null ? Infinity : (nowMs - lastSeenMs) / 60000
    return compare(minutesSinceSeen, rule.operator, rule.threshold)
  }
  const value = latest ? latest[rule.metric] : null
  if (value === null || value === undefined) return false
  return compare(value, rule.operator, rule.threshold)
}

/** La severidad de la regla mapea 1:1 con la prioridad del ticket. */
export function severityToPriority(severity: Severity): 'low' | 'medium' | 'high' | 'critical' {
  return severity
}

/** ¿Pasó ya el cooldown desde el último disparo? (evita un ticket cada 5 min). */
export function cooldownElapsed(lastTriggeredMs: number | null, cooldownMinutes: number, nowMs: number): boolean {
  if (lastTriggeredMs === null) return true
  return nowMs - lastTriggeredMs >= cooldownMinutes * 60000
}
