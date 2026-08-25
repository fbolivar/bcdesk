import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { cleanPdfText as clean, hexToRgbPdf as hexToRgb } from '@/lib/pdf/text'
import type { Brand } from '@/lib/email/branding'
import { embedLogo } from '@/lib/pdf/logo'

export type EndpointStat = {
  name: string
  os: string | null
  online: boolean
  samples: number
  cpuAvg: number | null; cpuMax: number | null
  ramAvg: number | null; ramMax: number | null
  diskAvg: number | null; diskMin: number | null // disco LIBRE (avg y mínimo)
  lastSeen: string | null
}
export type ClientGroup = { org: string; endpoints: EndpointStat[] }
export type RmmReport = {
  orgLabel: string
  monthLabel: string
  summary: {
    equipos: number; online: number; offline: number
    cpuAvg: number | null; ramAvg: number | null; diskAvg: number | null
    enRiesgo: number; muestras: number
  }
  analysis: string
  clients: ClientGroup[]
  recommendations: string[]
}

const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(Number(v))}%`)
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
  y -= 22

  // ── Resumen de la flota ──
  const kpis: { label: string; value: string; color?: RGB }[] = [
    { label: 'EQUIPOS', value: String(d.summary.equipos) },
    { label: 'EN LINEA', value: `${d.summary.online}/${d.summary.equipos}`, color: green },
    { label: 'CPU PROM.', value: pct(d.summary.cpuAvg), color: tone(d.summary.cpuAvg, 60, 80) },
    { label: 'RAM PROM.', value: pct(d.summary.ramAvg), color: tone(d.summary.ramAvg, 70, 85) },
    { label: 'DISCO LIBRE', value: pct(d.summary.diskAvg), color: tone(d.summary.diskAvg, 25, 15, true) },
    { label: 'EN RIESGO', value: String(d.summary.enRiesgo), color: d.summary.enRiesgo > 0 ? red : green },
  ]
  const cols = 6, gap = 8, bw = (cw - gap * (cols - 1)) / cols, bh = 50
  kpis.forEach((kp, i) => {
    const x = M + i * (bw + gap), yy = y - bh
    page.drawRectangle({ x, y: yy, width: bw, height: bh, color: rgb(0.985, 0.99, 0.995), borderColor: hairline, borderWidth: 0.7 })
    page.drawRectangle({ x, y: yy, width: 3, height: bh, color: accent })
    T(kp.label, x + 7, yy + bh - 13, 6, font, gray)
    T(kp.value, x + 7, yy + 12, 15, bold, kp.color ?? dark)
  })
  y -= bh + 16

  // ── Análisis general ──
  ensure(30)
  page.drawRectangle({ x: M, y: y - 4, width: 3, height: 11, color: accent })
  T('ANALISIS GENERAL', M + 9, y, 9, bold, dark); y -= 15
  for (const ln of wrap(d.analysis, 9, cw)) { ensure(13); T(ln, M, y, 9, font, gray); y -= 12 }
  y -= 10

  // ── Comportamiento por equipo, agrupado por cliente ──
  ensure(20)
  page.drawRectangle({ x: M, y: y - 2, width: 3, height: 11, color: accent })
  T('COMPORTAMIENTO POR EQUIPO', M + 9, y, 11, bold, dark); y -= 18

  // Columnas: Equipo | Estado | CPU p/m | RAM p/m | Disco libre p/m | Visto
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
    // Título del cliente
    T(`Cliente: ${g.org}`, M, y, 9.5, bold, accent); y -= 14
    drawHead()
    g.endpoints.forEach((e, ri) => {
      ensure(15)
      if (y === PH - M) drawHead() // nueva página: repetir cabecera
      if (ri % 2 === 1) page.drawRectangle({ x: M, y: y - 4, width: cw, height: 15, color: zebra })
      let x = M
      // Equipo
      T(String(e.name).slice(0, 26), x + 6, y, 8.5, font, dark); x += CW[0]
      // Estado
      if (e.online) T('En linea', x + 6, y, 8, font, green)
      else T('Fuera', x + 6, y, 8, font, gray)
      x += CW[1]
      // CPU prom/max
      T(`${pct(e.cpuAvg)}/${pct(e.cpuMax)}`, x + 6, y, 8.5, font, tone(e.cpuAvg, 60, 80)); x += CW[2]
      // RAM prom/max
      T(`${pct(e.ramAvg)}/${pct(e.ramMax)}`, x + 6, y, 8.5, font, tone(e.ramAvg, 70, 85)); x += CW[3]
      // Disco libre prom/min
      T(`${pct(e.diskAvg)}/${pct(e.diskMin)}`, x + 6, y, 8.5, font, tone(e.diskAvg, 25, 15, true)); x += CW[4]
      // Visto
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
  ensure(26)
  page.drawRectangle({ x: M, y: y - 2, width: 3, height: 11, color: accent })
  T('ANALISIS Y RECOMENDACIONES', M + 9, y, 11, bold, dark); y -= 18
  d.recommendations.forEach(rectxt => {
    const lines = wrap(rectxt, 9, cw - 14)
    ensure(lines.length * 12 + 4)
    // viñeta
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
