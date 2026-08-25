import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildRmmReportPdf, type EndpointStat, type ClientGroup } from '@/features/rmm/rmm-report-pdf'
import { getBrand } from '@/lib/email/branding'

export const runtime = 'nodejs'

type Agg = { samples: number; cpuAvg: number | null; cpuMax: number | null; ramAvg: number | null; ramMax: number | null; diskAvg: number | null; diskMin: number | null }

const nn = (v: unknown): number | null => (v == null ? null : Number(v))

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
  const startISO = `${month}-01T00:00:00-05:00`
  const nY = mm === 12 ? my + 1 : my, nM = mm === 12 ? 1 : mm + 1
  const endISO = `${nY}-${String(nM).padStart(2, '0')}-01T00:00:00-05:00`
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
  const agg = await aggregateMetrics(admin, ids, startISO, endISO)

  const nowMs = Date.now()
  const ONLINE_MS = 10 * 60 * 1000
  const orgName = (o: (typeof endpoints)[number]['organizations']) => (Array.isArray(o) ? o[0]?.name : o?.name) ?? 'Sin cliente'

  const stats: (EndpointStat & { org: string; risk: boolean })[] = endpoints.map(e => {
    const a = agg[e.id] ?? { samples: 0, cpuAvg: null, cpuMax: null, ramAvg: null, ramMax: null, diskAvg: null, diskMin: null }
    const online = !!e.last_seen_at && nowMs - new Date(e.last_seen_at).getTime() < ONLINE_MS
    const risk = a.samples === 0
      || (a.diskAvg != null && a.diskAvg < 15)
      || (a.cpuAvg != null && a.cpuAvg > 80)
      || (a.ramAvg != null && a.ramAvg > 85)
    return {
      name: e.display_name || e.hostname || '(sin nombre)',
      os: e.os, online, samples: a.samples,
      cpuAvg: a.cpuAvg, cpuMax: a.cpuMax, ramAvg: a.ramAvg, ramMax: a.ramMax,
      diskAvg: a.diskAvg, diskMin: a.diskMin, lastSeen: e.last_seen_at,
      org: orgName(e.organizations), risk,
    }
  })

  // Agrupar por cliente
  const byOrg = new Map<string, EndpointStat[]>()
  for (const s of stats) {
    if (!byOrg.has(s.org)) byOrg.set(s.org, [])
    byOrg.get(s.org)!.push({ name: s.name, os: s.os, online: s.online, samples: s.samples, cpuAvg: s.cpuAvg, cpuMax: s.cpuMax, ramAvg: s.ramAvg, ramMax: s.ramMax, diskAvg: s.diskAvg, diskMin: s.diskMin, lastSeen: s.lastSeen })
  }
  const clients: ClientGroup[] = [...byOrg.entries()]
    .map(([o, eps]) => ({ org: o, endpoints: eps.sort((x, y) => x.name.localeCompare(y.name)) }))
    .sort((x, y) => x.org.localeCompare(y.org))

  // Promedios de la flota (promedio de promedios por equipo, ignorando nulos)
  const mean = (vals: (number | null)[]) => { const v = vals.filter((n): n is number => n != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null }
  const cpuAvg = mean(stats.map(s => s.cpuAvg))
  const ramAvg = mean(stats.map(s => s.ramAvg))
  const diskAvg = mean(stats.map(s => s.diskAvg))
  const online = stats.filter(s => s.online).length
  const enRiesgo = stats.filter(s => s.risk).length
  const muestras = stats.reduce((a, s) => a + s.samples, 0)

  const analysis = stats.length === 0
    ? `No hay equipos monitoreados${org ? ' para este cliente' : ''} en ${monthLabel}.`
    : `${stats.length} equipo(s) monitoreado(s) en ${monthLabel}; ${online} en línea al momento del corte. `
      + `Promedios de la flota: CPU ${cpuAvg ?? '—'}%, RAM ${ramAvg ?? '—'}%, disco libre ${diskAvg ?? '—'}%. `
      + (enRiesgo > 0
        ? `${enRiesgo} equipo(s) requieren atención (ver recomendaciones).`
        : 'Todos los equipos operaron dentro de parámetros normales.')

  // Recomendaciones accionables
  const recs: string[] = []
  for (const s of stats.filter(s => s.risk).sort((a, b) => a.org.localeCompare(b.org))) {
    const label = `${s.org} · ${s.name}`
    if (s.samples === 0) { recs.push(`${label}: sin datos de monitoreo en el periodo. Verifica que el agente esté activo y el equipo encendido.`); continue }
    const parts: string[] = []
    if (s.diskAvg != null && s.diskAvg < 15) parts.push(`Disco crítico (${Math.round(s.diskAvg)}% libre prom., mín ${Math.round(s.diskMin ?? s.diskAvg)}%): libera espacio o amplía el disco.`)
    else if (s.diskAvg != null && s.diskAvg < 25) parts.push(`Disco en observación (${Math.round(s.diskAvg)}% libre): programa una limpieza.`)
    if (s.cpuAvg != null && s.cpuAvg > 80) parts.push(`CPU alta sostenida (${Math.round(s.cpuAvg)}% prom., pico ${Math.round(s.cpuMax ?? s.cpuAvg)}%): revisa procesos o evalúa mejorar el hardware.`)
    if (s.ramAvg != null && s.ramAvg > 85) parts.push(`Memoria alta (${Math.round(s.ramAvg)}% prom., pico ${Math.round(s.ramMax ?? s.ramAvg)}%): cierra aplicaciones o amplía la RAM.`)
    if (parts.length) recs.push(`${label}: ${parts.join(' ')}`)
  }
  if (recs.length === 0 && stats.length > 0) {
    recs.push('Todos los equipos operaron dentro de parámetros saludables de CPU, memoria y disco durante el periodo.')
  }
  if (stats.length > 0) {
    recs.push('Mantén el agente de monitoreo actualizado en todos los equipos para no perder muestras.')
    recs.push('Programa ventanas de mantenimiento mensuales: limpieza de disco, actualizaciones y reinicios controlados.')
  }

  let orgLabel = 'Consolidado (todos los clientes)'
  if (org) orgLabel = clients[0]?.org ?? 'Cliente'

  const brand = await getBrand()
  const pdf = await buildRmmReportPdf(brand, {
    orgLabel, monthLabel,
    summary: { equipos: stats.length, online, offline: stats.length - online, cpuAvg, ramAvg, diskAvg, enRiesgo, muestras },
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
