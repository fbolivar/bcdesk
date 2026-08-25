/**
 * Tarea de mantenimiento del RMM (corre por cron).
 *
 * DECISIÓN DE PRODUCTO: el módulo RMM es SOLO de monitoreo. Ya NO genera tickets
 * ni notificaciones automáticas. El seguimiento del comportamiento de los equipos
 * se hace con el "Reporte mensual de comportamiento" (CPU/RAM/disco/estado),
 * consolidado y por cliente, con análisis y recomendaciones.
 *
 * Esta función conserva únicamente la HIGIENE necesaria para que el panel y el
 * reporte reflejen el estado real:
 *   - expira comandos pendientes que quedaron colgados (+24h),
 *   - marca offline los endpoints sin heartbeat reciente (>10 min),
 *   - purga ventanas viejas de rate limit.
 * Las reglas de alerta (endpoint_alert_rules) ya no se evalúan.
 */

export interface RmmAlertsResult {
  ok: true
  expired_commands: number
  tickets_created: number
  notified: number
  errors: string[]
}

// Cliente mínimo (service role). Laxo a propósito para no arrastrar tipos generados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any

export async function runRmmAlerts(admin: Admin, nowMs = Date.now()): Promise<RmmAlertsResult> {
  const now = nowMs
  const nowIso = new Date(now).toISOString()

  // Expirar comandos pendientes de +24h sin ser tomados.
  const staleBefore = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const { data: expired } = await admin.from('endpoint_commands')
    .update({ status: 'expired', completed_at: nowIso })
    .eq('status', 'pending').is('picked_at', null).lt('created_at', staleBefore)
    .select('id')

  // Marcar offline los endpoints con heartbeat viejo (>10 min).
  await admin.from('endpoints').update({ status: 'offline' })
    .eq('status', 'online').lt('last_seen_at', new Date(now - 10 * 60 * 1000).toISOString())

  // Higiene: purga de ventanas de rate limit viejas.
  await admin.from('rmm_rate_limits').delete().lt('window_start', new Date(now - 24 * 60 * 60 * 1000).toISOString())

  return { ok: true, expired_commands: expired?.length ?? 0, tickets_created: 0, notified: 0, errors: [] }
}
