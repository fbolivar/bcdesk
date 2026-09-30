import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { cleanPdfText as clean, hexToRgbPdf as hexToRgb } from '@/lib/pdf/text'
import type { Brand } from '@/lib/email/branding'
import { embedLogo } from '@/lib/pdf/logo'

export type EndpointStat = {
  name: string
  os: string | null          // etiqueta amigable del SO (p. ej. "Windows 11", "Windows 10")
  online: boolean
  samples: number
  cpuAvg: number | null; cpuMax: number | null
  ramAvg: number | null; ramMax: number | null
  diskAvg: number | null; diskMin: number | null // disco LIBRE (avg y mínimo)
  lastSeen: string | null
}
export type ClientGroup = { org: string; endpoints: EndpointStat[] }

/** Equipo candidato a repotenciación (ampliar/renovar hardware o SO). */
export type UpgradeItem = {
  name: string
  org: string
  priority: 'alta' | 'media'
  reasons: string[]
  action: string
}
/** Métricas agregadas de una ventana (mes), para el comparativo. */
export type PeriodMetrics = {
  uptime: number | null      // disponibilidad %
  incidents: number          // tickets generados por RMM
  mttr: number | null        // horas promedio de resolución
  enRiesgo: number
}
export type TopIncident = { name: string; org: string; incidents: number }

export type RmmReport = {
  orgLabel: string
  monthLabel: string
  verdict: { level: 'verde' | 'amarillo' | 'rojo'; text: string }
  summary: {
    equipos: number; online: number; offline: number
    cpuAvg: number | null; ramAvg: number | null; diskAvg: number | null
    enRiesgo: number; muestras: number
    uptime: number | null; incidents: number; mttr: number | null
    aRepotenciar: number; soObsoleto: number
  }
  comparison: { current: PeriodMetrics; previous: PeriodMetrics }
  upgrades: UpgradeItem[]
  topIncidents: TopIncident[]
  analysis: string
  clients: ClientGroup[]
  recommendations: string[]
}

const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(Number(v))}%`)
const hrs = (v: number | null | undefined) => (v == null ? '—' : `${Number(v).toFixed(1)} h`)
function rel(iso: string | null): string {
  if (!iso) return 'nunca'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'hace segundos'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return `hace ${Math.floor(s / 86400)} d`
}

export async function buildRmmReportPdf(brand: Brand, d: RmmReport): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const PW = 595.28, PH = 841.89, M = 42
  const dark = rgb(0.13, 0.17, 0.23)
  const gray = rgb(0.42, 0.47, 0.53)
  const faint = rgb(0.62, 0.66, 0.71)
  const hairline = rgb(0.88, 0.9, 0.93)
  const zebra = rgb(0.975, 0.98, 0.985)
  const headFill = rgb(0.955, 0.965, 0.975)
  const green = rgb(0.06, 0.72, 0.51)
  const amber = rgb(0.85, 0.5, 0.05)
  const red = rgb(0.94, 0.27, 0.27)
  const greenBg = rgb(0.90, 0.97, 0.94)
  const amberBg = rgb(0.99, 0.96, 0.89)
  const redBg = rgb(0.99, 0.92, 0.92)
  const accent = hexToRgb(brand.color)
  const cw = PW - 2 * M

  let page: PDFPage = doc.addPage([PW, PH])
  let y = PH - M
  const ensure = (h: number) => { if (y - h < M + 16) { page = doc.addPage([PW, PH]); y = PH - M } }
  const T = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color: RGB = dark) => page.drawText(clean(s), { x, y: yy, size, font: f, color })
  const R = (s: string, xr: number, yy: number, size: number, f: PDFFont = font, color: RGB = dark) => { const c = clean(s); page.drawText(c, { x: xr - f.widthOfTextAtSize(c, size), y: yy, size, font: f, color }) }
  const wrap = (s: string, size: number, maxW: number, f: PDFFont = font): string[] => {
    const out: string[] = []
    for (const para of clean(s).split('\n')) {
      let ln = ''
      for (const w of para.split(' ')) {
        const test = ln ? ln + ' ' + w : w
        if (f.widthOfTextAtSize(test, size) > maxW) { if (ln) out.push(ln); ln = w } else ln = test
      }
      out.push(ln)
    }
    return out
  }
  const section = (title: string, size = 11) => {
    ensure(24)
    page.drawRectangle({ x: M, y: y - 2, width: 3, height: size - 0.5, color: accent })
    T(title, M + 9, y, size, bold, dark); y -= size + 7
  }

  // Color de una métrica según umbral. free=true → valores BAJOS son malos (disco libre).
  const tone = (v: number | null, warn: number, bad: number, free = false): RGB => {
    if (v == null) return dark
    if (free) return v <= bad ? red : v <= warn ? amber : dark
    return v >= bad ? red : v >= warn ? amber : dark
  }

  // ── Encabezado ──
  const logo = await embedLogo(doc, brand.logoUrl)
  const top = PH - M
  let hx = M
  if (logo) { const lh = 34, lw = (logo.width / logo.height) * lh; page.drawImage(logo, { x: M, y: top - lh, width: lw, height: lh }); hx = M + lw + 14 }
  T(brand.name, hx, top - 14, 16, bold, dark)
  T('REPORTE MENSUAL DE COMPORTAMIENTO - RMM', hx, top - 28, 8.5, font, gray)
  R(d.monthLabel, PW - M, top - 14, 9.5, font, gray)
  R(d.orgLabel, PW - M, top - 26, 7.5, font, faint)
  y = top - 44
  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1.4, color: accent })
  y -= 18

  // ── Resumen ejecutivo (semáforo) ──
  const vc = d.verdict.level === 'verde' ? green : d.verdict.level === 'amarillo' ? amber : red
  const vbg = d.verdict.level === 'verde' ? greenBg : d.verdict.level === 'amarillo' ? amberBg : redBg
  const vlabel = d.verdict.level === 'verde' ? 'SALUDABLE' : d.verdict.level === 'amarillo' ? 'EN OBSERVACION' : 'REQUIERE ACCION'
  const vLines = wrap(d.verdict.text, 9, cw - 130)
  const vboxH = Math.max(42, 16 + vLines.length * 12)
  page.drawRectangle({ x: M, y: y - vboxH, width: cw, height: vboxH, color: vbg })
  page.drawRectangle({ x: M, y: y - vboxH, width: 4, height: vboxH, color: vc })
  T('ESTADO GENERAL DE LA FLOTA', M + 14, y - 14, 7, font, gray)
  T(vlabel, M + 14, y - 30, 14, bold, vc)
  let vy = y - 13
  for (const ln of vLines) { T(ln, M + 150, vy, 9, font, dark); vy -= 12 }
  y -= vboxH + 16

  // ── Indicadores clave (dos filas de 6) ──
  const drawKpis = (kpis: { label: string; value: string; color?: RGB }[]) => {
    const cols = 6, gap = 8, bw = (cw - gap * (cols - 1)) / cols, bh = 48
    ensure(bh + 6)
    kpis.forEach((kp, i) => {
      const x = M + i * (bw + gap), yy = y - bh
      page.drawRectangle({ x, y: yy, width: bw, height: bh, color: rgb(0.985, 0.99, 0.995), borderColor: hairline, borderWidth: 0.7 })
      page.drawRectangle({ x, y: yy, width: 3, height: bh, color: accent })
      for (const ln of wrap(kp.label, 6, bw - 12).slice(0, 2)) { T(ln, x + 7, yy + bh - 12, 6, font, gray) }
      T(kp.value, x + 7, yy + 11, 14, bold, kp.color ?? dark)
    })
    y -= bh + 8
  }
  drawKpis([
    { label: 'EQUIPOS', value: String(d.summary.equipos) },
    { label: 'EN LINEA', value: `${d.summary.online}/${d.summary.equipos}`, color: green },
    { label: 'DISPONIBILIDAD', value: pct(d.summary.uptime), color: tone(d.summary.uptime, 95, 90, true) },
    { label: 'INCIDENTES', value: String(d.summary.incidents), color: d.summary.incidents > 0 ? amber : green },
    { label: 'MTTR', value: hrs(d.summary.mttr) },
    { label: 'EN RIESGO', value: String(d.summary.enRiesgo), color: d.summary.enRiesgo > 0 ? red : green },
  ])
  drawKpis([
    { label: 'CPU PROM.', value: pct(d.summary.cpuAvg), color: tone(d.summary.cpuAvg, 60, 80) },
    { label: 'RAM PROM.', value: pct(d.summary.ramAvg), color: tone(d.summary.ramAvg, 70, 85) },
    { label: 'DISCO LIBRE', value: pct(d.summary.diskAvg), color: tone(d.summary.diskAvg, 25, 15, true) },
    { label: 'A REPOTENCIAR', value: String(d.summary.aRepotenciar), color: d.summary.aRepotenciar > 0 ? amber : green },
    { label: 'SO SIN SOPORTE', value: String(d.summary.soObsoleto), color: d.summary.soObsoleto > 0 ? red : green },
    { label: 'MUESTRAS', value: d.summary.muestras.toLocaleString('es-CO') },
  ])
  y -= 8

  // ── Comparativo mes actual vs anterior ──
  section('COMPARATIVO CON EL MES ANTERIOR')
  {
    const rows: { label: string; cur: string; prev: string; better: 'up' | 'down' }[] = [
      { label: 'Disponibilidad (uptime)', cur: pct(d.comparison.current.uptime), prev: pct(d.comparison.previous.uptime), better: 'up' },
      { label: 'Incidentes RMM', cur: String(d.comparison.current.incidents), prev: String(d.comparison.previous.incidents), better: 'down' },
      { label: 'MTTR (horas)', cur: hrs(d.comparison.current.mttr), prev: hrs(d.comparison.previous.mttr), better: 'down' },
      { label: 'Equipos en riesgo', cur: String(d.comparison.current.enRiesgo), prev: String(d.comparison.previous.enRiesgo), better: 'down' },
    ]
    const c1 = cw * 0.46, c2 = cw * 0.18, c3 = cw * 0.18, c4 = cw * 0.18
    ensure(16)
    page.drawRectangle({ x: M, y: y - 4, width: cw, height: 16, color: headFill })
    T('Indicador', M + 6, y, 7.5, bold, gray)
    T('Mes actual', M + c1 + 6, y, 7.5, bold, gray)
    T('Mes anterior', M + c1 + c2 + 6, y, 7.5, bold, gray)
    T('Tendencia', M + c1 + c2 + c3 + 6, y, 7.5, bold, gray)
    y -= 19
    const num = (s: string) => { const m = s.match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null }
    rows.forEach((r, i) => {
      ensure(15)
      if (i % 2 === 1) page.drawRectangle({ x: M, y: y - 4, width: cw, height: 15, color: zebra })
      T(r.label, M + 6, y, 8.5, font, dark)
      T(r.cur, M + c1 + 6, y, 8.5, bold, dark)
      T(r.prev, M + c1 + c2 + 6, y, 8.5, font, gray)
      const a = num(r.cur), b = num(r.prev)
      let trend = 'sin cambio', tcol = gray
      if (a != null && b != null) {
        if (a === b) { trend = 'igual'; tcol = gray }
        else {
          const improved = r.better === 'up' ? a > b : a < b
          const delta = Math.abs(a - b)
          trend = `${a > b ? '+' : '-'}${delta % 1 === 0 ? delta : delta.toFixed(1)} ${improved ? '(mejora)' : '(empeora)'}`
          tcol = improved ? green : red
        }
      }
      T(trend, M + c1 + c2 + c3 + 6, y, 8, font, tcol)
      y -= 15
    })
    y -= 12
  }

  // ── Equipos que requieren repotenciación ──
  section('EQUIPOS QUE REQUIEREN REPOTENCIACION')
  if (d.upgrades.length === 0) {
    T('Ningun equipo requiere ampliacion o renovacion de hardware/SO en el periodo.', M + 4, y, 9, font, green); y -= 16
  } else {
    T('Priorizados de mayor a menor urgencia. La prioridad ALTA implica riesgo operativo o de seguridad.', M, y, 8, font, gray); y -= 15
    const ordered = [...d.upgrades].sort((a, b) => (a.priority === b.priority ? a.org.localeCompare(b.org) : a.priority === 'alta' ? -1 : 1))
    for (const u of ordered) {
      const reasonLines = u.reasons.flatMap(r => wrap(`• ${r}`, 8.5, cw - 90))
      const actionLines = wrap(`Accion: ${u.action}`, 8.5, cw - 90)
      const blockH = 16 + reasonLines.length * 11 + actionLines.length * 11 + 8
      ensure(blockH)
      const pc = u.priority === 'alta' ? red : amber
      const pbg = u.priority === 'alta' ? redBg : amberBg
      // Encabezado del equipo con badge de prioridad
      T(`${u.name}`, M, y, 10, bold, dark)
      T(`· ${u.org}`, M + bold.widthOfTextAtSize(clean(u.name), 10) + 6, y, 8.5, font, gray)
      const badge = u.priority === 'alta' ? 'PRIORIDAD ALTA' : 'PRIORIDAD MEDIA'
      const bwd = bold.widthOfTextAtSize(badge, 6.5) + 12
      page.drawRectangle({ x: PW - M - bwd, y: y - 3, width: bwd, height: 13, color: pbg })
      T(badge, PW - M - bwd + 6, y, 6.5, bold, pc)
      y -= 15
      for (const ln of reasonLines) { T(ln, M + 6, y, 8.5, font, dark); y -= 11 }
      for (const ln of actionLines) { T(ln, M + 6, y, 8.5, font, accent); y -= 11 }
      y -= 8
    }
  }
  y -= 4

  // ── Top equipos por incidentes ──
  if (d.topIncidents.length > 0) {
    section('EQUIPOS CON MAS INCIDENTES')
    d.topIncidents.forEach((t, i) => {
      ensure(13)
      T(`${i + 1}. ${t.name} · ${t.org}`, M + 4, y, 9, font, dark)
      R(`${t.incidents} incidente(s)`, PW - M, y, 9, bold, amber)
      y -= 14
    })
    y -= 6
  }

  // ── Análisis general ──
  section('ANALISIS GENERAL', 9)
  for (const ln of wrap(d.analysis, 9, cw)) { ensure(13); T(ln, M, y, 9, font, gray); y -= 12 }
  y -= 10

  // ── Comportamiento por equipo, agrupado por cliente ──
  section('COMPORTAMIENTO POR EQUIPO')
  const CW = [cw * 0.28, cw * 0.12, cw * 0.15, cw * 0.15, cw * 0.16, cw * 0.14]
  const heads = ['Equipo', 'Estado', 'CPU pr/mx', 'RAM pr/mx', 'Disco pr/mn', 'Visto']
  const drawHead = () => {
    page.drawRectangle({ x: M, y: y - 4, width: cw, height: 16, color: headFill })
    let cx = M
    heads.forEach((h, i) => { T(h, cx + 6, y, 7.5, bold, gray); cx += CW[i] })
    page.drawLine({ start: { x: M, y: y - 5 }, end: { x: PW - M, y: y - 5 }, thickness: 0.8, color: hairline })
    y -= 19
  }
  if (d.clients.length === 0) {
    T('Sin equipos monitoreados en el periodo.', M + 4, y, 9, font, faint); y -= 14
  }
  for (const g of d.clients) {
    ensure(40)
    T(`Cliente: ${g.org}`, M, y, 9.5, bold, accent); y -= 14
    drawHead()
    g.endpoints.forEach((e, ri) => {
      ensure(15)
      if (y === PH - M) drawHead()
      if (ri % 2 === 1) page.drawRectangle({ x: M, y: y - 4, width: cw, height: 15, color: zebra })
      let x = M
      T(String(e.name).slice(0, 26), x + 6, y, 8.5, font, dark); x += CW[0]
      if (e.online) T('En linea', x + 6, y, 8, font, green)
      else T('Fuera', x + 6, y, 8, font, gray)
      x += CW[1]
      T(`${pct(e.cpuAvg)}/${pct(e.cpuMax)}`, x + 6, y, 8.5, font, tone(e.cpuAvg, 60, 80)); x += CW[2]
      T(`${pct(e.ramAvg)}/${pct(e.ramMax)}`, x + 6, y, 8.5, font, tone(e.ramAvg, 70, 85)); x += CW[3]
      T(`${pct(e.diskAvg)}/${pct(e.diskMin)}`, x + 6, y, 8.5, font, tone(e.diskAvg, 25, 15, true)); x += CW[4]
      T(rel(e.lastSeen), x + 6, y, 7.5, font, gray)
      y -= 15
    })
    if (g.endpoints.some(e => e.samples === 0)) {
      ensure(12); T('Nota: equipos en 0% sin muestras = agente detenido o equipo apagado en el periodo.', M + 4, y, 6.5, font, faint); y -= 12
    }
    y -= 10
  }

  // ── Recomendaciones ──
  y -= 2
  section('ANALISIS Y RECOMENDACIONES')
  d.recommendations.forEach(rectxt => {
    const lines = wrap(rectxt, 9, cw - 14)
    ensure(lines.length * 12 + 4)
    page.drawCircle({ x: M + 3, y: y + 3, size: 1.5, color: accent })
    lines.forEach((ln, i) => { T(ln, M + 12, y, 9, font, dark); if (i < lines.length - 1) y -= 12 })
    y -= 15
  })

  // ── Pie ──
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 34 }, end: { x: PW - M, y: 34 }, thickness: 0.6, color: hairline })
    p.drawText(clean(`${brand.name}  -  Reporte de monitoreo RMM  -  ${d.monthLabel}`), { x: M, y: 22, size: 7.5, font, color: gray })
    const rt = clean(`Pagina ${i + 1} de ${pages.length}`)
    p.drawText(rt, { x: PW - M - font.widthOfTextAtSize(rt, 7.5), y: 22, size: 7.5, font, color: faint })
  })

  return Buffer.from(await doc.save())
}
