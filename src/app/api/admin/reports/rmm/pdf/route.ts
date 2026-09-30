import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  buildRmmReportPdf, type EndpointStat, type ClientGroup,
  type UpgradeItem, type PeriodMetrics, type TopIncident,
} from '@/features/rmm/rmm-report-pdf'
import { getBrand } from '@/lib/email/branding'

export const runtime = 'nodejs'

type Agg = { samples: number; cpuAvg: number | null; cpuMax: number | null; ramAvg: number | null; ramMax: number | null; diskAvg: number | null; diskMin: number | null }

const nn = (v: unknown): number | null => (v == null ? null : Number(v))
const r0 = (v: number) => Math.round(v)

/** Deriva un SO amigable del string crudo del agente y marca si está sin soporte.
 *  Windows: build 22000+ = Windows 11; 10240-19045 = Windows 10 (fin de soporte
 *  14-oct-2025 → sin parches de seguridad). */
function osInfo(raw: string | null): { label: string | null; win10EOL: boolean } {
  if (!raw) return { label: null, win10EOL: false }
  const m = raw.match(/10\.0\.(\d+)\./)
  if (m) {
    const b = Number(m[1])
    if (b >= 22000) return { label: `Windows 11 (build ${b})`, win10EOL: false }
    if (b >= 10240) return { label: `Windows 10 (build ${b})`, win10EOL: true }
    return { label: `Windows (build ${b})`, win10EOL: false }
  }
  return { label: raw.replace(/\s+/g, ' ').trim().slice(0, 40) || null, win10EOL: false }
}

/** Agrega métricas por endpoint. Intenta agregación en la BD (rápida, precisa) y
 *  si el proyecto no expone funciones de agregado, cae a paginado en JS. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function aggregateMetrics(admin: any, ids: string[], startISO: string, endISO: string): Promise<Record<string, Agg>> {
  const out: Record<string, Agg> = {}
  if (ids.length === 0) return out

  const { data, error } = await admin.from('endpoint_metrics')
    .select('endpoint_id, n:endpoint_id.count(), cpu_avg:cpu_pct.avg(), cpu_max:cpu_pct.max(), ram_avg:ram_pct.avg(), ram_max:ram_pct.max(), disk_avg:disk_free_pct.avg(), disk_min:disk_free_pct.min()')
    .in('endpoint_id', ids).gte('recorded_at', startISO).lt('recorded_at', endISO)

  if (!error && Array.isArray(data)) {
    for (const r of data as Record<string, unknown>[]) {
      out[r.endpoint_id as string] = {
        samples: Number(r.n ?? 0),
        cpuAvg: nn(r.cpu_avg), cpuMax: nn(r.cpu_max),
        ramAvg: nn(r.ram_avg), ramMax: nn(r.ram_max),
        diskAvg: nn(r.disk_avg), diskMin: nn(r.disk_min),
      }
    }
    return out
  }

  // Respaldo: paginado en JS por endpoint.
  const PAGE = 1000, MAXP = 60
  for (const id of ids) {
    let samples = 0, cpuSum = 0, cpuN = 0, cpuMax: number | null = null
    let ramSum = 0, ramN = 0, ramMax: number | null = null
    let diskSum = 0, diskN = 0, diskMin: number | null = null
    for (let p = 0; p < MAXP; p++) {
      const { data: rows, error: e2 } = await admin.from('endpoint_metrics')
        .select('cpu_pct, ram_pct, disk_free_pct')
        .eq('endpoint_id', id).gte('recorded_at', startISO).lt('recorded_at', endISO)
        .order('recorded_at', { ascending: true }).range(p * PAGE, p * PAGE + PAGE - 1)
      if (e2 || !rows || rows.length === 0) break
      for (const r of rows as { cpu_pct: number | null; ram_pct: number | null; disk_free_pct: number | null }[]) {
        samples++
        if (r.cpu_pct != null) { const v = Number(r.cpu_pct); cpuSum += v; cpuN++; cpuMax = cpuMax == null ? v : Math.max(cpuMax, v) }
        if (r.ram_pct != null) { const v = Number(r.ram_pct); ramSum += v; ramN++; ramMax = ramMax == null ? v : Math.max(ramMax, v) }
        if (r.disk_free_pct != null) { const v = Number(r.disk_free_pct); diskSum += v; diskN++; diskMin = diskMin == null ? v : Math.min(diskMin, v) }
      }
      if (rows.length < PAGE) break
    }
    out[id] = {
      samples,
      cpuAvg: cpuN ? cpuSum / cpuN : null, cpuMax,
      ramAvg: ramN ? ramSum / ramN : null, ramMax,
      diskAvg: diskN ? diskSum / diskN : null, diskMin,
    }
  }
  return out
}

/** Marca "en riesgo" (mismo criterio que el resumen): sin muestras, disco bajo,
 *  CPU o RAM altas sostenidas. */
function isRisk(a: Agg): boolean {
  return a.samples === 0
    || (a.diskAvg != null && a.diskAvg < 15)
    || (a.cpuAvg != null && a.cpuAvg > 80)
    || (a.ramAvg != null && a.ramAvg > 85)
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const org = url.searchParams.get('org') || null
  const now = new Date()
  const month = url.searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [my, mm] = month.split('-').map(Number)
  if (!my || !mm) return NextResponse.json({ error: 'Mes inválido' }, { status: 400 })
  const pad = (n: number) => String(n).padStart(2, '0')
  const startISO = `${month}-01T00:00:00-05:00`
  const nY = mm === 12 ? my + 1 : my, nM = mm === 12 ? 1 : mm + 1
  const endISO = `${nY}-${pad(nM)}-01T00:00:00-05:00`
  const pY = mm === 1 ? my - 1 : my, pM = mm === 1 ? 12 : mm - 1
  const prevStartISO = `${pY}-${pad(pM)}-01T00:00:00-05:00`
  const monthLabel = new Date(my, mm - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  const admin = createServiceClient()

  // Equipos activos (opcionalmente de un cliente), con nombre del cliente.
  let epq = admin.from('endpoints')
    .select('id, hostname, display_name, os, last_seen_at, organization_id, organizations(name)')
    .is('disabled_at', null)
  if (org) epq = epq.eq('organization_id', org)
  const { data: epData } = await epq
  const endpoints = (epData ?? []) as {
    id: string; hostname: string | null; display_name: string | null; os: string | null
    last_seen_at: string | null; organization_id: string
    organizations?: { name: string } | { name: string }[] | null
  }[]

  const ids = endpoints.map(e => e.id)

  // SO más reciente por equipo (para detectar sistemas sin soporte).
  const osByEp = new Map<string, { label: string | null; win10EOL: boolean }>()
  if (ids.length) {
    const { data: inv } = await admin.from('endpoint_inventory')
      .select('endpoint_id, os_version, captured_at')
      .in('endpoint_id', ids).order('captured_at', { ascending: false })
    for (const row of (inv ?? []) as { endpoint_id: string; os_version: string | null }[]) {
      if (!osByEp.has(row.endpoint_id)) osByEp.set(row.endpoint_id, osInfo(row.os_version))
    }
  }

  // Agregados del mes actual y del anterior (para el comparativo).
  const agg = await aggregateMetrics(admin, ids, startISO, endISO)
  const aggPrev = await aggregateMetrics(admin, ids, prevStartISO, startISO)

  const nowMs = Date.now()
  const ONLINE_MS = 10 * 60 * 1000
  const orgName = (o: (typeof endpoints)[number]['organizations']) => (Array.isArray(o) ? o[0]?.name : o?.name) ?? 'Sin cliente'
  const nameById = new Map<string, { name: string; org: string }>()

  const stats = endpoints.map(e => {
    const a = agg[e.id] ?? { samples: 0, cpuAvg: null, cpuMax: null, ramAvg: null, ramMax: null, diskAvg: null, diskMin: null }
    const online = !!e.last_seen_at && nowMs - new Date(e.last_seen_at).getTime() < ONLINE_MS
    const name = e.display_name || e.hostname || '(sin nombre)'
    const o = orgName(e.organizations)
    const os = osByEp.get(e.id) ?? { label: null, win10EOL: false }
    nameById.set(e.id, { name, org: o })
    return {
      id: e.id, name, org: o, online, os,
      samples: a.samples, cpuAvg: a.cpuAvg, cpuMax: a.cpuMax, ramAvg: a.ramAvg, ramMax: a.ramMax,
      diskAvg: a.diskAvg, diskMin: a.diskMin, lastSeen: e.last_seen_at, risk: isRisk(a),
    }
  })

  // Agrupar por cliente (tabla de comportamiento).
  const byOrg = new Map<string, EndpointStat[]>()
  for (const s of stats) {
    if (!byOrg.has(s.org)) byOrg.set(s.org, [])
    byOrg.get(s.org)!.push({ name: s.name, os: s.os.label, online: s.online, samples: s.samples, cpuAvg: s.cpuAvg, cpuMax: s.cpuMax, ramAvg: s.ramAvg, ramMax: s.ramMax, diskAvg: s.diskAvg, diskMin: s.diskMin, lastSeen: s.lastSeen })
  }
  const clients: ClientGroup[] = [...byOrg.entries()]
    .map(([o, eps]) => ({ org: o, endpoints: eps.sort((x, y) => x.name.localeCompare(y.name)) }))
    .sort((x, y) => x.org.localeCompare(y.org))

  // Promedios de la flota (promedio de promedios por equipo, ignorando nulos).
  const mean = (vals: (number | null)[]) => { const v = vals.filter((n): n is number => n != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null }
  const cpuAvg = mean(stats.map(s => s.cpuAvg))
  const ramAvg = mean(stats.map(s => s.ramAvg))
  const diskAvg = mean(stats.map(s => s.diskAvg))
  const online = stats.filter(s => s.online).length
  const enRiesgo = stats.filter(s => s.risk).length
  const muestras = stats.reduce((a, s) => a + s.samples, 0)
  const enRiesgoPrev = ids.filter(id => aggPrev[id] && isRisk(aggPrev[id])).length

  // ── Equipos a repotenciar (hardware/SO) ──
  const upgrades: UpgradeItem[] = []
  let soObsoleto = 0
  for (const s of stats) {
    if (s.os.win10EOL) soObsoleto++
    const reasons: string[] = []
    const actions: string[] = []
    let alta = false
    if (s.os.win10EOL) {
      reasons.push('Sistema operativo Windows 10 sin soporte de Microsoft (fin de soporte 14-oct-2025): sin parches de seguridad.')
      actions.push('migrar a Windows 11 (verificar compatibilidad; si el equipo no es compatible, programar su reemplazo)')
      alta = true
    }
    if (s.diskAvg != null && s.diskAvg < 15) {
      reasons.push(`Disco casi lleno (${r0(s.diskAvg)}% libre prom., mínimo ${r0(s.diskMin ?? s.diskAvg)}%).`)
      actions.push('ampliar el almacenamiento o instalar un SSD de mayor capacidad')
      alta = true
    } else if (s.diskAvg != null && s.diskAvg < 25) {
      reasons.push(`Disco en observación (${r0(s.diskAvg)}% libre prom.).`)
      actions.push('liberar espacio o planear ampliación de almacenamiento')
    }
    if (s.ramAvg != null && s.ramAvg > 85) {
      reasons.push(`Memoria RAM saturada (${r0(s.ramAvg)}% prom., pico ${r0(s.ramMax ?? s.ramAvg)}%).`)
      actions.push('ampliar la memoria RAM')
      alta = true
    } else if (s.ramAvg != null && (s.ramAvg > 78 || (s.ramMax != null && s.ramMax >= 96))) {
      reasons.push(`Memoria RAM alta en horas pico (${r0(s.ramAvg)}% prom., pico ${r0(s.ramMax ?? s.ramAvg)}%): poco margen.`)
      actions.push('evaluar ampliación de memoria RAM')
    }
    if (s.cpuAvg != null && s.cpuAvg > 80) {
      reasons.push(`CPU alta sostenida (${r0(s.cpuAvg)}% prom., pico ${r0(s.cpuMax ?? s.cpuAvg)}%).`)
      actions.push('revisar procesos y evaluar mejora de CPU o reemplazo del equipo')
      alta = true
    }
    if (reasons.length) {
      // dedup de acciones conservando orden
      const act = [...new Set(actions)]
      upgrades.push({ name: s.name, org: s.org, priority: alta ? 'alta' : 'media', reasons, action: `Se recomienda ${act.join('; ')}.` })
    }
  }
  const aRepotenciar = upgrades.length

  // ── Métricas del periodo vía RPC (uptime, incidentes, MTTR) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = async (start: string, end: string): Promise<{ uptime: number | null; incidents: number; mttr: number | null }> => {
    const { data } = await admin.rpc('rmm_report_metrics', { p_org: org, p_start: start, p_end: end })
    const d = (data ?? {}) as { uptime_pct?: number | null; tickets?: number | null; mttr_hours?: number | null }
    return { uptime: nn(d.uptime_pct), incidents: Number(d.tickets ?? 0), mttr: nn(d.mttr_hours) }
  }
  const curM = await rpc(startISO, endISO)
  const prevM = await rpc(prevStartISO, startISO)

  // ── Top equipos por incidentes del mes ──
  const { data: tks } = await admin.from('tickets')
    .select('source_endpoint_id')
    .gte('created_at', startISO).lt('created_at', endISO)
    .not('source_endpoint_id', 'is', null)
  const incCount = new Map<string, number>()
  for (const t of (tks ?? []) as { source_endpoint_id: string }[]) {
    if (nameById.has(t.source_endpoint_id)) incCount.set(t.source_endpoint_id, (incCount.get(t.source_endpoint_id) ?? 0) + 1)
  }
  const topIncidents: TopIncident[] = [...incCount.entries()]
    .map(([id, n]) => ({ name: nameById.get(id)!.name, org: nameById.get(id)!.org, incidents: n }))
    .sort((a, b) => b.incidents - a.incidents).slice(0, 5)

  const current: PeriodMetrics = { uptime: curM.uptime, incidents: curM.incidents, mttr: curM.mttr, enRiesgo }
  const previous: PeriodMetrics = { uptime: prevM.uptime, incidents: prevM.incidents, mttr: prevM.mttr, enRiesgo: enRiesgoPrev }

  // ── Veredicto (semáforo) ──
  const hasAlta = upgrades.some(u => u.priority === 'alta')
  const level: 'verde' | 'amarillo' | 'rojo' =
    (soObsoleto > 0 || hasAlta) ? 'rojo' : (aRepotenciar > 0 || enRiesgo > 0) ? 'amarillo' : 'verde'
  let verdictText: string
  if (stats.length === 0) {
    verdictText = `No hay equipos monitoreados${org ? ' para este cliente' : ''} en ${monthLabel}.`
  } else if (level === 'rojo') {
    verdictText = `${stats.length} equipos monitoreados; disponibilidad ${curM.uptime ?? '—'}%. `
      + (soObsoleto > 0 ? `${soObsoleto} con sistema operativo sin soporte y ` : '')
      + `${aRepotenciar} requieren repotenciación. Priorice las acciones marcadas como PRIORIDAD ALTA: migración de SO y ampliaciones de hardware.`
  } else if (level === 'amarillo') {
    verdictText = `${stats.length} equipos monitoreados; disponibilidad ${curM.uptime ?? '—'}%. `
      + `${aRepotenciar} equipo(s) en observación para ampliación de hardware. Sin situaciones críticas, pero conviene atender las recomendaciones.`
  } else {
    verdictText = `${stats.length} equipos monitoreados; disponibilidad ${curM.uptime ?? '—'}%. Todos operaron dentro de parámetros saludables durante ${monthLabel}.`
  }

  // ── Análisis general ──
  const analysis = stats.length === 0
    ? `No hay equipos monitoreados${org ? ' para este cliente' : ''} en ${monthLabel}.`
    : `${stats.length} equipo(s) monitoreado(s) en ${monthLabel}; ${online} en línea al momento del corte. `
      + `Promedios de la flota: CPU ${cpuAvg ?? '—'}%, RAM ${ramAvg ?? '—'}%, disco libre ${diskAvg ?? '—'}%. `
      + `Disponibilidad del periodo: ${curM.uptime ?? '—'}% (mes anterior: ${prevM.uptime ?? '—'}%). `
      + `Se generaron ${curM.incidents} incidente(s) automático(s) por monitoreo`
      + (curM.mttr != null ? `, con un tiempo medio de resolución de ${curM.mttr} h. ` : '. ')
      + (aRepotenciar > 0 ? `${aRepotenciar} equipo(s) figuran como candidatos a repotenciación (ver sección dedicada).` : 'Ningún equipo requiere repotenciación este periodo.')

  // ── Recomendaciones ──
  const recs: string[] = []
  if (soObsoleto > 0) {
    const eol = stats.filter(s => s.os.win10EOL).map(s => `${s.org} · ${s.name}`)
    recs.push(`Prioridad de seguridad: ${soObsoleto} equipo(s) con Windows 10 sin soporte (${eol.slice(0, 6).join('; ')}${eol.length > 6 ? '…' : ''}). Planificar migración a Windows 11 o reemplazo; sin parches quedan expuestos.`)
  }
  for (const s of stats.filter(s => s.risk).sort((a, b) => a.org.localeCompare(b.org))) {
    const label = `${s.org} · ${s.name}`
    if (s.samples === 0) { recs.push(`${label}: sin datos de monitoreo en el periodo. Verifica que el agente esté activo y el equipo encendido.`); continue }
    const parts: string[] = []
    if (s.diskAvg != null && s.diskAvg < 15) parts.push(`disco crítico (${r0(s.diskAvg)}% libre): libera espacio o amplía el disco.`)
    if (s.cpuAvg != null && s.cpuAvg > 80) parts.push(`CPU alta sostenida (${r0(s.cpuAvg)}%): revisa procesos o mejora el hardware.`)
    if (s.ramAvg != null && s.ramAvg > 85) parts.push(`memoria alta (${r0(s.ramAvg)}%): cierra aplicaciones o amplía la RAM.`)
    if (parts.length) recs.push(`${label}: ${parts.join(' ')}`)
  }
  if (curM.uptime != null && curM.uptime < 85) {
    recs.push(`Disponibilidad de ${curM.uptime}%: por debajo del objetivo. Revisa equipos que se apagan o pierden conexión, y mantén el agente corriendo como servicio para no perder muestras.`)
  }
  if (stats.length > 0) {
    recs.push('Mantén el agente de monitoreo actualizado y en ejecución en todos los equipos para no perder muestras.')
    recs.push('Programa ventanas de mantenimiento mensuales: limpieza de disco, actualizaciones del sistema y reinicios controlados.')
  }
  if (recs.length === 0 && stats.length > 0) recs.push('Todos los equipos operaron dentro de parámetros saludables durante el periodo.')

  let orgLabel = 'Consolidado (todos los clientes)'
  if (org) orgLabel = clients[0]?.org ?? 'Cliente'

  const brand = await getBrand()
  const pdf = await buildRmmReportPdf(brand, {
    orgLabel, monthLabel,
    verdict: { level, text: verdictText },
    summary: {
      equipos: stats.length, online, offline: stats.length - online, cpuAvg, ramAvg, diskAvg,
      enRiesgo, muestras, uptime: curM.uptime, incidents: curM.incidents, mttr: curM.mttr,
      aRepotenciar, soObsoleto,
    },
    comparison: { current, previous },
    upgrades, topIncidents,
    analysis, clients, recommendations: recs,
  })

  const slug = (org ? orgLabel : 'consolidado').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T-]/g, '')
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rmm_comportamiento_${slug}_${month}_${stamp}.pdf"`,
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
    },
  })
}
