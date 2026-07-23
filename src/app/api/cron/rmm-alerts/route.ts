import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { computeSla } from '@/lib/tickets/sla'
import { ruleTriggers, cooldownElapsed, severityToPriority, type AlertRule } from '@/lib/rmm/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const METRIC_LABEL: Record<string, string> = {
  cpu_pct: 'CPU', ram_pct: 'RAM', disk_free_pct: 'Disco libre', offline: 'Sin reportar',
}

function describeRule(r: { metric: string; operator: string; threshold: number }): string {
  if (r.metric === 'offline') return `Equipo sin reportar (${r.operator}${r.threshold} min)`
  const unit = r.metric === 'offline' ? ' min' : '%'
  return `${METRIC_LABEL[r.metric] ?? r.metric} ${r.operator} ${r.threshold}${unit}`
}

type EndpointRow = { id: string; last_seen_at: string | null; hostname: string | null }
type MetricRow = { endpoint_id: string; cpu_pct: number | null; ram_pct: number | null; disk_free_pct: number | null }
type RuleRow = AlertRule & { id: string; action: 'create_ticket' | 'notify'; cooldown_minutes: number }

async function run(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceClient()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  // ── (Ajuste #4) Expirar comandos pendientes con más de 24h sin ser tomados ──
  const staleBefore = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const { data: expired } = await admin.from('endpoint_commands')
    .update({ status: 'expired', completed_at: nowIso })
    .eq('status', 'pending').is('picked_at', null).lt('created_at', staleBefore)
    .select('id')

  // ── Marcar offline los endpoints con heartbeat viejo (>10 min) ──
  await admin.from('endpoints').update({ status: 'offline' })
    .eq('status', 'online').lt('last_seen_at', new Date(now - 10 * 60 * 1000).toISOString())

  // ── Evaluar alertas SOLO para clientes con rmm_enabled = true ──
  const { data: orgs } = await admin.from('organizations').select('id').eq('rmm_enabled', true)
  const { data: sysAdmin } = await admin.from('profiles')
    .select('id').eq('role', 'admin').eq('is_active', true).order('created_at', { ascending: true }).limit(1).maybeSingle()
  const systemCreatedBy = sysAdmin?.id ?? null

  let ticketsCreated = 0
  let notified = 0

  for (const org of orgs ?? []) {
    const { data: rulesData } = await admin.from('endpoint_alert_rules')
      .select('id, metric, operator, threshold, severity, action, cooldown_minutes')
      .eq('organization_id', org.id).eq('is_active', true)
    const rules = (rulesData ?? []) as RuleRow[]
    if (rules.length === 0) continue

    const { data: endpointsData } = await admin.from('endpoints')
      .select('id, last_seen_at, hostname').eq('organization_id', org.id).is('disabled_at', null)
    const endpoints = (endpointsData ?? []) as EndpointRow[]
    if (endpoints.length === 0) continue
    const epIds = endpoints.map(e => e.id)

    // Última métrica por endpoint (una consulta, dedup en memoria).
    const { data: metricsData } = await admin.from('endpoint_metrics')
      .select('endpoint_id, cpu_pct, ram_pct, disk_free_pct, recorded_at')
      .in('endpoint_id', epIds).order('recorded_at', { ascending: false }).limit(epIds.length * 3 + 50)
    const latest: Record<string, MetricRow> = {}
    for (const m of (metricsData ?? []) as (MetricRow & { recorded_at: string })[]) {
      if (!latest[m.endpoint_id]) latest[m.endpoint_id] = m
    }

    const { data: statesData } = await admin.from('endpoint_alert_state')
      .select('endpoint_id, rule_id, last_triggered_at, active_ticket_id').in('endpoint_id', epIds)
    const stateMap = new Map((statesData ?? []).map(s => [`${s.endpoint_id}|${s.rule_id}`, s]))

    for (const ep of endpoints) {
      const lastSeenMs = ep.last_seen_at ? new Date(ep.last_seen_at).getTime() : null
      for (const rule of rules) {
        const triggers = ruleTriggers(rule, latest[ep.id] ?? null, lastSeenMs, now)
        const key = `${ep.id}|${rule.id}`
        const state = stateMap.get(key)

        if (!triggers) {
          // Condición despejada → liberar el ticket activo para permitir uno nuevo la próxima vez.
          if (state?.active_ticket_id) {
            await admin.from('endpoint_alert_state').update({ active_ticket_id: null })
              .eq('endpoint_id', ep.id).eq('rule_id', rule.id)
          }
          continue
        }

        // ¿Ya hay un ticket abierto por esta condición? No duplicar.
        if (state?.active_ticket_id) {
          const { data: t } = await admin.from('tickets').select('status').eq('id', state.active_ticket_id).maybeSingle()
          if (t && !['resolved', 'closed', 'cancelled'].includes(t.status)) {
            await admin.from('endpoint_alert_state').upsert(
              { endpoint_id: ep.id, rule_id: rule.id, last_triggered_at: nowIso, active_ticket_id: state.active_ticket_id },
              { onConflict: 'endpoint_id,rule_id' })
            continue
          }
        }

        // Cooldown: no repetir el aviso antes de tiempo.
        const lastMs = state?.last_triggered_at ? new Date(state.last_triggered_at).getTime() : null
        if (!cooldownElapsed(lastMs, rule.cooldown_minutes, now)) continue

        if (rule.action === 'create_ticket' && systemCreatedBy) {
          const priority = severityToPriority(rule.severity)
          const sla = await computeSla(admin, priority)
          const snap = latest[ep.id]
          const { data: ticket } = await admin.from('tickets').insert({
            organization_id: org.id,
            title: `RMM: ${describeRule(rule)}${ep.hostname ? ` · ${ep.hostname}` : ''}`,
            description: `Alerta automática de monitoreo.\n\nRegla: ${describeRule(rule)}\nEquipo: ${ep.hostname ?? ep.id}\n`
              + (rule.metric !== 'offline' && snap ? `Lectura actual: CPU ${snap.cpu_pct ?? '—'}% · RAM ${snap.ram_pct ?? '—'}% · Disco libre ${snap.disk_free_pct ?? '—'}%` : '')
              + (rule.metric === 'offline' ? `Última señal: ${ep.last_seen_at ?? 'nunca'}` : ''),
            status: 'open',
            priority,
            category: 'support',
            source_channel: 'rmm',
            created_by: systemCreatedBy,
            source_endpoint_id: ep.id,
            ...sla,
          }).select('id').single()

          if (ticket) {
            ticketsCreated++
            await admin.from('endpoint_alert_state').upsert(
              { endpoint_id: ep.id, rule_id: rule.id, last_triggered_at: nowIso, active_ticket_id: ticket.id },
              { onConflict: 'endpoint_id,rule_id' })
            await admin.from('audit_logs').insert({
              actor_id: null, action: 'rmm.alert_ticket',
              resource_type: 'ticket', resource_id: ticket.id, new_values: { endpoint_id: ep.id, rule_id: rule.id },
            })
          }
        } else if (rule.action === 'notify') {
          const { data: staff } = await admin.from('profiles').select('id, role').in('role', ['admin', 'agent']).eq('is_active', true)
          if (staff?.length) {
            await admin.from('notifications').insert(staff.map(s => ({
              user_id: s.id, type: 'rmm',
              title: `RMM: ${describeRule(rule)}`,
              body: ep.hostname ?? ep.id,
              link: `/admin/rmm/endpoints/${ep.id}`,
            })))
            notified++
          }
          await admin.from('endpoint_alert_state').upsert(
            { endpoint_id: ep.id, rule_id: rule.id, last_triggered_at: nowIso, active_ticket_id: null },
            { onConflict: 'endpoint_id,rule_id' })
        }
      }
    }
  }

  return NextResponse.json({ ok: true, expired_commands: expired?.length ?? 0, tickets_created: ticketsCreated, notified })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
